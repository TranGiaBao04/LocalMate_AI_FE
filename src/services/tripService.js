import { apiClient } from "../api/apiClient";

export const tripService = {
  generateTrip: (request) => apiClient.post("/trips/generate", request),
  getTrips: () => apiClient.get("/trips"),
  getTripById: (tripId) => apiClient.get(`/trips/${tripId}`),
  saveTrip: (trip) => apiClient.post("/trips", trip),
  finalizeTrip: (tripId) => apiClient.patch(`/trips/${tripId}/finalize`),
  deleteTrip: (tripId) => apiClient.delete(`/trips/${tripId}`),
  replaceItem: (tripId, itemId, placeId) =>
    apiClient.patch(`/trips/${tripId}/items/${itemId}/replace`, { placeId }),
  markVisited: (tripId, itemId) =>
    apiClient.patch(`/trips/${tripId}/items/${itemId}/visit`),
};
