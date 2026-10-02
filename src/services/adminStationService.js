import { adminApiClient } from "../api/adminApiClient";

// Cần quyền ManagePlaces. BE không cache: duyệt/xoá địa điểm xong gọi lại là thấy số mới.
export const adminStationService = {
  // → { radiusMeters, minActivePlacesPerStation, understockedStationCount,
  //     outsideCoverage: { pending, active, inactive, total },
  //     stations: [{ id, order, name, latitude, longitude, totals: { pending, active, inactive, total },
  //       categories: [{ category, pending, active, inactive, total }] (luôn đủ Cafe, Food, Culture, CheckIn),
  //       isUnderstocked, shortfall, missingCategories: string[] }] }, đủ 14 ga theo thứ tự tuyến
  getStations: () => adminApiClient.get("/admin/stations"),
};
