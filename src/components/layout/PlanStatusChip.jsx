import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useSubscription } from "../../context/SubscriptionContext";
import { useClock } from "../../hooks/useClock";
import {
  getSubscriptionPlanName,
  isGenerateQuotaExhausted,
  isPaidSubscription,
  isTrialSubscription,
} from "../../utils/subscriptionUtils";

// Gói trả phí còn từ chừng này ngày trở xuống thì nhãn chuyển màu cảnh báo
const EXPIRING_SOON_DAYS = 2;
const DAY_MS = 24 * 60 * 60 * 1000;
// Số ngày còn lại và mốc làm mới lượt chỉ cần tính lại mỗi phút
const CLOCK_TICK_MS = 60_000;

const TONES = {
  free: "border-border-soft bg-surface-container-low text-navy-dark hover:bg-chip-bg",
  paid: "border-blue-200 bg-blue-50 text-primary hover:bg-blue-100",
  warn: "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100",
};

// full: hiện từ sm trở lên và đọc cho trình đọc màn hình; short: màn hẹp
function describePlanChip(sub, name, now) {
  if (isPaidSubscription(sub)) {
    const isTrial = isTrialSubscription(sub);
    const prefix = isTrial ? `Dùng thử ${name}` : name;
    const icon = isTrial ? "redeem" : "workspace_premium";
    const days = Math.ceil((new Date(sub.effectiveUntil ?? sub.endsAt).getTime() - now) / DAY_MS);
    if (!Number.isFinite(days)) return { tone: "paid", icon, full: prefix, short: name };
    if (days <= 0) return { tone: "warn", icon: "schedule", full: `${prefix} · đã hết hạn`, short: "Hết hạn" };
    const expiringSoon = days <= EXPIRING_SOON_DAYS;
    return {
      tone: expiringSoon ? "warn" : "paid",
      icon: expiringSoon ? "schedule" : icon,
      full: `${prefix} · còn ${days} ngày`,
      short: `${days} ngày`,
    };
  }

  if (isGenerateQuotaExhausted(sub, now)) {
    return { tone: "warn", icon: "error", full: `${name} · hết lượt tháng này`, short: "Hết lượt" };
  }
  const usage = sub.usage;
  if (typeof usage?.generateLimit === "number") {
    // Đã qua mốc làm mới mà chưa tải lại gói thì coi như còn đủ lượt
    const resetTime = usage.resetAt ? new Date(usage.resetAt).getTime() : NaN;
    const used = Number.isFinite(resetTime) && now >= resetTime ? 0 : usage.generateUsed ?? 0;
    const left = Math.max(0, usage.generateLimit - used);
    return {
      tone: "free",
      icon: "confirmation_number",
      full: `${name} · còn ${left}/${usage.generateLimit} lịch`,
      short: `${left}/${usage.generateLimit} lịch`,
    };
  }
  return { tone: "free", icon: "confirmation_number", full: name, short: name };
}

// Nhãn gói hiện tại ở thanh tiêu đề, bấm để mở trang Gói. Không gọi thêm API.
export default function PlanStatusChip() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { isLoggedIn, isDemo } = useAuth();
  const { subscription, subscriptionLoading, plans } = useSubscription();
  const now = useClock(CLOCK_TICK_MS);

  // Trang Gói đã có thông tin gói ngay trong nội dung
  if (!isLoggedIn || isDemo || pathname === "/subscription") return null;
  if (!subscription) {
    return subscriptionLoading
      ? <span data-testid="plan-chip-loading" aria-hidden="true" className="ml-auto h-8 w-20 flex-none animate-pulse rounded-full bg-surface-container-low sm:w-40" />
      : null;
  }

  const chip = describePlanChip(subscription, getSubscriptionPlanName(subscription, plans), now);
  return (
    <button
      type="button"
      onClick={() => navigate("/subscription")}
      aria-label={`Gói hiện tại: ${chip.full}. Mở trang gói dịch vụ.`}
      title={chip.full}
      className={`ml-auto inline-flex h-8 min-w-0 flex-none items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-semibold transition-colors motion-reduce:transition-none sm:px-3 sm:text-[13px] ${TONES[chip.tone]}`}
    >
      <span aria-hidden="true" className="material-symbols-outlined text-[16px]">{chip.icon}</span>
      <span className="hidden whitespace-nowrap sm:inline">{chip.full}</span>
      <span className="whitespace-nowrap sm:hidden">{chip.short}</span>
    </button>
  );
}
