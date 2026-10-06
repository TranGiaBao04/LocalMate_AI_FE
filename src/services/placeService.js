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
  getMetroClusters: () => apiClient.get("/places/metro-clusters"),
  getPlaces: ({ latitude, longitude, category } = {}) =>
    apiClient.get(`/places/nearby${toQueryString({ latitude, longitude, category })}`),
  getPlaceById: (placeId) => apiClient.get(`/places/${placeId}`),
  // Đánh giá công khai của địa điểm (PagedResult). Dòng: { id, rating, quickTags, comment, createdAt, reviewerName }
  // sortBy: createdAt | rating; rating 1–5 (bỏ trống = mọi mức sao). 404 place_not_found.
  getPlaceReviews: (placeId, { page, pageSize, sortBy, sortDirection, rating } = {}) =>
    apiClient.get(
      `/places/${placeId}/reviews${toQueryString({ page, pageSize, sortBy, sortDirection, rating })}`,
    ),
};
