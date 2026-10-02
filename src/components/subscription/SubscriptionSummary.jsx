import { PLAN_CODES, PLAN_DISPLAY_NAMES, formatVnDateTime } from "../../utils/subscriptionUtils";

export default function SubscriptionSummary({ subscription, loading, onRenew }) {
  if (loading) {
    return (
      <div className="card animate-pulse space-y-4">
        <div className="h-6 w-32 bg-surface-container-high rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="h-20 bg-surface-container-high rounded" />
          <div className="h-20 bg-surface-container-high rounded" />
        </div>
      </div>
    );
  }

  const currentPlan = subscription?.plan || PLAN_CODES.FREE;
  const planDisplayName = PLAN_DISPLAY_NAMES[currentPlan] || currentPlan;
  const isPaid = currentPlan === PLAN_CODES.TRIP_PASS || currentPlan === PLAN_CODES.MEMBERSHIP;
  const endsAtFormatted = subscription?.endsAt ? formatVnDateTime(subscription.endsAt) : null;

  const generateUsed = subscription?.usage?.generateUsed ?? 0;
  const generateLimit = subscription?.usage?.generateLimit;
  const resetAtFormatted = subscription?.usage?.resetAt
    ? formatVnDateTime(subscription.usage.resetAt)
    : null;

  const savedTripsUsed = subscription?.savedTrips?.used ?? 0;
  const savedTripsLimit = subscription?.savedTrips?.limit;
  const isSavedTripsOverLimit =
    savedTripsLimit != null && savedTripsUsed > savedTripsLimit;

  return (
    <div className="card space-y-5 border border-outline-variant/30 bg-gradient-to-br from-surface to-surface-container-lowest shadow-sm">
      {/* Header & Badges */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/20 pb-4">
        <div>
          <span className="text-label-md font-semibold text-on-surface-variant uppercase tracking-wider">
            Gói của bạn
          </span>
          <div className="flex items-center gap-2.5 mt-1">
            <h2 className="text-headline-md font-bold text-on-surface">
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

      {/* Expiry for Paid plans */}
      {isPaid && endsAtFormatted && (
        <div className="flex items-center gap-2 text-body-md text-on-surface-variant bg-surface-container-low px-3.5 py-2.5 rounded-xl">
          <span className="material-symbols-outlined text-primary text-[20px]">
            schedule
          </span>
          <span>
            Hết hạn vào:{" "}
            <strong className="text-on-surface">{endsAtFormatted}</strong>
          </span>
        </div>
      )}

      {/* Quota Usage Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
        {/* Lượt tạo lịch trình */}
        <div className="rounded-2xl border border-outline-variant/20 bg-surface p-4 space-y-2">
          <div className="flex items-center justify-between text-label-md text-on-surface-variant">
            <span>Lượt tạo lịch trình tháng này</span>
            <span className="material-symbols-outlined text-primary text-[18px]">
              auto_awesome
            </span>
          </div>
          <div className="text-title-lg font-bold text-on-surface">
            {generateLimit == null ? (
              <span className="text-primary">Không giới hạn</span>
            ) : (
              <span>
                {generateUsed} / {generateLimit}
              </span>
            )}
          </div>
          {generateLimit != null && resetAtFormatted && (
            <p className="text-label-sm text-text-muted">
              Làm mới lượt vào {resetAtFormatted}
            </p>
          )}
        </div>

        {/* Lịch trình đã chốt */}
        <div className="rounded-2xl border border-outline-variant/20 bg-surface p-4 space-y-2">
          <div className="flex items-center justify-between text-label-md text-on-surface-variant">
            <span>Lịch trình đã chốt</span>
            <span className="material-symbols-outlined text-primary text-[18px]">
              confirmation_number
            </span>
          </div>
          <div className="text-title-lg font-bold text-on-surface">
            {savedTripsLimit == null ? (
              <span className="text-primary">Không giới hạn</span>
            ) : (
              <span>
                {savedTripsUsed} / {savedTripsLimit}
              </span>
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
