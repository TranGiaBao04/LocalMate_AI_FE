import { createContext, useContext, useState } from "react";
import { STORAGE_KEYS } from "../constants";
import { mockItineraries } from "../data/itineraries.mock";
import { mockPlaces } from "../data/places.mock";

const TripContext = createContext(null);

export function TripProvider({ children }) {
  const [request, setRequestState] = useState(null);
  const [currentTrip, setCurrentTripState] = useState(null);
  const [savedTrips, setSavedTrips] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SAVED_TRIPS);
      return stored ? JSON.parse(stored) : mockItineraries;
    } catch {
      return mockItineraries;
    }
  });

  const setRequest = (r) => {
    setRequestState(r);
    localStorage.setItem(STORAGE_KEYS.TRIP_REQUEST, JSON.stringify(r));
  };

  const setCurrentTrip = (t) => {
    setCurrentTripState(t);
    if (t) localStorage.setItem(STORAGE_KEYS.TRIP_DRAFT, JSON.stringify(t));
  };

  const persistTrips = (trips) => {
    setSavedTrips(trips);
    localStorage.setItem(STORAGE_KEYS.SAVED_TRIPS, JSON.stringify(trips));
  };

  const saveTrip = (trip) => {
    const existing = savedTrips.findIndex((t) => t.id === trip.id);
    let updated;
    if (existing >= 0) {
      updated = savedTrips.map((t) => (t.id === trip.id ? trip : t));
    } else {
      updated = [trip, ...savedTrips];
    }
    persistTrips(updated);
  };

  const deleteTrip = (id) => {
    persistTrips(savedTrips.filter((t) => t.id !== id));
  };

  const generateTrip = async (req) => {
    await new Promise((r) => setTimeout(r, 2500));

    let candidates = mockPlaces.filter((p) => p.isActive);

    if (req.interests.length > 0) {
      const scored = candidates
        .map((p) => ({
          place: p,
          score: p.tags.filter((t) => req.interests.includes(t)).length,
        }))
        .sort((a, b) => b.score - a.score);
      candidates = scored.map((s) => s.place);
    }

    if (req.budgetPerPerson < 999999) {
      candidates = candidates.filter(
        (p) => p.estimatedCostMin <= req.budgetPerPerson * 0.4,
      );
    }

    const maxItems =
      req.durationHours <= 2 ? 2 : req.durationHours <= 4 ? 4 : 5;
    const selected = candidates.slice(0, maxItems);

    let hour = 14;
    const items = selected.map((p, i) => {
      const timeStr = `${String(hour).padStart(2, "0")}:00`;
      hour += Math.ceil(p.suggestedDurationMinutes / 60) + 1;
      return {
        id: `item-${Date.now()}-${i}`,
        time: timeStr,
        placeId: p.id,
        placeName: p.name,
        placeCategory: p.category,
        durationMinutes: p.suggestedDurationMinutes,
        estimatedCost: Math.round(
          (p.estimatedCostMin + p.estimatedCostMax) / 2,
        ),
        reason: p.insights[0] ?? "Phù hợp với hành trình của bạn.",
        travelNote: p.nearestMetroStation
          ? `Gần ga ${p.nearestMetroStation}`
          : undefined,
      };
    });

    const totalBudget = items.reduce((s, i) => s + i.estimatedCost, 0);

    const trip = {
      id: `trip-${Date.now()}`,
      status: "draft",
      title: `Hành trình ${req.durationHours} tiếng – ${req.startArea}`,
      summary: `Lịch trình ${req.durationHours} giờ, ${req.peopleCount} người, dựa trên sở thích cá nhân.`,
      mainArea: req.startArea,
      durationHours: req.durationHours,
      estimatedBudget: totalBudget,
      intensity:
        req.durationHours <= 2 ? "Nhẹ" : req.durationHours <= 4 ? "Vừa" : "Dày",
      metroFriendly: req.metroFriendly,
      items,
      createdAt: new Date().toISOString(),
    };

    return trip;
  };

  const finalizeTrip = (tripId) => {
    const trip =
      currentTrip?.id === tripId
        ? currentTrip
        : savedTrips.find((t) => t.id === tripId);
    if (!trip) return;
    const updated = {
      ...trip,
      status: "finalized",
      finalizedAt: new Date().toISOString(),
    };
    setCurrentTrip(updated);
    saveTrip(updated);
  };

  const replaceItem = (tripId, itemId, newPlaceId) => {
    const trip =
      currentTrip?.id === tripId
        ? currentTrip
        : savedTrips.find((t) => t.id === tripId);
    if (!trip) return;
    const newPlace = mockPlaces.find((p) => p.id === newPlaceId);
    if (!newPlace) return;
    const updated = {
      ...trip,
      items: trip.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              placeId: newPlace.id,
              placeName: newPlace.name,
              placeCategory: newPlace.category,
              estimatedCost: Math.round(
                (newPlace.estimatedCostMin + newPlace.estimatedCostMax) / 2,
              ),
              durationMinutes: newPlace.suggestedDurationMinutes,
              reason: newPlace.insights[0] ?? "",
            }
          : item,
      ),
    };
    updated.estimatedBudget = updated.items.reduce(
      (s, i) => s + i.estimatedCost,
      0,
    );
    setCurrentTrip(updated);
    saveTrip(updated);
  };

  const markVisited = (tripId, itemId) => {
    const trip = savedTrips.find((t) => t.id === tripId) ?? currentTrip;
    if (!trip) return;
    const items = trip.items.map((i) =>
      i.id === itemId ? { ...i, isVisited: true } : i,
    );
    const updated = {
      ...trip,
      status: items.every((i) => i.isVisited) ? "completed" : trip.status,
      items,
    };
    if (currentTrip?.id === tripId) setCurrentTripState(updated);
    saveTrip(updated);
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
