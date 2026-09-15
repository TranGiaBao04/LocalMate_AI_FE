import { apiClient } from "../api/apiClient";

function toQueryString(params = {}) {
  const query = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
    )
    .join("&");
  return query ? `?${query}` : "";
}

export const placeService = {
  getPlaces: (params) => apiClient.get(`/places${toQueryString(params)}`),
  getPlaceById: (placeId) => apiClient.get(`/places/${placeId}`),
};
