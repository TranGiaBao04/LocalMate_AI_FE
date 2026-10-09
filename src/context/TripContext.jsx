import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { STORAGE_KEYS } from "../constants";
import { tripService } from "../services/tripService";
import { useAuth } from "./AuthContext";
import { useNotifications } from "./NotificationContext";

const TripContext = createContext(null);

export function TripProvider({ children }) {
  const { user, isLoggedIn, isDemo, initializing } = useAuth();
  const owner = !initializing && isLoggedIn && user?.id
    ? `${isDemo ? "demo" : "user"}:${encodeURIComponent(user.id)}`
    : null;
  return (
    <OwnedTripProvider key={owner ?? "unavailable"} owner={owner} persisted={Boolean(owner) && !isDemo}>
      {children}
    </OwnedTripProvider>
  );
}

function OwnedTripProvider({ children, owner, persisted }) {
  const { refreshUnreadCount } = useNotifications();
  const scope = useRef({ active: true, generation: 0 });
  useLayoutEffect(() => {
    const lifetime = scope.current;
    lifetime.active = true;
    lifetime.generation += 1;
    return () => {
      lifetime.active = false;
      lifetime.generation += 1;
    };
  }, []);

  const assertActive = (generation = scope.current.generation) => {
    if (!owner || !scope.current.active || scope.current.generation !== generation) {
      const error = new Error("Phiên lịch trình đã thay đổi. Vui lòng thử lại trong tài khoản hiện tại.");
      error.code = "trip_session_changed";
      throw error;
    }
  };
  const ownedRequest = async (operation) => {
    const generation = scope.current.generation;
    assertActive(generation);
    try {
      const result = await operation();
      assertActive(generation);
      return result;
    } catch (error) {
      assertActive(generation);
      throw error;
    }
  };
  const storageKey = (key) => `${key}:owner:${owner?.slice("user:".length)}`;
  const readOwned = (key) => {
    if (!persisted) return null;
    try {
      const stored = localStorage.getItem(storageKey(key));
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  };
  const [request, setRequestState] = useState(() => {
    return readOwned(STORAGE_KEYS.TRIP_REQUEST);
  });
  const [currentTrip, setCurrentTripState] = useState(() => {
    return readOwned(STORAGE_KEYS.TRIP_DRAFT);
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
    if (!persisted) {
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
  }, [persisted, tripsReloadKey]);

  const setRequest = (r) => {
    assertActive();
    setRequestState(r);
    if (persisted) localStorage.setItem(storageKey(STORAGE_KEYS.TRIP_REQUEST), JSON.stringify(r));
  };

  const setCurrentTrip = (t) => {
    assertActive();
    setCurrentTripState(t);
    if (persisted) {
      if (t) localStorage.setItem(storageKey(STORAGE_KEYS.TRIP_DRAFT), JSON.stringify(t));
      else localStorage.removeItem(storageKey(STORAGE_KEYS.TRIP_DRAFT));
    }
  };

  const upsertSavedTrip = (trip) => {
    assertActive();
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
    assertActive();
    if (currentTrip?.id === trip.id) setCurrentTrip(trip);
    setSavedTrips((prev) => prev.map((t) => (t.id === trip.id ? trip : t)));
    return trip;
  };

  const refreshTrip = async (tripId) =>
    syncTrip(await ownedRequest(() => tripService.getTripById(tripId)));

  const fetchTrip = async (tripId) => {
    const trip = await ownedRequest(() => tripService.getTripById(tripId));
    upsertSavedTrip(trip);
    return trip;
  };

  const generateTrip = async (req) => ownedRequest(() => tripService.generateTrip(req));

  // AI chỉ đổi câu lý do. Gọi lại GET /trips/{id} để không ghi đè thay đổi người dùng làm trong lúc chờ.
  // Mỗi trip chỉ một lần gọi cùng lúc: BE tính lần đang chờ là 1 lượt của trip, lần gọi chồng lên sẽ nhận
  // 429 ai_trip_limit_reached dù trip chưa hết lượt. Gọi lại khi đang chờ thì nhận đúng promise cũ.
  const explainTrip = (tripId) => {
    assertActive();
    const generation = scope.current.generation;
    const pending = explainRequests.current.get(tripId);
    if (pending) return pending;
    const request = (async () => {
      try {
        await ownedRequest(() => tripService.explainTrip(tripId));
        return await refreshTrip(tripId);
      } finally {
        explainRequests.current.delete(tripId);
        if (scope.current.active && scope.current.generation === generation) {
          setExplainingTripIds((ids) => ids.filter((id) => id !== tripId));
        }
      }
    })();
    explainRequests.current.set(tripId, request);
    setExplainingTripIds((ids) => [...ids, tripId]);
    return request;
  };

  const saveTrip = async (trip) => {
    const saved = await ownedRequest(() => tripService.saveTrip(trip.id));
    if (currentTrip?.id === saved.id) setCurrentTrip(saved);
    upsertSavedTrip(saved);
    return saved;
  };

  const deleteTrip = async (id) => {
    await ownedRequest(() => tripService.deleteTrip(id));
    setSavedTrips((prev) => prev.filter((t) => t.id !== id));
  };

  const finalizeTrip = async (tripId, funding = null) => {
    const updated = await ownedRequest(() => tripService.finalizeTrip(tripId, funding));
    syncTrip(updated);
    upsertSavedTrip(updated);
    // BE tạo thông báo "đã chốt lịch trình"
    refreshUnreadCount();
    return updated;
  };

  const replaceItem = async (tripId, itemId, newPlaceId) => {
    const result = await ownedRequest(() => tripService.replaceItem(tripId, itemId, newPlaceId));
    await refreshTrip(tripId);
    return result;
  };

  const deleteItem = async (tripId, itemId) => {
    await ownedRequest(() => tripService.deleteItem(tripId, itemId));
    const updated = await refreshTrip(tripId);
    return updated.items;
  };

  const markVisited = async (tripId, itemId) => {
    await ownedRequest(() => tripService.markVisited(itemId));
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
