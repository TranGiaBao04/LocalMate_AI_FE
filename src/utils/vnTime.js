// Ngày/giờ theo giờ Việt Nam, không theo múi giờ thiết bị (BE tính mọi thứ theo Asia/Ho_Chi_Minh)
const VN_TZ = "Asia/Ho_Chi_Minh";
export const DAY_MINUTES = 24 * 60;

// "yyyy-MM-dd"
export function todayInVietnam(now = Date.now()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: VN_TZ }).format(now);
}

// Số phút tính từ 00:00 hôm nay
export function minutesNowInVietnam(now = Date.now()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: VN_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  return get("hour") * 60 + get("minute");
}

export function roundUpMinutes(minutes, step = 15) {
  return Math.ceil(minutes / step) * step;
}

// "08:00" hoặc "08:00:00" -> 480
export function timeToMinutes(time) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

// 480 -> "08:00"
export function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// "yyyy-MM-dd" + n ngày
export function addDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// "2026-09-26" -> "Thứ Bảy, 26/09"
export function formatPlannedDate(isoDate) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "UTC",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(`${isoDate}T00:00:00Z`));
}
