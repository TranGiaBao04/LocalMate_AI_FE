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
    price: 19000,
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

/**
 * Authoritatively determines if a subscription state represents a paid plan.
 * Does not restrict to hard-coded builtin plan codes.
 * Free plan has plan === "Free" (case-insensitive).
 * A paid plan must have plan !== "Free" and at least one valid effective lifecycle boundary.
 */
export function isPaidSubscription(sub) {
  if (!sub || typeof sub !== "object") return false;
  if (typeof sub.plan !== "string" || !sub.plan.trim()) return false;
  const isFreePlan = sub.plan.trim().toLowerCase() === "free";
  if (isFreePlan) return false;
  // A current paid period is represented by Backend effective lifecycle boundaries.
  const hasEffectiveBoundary = Boolean(
    (typeof sub.endsAt === "string" && sub.endsAt.trim()) ||
    (typeof sub.effectiveUntil === "string" && sub.effectiveUntil.trim())
  );
  if (!hasEffectiveBoundary) {
    return false;
  }
  return true;
}

/**
 * Authoritatively determines if a subscription state represents a Free plan.
 */
export function isFreeSubscription(sub) {
  if (!sub || typeof sub !== "object") return false;
  if (typeof sub.plan !== "string" || !sub.plan.trim()) return false;
  return sub.plan.trim().toLowerCase() === "free";
}

/**
 * Resolves a presentation-safe display name for a plan code.
 * Preferred order: catalog name -> known display name mapping -> raw plan code.
 */
export function getPlanDisplayName(planCode, catalogPlans = []) {
  if (!planCode) return "";
  const catalogPlan = Array.isArray(catalogPlans)
    ? catalogPlans.find((p) => p.code === planCode)
    : null;
  if (catalogPlan?.name) return catalogPlan.name;
  return PLAN_DISPLAY_NAMES[planCode] || planCode;
}
