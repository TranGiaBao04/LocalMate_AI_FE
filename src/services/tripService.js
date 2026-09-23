import { apiClient } from "../api/apiClient";

export const tripService = {
  generateTrip: (request) => apiClient.post("/trips/generate", request),
  getTrips: () => apiClient.get("/trips"),
  getTripById: (tripId) => apiClient.get(`/trips/${tripId}`),
  saveTrip: (trip) => apiClient.post("/trips", trip),
  finalizeTrip: (tripId) => apiClient.patch(`/trips/${tripId}/finalize`),
  deleteTrip: (tripId) => apiClient.delete(`/trips/${tripId}`),

  getItemAlternatives: (tripId, itemId, limit) =>
    apiClient.get(
      `/trips/${tripId}/items/${itemId}/alternatives${limit ? `?limit=${limit}` : ""}`,
    ),
  replaceItem: (tripId, itemId, newPlaceId) =>
    apiClient.put(`/trips/${tripId}/items/${itemId}/replace`, { newPlaceId }),
  deleteItem: (tripId, itemId) =>
    apiClient.delete(`/trips/${tripId}/items/${itemId}`),

  markVisited: (tripId, itemId) =>
    apiClient.patch(`/trips/${tripId}/items/${itemId}/visit`),
};
