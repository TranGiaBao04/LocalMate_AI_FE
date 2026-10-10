import {
  formatVnDateTime,
  isPaidSubscription,
  isFreeSubscription,
  getPlanDisplayName,
} from "../../utils/subscriptionUtils";

export default function SubscriptionSummary({ subscription, loading, onRenew, plans = [] }) {
  if (loading) {
    return (
      <div role="status" aria-label="Đang tải thông tin gói" className="animate-pulse space-y-4 py-5" data-testid="subscription-summary-loading">
        <div className="h-6 w-32 bg-surface-container-high rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="h-20 bg-surface-container-high rounded" />
          <div className="h-20 bg-surface-container-high rounded" />
        </div>
      </div>
    );
  }

  const isFree = isFreeSubscription(subscription);
  const isPaid = isPaidSubscription(subscription);

  // If subscription is missing, malformed, or neither valid Free nor valid Paid, fail safely
  if (!isFree && !isPaid) {
    return (
      <div
        role="status"
        className="space-y-3 border-b border-outline-variant/30 py-6 text-center"
        data-testid="subscription-summary-unavailable"
      >
        <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center mx-auto text-on-surface-variant">
          <span className="material-symbols-outlined text-[24px]">sync_problem</span>
        </div>
        <div className="space-y-1">
          <h3 className="text-title-md font-bold text-on-surface">
            Không thể tải thông tin gói
          </h3>
          <p className="text-body-md text-on-surface-variant">
            Chưa thể lấy thông tin gói cước và hạn mức của bạn từ máy chủ.
          </p>
        </div>
      </div>
    );
  }

  const currentPlan = subscription.plan;
  const planDisplayName = getPlanDisplayName(currentPlan, plans);

  const effectiveUntilFormatted = subscription.effectiveUntil
    ? formatVnDateTime(subscription.effectiveUntil)
    : null;
  const endsAtFormatted = subscription.endsAt
    ? formatVnDateTime(subscription.endsAt)
    : null;
  const hasDistinctBoundaries =
    effectiveUntilFormatted &&
    endsAtFormatted &&
    subscription.effectiveUntil !== subscription.endsAt;

  const generateLimit = subscription.usage?.generateLimit;
  const generateUsed = subscription.usage?.generateUsed;
  const isGenerateUnlimited = generateLimit === null;
  const resetAtFormatted = subscription.usage?.resetAt
    ? formatVnDateTime(subscription.usage.resetAt)
    : null;

  const savedTripsLimit = subscription.savedTrips?.limit;
  const savedTripsUsed = subscription.savedTrips?.used;
  const isSavedTripsUnlimited = savedTripsLimit === null;
  const isSavedTripsOverLimit =
    typeof savedTripsLimit === "number" &&
    typeof savedTripsUsed === "number" &&
    savedTripsUsed > savedTripsLimit;

  const generatePeriodLabel = isFree
    ? "Lượt tạo lịch trình tháng này"
    : "Lượt tạo lịch trình";

  return (
    <div className="space-y-5 min-w-0 border-b border-outline-variant/40 pb-7">
      {/* Header & Badges */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/20 pb-4">
        <div>
          <span className="text-label-md font-semibold text-on-surface-variant">
            Gói của bạn
          </span>
          <div className="flex flex-wrap items-center gap-2.5 mt-1">
            <h2 className="text-2xl font-bold text-on-surface break-words">
              {planDisplayName}
            </h2>
            <span
              className={`rounded-full px-3 py-0.5 text-xs font-bold ${
                isPaid
                  ? "bg-primary text-on-primary shadow-sm"
                  : "bg-surface-container-high text-on-surface-variant"
              }`}
            >
              {isPaid ? "Đang hoạt động" : "Mặc định"}
            </span>
          </div>
        </div>

        {isPaid && onRenew && (
          <button
            type="button"
            onClick={onRenew}
            className="btn-outline text-label-md font-semibold text-primary border-primary/40 hover:bg-primary/5 px-4 py-2 rounded-xl flex items-center gap-1.5 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">
              autorenew
            </span>
            Gia hạn {planDisplayName}
          </button>
        )}
      </div>

      {/* Expiry / Effective boundaries for Paid plans */}
      {isPaid && (
        <>
          {hasDistinctBoundaries ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-body-md text-on-surface-variant bg-surface-container-low px-3.5 py-2.5 rounded-xl">
                <span className="material-symbols-outlined text-primary text-[20px]">
                  event_available
                </span>
                <span>
                  Kỳ hiện tại đến:{" "}
                  <strong className="text-on-surface">{effectiveUntilFormatted}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2 text-body-md text-on-surface-variant bg-surface-container-low px-3.5 py-2.5 rounded-xl">
                <span className="material-symbols-outlined text-primary text-[20px]">
                  schedule
                </span>
                <span>
                  Đã thanh toán đến:{" "}
                  <strong className="text-on-surface">{endsAtFormatted}</strong>
                </span>
              </div>
            </div>
          ) : effectiveUntilFormatted ? (
            <div className="flex items-center gap-2 text-body-md text-on-surface-variant bg-surface-container-low px-3.5 py-2.5 rounded-xl">
              <span className="material-symbols-outlined text-primary text-[20px]">
                schedule
              </span>
              <span>
                Kỳ hiện tại đến:{" "}
                <strong className="text-on-surface">{effectiveUntilFormatted}</strong>
              </span>
            </div>
          ) : endsAtFormatted ? (
            <div className="flex items-center gap-2 text-body-md text-on-surface-variant bg-surface-container-low px-3.5 py-2.5 rounded-xl">
              <span className="material-symbols-outlined text-primary text-[20px]">
                schedule
              </span>
              <span>
                Đã thanh toán đến:{" "}
                <strong className="text-on-surface">{endsAtFormatted}</strong>
              </span>
            </div>
          ) : null}
        </>
      )}

      {/* Quota Usage Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
        {/* Lượt tạo lịch trình */}
        <div className="border-l-2 border-primary/30 pl-4 py-2 space-y-2 min-w-0">
          <div className="flex items-center justify-between text-label-md text-on-surface-variant">
            <span>{generatePeriodLabel}</span>
            <span className="material-symbols-outlined text-primary text-[18px]">
              auto_awesome
            </span>
          </div>
          <div className="text-title-lg font-bold text-on-surface">
            {isGenerateUnlimited ? (
              <span className="text-primary">Không giới hạn</span>
            ) : typeof generateLimit === "number" ? (
              <span>
                {typeof generateUsed === "number" ? generateUsed : "—"} / {generateLimit}
              </span>
            ) : (
              <span className="text-on-surface-variant font-normal">Chưa có thông tin</span>
            )}
          </div>
          {typeof generateLimit === "number" && resetAtFormatted && (
            <p className="text-label-sm text-text-muted">
              Làm mới vào {resetAtFormatted}
            </p>
          )}
        </div>

        {/* Lịch trình đã chốt */}
        <div className="border-l-2 border-emerald-600/30 pl-4 py-2 space-y-2 min-w-0">
          <div className="flex items-center justify-between text-label-md text-on-surface-variant">
            <span>Lịch trình đã chốt</span>
            <span className="material-symbols-outlined text-primary text-[18px]">
              confirmation_number
            </span>
          </div>
          <div className="text-title-lg font-bold text-on-surface">
            {isSavedTripsUnlimited ? (
              <span className="text-primary">Không giới hạn</span>
            ) : typeof savedTripsLimit === "number" ? (
              <span>
                {typeof savedTripsUsed === "number" ? savedTripsUsed : "—"} / {savedTripsLimit}
              </span>
            ) : (
              <span className="text-on-surface-variant font-normal">Chưa có thông tin</span>
            )}
          </div>
          {isSavedTripsOverLimit ? (
            <p className="text-label-sm text-amber-600 font-medium">
              Bạn có {savedTripsUsed} lịch trình đã lưu từ trước. Nâng cấp gói để chốt thêm lịch trình mới.
            </p>
          ) : (
            <p className="text-label-sm text-text-muted">
              Chỉ tính các lịch trình đã chốt chính thức
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
