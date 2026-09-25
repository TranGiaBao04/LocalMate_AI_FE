import { apiClient } from "../api/apiClient";

export const masterDataService = {
  // { metroStations: [{ id, name, order, latitude, longitude }], placeCategories: string[] }
  getMasterData: () => apiClient.get("/master-data", { auth: false }),
};
