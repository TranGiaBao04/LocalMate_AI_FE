import { adminApiClient } from "../api/adminApiClient";

// Phản hồi & đánh giá (chỉ xem), cần quyền ViewFeedback. Lỗi tham số: 400 invalid_admin_feedback_query.
const LIST_PARAMS = ["page", "pageSize", "sortBy", "sortDirection", "userId", "from", "to", "hasComment"];

function toQuery(params, keys) {
  const searchParams = new URLSearchParams();
  keys.forEach((key) => {
    const value = params[key];
    if (value !== undefined && value !== null && value !== "") searchParams.append(key, value);
  });
  if (params.search?.trim()) searchParams.append("search", params.search.trim().slice(0, 100));
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export const adminFeedbackService = {
  // from/to "yyyy-MM-dd" theo giờ VN, bỏ trống = 30 ngày gần nhất; luật giống API dashboard.
  // -> { from, to, reviews: { count, averageRating, ratings[5], quickTags[12] },
  //      tripFeedback: { count, quickTags[7] }, lowestRatedPlaces[≤5], generatedAt }
  getSummary: ({ from, to } = {}) =>
    adminApiClient.get(`/admin/feedback/summary${toQuery({ from, to }, ["from", "to"])}`),

  // Dòng: { id, rating, quickTags, comment, createdAt, user: { userId, fullName, email },
  //   place: { id, name, isVisible }, tripId, tripDeleted }. sortBy: createdAt | rating
  getReviews: (params = {}) =>
    adminApiClient.get(`/admin/reviews${toQuery(params, [...LIST_PARAMS, "placeId", "rating"])}`),

  // Dòng: { id, tripId, tripDeleted, quickTag, comment, createdAt, user }. sortBy: chỉ createdAt
  getTripFeedback: (params = {}) =>
    adminApiClient.get(`/admin/feedback${toQuery(params, [...LIST_PARAMS, "quickTag"])}`),
};
