import { apiClient } from "../api/apiClient";
import { mapMyTrip, mapTrip } from "../utils/tripMapper";

// Request wizard -> TripRequestDto của BE. budgetMax là ngân sách MỘT NGƯỜI (VNĐ), không nhân số người.
// budgetMin BE chưa dùng nên gửi 0. BE không nhận peopleCount/timeOfDay.
export function toTripRequestDto({
  startLatitude,
  startLongitude,
  startStationOrder,
  destinationStationOrder,
  durationHours,
  budgetMaxPerPerson,
  tagIds,
  travelMode,
  plannedDate,
  startTime,
  note,
}) {
  return {
    // Điểm xuất phát: đúng MỘT trong hai, ga (order 1–14) hoặc cặp toạ độ. Gửi cả hai BE trả 400.
    ...(startStationOrder != null
      ? { startStationOrder }
      : { startLatitude, startLongitude }),
    // Ga muốn chơi quanh đó (order 1–14). Bỏ trống = quanh ga gần điểm xuất phát.
    ...(destinationStationOrder != null && { destinationStationOrder }),
    durationHours,
    budgetMin: 0,
    budgetMax: budgetMaxPerPerson,
    tagIds,
    // "yyyy-MM-dd" giờ VN, bỏ trống = hôm nay
    ...(plannedDate && { plannedDate }),
    // "HH:mm" giờ VN, luôn gửi (bỏ trống BE dùng 08:00, lịch có thể bắt đầu ở quá khứ)
    startTime: `${startTime}:00`,
    // "Auto" (mặc định BE) | "Walking" | "Motorbike" | "Metro"
    ...(travelMode && { travelMode }),
    // Ghi chú tự do (tối đa 300 ký tự), chỉ để ưu tiên địa điểm hợp ý. Rỗng thì không gửi.
    ...(note?.trim() && { note: note.trim() }),
  };
}

// Trip (đã qua mapTrip) -> `base` của parse-request: tiêu chí của lịch người dùng đang xem
export function toParseBase(trip) {
  return {
    durationHours: trip.durationHours,
    budgetMax: trip.budgetMax,
    tagIds: trip.tagIds ?? [],
    travelMode: trip.travelMode ?? null,
    startStationOrder: trip.startStation?.order ?? null,
    destinationStationOrder: trip.destinationStation?.order ?? null,
    plannedDate: trip.plannedDate ?? null,
    startTime: trip.startTime ? `${trip.startTime}:00` : null,
    note: trip.note ?? null,
  };
}

const getTripById = async (tripId) =>
  mapTrip(await apiClient.get(`/trips/${tripId}`));

export const tripService = {
  // { isFeasible, reason, nearestStation (ga lên), anchorStation: { order, name } (ga lấy địa điểm quanh đó),
  //   suggestedStations: [{ order, name, placeCount }] (chỉ có khi reason = InsufficientCandidates),
  //   durationCategory, budgetTier, estimatedStopCount, candidatePlaceCount }
  checkFeasibility: (dto) =>
    apiClient.post("/trips/feasibility-check", dto, { auth: false }),

  // 201 TripDetailResponse: trip nháp đã lưu (có id)
  generateTrip: async (dto) =>
    mapTrip(await apiClient.post("/trips/generate", dto)),

  // AI viết lại câu lý do cho từng chặng của trip nháp, không đổi địa điểm/giờ/chi phí.
  // { items: [{ itemId, placeId, reasoning }], aiExplainedAt }
  explainTrip: (tripId) => apiClient.post(`/trips/${tripId}/explanations`),

  // AI đọc câu người dùng gõ thành tiêu chí tạo lịch, không tạo lịch. Có base thì câu được hiểu là
  // yêu cầu THAY ĐỔI so với lịch đó và fields là bộ tiêu chí đầy đủ sau khi ghép.
  // { isTripRequest, message, fields: { durationHours, budgetMax, tagIds, travelMode, startStationOrder,
  //   destinationStationOrder, plannedDate, startTime: "HH:mm:ss", note }, missing, changed }
  parseTripRequest: (text, base) =>
    apiClient.post("/trips/parse-request", { text, ...(base && { base }) }),

  getTrips: async () =>
    (await apiClient.get("/trips/my-trips")).map(mapMyTrip),
  getTripById,

  // save/finalize chỉ trả { tripId, status } nên gọi lại GET để lấy trip đầy đủ
  saveTrip: async (tripId) => {
    await apiClient.post("/trips/save", { tripId });
    return getTripById(tripId);
  },
  finalizeTrip: async (tripId, funding = null) => {
    const input = funding == null
      ? { fundingSource: "Normal" }
      : typeof funding === "string" ? { fundingSource: funding } : funding;
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new TypeError("Nguồn chốt lịch trình không hợp lệ.");
    }
    let body;
    if (input.fundingSource === "Normal" && !("entitlementId" in input)) {
      body = { fundingSource: "Normal" };
    } else if (input.fundingSource === "SingleEntitlement" &&
      typeof input.entitlementId === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.entitlementId) &&
      input.entitlementId !== "00000000-0000-0000-0000-000000000000") {
      body = { fundingSource: "SingleEntitlement", entitlementId: input.entitlementId };
    } else {
      throw new TypeError("Cần chọn rõ Normal hoặc SingleEntitlement cùng quyền hợp lệ.");
    }
    await apiClient.post(`/trips/${tripId}/finalize`, body);
    return getTripById(tripId);
  },
  deleteTrip: (tripId) => apiClient.delete(`/trips/${tripId}`),

  getItemAlternatives: (tripId, itemId, limit) =>
    apiClient.get(
      `/trips/${tripId}/items/${itemId}/alternatives${limit ? `?limit=${limit}` : ""}`,
    ),
  // Trả { warnings, place, items, ... }. BE tính lại giờ mọi chặng; TripContext gọi lại GET /trips/{id} nên không dùng items.
  replaceItem: (tripId, itemId, newPlaceId) =>
    apiClient.put(`/trips/${tripId}/items/${itemId}/replace`, { newPlaceId }),
  deleteItem: (tripId, itemId) =>
    apiClient.delete(`/trips/${tripId}/items/${itemId}`),

  // BE không cần tripId ở path
  markVisited: (itemId) => apiClient.put(`/trips/items/${itemId}/visit`),
};
