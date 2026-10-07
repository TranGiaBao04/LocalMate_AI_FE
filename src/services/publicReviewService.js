import { apiClient } from "../api/apiClient";

export const publicReviewService = {
  // Đánh giá địa điểm cho trang đích →
  // { items: [{ id, rating, comment, quickTags, createdAt, reviewerName, place: { id, name } }], generatedAt }.
  // quickTags là mảng mã nhãn tích cực (có thể rỗng). items có thể ít hơn limit. BE cache 10 phút.
  getPublicReviews: (limit = 3) =>
    apiClient.get(`/public/reviews?limit=${limit}`, { auth: false }),
};
