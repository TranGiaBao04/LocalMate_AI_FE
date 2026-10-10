import { PLAN_CODES, PLAN_DISPLAY_NAMES, formatPlanPrice } from "../../utils/subscriptionUtils";

export default function PlanCard({
  plan,
  currentPlanCode = null,
  onSelect,
  onRenew,
  isDemo = false,
  loading = false,
}) {
  const planCode = plan?.code;
  const isCurrentPlan = Boolean(currentPlanCode && currentPlanCode === planCode);
  const displayName = plan?.name || PLAN_DISPLAY_NAMES[planCode] || planCode;
  const isMembership = planCode === PLAN_CODES.MEMBERSHIP;
  const isTripPass = planCode === PLAN_CODES.TRIP_PASS;
  const isFree =
    planCode === PLAN_CODES.FREE ||
    String(planCode).toLowerCase() === "free";

  // Duration text
  const durationText = plan.durationDays
    ? `${plan.durationDays} ngày`
    : plan.durationDays === null ? "Không thời hạn" : "Chưa có thời hạn";
  const priceText = typeof plan.price === "number" && Number.isFinite(plan.price) && plan.price >= 0
    ? formatPlanPrice(plan.price) : "Chưa có giá";

  // Quota benefits
  const generateBenefit =
    plan.generateLimit === null
      ? "Tạo lịch trình AI không giới hạn"
      : typeof plan.generateLimit === "number"
        ? `${plan.generateLimit} lượt tạo lịch trình`
        : "Lượt tạo lịch trình";

  const savedTripsBenefit =
    plan.savedTripLimit === null
      ? "Lịch trình đã chốt không giới hạn"
      : typeof plan.savedTripLimit === "number"
        ? `Tối đa ${plan.savedTripLimit} lịch trình đã chốt`
        : "Lịch trình đã chốt";

  // Action button rendering
  const renderAction = () => {
    if (isDemo) {
      if (isFree) {
        return (
          <button
            type="button"
            disabled
            className="w-full py-3 rounded-xl bg-surface-container-high text-on-surface-variant font-semibold text-label-md cursor-not-allowed"
          >
            Phiên bản Demo
          </button>
        );
      }
      return (
        <button
          type="button"
          disabled
          className="w-full py-3 rounded-xl bg-surface-container-high text-on-surface-variant font-semibold text-label-md cursor-not-allowed opacity-75"
          title="Vui lòng đăng ký tài khoản thật để thanh toán gói"
        >
          Cần tài khoản chính thức
        </button>
      );
    }

    // Persisted User Logic - Backend classification is authoritative
    if (isCurrentPlan) {
      if (isFree) {
        return (
          <button
            type="button"
            disabled
            className="w-full py-3 rounded-xl bg-surface-container-high text-on-surface-variant font-semibold text-label-md cursor-default"
          >
            Gói hiện tại
          </button>
        );
      }
      return (
        <div className="flex flex-col gap-2">
          <div className="text-center py-1.5 rounded-lg bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200">
            Gói đang dùng
          </div>
          {onRenew ? (
            <button
              type="button"
              onClick={onRenew}
              disabled={loading}
              className="w-full py-2.5 rounded-xl border-2 border-primary text-primary hover:bg-primary/5 font-bold text-label-md transition-all active:scale-98"
            >
              {loading ? "Đang xử lý..." : `Gia hạn ${displayName}`}
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="w-full py-3 rounded-xl bg-surface-container-high text-on-surface-variant font-semibold text-label-md cursor-default"
            >
              Gói hiện tại
            </button>
          )}
        </div>
      );
    }

    if (isFree) {
      return (
        <button
          type="button"
          disabled
          className="w-full py-3 rounded-xl bg-surface-container-high text-text-faint font-semibold text-label-md cursor-not-allowed"
        >
          Không khả dụng
        </button>
      );
    }

    // Any paid target plan is selectable; backend quote & error authoritatively classifies
    return (
      <button
        type="button"
        onClick={() => onSelect(planCode)}
        disabled={loading}
        className={`w-full py-3 rounded-xl font-bold text-label-md transition-all active:scale-98 shadow-sm ${
          isMembership
            ? "bg-primary text-on-primary hover:bg-primary/90 shadow-primary/20"
            : "bg-navy-dark text-white hover:bg-navy-darkest"
        }`}
      >
        {loading ? "Đang xử lý..." : `Chọn ${displayName}`}
      </button>
    );
  };

  return (
    <article
      className={`rounded-[8px] min-w-0 p-5 sm:p-6 flex flex-col justify-between relative [&_button]:rounded-[8px] [&_button]:min-h-11 [&_button:focus-visible]:outline [&_button:focus-visible]:outline-2 [&_button:focus-visible]:outline-offset-2 [&_button:focus-visible]:outline-primary ${
        isMembership
          ? "border-2 border-primary bg-surface shadow-sm"
          : isTripPass
            ? "border border-outline-variant/60 bg-surface shadow-sm hover:shadow-md"
            : "border border-outline-variant/40 bg-surface/90"
      }`}
    >
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="text-title-lg font-bold text-on-surface min-w-0 break-words">
            {displayName}
          </h3>
          {isCurrentPlan && !isDemo && (
            <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold">
              Hiện tại
            </span>
          )}
        </div>

        {/* Pricing */}
        <div className="mb-5 pb-5 border-b border-outline-variant/30 flex flex-wrap items-baseline gap-1.5">
          <span className="text-3xl font-bold text-on-surface break-all">
            {priceText}
          </span>
          <span className="text-body-md text-on-surface-variant font-medium">
            / {durationText}
          </span>
        </div>

        {/* Features list */}
        <ul className="space-y-3 text-body-md text-on-surface-variant mb-6">
          <li className="flex items-start gap-2.5">
            <span
              className="material-symbols-outlined text-[20px] text-emerald-600 flex-shrink-0 mt-0.5"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              check_circle
            </span>
            <span className="leading-snug">{generateBenefit}</span>
          </li>
          <li className="flex items-start gap-2.5">
            <span
              className="material-symbols-outlined text-[20px] text-emerald-600 flex-shrink-0 mt-0.5"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              check_circle
            </span>
            <span className="leading-snug">{savedTripsBenefit}</span>
          </li>
          <li className="flex items-start gap-2.5">
            <span
              className="material-symbols-outlined text-[20px] text-emerald-600 flex-shrink-0 mt-0.5"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              check_circle
            </span>
            <span className="leading-snug">
              Bản đồ Metro & chỉ đường Google Maps
            </span>
          </li>
        </ul>
      </div>

      <div className="mt-4 pt-2">{renderAction()}</div>
    </article>
  );
}
