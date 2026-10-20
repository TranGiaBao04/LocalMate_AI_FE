import { apiClient } from "../api/apiClient";

// Góp ý về ứng dụng LocalMate (App Feedback):
// Type: 1 (Bug - Báo lỗi), 2 (Suggestion - Góp ý tính năng), 3 (Praise - Khen ngợi), 4 (Other - Khác)
// Rating: 1-5 (tuỳ chọn)
// Content: 1-1000 ký tự
// PagePath: đường dẫn trang hiện tại
export const appFeedbackService = {
  // -> { id, type, typeName, rating, content, pagePath, createdAt }
  // 429 app_feedback_daily_limit_reached (tối đa 5 lượt / ngày)
  // 403 app_feedback_requires_persisted_user (chặn tài khoản demo)
  submitAppFeedback: ({ type, rating, content, pagePath }) =>
    apiClient.post("/app-feedback", {
      type: Number(type),
      rating: rating ? Number(rating) : undefined,
      content: content?.trim(),
      pagePath: pagePath?.trim() || undefined,
    }),
};
