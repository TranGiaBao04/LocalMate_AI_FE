export const PLAN_CODES = {
  FREE: "Free",
  TRIP_PASS: "TripPass",
  MEMBERSHIP: "Membership",
};

export const PLAN_DISPLAY_NAMES = {
  [PLAN_CODES.FREE]: "Free",
  [PLAN_CODES.TRIP_PASS]: "Trip Pass",
  [PLAN_CODES.MEMBERSHIP]: "Membership",
};

/**
 * Gói cước tĩnh dự phòng (Static Fallback).
 * LƯU Ý QUAN TRỌNG:
 * Backend `/api/subscriptions/plans` là nguồn chân lý (authoritative source) duy nhất cho giao diện giao dịch / thanh toán.
 * FALLBACK_PLANS chỉ được sử dụng cho mục đích hiển thị marketing tĩnh (như WelcomePage) khi người dùng chưa đăng nhập.
 */
export const FALLBACK_PLANS = [
  {
    code: PLAN_CODES.FREE,
    price: 0,
    durationDays: null,
    generateLimit: 1,
    savedTripLimit: 1,
  },
  {
    code: PLAN_CODES.TRIP_PASS,
    price: 49000,
    durationDays: 7,
    generateLimit: null,
    savedTripLimit: 3,
  },
  {
    code: PLAN_CODES.MEMBERSHIP,
    price: 59000,
    durationDays: 30,
    generateLimit: null,
    savedTripLimit: null,
  },
];

const VN_TZ = "Asia/Ho_Chi_Minh";

/**
 * Định dạng ngày giờ chuẩn Việt Nam (Asia/Ho_Chi_Minh)
 * Ví dụ: "14:30 15/10/2026"
 */
export function formatVnDateTime(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: VN_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

/**
 * Định dạng ngày chuẩn Việt Nam (Asia/Ho_Chi_Minh)
 * Ví dụ: "15/10/2026"
 */
export function formatVnDate(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: VN_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Định dạng giá tiền chuẩn VND
 * Ví dụ: 59000 -> "59.000đ", 0 -> "0đ"
 */
export function formatPlanPrice(price) {
  if (price === 0 || price == null) return "0đ";
  return `${new Intl.NumberFormat("vi-VN").format(price)}đ`;
}
