import { apiClient } from "../api/apiClient";

// Lịch trong ngày không đổi nên lưu tạm theo tham số trong phiên
const cache = new Map();

function cachedGet(path) {
  if (!cache.has(path)) {
    const request = apiClient.get(path, { auth: false }).catch((err) => {
      cache.delete(path); // lỗi thì lần sau gọi lại
      throw err;
    });
    cache.set(path, request);
  }
  return cache.get(path);
}

export const metroService = {
  // Ga đi -> ga đến (order 1–14, khác nhau), BE tự suy ra chiều. date "yyyy-MM-dd" giờ VN.
  // -> { from, to, date, direction, towardStationName, travelMinutes, stopCount, isEstimated, precision,
  //      isWithinEffectivePeriod, effectiveFrom, effectiveTo, notice,
  //      trips: [{ departure, arrival }], headways: [{ from, to, minutes }] }
  getJourney: (from, to, date) =>
    cachedGet(`/metro/journeys?from=${from}&to=${to}&date=${date}`),

  // Một ga, cả 2 chiều (ga 1 và 14 chỉ có 1 chiều).
  // -> { station, date, firstDeparture, lastDeparture, ..., notice,
  //      directions: [{ direction, towardStationName, departures: ["HH:mm:ss"], headways }] }
  getDepartures: (stationOrder, date) =>
    cachedGet(`/metro/stations/${stationOrder}/departures?date=${date}`),
};
