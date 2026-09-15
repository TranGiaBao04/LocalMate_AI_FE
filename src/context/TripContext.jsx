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

  const generateTrip = async (req) => tripService.generateTrip(req);

  const saveTrip = async (trip) => {
    const saved = await tripService.saveTrip(trip);
    upsertSavedTrip(saved);
    return saved;
  };

  const deleteTrip = async (id) => {
    await tripService.deleteTrip(id);
    setSavedTrips((prev) => prev.filter((t) => t.id !== id));
  };

  const finalizeTrip = async (tripId) => {
    const updated = await tripService.finalizeTrip(tripId);
    if (currentTrip?.id === tripId) setCurrentTrip(updated);
    upsertSavedTrip(updated);
    return updated;
  };

  const replaceItem = async (tripId, itemId, newPlaceId) => {
    const updated = await tripService.replaceItem(tripId, itemId, newPlaceId);
    if (currentTrip?.id === tripId) setCurrentTrip(updated);
    upsertSavedTrip(updated);
    return updated;
  };

  const markVisited = async (tripId, itemId) => {
    const updated = await tripService.markVisited(tripId, itemId);
    if (currentTrip?.id === tripId) setCurrentTripState(updated);
    upsertSavedTrip(updated);
    return updated;
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
        markVisited,
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
