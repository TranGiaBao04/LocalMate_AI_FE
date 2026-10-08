import { createContext, useContext, useEffect, useRef, useState } from "react";
import { STORAGE_KEYS } from "../constants";
import { tripService } from "../services/tripService";
import { useAuth } from "./AuthContext";
import { useNotifications } from "./NotificationContext";

const TripContext = createContext(null);

export function TripProvider({ children }) {
  const { isLoggedIn, isDemo } = useAuth();
  const { refreshUnreadCount } = useNotifications();
  const [request, setRequestState] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.TRIP_REQUEST);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [currentTrip, setCurrentTripState] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.TRIP_DRAFT);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [savedTrips, setSavedTrips] = useState([]);
  const [tripsLoading, setTripsLoading] = useState(false);
  const [tripsLoaded, setTripsLoaded] = useState(false);
  const [tripsError, setTripsError] = useState(false);
  const [tripsReloadKey, setTripsReloadKey] = useState(0);
  // Lần gọi AI viết lý do đang chờ, theo tripId. Giữ ở context để rời trang Nháp rồi quay lại vẫn biết đang chờ.
  const explainRequests = useRef(new Map());
  const [explainingTripIds, setExplainingTripIds] = useState([]);

  useEffect(() => {
    let active = true;
    if (!isLoggedIn || isDemo) {
      queueMicrotask(() => {
        if (!active) return;
        setSavedTrips([]);
        setTripsLoading(false);
        setTripsLoaded(false);
        setTripsError(false);
      });
      return () => { active = false; };
    }
    queueMicrotask(() => {
      if (!active) return;
      setTripsLoading(true);
      setTripsLoaded(false);
      setTripsError(false);
    });
    tripService
      .getTrips()
      .then((trips) => {
        if (active) setSavedTrips(trips);
      })
      .catch(() => {
        if (active) setTripsError(true);
      })
      .finally(() => {
        if (active) setTripsLoading(false);
        if (active) setTripsLoaded(true);
      });
    return () => { active = false; };
  }, [isLoggedIn, isDemo, tripsReloadKey]);

  const setRequest = (r) => {
    setRequestState(r);
    localStorage.setItem(STORAGE_KEYS.TRIP_REQUEST, JSON.stringify(r));
  };

  const setCurrentTrip = (t) => {
    setCurrentTripState(t);
    if (t) localStorage.setItem(STORAGE_KEYS.TRIP_DRAFT, JSON.stringify(t));
    else localStorage.removeItem(STORAGE_KEYS.TRIP_DRAFT);
  };

  const upsertSavedTrip = (trip) => {
    setSavedTrips((prev) => {
      const existing = prev.findIndex((t) => t.id === trip.id);
      if (existing >= 0) {
        return prev.map((t) => (t.id === trip.id ? trip : t));
      }
      return [trip, ...prev];
    });
  };

  // Cập nhật trip mới nhất từ server vào currentTrip; chỉ cập nhật savedTrips nếu trip đã có sẵn trong đó
  const syncTrip = (trip) => {
    if (currentTrip?.id === trip.id) setCurrentTrip(trip);
    setSavedTrips((prev) => prev.map((t) => (t.id === trip.id ? trip : t)));
    return trip;
  };

  const refreshTrip = async (tripId) =>
    syncTrip(await tripService.getTripById(tripId));

  const fetchTrip = async (tripId) => {
    const trip = await tripService.getTripById(tripId);
    upsertSavedTrip(trip);
    return trip;
  };

  const generateTrip = async (req) => tripService.generateTrip(req);

  // AI chỉ đổi câu lý do. Gọi lại GET /trips/{id} để không ghi đè thay đổi người dùng làm trong lúc chờ.
  // Mỗi trip chỉ một lần gọi cùng lúc: BE tính lần đang chờ là 1 lượt của trip, lần gọi chồng lên sẽ nhận
  // 429 ai_trip_limit_reached dù trip chưa hết lượt. Gọi lại khi đang chờ thì nhận đúng promise cũ.
  const explainTrip = (tripId) => {
    const pending = explainRequests.current.get(tripId);
    if (pending) return pending;
    const request = (async () => {
      try {
        await tripService.explainTrip(tripId);
        return await refreshTrip(tripId);
      } finally {
        explainRequests.current.delete(tripId);
        setExplainingTripIds((ids) => ids.filter((id) => id !== tripId));
      }
    })();
    explainRequests.current.set(tripId, request);
    setExplainingTripIds((ids) => [...ids, tripId]);
    return request;
  };

  const saveTrip = async (trip) => {
    const saved = await tripService.saveTrip(trip.id);
    if (currentTrip?.id === saved.id) setCurrentTrip(saved);
    upsertSavedTrip(saved);
    return saved;
  };

  const deleteTrip = async (id) => {
    await tripService.deleteTrip(id);
    setSavedTrips((prev) => prev.filter((t) => t.id !== id));
  };

  const finalizeTrip = async (tripId, funding = null) => {
    const updated = await tripService.finalizeTrip(tripId, funding);
    syncTrip(updated);
    upsertSavedTrip(updated);
    // BE tạo thông báo "đã chốt lịch trình"
    refreshUnreadCount();
    return updated;
  };

  const replaceItem = async (tripId, itemId, newPlaceId) => {
    const result = await tripService.replaceItem(tripId, itemId, newPlaceId);
    await refreshTrip(tripId);
    return result;
  };

  const deleteItem = async (tripId, itemId) => {
    await tripService.deleteItem(tripId, itemId);
    const updated = await refreshTrip(tripId);
    return updated.items;
  };

  const markVisited = async (tripId, itemId) => {
    await tripService.markVisited(itemId);
    return refreshTrip(tripId);
  };

  return (
    <TripContext.Provider
      value={{
        request,
        setRequest,
        currentTrip,
        setCurrentTrip,
        savedTrips,
        tripsLoading,
        tripsLoaded,
        tripsError,
        retryTrips: () => setTripsReloadKey((key) => key + 1),
        saveTrip,
        deleteTrip,
        generateTrip,
        explainTrip,
        explainingTripIds,
        finalizeTrip,
        replaceItem,
        deleteItem,
        markVisited,
        fetchTrip,
      }}
    >
      {children}
    </TripContext.Provider>
  );
}

export function useTrip() {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error("useTrip must be used within TripProvider");
  return ctx;
}
