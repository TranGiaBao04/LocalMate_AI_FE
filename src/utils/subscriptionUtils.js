export const PLAN_CODES = {
  FREE: "Free",
  TRIP_PASS: "TripPass",
  MEMBERSHIP: "Membership",
};

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
 * Gói được tặng (admin tặng hoặc dùng thử khi đăng ký): BE trả isTrial = true, endsAt = null,
 * effectiveUntil = lúc hết dùng thử. Không có kỳ đã mua nên không gia hạn được (409 no_active_subscription).
 */
export function isTrialSubscription(sub) {
  return isPaidSubscription(sub) && sub.isTrial === true;
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
 * Tên gói lấy từ danh sách gói (/subscription/plans). Danh sách chưa tải xong thì dùng mã gói.
 * Tên có thể đổi bất cứ lúc nào, mọi so sánh phải dùng mã gói.
 */
export function getPlanDisplayName(planCode, catalogPlans = []) {
  if (!planCode) return "";
  const catalogPlan = Array.isArray(catalogPlans)
    ? catalogPlans.find((p) => p.code === planCode)
    : null;
  return catalogPlan?.name || planCode;
}

/** Gói của chính user: dùng planName từ /subscription/me, thiếu thì tra danh sách gói. */
export function getSubscriptionPlanName(subscription, catalogPlans = []) {
  return subscription?.planName || getPlanDisplayName(subscription?.plan, catalogPlans);
}

const UPGRADE_LIMITS = {
  generate: { planField: "generateLimit", current: (sub) => sub?.usage?.generateLimit },
  savedTrips: { planField: "savedTripLimit", current: (sub) => sub?.savedTrips?.limit },
  ai: { planField: "aiDailyCallLimit", current: (sub) => sub?.ai?.dailyLimit },
};

// Giới hạn của gói có rộng hơn giới hạn đang dùng không. null là không giới hạn,
// riêng AI null là "chưa đặt riêng cho gói" (dùng số ở Cấu hình hệ thống) nên không tính là rộng hơn
function isLimitBetter(reason, planLimit, currentLimit) {
  if (planLimit == null) return reason !== "ai";
  return typeof currentLimit === "number" && planLimit > currentLimit;
}

/**
 * Gói nên gợi ý khi người dùng chạm giới hạn `reason` ("generate" | "savedTrips" | "ai"), rẻ trước.
 * Gói cao hơn = giá cao hơn gói đang dùng; người đang dùng thử chưa mua gói nào nên thấy mọi gói trả phí.
 * Chỉ giữ gói mở rộng đúng giới hạn đang chạm.
 */
export function getUpgradeOptions(reason, subscription, plans = []) {
  const limit = UPGRADE_LIMITS[reason];
  if (!limit || !subscription || !Array.isArray(plans)) return [];
  const currentPrice = isTrialSubscription(subscription)
    ? 0
    : plans.find((p) => p.code === subscription.plan)?.price ?? 0;
  return plans
    .filter((p) => typeof p.price === "number" && p.price > currentPrice)
    .filter((p) => isLimitBetter(reason, p[limit.planField], limit.current(subscription)))
    .sort((a, b) => a.price - b.price);
}

/**
 * % rẻ hơn mỗi ngày so với gói trả phí rẻ nhất có thời hạn, tính từ price/durationDays (không gắn cứng số gói).
 * Không rẻ hơn hoặc thiếu số thì trả null.
 */
export function getPerDaySaving(plan, plans = []) {
  const perDay = (p) => (p?.price > 0 && p?.durationDays > 0 ? p.price / p.durationDays : null);
  const own = perDay(plan);
  const base = (Array.isArray(plans) ? plans : [])
    .filter((p) => p.code !== plan?.code && perDay(p) != null)
    .sort((a, b) => a.price - b.price)[0];
  if (own == null || !base) return null;
  const percent = Math.round((1 - own / perDay(base)) * 100);
  return percent >= 1 ? { percent, baseName: base.name || base.code } : null;
}
