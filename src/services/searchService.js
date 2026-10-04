import { apiClient } from "../api/apiClient";

export const searchService = {
  // Tìm ga, địa điểm, lịch trình mẫu theo từ khoá (2–100 ký tự), công khai.
  // Mỗi nhóm: { items, hasMore }.
  // { query,
  //   stations.items: [{ id, order, name, placeCount }],
  //   places.items: [{ id, name, address, category, imageUrl, estimatedCostMin, estimatedCostMax,
  //                    station: { order, name } | null, matchedOn: "Name" | "Tag" | "Address" }],
  //   curatedItineraries.items: [{ id, title, coverImageUrl, estimatedDurationMinutes,
  //                                estimatedCostMin, estimatedCostMax, stationName }] }
  search: (keyword) =>
    apiClient.get(`/search?q=${encodeURIComponent(keyword)}`, { auth: false }),
};
