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
 * Lượt AI trong ngày từ GET /subscription/me (`ai`). Trả null khi chưa có số hoặc đã qua resetAt
 * (00:00 giờ Việt Nam hôm sau), để giao diện không hiện lượt của hôm qua.
 */
export function getAiQuota(sub, now = Date.now()) {
  const ai = sub?.ai;
  if (!ai || typeof ai.dailyUsed !== "number" || typeof ai.dailyLimit !== "number") return null;
  const resetTime = ai.resetAt ? new Date(ai.resetAt).getTime() : NaN;
  if (Number.isFinite(resetTime) && now >= resetTime) return null;
  return {
    used: ai.dailyUsed,
    limit: ai.dailyLimit,
    remaining: Math.max(0, ai.dailyLimit - ai.dailyUsed),
    resetAt: ai.resetAt ?? null,
  };
}

/**
 * Câu nhắc cạnh nút AI khi đã có số lượt (aiQuota khác null).
 */
export function getAiQuotaHint(aiQuota) {
  if (aiQuota.limit === 0) return "Gói hiện tại không có lượt AI.";
  if (aiQuota.remaining === 0) {
    const resetAt = formatVnDateTime(aiQuota.resetAt);
    return `Bạn đã dùng hết lượt AI hôm nay.${resetAt ? ` Lượt mới có từ ${resetAt}.` : ""}`;
  }
  return `Mỗi lần tính 1 lượt AI. Còn ${aiQuota.remaining}/${aiQuota.limit} lượt hôm nay.`;
}

/**
 * Hết lượt tạo lịch trình theo yêu cầu, cùng điều kiện với BE: used >= limit, limit null là không giới hạn.
 * Áp dụng lịch mẫu và nhân bản lịch không tính vào lượt này.
 */
export function isGenerateQuotaExhausted(sub, now = Date.now()) {
  const usage = sub?.usage;
  if (typeof usage?.generateLimit !== "number" || typeof usage?.generateUsed !== "number") return false;
  const resetTime = usage.resetAt ? new Date(usage.resetAt).getTime() : NaN;
  if (Number.isFinite(resetTime) && now >= resetTime) return false;
  return usage.generateUsed >= usage.generateLimit;
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
