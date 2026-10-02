import { apiClient } from "../api/apiClient";

export const reviewService = {
  // Đánh giá theo từng chặng (chỉ chặng đã isVisited). quickTags tối đa 3 giá trị,
  // comment tối đa 1000 ký tự, cả hai tuỳ chọn.
  // -> { id, itineraryItemId, placeId, rating, quickTags, comment, createdAt }
  submitReview: (itemId, { rating, quickTags, comment }) =>
    apiClient.post(`/trips/items/${itemId}/review`, {
      rating,
      quickTags,
      comment: comment?.trim() || undefined,
    }),

  // 404 review_not_found nếu chưa đánh giá
  getReview: (itemId) => apiClient.get(`/trips/items/${itemId}/review`),
};
