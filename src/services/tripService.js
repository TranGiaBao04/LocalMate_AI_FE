import { apiClient } from "../api/apiClient";
import { mapMyTrip, mapTrip } from "../utils/tripMapper";

// Request wizard -> TripRequestDto của BE. budgetMin/Max là TỔNG cả chuyến (VNĐ),
// nên nhân mức theo người với số người.
export function toTripRequestDto({
  startLatitude,
  startLongitude,
  durationHours,
  budgetMinPerPerson,
  budgetMaxPerPerson,
  peopleCount,
  tagIds,
}) {
  return {
    startLatitude,
    startLongitude,
    durationHours,
    budgetMin: budgetMinPerPerson * peopleCount,
    budgetMax: budgetMaxPerPerson * peopleCount,
    tagIds,
  };
}

const getTripById = async (tripId) =>
  mapTrip(await apiClient.get(`/trips/${tripId}`));

export const tripService = {
  // { isFeasible, reason, nearestStation, durationCategory, budgetTier, estimatedStopCount, candidatePlaceCount }
  checkFeasibility: (dto) =>
    apiClient.post("/trips/feasibility-check", dto, { auth: false }),

  // Chưa có endpoint tương ứng bên BE (BE-41, chờ LLM)
  generateTrip: (request) => apiClient.post("/trips/generate", request),

  getTrips: async () =>
    (await apiClient.get("/trips/my-trips")).map(mapMyTrip),
  getTripById,

  // save/finalize chỉ trả { tripId, status } nên gọi lại GET để lấy trip đầy đủ
  saveTrip: async (tripId) => {
    await apiClient.post("/trips/save", { tripId });
    return getTripById(tripId);
  },
  finalizeTrip: async (tripId) => {
    await apiClient.post(`/trips/${tripId}/finalize`);
    return getTripById(tripId);
  },
  deleteTrip: (tripId) => apiClient.delete(`/trips/${tripId}`),

  getItemAlternatives: (tripId, itemId, limit) =>
    apiClient.get(
      `/trips/${tripId}/items/${itemId}/alternatives${limit ? `?limit=${limit}` : ""}`,
    ),
  // Trả { warnings, place, ... }, giữ nguyên để hiển thị cảnh báo
  replaceItem: (tripId, itemId, newPlaceId) =>
    apiClient.put(`/trips/${tripId}/items/${itemId}/replace`, { newPlaceId }),
  deleteItem: (tripId, itemId) =>
    apiClient.delete(`/trips/${tripId}/items/${itemId}`),

  // BE không cần tripId ở path
  markVisited: (itemId) => apiClient.put(`/trips/items/${itemId}/visit`),
};
