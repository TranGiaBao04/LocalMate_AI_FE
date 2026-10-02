import { timeToMinutes } from "./vnTime";

// "05:13:00" -> "05:13"
export const toHHmm = (time) => time.slice(0, 5);

// Các chuyến sắp tới (mặc định 3), tính cả chuyến đúng phút hiện tại.
// trips: [{ departure, arrival? }] (API theo ga không có arrival)
export function upcomingTrips(trips, nowMinutes, count = 3) {
  return trips
    .filter((trip) => timeToMinutes(trip.departure) >= nowMinutes)
    .slice(0, count)
    .map((trip) => ({
      departure: toHHmm(trip.departure),
      arrival: trip.arrival ? toHHmm(trip.arrival) : null,
      minutesLeft: timeToMinutes(trip.departure) - nowMinutes,
    }));
}

// Số phút/chuyến lúc này; null nếu ngoài giờ chạy ("to" không tính vào khung)
export function currentHeadway(headways, nowMinutes) {
  return (
    headways.find(
      (h) => timeToMinutes(h.from) <= nowMinutes && nowMinutes < timeToMinutes(h.to),
    )?.minutes ?? null
  );
}

// Trước chuyến đầu trong ngày thì ghi "Chuyến đầu" thay cho "Chuyến kế"
export const isBeforeFirstTrip = (firstDeparture, nowMinutes) =>
  firstDeparture != null && nowMinutes < timeToMinutes(firstDeparture);
