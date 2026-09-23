import { apiClient } from "../api/apiClient";

export const reviewService = {
  submitReview: (review) => apiClient.post("/reviews", review),
};
