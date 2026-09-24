import { createContext, useContext, useEffect, useState } from "react";
import { STORAGE_KEYS } from "../constants";
import { tripService } from "../services/tripService";
import { useAuth } from "./AuthContext";

const TripContext = createContext(null);

export function TripProvider({ children }) {
  const { isLoggedIn } = useAuth();
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

  useEffect(() => {
    if (!isLoggedIn) return;
    tripService
      .getTrips()
      .then(setSavedTrips)
      .catch(() => setSavedTrips([]));
  }, [isLoggedIn]);

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

  const finalizeTrip = async (tripId) => {
    const updated = await tripService.finalizeTrip(tripId);
    syncTrip(updated);
    upsertSavedTrip(updated);
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
        saveTrip,
        deleteTrip,
        generateTrip,
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
