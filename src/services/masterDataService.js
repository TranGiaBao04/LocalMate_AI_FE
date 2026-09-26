import { apiClient } from "../api/apiClient";

export const masterDataService = {
  // { metroStations: [{ id, name, order, latitude, longitude }], placeCategories: string[],
  //   reviewQuickTags: [{ code, label }], tripStatuses: string[], travelModes: string[],
  //   tripLimits: { minDurationHours, maxDurationHours },
  //   timeSlots: [{ code, label, startTime: "08:00:00", maxDurationHours }] }
  getMasterData: () => apiClient.get("/master-data", { auth: false }),
};
