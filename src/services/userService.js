import { apiClient } from "../api/apiClient";

export const userService = {
  updateProfile: (payload) => apiClient.patch("/users/me", payload),
};
