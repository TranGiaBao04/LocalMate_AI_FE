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
  getNearby: ({ latitude, longitude, category } = {}) =>
    apiClient.get(`/places/nearby${toQueryString({ latitude, longitude, category })}`),
  getPlaceById: (placeId) => apiClient.get(`/places/${placeId}`),
};
