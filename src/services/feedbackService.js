import { apiClient } from "../api/apiClient";

// Feedback cho CẢ chuyến đi (khác đánh giá từng chặng ở reviewService): không có số sao,
// đúng 1 quickTag (mã + nhãn lấy từ feedbackQuickTags của master-data), mỗi user 1 feedback / chuyến,
// chuyến phải đã chốt.
export const feedbackService = {
  // -> { id, tripId, quickTag, comment, createdAt }
  // 409 trip_not_finalized | feedback_already_exists, 403 feedback_requires_persisted_user
  submitTripFeedback: ({ tripId, quickTag, comment }) =>
    apiClient.post("/feedback/trip", { tripId, quickTag, comment: comment?.trim() || undefined }),

  // 404 feedback_not_found nếu chưa gửi (kể cả chuyến còn nháp)
  getTripFeedback: (tripId) => apiClient.get(`/feedback/trip/${tripId}`),
};
