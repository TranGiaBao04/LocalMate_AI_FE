import { useEffect } from "react";
import {
  CHECKOUT_QUOTE_TYPE,
  CUSTOMER_SUBSCRIPTION_ERROR_CODES,
  extractErrorCode,
  getCustomerErrorMessage,
} from "../../utils/subscriptionUpgradeContract";
import { PLAN_DISPLAY_NAMES, formatPlanPrice } from "../../utils/subscriptionUtils";

/**
 * Dialog displaying authoritative server checkout quote preview before payment confirmation.
 * Strictly adheres to backend values:
 * - Direct rendering of listPrice, creditAmount, amount, durationDays
 * - Explanatory credits[] breakdown without client-side summing or recalculation
 * - Backend-driven Purchase / Upgrade classification
 * - Safe presentation of blocked classification states (409 codes)
 * - Confirmation sends only planCode, never financial fields
 *
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {() => void} props.onClose
 * @param {import("../../utils/subscriptionUpgradeContract").CheckoutQuote|null} props.quote
 * @param {boolean} [props.loading]
 * @param {any} [props.error]
 * @param {(planCode: string) => void} props.onConfirm
 * @param {boolean} [props.confirmLoading]
 * @param {() => void} [props.onRenew]
 */
export default function CheckoutQuoteDialog({
  isOpen,
  onClose,
  quote,
  loading = false,
  error = null,
  onConfirm,
  confirmLoading = false,
  onRenew,
}) {
  // ESC key support
  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && !confirmLoading) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, confirmLoading]);

  if (!isOpen) return null;

  const errorCode = extractErrorCode(error);
  const status =
    typeof error?.status === "number"
      ? error.status
      : typeof error?.data?.status === "number"
        ? error.data.status
        : null;

  const isPlanAlreadyActive =
    errorCode === CUSTOMER_SUBSCRIPTION_ERROR_CODES.PLAN_ALREADY_ACTIVE &&
    (status === 409 || status === null);
  const isAlreadyCovered =
    errorCode === CUSTOMER_SUBSCRIPTION_ERROR_CODES.ALREADY_COVERED_BY_HIGHER_PLAN &&
    (status === 409 || status === null);
  const isTargetScheduled =
    errorCode === CUSTOMER_SUBSCRIPTION_ERROR_CODES.TARGET_PLAN_ALREADY_SCHEDULED &&
    (status === 409 || status === null);
  const isInvalidPlan =
    errorCode === CUSTOMER_SUBSCRIPTION_ERROR_CODES.INVALID_PLAN_CODE &&
    (status === 400 || status === null);

  const targetPlanCode = quote?.planCode;
  const displayName = targetPlanCode
    ? PLAN_DISPLAY_NAMES[targetPlanCode] || targetPlanCode
    : "Gói cước";

  const isUpgrade = quote?.type === CHECKOUT_QUOTE_TYPE.UPGRADE;
  const isPurchase = quote?.type === CHECKOUT_QUOTE_TYPE.PURCHASE;
  const isSupportedQuote = quote && (isUpgrade || isPurchase);

  const getHeaderTitle = () => {
    if (loading) return "Báo giá gói cước";
    if (error) {
      if (isPlanAlreadyActive) return "Gói cước đang hoạt động";
      if (isAlreadyCovered) return "Không thể chọn gói này";
      if (isTargetScheduled) return "Gói cước đã được lên lịch";
      if (isInvalidPlan) return "Gói cước không khả dụng";
      return "Thông báo gói cước";
    }
    if (!isSupportedQuote && quote) return "Báo giá không được hỗ trợ";
    if (isUpgrade) return "Xác nhận nâng cấp gói cước";
    return "Xác nhận đăng ký gói cước";
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-quote-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !confirmLoading) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-lg rounded-3xl bg-surface border border-outline-variant/30 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-outline-variant/20 px-6 py-4 bg-surface-container-lowest">
          <div>
            <h3
              id="checkout-quote-title"
              className="text-title-md font-bold text-on-surface"
            >
              {getHeaderTitle()}
            </h3>
            {targetPlanCode && isSupportedQuote && (
              <p className="text-label-sm text-on-surface-variant font-medium">
                {displayName} ({targetPlanCode})
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={confirmLoading}
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors disabled:opacity-50"
            aria-label="Đóng"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* 1. Loading State */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-10 space-y-3 text-center">
              <span className="material-symbols-outlined text-primary text-[40px] animate-spin">
                progress_activity
              </span>
              <p className="text-body-md text-on-surface font-medium">
                Đang lấy thông tin báo giá từ hệ thống...
              </p>
              <p className="text-label-sm text-text-muted">
                Hệ thống đang xác định chính xác số tiền và khấu trừ (nếu có)
              </p>
            </div>
          )}

          {/* 2. Error / Blocker States */}
          {!loading && error && (
            <div className="space-y-4">
              {isPlanAlreadyActive ? (
                <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-left space-y-2">
                  <div className="flex items-center gap-2 text-emerald-900 font-bold text-body-md">
                    <span
                      className="material-symbols-outlined text-emerald-600 text-[22px]"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      check_circle
                    </span>
                    <span>Gói này đang hoạt động</span>
                  </div>
                  <p className="text-body-sm text-emerald-800">
                    Gói dịch vụ này hiện đang hoạt động trên tài khoản của bạn.
                    Bạn có thể tiếp tục gia hạn để kéo dài thời gian sử dụng.
                  </p>
                </div>
              ) : isAlreadyCovered ? (
                <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 text-left space-y-2">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-body-md">
                    <span className="material-symbols-outlined text-amber-600 text-[22px]">
                      shield
                    </span>
                    <span>Đã bao gồm trong gói hiện tại</span>
                  </div>
                  <p className="text-body-sm text-amber-800">
                    Gói hiện tại của bạn đã bao gồm đầy đủ quyền lợi này. Bạn không cần mua thêm gói dịch vụ này.
                  </p>
                </div>
              ) : isTargetScheduled ? (
                <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 text-left space-y-2">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-body-md">
                    <span className="material-symbols-outlined text-amber-600 text-[22px]">
                      event_upcoming
                    </span>
                    <span>Gói đã được lên lịch</span>
                  </div>
                  <p className="text-body-sm text-amber-800">
                    Gói cước này đã được lên lịch kích hoạt trong tương lai trên tài khoản của bạn.
                  </p>
                </div>
              ) : isInvalidPlan ? (
                <div className="p-5 rounded-2xl bg-error/5 border border-error/20 text-left space-y-2">
                  <div className="flex items-center gap-2 text-error font-bold text-body-md">
                    <span className="material-symbols-outlined text-error text-[22px]">
                      error
                    </span>
                    <span>Gói cước không hợp lệ</span>
                  </div>
                  <p className="text-body-sm text-on-surface-variant">
                    Gói dịch vụ không hợp lệ hoặc không còn khả dụng trên hệ thống.
                  </p>
                </div>
              ) : (
                <div className="p-5 rounded-2xl bg-error/5 border border-error/20 text-left space-y-2">
                  <div className="flex items-center gap-2 text-error font-bold text-body-md">
                    <span className="material-symbols-outlined text-error text-[22px]">
                      error
                    </span>
                    <span>Không thể lấy báo giá</span>
                  </div>
                  <p className="text-body-sm text-on-surface-variant">
                    {getCustomerErrorMessage(errorCode, error?.message)}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 3. Fail-safe: Unknown Quote Type */}
          {!loading && !error && quote && !isSupportedQuote && (
            <div className="p-5 rounded-2xl bg-error/5 border border-error/20 text-left space-y-2">
              <div className="flex items-center gap-2 text-error font-bold text-body-md">
                <span className="material-symbols-outlined text-error text-[22px]">
                  warning
                </span>
                <span>Loại giao dịch không được hỗ trợ</span>
              </div>
              <p className="text-body-sm text-on-surface-variant">
                Phản hồi báo giá từ máy chủ chứa loại giao dịch chưa được hỗ trợ. Vui lòng liên hệ quản trị viên để được hỗ trợ.
              </p>
            </div>
          )}

          {/* 4. Supported Authoritative Quote Preview */}
          {!loading && !error && isSupportedQuote && (
            <div className="space-y-5">
              {/* Operation type & plan badge */}
              <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
                <div className="flex items-center gap-2">
                  <span
                    data-testid="quote-type-badge"
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      isUpgrade
                        ? "bg-blue-100 text-blue-800 border border-blue-200"
                        : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                    }`}
                  >
                    {isUpgrade ? "Nâng cấp gói" : "Mua mới"}
                  </span>
                  <span
                    data-testid="quote-type"
                    className="sr-only"
                  >
                    {quote.type}
                  </span>
                </div>
                <div className="text-right">
                  <span
                    data-testid="quote-plan-code"
                    className="font-bold text-on-surface text-body-md"
                  >
                    {displayName}
                  </span>
                </div>
              </div>

              {/* Financial summary card */}
              <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30 space-y-3">
                <div className="flex items-center justify-between text-body-md">
                  <span className="text-on-surface-variant">
                    {isUpgrade ? "Giá niêm yết gói mới:" : "Giá gói:"}
                  </span>
                  <span
                    data-testid="quote-list-price"
                    className="font-semibold text-on-surface"
                  >
                    {formatPlanPrice(quote.listPrice)}
                  </span>
                </div>

                {isUpgrade && (
                  <div className="flex items-center justify-between text-body-md">
                    <span className="text-on-surface-variant">
                      Khấu trừ thời gian chưa dùng:
                    </span>
                    <span
                      data-testid="quote-credit-amount"
                      className="font-bold text-emerald-700"
                    >
                      - {formatPlanPrice(quote.creditAmount)}
                    </span>
                  </div>
                )}

                <div className="pt-2 border-t border-outline-variant/20 flex items-baseline justify-between">
                  <span className="font-bold text-on-surface text-body-md">
                    Số tiền thanh toán:
                  </span>
                  <span
                    data-testid="quote-payable-amount"
                    className="text-2xl font-black text-primary tracking-tight"
                  >
                    {formatPlanPrice(quote.amount)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-label-md text-on-surface-variant pt-1 border-t border-outline-variant/10">
                  <span>Thời hạn sử dụng gói mới:</span>
                  <span
                    data-testid="quote-duration-days"
                    className="font-bold text-on-surface"
                  >
                    {quote.durationDays} ngày
                  </span>
                </div>
              </div>

              {/* Term Duration Concept Note */}
              <p className="text-label-sm text-text-muted leading-relaxed">
                {isUpgrade ? (
                  <>
                    Giá trị chưa sử dụng của các gói trước được khấu trừ trực tiếp vào đơn thanh toán này. Gói nâng cấp sẽ nhận trọn vẹn <strong>{quote.durationDays} ngày</strong> thời hạn mới kể từ thời điểm thanh toán thành công.
                  </>
                ) : (
                  <>
                    Gói dịch vụ có thời hạn sử dụng <strong>{quote.durationDays} ngày</strong> trọn vẹn kể từ khi giao dịch được xác nhận thanh toán thành công.
                  </>
                )}
              </p>

              {/* Explanatory Credits Section (Upgrade only) */}
              {isUpgrade && Array.isArray(quote.credits) && quote.credits.length > 0 && (
                <div
                  data-testid="quote-credits-section"
                  className="space-y-2 pt-2 border-t border-outline-variant/20"
                >
                  <p className="text-label-sm font-bold text-on-surface">
                    Chi tiết nguồn khấu trừ:
                  </p>
                  <div className="space-y-2">
                    {quote.credits.map((credit, idx) => (
                      <div
                        key={`${credit.planCode}-${idx}`}
                        data-testid="credit-row"
                        className="p-3 rounded-xl bg-surface border border-outline-variant/30 flex items-center justify-between text-body-sm"
                      >
                        <div>
                          <div
                            data-testid="credit-row-name"
                            className="font-semibold text-on-surface"
                          >
                            {credit.planName} ({credit.planCode})
                          </div>
                          <div
                            data-testid="credit-row-days"
                            className="text-label-sm text-on-surface-variant"
                          >
                            Còn lại {credit.remainingDays} ngày
                          </div>
                        </div>
                        <div className="text-right">
                          <span
                            data-testid="credit-row-amount"
                            className="font-bold text-emerald-700"
                          >
                            {formatPlanPrice(credit.creditAmount)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-label-xs text-text-faint">
                    * Số ngày còn lại là bằng chứng căn cứ tính toán khấu trừ giá trị, không cộng dồn vào thời hạn gói mới.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Dialog Footer Actions */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-outline-variant/20 bg-surface-container-lowest">
          {/* Action on plan_already_active: Renew Handoff */}
          {isPlanAlreadyActive && onRenew && (
            <button
              type="button"
              onClick={onRenew}
              disabled={confirmLoading}
              data-testid="quote-renew-button"
              className="px-6 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-label-md hover:bg-primary/90 transition-all active:scale-98 shadow-sm"
            >
              Gia hạn gói này
            </button>
          )}

          {/* Standard Cancel / Close */}
          <button
            type="button"
            onClick={onClose}
            disabled={confirmLoading}
            data-testid="quote-cancel-button"
            className="px-5 py-2.5 rounded-xl border border-outline-variant/60 font-semibold text-label-md text-on-surface-variant hover:bg-surface-container-high transition-colors disabled:opacity-50"
          >
            {isSupportedQuote ? "Hủy" : "Đóng"}
          </button>

          {/* Explicit Confirmation (Only on supported quotes) */}
          {isSupportedQuote && (
            <button
              type="button"
              onClick={() => onConfirm(quote.planCode)}
              disabled={confirmLoading}
              data-testid="quote-confirm-button"
              className="px-6 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-label-md hover:bg-primary/90 transition-all active:scale-98 shadow-sm disabled:opacity-50 flex items-center gap-2"
            >
              {confirmLoading ? (
                <>
                  <span className="material-symbols-outlined text-[18px] animate-spin">
                    progress_activity
                  </span>
                  <span>Đang xử lý...</span>
                </>
              ) : (
                <span>
                  {isUpgrade ? "Xác nhận nâng cấp" : "Xác nhận thanh toán"}
                </span>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
