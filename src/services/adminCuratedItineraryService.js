import { adminApiClient } from "../api/adminApiClient";

// Lịch trình mẫu trong Admin Portal, cần quyền ManagePlaces.
// Lịch: { id, title, description, coverImageUrl, estimatedDurationMinutes, estimatedCostMin, estimatedCostMax,
//   stationName, unavailablePlaceCount, items: [{ placeId, name, category, status, isDeleted, orderIndex,
//   estimatedCostMin, estimatedCostMax }], createdAt, updatedAt }.
// isDeleted = true: địa điểm đã xoá, phải bỏ khỏi lịch. false mà status khác Active: đang ẩn/chờ duyệt.
// Thời lượng và chi phí do BE tính lúc lưu (đổi giá/ẩn địa điểm sau đó thì phải lưu lại lịch mới cập nhật).
// Không có bản nháp: tạo/sửa có hiệu lực ngay trên app. Hai admin cùng sửa thì người lưu sau thắng.
// Mã lỗi: 400 invalid_curated_itinerary (errors: Title | Description | CoverImageUrl | PlaceIds),
// 400 invalid_curated_itinerary_query, 404 curated_itinerary_not_found.
export const adminCuratedItineraryService = {
  /**
   * PagedResult: { items, page, pageSize, totalCount, totalPages }
   * @param {Object} params page, pageSize (≤ 100), search (tìm không dấu theo tiêu đề),
   *   sortBy (updatedAt | createdAt | title), sortDirection
   */
  getItineraries: (params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.page != null) searchParams.append("page", params.page);
    if (params.pageSize != null) searchParams.append("pageSize", params.pageSize);
    if (params.sortBy) searchParams.append("sortBy", params.sortBy);
    if (params.sortDirection) searchParams.append("sortDirection", params.sortDirection);
    if (params.search?.trim()) searchParams.append("search", params.search.trim().slice(0, 100));
    const query = searchParams.toString();
    return adminApiClient.get(`/admin/curated-itineraries${query ? `?${query}` : ""}`);
  },
  getItinerary: (id) => adminApiClient.get(`/admin/curated-itineraries/${id}`),
  // payload: { title (≤ 200), description (≤ 1000, có thể null), coverImageUrl (có thể null),
  //   placeIds (2–10 địa điểm Active, thứ tự mảng là thứ tự đi) }
  createItinerary: (payload) => adminApiClient.post("/admin/curated-itineraries", payload),
  // Thay toàn bộ nội dung và danh sách chặng
  updateItinerary: (id, payload) => adminApiClient.put(`/admin/curated-itineraries/${id}`, payload),
  // 204, không khôi phục được
  deleteItinerary: (id) => adminApiClient.delete(`/admin/curated-itineraries/${id}`),
};
