import { apiClient } from "../api/apiClient";

export const tagService = {
  getTags: () => apiClient.get("/tags"),
};
