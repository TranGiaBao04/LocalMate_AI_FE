import { apiClient } from "../api/apiClient";

export const authService = {
  login: (email, password) =>
    apiClient.post("/auth/login", { email, password }, { auth: false }),
  register: (fullName, email, password) =>
    apiClient.post(
      "/auth/register",
      { fullName, email, password },
      { auth: false },
    ),
  getProfile: () => apiClient.get("/auth/me"),
};
