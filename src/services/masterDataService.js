import { apiClient } from "../api/apiClient";

export const masterDataService = {
  // { metroStations: [{ id, name, order, latitude, longitude }], placeCategories: string[],
  //   reviewQuickTags: [{ code, label }], tripStatuses: string[], travelModes: string[],
  //   tripLimits: { minDurationHours, maxDurationHours },
  //   timeSlots: [{ code, label, startTime: "08:00:00", maxDurationHours }],
  //   feedbackQuickTags: [{ code, label }] (7 nhãn của feedback cả chuyến đi) }
  getMasterData: () => apiClient.get("/master-data", { auth: false }),
};
