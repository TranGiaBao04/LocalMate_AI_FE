import { adminApiClient } from "../api/adminApiClient";

export const adminPlaceService = {
  // [{ id, name, address, latitude, longitude, category, status: "Pending"|"Active"|"Inactive",
  //    isVerified, estimatedCostMin, estimatedCostMax, imageUrl, createdAt, updatedAt }]
  // BE-93 (Huy) sẽ đổi sang PagedResult { items, page, pageSize, totalCount, totalPages }
  getPlaces: () => adminApiClient.get("/admin/places"),
};
