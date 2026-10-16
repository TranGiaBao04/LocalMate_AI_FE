import { formatClock, minutesNowInVietnam, timeToMinutes, weekdayInVietnam } from "./vnTime";

// Thứ tự và nhãn theo dayOfWeek của BE (Monday → Sunday)
export const DAYS_OF_WEEK = [
  { key: "Monday", label: "Thứ Hai" },
  { key: "Tuesday", label: "Thứ Ba" },
  { key: "Wednesday", label: "Thứ Tư" },
  { key: "Thursday", label: "Thứ Năm" },
  { key: "Friday", label: "Thứ Sáu" },
  { key: "Saturday", label: "Thứ Bảy" },
  { key: "Sunday", label: "Chủ Nhật" },
];

const toHHmm = (time) => time.slice(0, 5);
// isClosed false mà không có giờ = thứ đó chưa nhập (không phải mở cả ngày)
const hasHours = (day) => !day.isClosed && day.openTime != null && day.closeTime != null;
// 00:00–00:00 = mở cả ngày (BE không có field riêng, giờ trùng khác bị BE từ chối)
export const isAllDay = (day) =>
  hasHours(day) && toHHmm(day.openTime) === "00:00" && toHHmm(day.closeTime) === "00:00";
// closeTime < openTime = mở qua nửa đêm (BE không cho giờ mở bằng giờ đóng)
const isOvernight = (day) => timeToMinutes(day.closeTime) < timeToMinutes(day.openTime);

// Một thứ thành chữ: "Nghỉ" | "Chưa rõ" | "Mở cả ngày" | "08:00 – 22:00" | "17:00 – 02:00 (hôm sau)"
export function formatDayHours(day) {
  if (day.isClosed) return "Nghỉ";
  if (!hasHours(day)) return "Chưa rõ";
  if (isAllDay(day)) return "Mở cả ngày";
  return `${toHHmm(day.openTime)} – ${formatClock(toHHmm(day.closeTime), isOvernight(day))}`;
}

// Trạng thái lúc này theo giờ VN (BE không tính sẵn), xét cả khung qua đêm của hôm trước:
// { status: "open", closesAt, closesNextDay } | { status: "open", allDay: true }
// | { status: "closed", opensAt, closedToday } | { status: "unknown" }
export function getOpenStateNow(openingHours, now = Date.now()) {
  if (!openingHours?.hasData) return { status: "unknown" };
  const byDay = Object.fromEntries(openingHours.days.map((d) => [d.dayOfWeek, d]));
  const todayKey = weekdayInVietnam(now);
  const index = DAYS_OF_WEEK.findIndex((d) => d.key === todayKey);
  const today = byDay[todayKey];
  const yesterday = byDay[DAYS_OF_WEEK[(index + 6) % 7].key];
  const minutes = minutesNowInVietnam(now);

  // Quán mở qua đêm từ hôm qua vẫn đang mở lúc sáng sớm nay
  if (
    yesterday &&
    hasHours(yesterday) &&
    isOvernight(yesterday) &&
    minutes < timeToMinutes(yesterday.closeTime)
  ) {
    return { status: "open", closesAt: toHHmm(yesterday.closeTime), closesNextDay: false };
  }
  if (!today || (!today.isClosed && !hasHours(today))) return { status: "unknown" };

  // Hôm qua chưa nhập giờ thì không chắc quán đã đóng lúc trước giờ mở hôm nay (có thể còn khung qua đêm)
  const yesterdayUnknown = yesterday && !yesterday.isClosed && !hasHours(yesterday);
  const closedBeforeOpening = (state) => (yesterdayUnknown ? { status: "unknown" } : state);

  if (today.isClosed) return closedBeforeOpening({ status: "closed", opensAt: null, closedToday: true });
  if (isAllDay(today)) return { status: "open", allDay: true };

  const open = timeToMinutes(today.openTime);
  if (minutes < open) {
    return closedBeforeOpening({ status: "closed", opensAt: toHHmm(today.openTime), closedToday: false });
  }
  if (isOvernight(today) || minutes < timeToMinutes(today.closeTime)) {
    return { status: "open", closesAt: toHHmm(today.closeTime), closesNextDay: isOvernight(today) };
  }
  return { status: "closed", opensAt: null, closedToday: false };
}

// Câu ngắn cho trạng thái lúc này; null khi chưa đủ dữ liệu
export function describeOpenState(state) {
  if (state.status === "open" && state.allDay) return "Đang mở cửa · mở cả ngày";
  if (state.status === "open") {
    return `Đang mở cửa · đóng lúc ${formatClock(state.closesAt, state.closesNextDay)}`;
  }
  if (state.status !== "closed") return null;
  if (state.closedToday) return "Hôm nay nghỉ";
  return state.opensAt ? `Đang đóng cửa · mở lúc ${state.opensAt}` : "Đang đóng cửa";
}
