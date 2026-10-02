import { useEffect, useState, useRef, useCallback } from "react";
import QRCode from "react-qr-code";
import { subscriptionService } from "../../services/subscriptionService";
import { PLAN_DISPLAY_NAMES, formatPlanPrice } from "../../utils/subscriptionUtils";
import { PAYMENT_ORDER_STATUS } from "../../utils/subscriptionUpgradeContract";

const POLLING_INTERVAL_MS = 3000;

export default function PaymentCheckoutModal({
  isOpen,
  onClose,
  paymentIntent,
  onSuccess,
  onRetryPayment,
  onRetryCheckout,
}) {
  const [orderStatus, setOrderStatus] = useState(() => paymentIntent?.status || PAYMENT_ORDER_STATUS.PENDING);
  const [secondsLeft, setSecondsLeft] = useState(() => {
    if (!paymentIntent?.expiresAt) return 0;
    const diffMs = new Date(paymentIntent.expiresAt).getTime() - Date.now();
    return Math.max(0, Math.floor(diffMs / 1000));
  });
  const [pollError, setPollError] = useState("");
  const [isRetryingLookup, setIsRetryingLookup] = useState(false);

  const pollTimerRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const isFinalCheckDoneRef = useRef(false);
  const isCheckingRef = useRef(false);
  const reqSeqRef = useRef(0);

  const orderId = paymentIntent?.orderId;
  const qrCode = paymentIntent?.qrCode;
  const checkoutUrl = paymentIntent?.checkoutUrl;
  const amount = paymentIntent?.amount;
  const listPrice = paymentIntent?.listPrice;
  const creditAmount = paymentIntent?.creditAmount;
  const expiresAt = paymentIntent?.expiresAt;
  const planCode = paymentIntent?.planCode;
  const ownerId = paymentIntent?.ownerId;
  const planDisplayName = PLAN_DISPLAY_NAMES[planCode] || planCode || "Gói cước";
  const lastOrderIdRef = useRef(orderId);
  const lastOwnerIdRef = useRef(ownerId);

  // Stop polling helper
  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const lastStatusRef = useRef(paymentIntent?.status);

  // Reset state thanh toán nội bộ khi orderId, ownerId hoặc intent status thay đổi
  useEffect(() => {
    if (!orderId) return undefined;

    if (lastOrderIdRef.current !== orderId || lastOwnerIdRef.current !== ownerId) {
      lastOrderIdRef.current = orderId;
      lastOwnerIdRef.current = ownerId;
      lastStatusRef.current = paymentIntent?.status;
      reqSeqRef.current += 1;
      isCheckingRef.current = false;

      setOrderStatus(paymentIntent?.status || PAYMENT_ORDER_STATUS.PENDING);
      setPollError("");
      const diffMs = expiresAt ? new Date(expiresAt).getTime() - Date.now() : 0;
      setSecondsLeft(Math.max(0, Math.floor(diffMs / 1000)));
      isFinalCheckDoneRef.current = false;
      stopPolling();
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
    } else if (paymentIntent?.status && paymentIntent.status !== lastStatusRef.current) {
      lastStatusRef.current = paymentIntent.status;
      reqSeqRef.current += 1;
      setOrderStatus(paymentIntent.status);
    }
  }, [orderId, ownerId, paymentIntent?.status, expiresAt, stopPolling]);

  const handleRetry = () => {
    if (onRetryPayment) {
      onRetryPayment(paymentIntent);
    } else if (onRetryCheckout) {
      onRetryCheckout(paymentIntent);
    }
  };

  // Hàm kiểm tra trạng thái đơn hàng từ Backend (GET owned order is authority)
  const checkOrderStatus = useCallback(async () => {
    if (!orderId || isCheckingRef.current) return;
    const currentSeq = ++reqSeqRef.current;
    isCheckingRef.current = true;

    try {
      const order = await subscriptionService.getOrder(orderId);
      // Invalidate if request sequence or orderId has changed
      if (currentSeq !== reqSeqRef.current) return;
      setPollError("");

      if (order?.status) {
        setOrderStatus(order.status);
        if (order.status === PAYMENT_ORDER_STATUS.PAID) {
          stopPolling();
          if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
          if (onSuccess) onSuccess(order);
        } else if (
          order.status === PAYMENT_ORDER_STATUS.FAILED ||
          order.status === PAYMENT_ORDER_STATUS.EXPIRED ||
          order.status === PAYMENT_ORDER_STATUS.REVIEW_REQUIRED
        ) {
          stopPolling();
          if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
        }
      }
    } catch {
      if (currentSeq !== reqSeqRef.current) return;
      // Khi gặp lỗi mạng trong lúc poll, không tạo order mới, không đổi sang terminal status
      setPollError("Đang chờ xác nhận thanh toán từ ngân hàng hoặc chưa thể kết nối máy chủ...");
    } finally {
      if (currentSeq === reqSeqRef.current) {
        isCheckingRef.current = false;
      }
    }
  }, [orderId, onSuccess, stopPolling]);

  // Thủ công bấm kiểm tra lại đơn hàng (retry lookup only, never checkout)
  const handleManualLookupRetry = async () => {
    setIsRetryingLookup(true);
    await checkOrderStatus();
    setIsRetryingLookup(false);
  };

  // Khởi tạo và đếm ngược thời gian (DISPLAY ONLY - never synthesizes Expired)
  useEffect(() => {
    if (!isOpen || !expiresAt) return undefined;

    isFinalCheckDoneRef.current = false;

    const calculateRemainingSeconds = () => {
      const diffMs = new Date(expiresAt).getTime() - Date.now();
      return Math.max(0, Math.floor(diffMs / 1000));
    };

    countdownTimerRef.current = setInterval(() => {
      const remaining = calculateRemainingSeconds();
      setSecondsLeft(remaining);

      // Khi hết giờ trên client, gọi kiểm tra với BE để lấy trạng thái thật sự
      // TUYỆT ĐỐI KHÔNG tự đặt Expired trên FE khi chưa có xác nhận từ Backend
      if (remaining <= 0) {
        clearInterval(countdownTimerRef.current);
        if (!isFinalCheckDoneRef.current) {
          isFinalCheckDoneRef.current = true;
          checkOrderStatus();
        }
      }
    }, 1000);

    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [isOpen, expiresAt, checkOrderStatus]);

  // Khởi tạo vòng lặp Polling (Chỉ chạy khi Pending)
  useEffect(() => {
    if (!isOpen || !orderId || orderStatus !== PAYMENT_ORDER_STATUS.PENDING) {
      stopPolling();
      return undefined;
    }

    const initialTimer = setTimeout(() => {
      checkOrderStatus();
    }, 0);

    pollTimerRef.current = setInterval(() => {
      checkOrderStatus();
    }, POLLING_INTERVAL_MS);

    return () => {
      clearTimeout(initialTimer);
      stopPolling();
    };
  }, [isOpen, orderId, orderStatus, checkOrderStatus, stopPolling]);

  // Lắng nghe phím ESC để đóng modal
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      reqSeqRef.current += 1;
      isCheckingRef.current = false;
      stopPolling();
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [stopPolling]);

  if (!isOpen || !paymentIntent) return null;

  // Định dạng mm:ss
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const formattedCountdown = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const isPending = orderStatus === PAYMENT_ORDER_STATUS.PENDING;
  const isPaid = orderStatus === PAYMENT_ORDER_STATUS.PAID;
  const isFailed = orderStatus === PAYMENT_ORDER_STATUS.FAILED;
  const isExpired = orderStatus === PAYMENT_ORDER_STATUS.EXPIRED;
  const isReviewRequired = orderStatus === PAYMENT_ORDER_STATUS.REVIEW_REQUIRED;
  const isUnknown = !isPending && !isPaid && !isFailed && !isExpired && !isReviewRequired;

  const hasPayableHint = Boolean(qrCode || checkoutUrl);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in"
    >
      <div className="w-full max-w-md rounded-3xl bg-surface border border-outline-variant/30 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-outline-variant/20 px-6 py-4 bg-surface-container-lowest">
          <div>
            <h3
              id="payment-modal-title"
              className="text-title-md font-bold text-on-surface"
            >
              Thanh toán {planDisplayName}
            </h3>
            <div className="text-label-sm text-on-surface-variant font-medium">
              {listPrice != null && creditAmount != null && creditAmount > 0 && (
                <div className="text-text-muted text-xs line-through">
                  Giá gốc: {formatPlanPrice(listPrice)}
                </div>
              )}
              {creditAmount != null && creditAmount > 0 && (
                <div className="text-emerald-700 text-xs font-semibold">
                  Khấu trừ: -{formatPlanPrice(creditAmount)}
                </div>
              )}
              <p>
                Số tiền thanh toán:{" "}
                <strong className="text-primary font-extrabold">
                  {formatPlanPrice(amount)}
                </strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors"
            aria-label="Đóng cửa sổ thanh toán"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-center">
          {/* TRẠNG THÁI: PENDING (ĐANG CHỜ) */}
          {isPending && (
            <>
              {/* Status & Countdown banner */}
              <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-primary/10 border border-primary/20 text-label-md">
                <div className="flex items-center gap-2">
                  <span className="flex h-2.5 w-2.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
                  </span>
                  <span className="font-bold text-primary">Chờ thanh toán</span>
                </div>
                <div className="flex items-center gap-1.5 font-bold text-on-surface">
                  <span className="material-symbols-outlined text-[18px] text-text-muted">
                    schedule
                  </span>
                  <span>{expiresAt ? formattedCountdown : "--:--"}</span>
                </div>
              </div>

              {/* QR Code / Unresolved Link Hint */}
              {qrCode ? (
                <div className="flex flex-col items-center justify-center">
                  <div className="p-4 bg-white rounded-2xl border-2 border-outline-variant/40 shadow-inner flex items-center justify-center max-w-[240px] w-full aspect-square">
                    <QRCode
                      value={qrCode}
                      size={200}
                      style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                      viewBox="0 0 256 256"
                    />
                  </div>
                  <p className="text-label-sm text-text-muted mt-3 max-w-xs">
                    Mở ứng dụng Ngân hàng hoặc Ví điện tử bất kỳ để quét mã VietQR
                  </p>
                </div>
              ) : !hasPayableHint ? (
                <div className="py-4 space-y-2 border border-outline-variant/30 rounded-2xl bg-surface-container-lowest p-4">
                  <span className="material-symbols-outlined text-primary text-[32px] animate-spin">
                    progress_activity
                  </span>
                  <p className="text-body-md font-semibold text-on-surface">
                    Đơn hàng đang chờ xử lý
                  </p>
                  <p className="text-label-sm text-on-surface-variant">
                    Chưa có liên kết thanh toán trực tiếp. Hệ thống đang tiếp tục kiểm tra trạng thái đơn hàng.
                  </p>
                </div>
              ) : null}

              {/* Polling warning / status note with retry lookup button */}
              {pollError && (
                <div className="space-y-2">
                  <p className="text-label-sm text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
                    {pollError}
                  </p>
                  <button
                    type="button"
                    onClick={handleManualLookupRetry}
                    disabled={isRetryingLookup}
                    className="inline-flex items-center gap-1.5 text-label-sm font-bold text-primary hover:underline disabled:opacity-50"
                  >
                    <span className={`material-symbols-outlined text-[16px] ${isRetryingLookup ? "animate-spin" : ""}`}>
                      refresh
                    </span>
                    <span>Kiểm tra lại trạng thái</span>
                  </button>
                </div>
              )}

              {/* Open Checkout URL Button (Shown only when Pending and URL exists) */}
              {checkoutUrl && (
                <div className="pt-1 space-y-2">
                  <a
                    href={checkoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-navy-dark hover:bg-navy-darkest text-white font-bold text-label-md transition-all active:scale-98 shadow-sm"
                  >
                    <span>Mở trang thanh toán PayOS</span>
                    <span className="material-symbols-outlined text-[18px]">
                      open_in_new
                    </span>
                  </a>
                  <p className="text-label-xs text-text-faint">
                    Nếu không quét được mã, bạn có thể bấm để mở giao diện cổng thanh toán PayOS
                  </p>
                </div>
              )}
            </>
          )}

          {/* TRẠNG THÁI: PAID (THÀNH CÔNG) - NO QR */}
          {isPaid && (
            <div className="py-6 space-y-4 animate-fade-in-up">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
                <span
                  className="material-symbols-outlined text-[40px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  check_circle
                </span>
              </div>
              <div>
                <h4 className="text-title-lg font-bold text-on-surface">
                  Thanh toán thành công!
                </h4>
                <p className="text-body-md text-on-surface-variant mt-1.5">
                  Gói <strong className="text-primary font-bold">{planDisplayName}</strong> đã được kích hoạt thành công trên tài khoản của bạn.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 px-4 rounded-xl bg-primary text-on-primary font-bold text-label-md hover:bg-primary/90 transition-all shadow-md shadow-primary/25"
              >
                Bắt đầu trải nghiệm ngay
              </button>
            </div>
          )}

          {/* TRẠNG THÁI: REVIEW_REQUIRED (CẦN ĐỐI SOÁT) - NO QR, NO RETRY CHECKOUT */}
          {isReviewRequired && (
            <div className="py-6 space-y-4 animate-fade-in-up">
              <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto shadow-sm">
                <span className="material-symbols-outlined text-[36px]">
                  rate_review
                </span>
              </div>
              <div>
                <h4 className="text-title-lg font-bold text-on-surface">
                  Thanh toán đang cần được kiểm tra
                </h4>
                <p className="text-body-md text-on-surface-variant mt-1.5">
                  Giao dịch đang cần kiểm tra đối soát, vui lòng liên hệ bộ phận hỗ trợ hoặc đợi hệ thống xử lý. Vui lòng không thực hiện thanh toán lại.
                </p>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-2.5 rounded-xl border border-outline-variant text-on-surface font-semibold text-label-md hover:bg-surface-container-high transition-colors"
                >
                  Đóng
                </button>
              </div>
            </div>
          )}

          {/* TRẠNG THÁI: EXPIRED (HẾT HẠN) - NO QR */}
          {isExpired && (
            <div className="py-6 space-y-4 animate-fade-in-up">
              <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto shadow-sm">
                <span className="material-symbols-outlined text-[36px]">
                  timer_off
                </span>
              </div>
              <div>
                <h4 className="text-title-lg font-bold text-on-surface">
                  Mã thanh toán đã hết hạn
                </h4>
                <p className="text-body-md text-on-surface-variant mt-1.5">
                  Mã QR hiện tại đã quá thời gian chờ xử lý. Bạn có thể tạo mã mới để tiếp tục.
                </p>
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleRetry}
                  className="w-full py-3 px-4 rounded-xl bg-primary text-on-primary font-bold text-label-md hover:bg-primary/90 transition-all shadow-sm"
                >
                  Tạo mã thanh toán mới
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-2.5 rounded-xl border border-outline-variant text-on-surface-variant font-semibold text-label-md hover:bg-surface-container-high transition-colors"
                >
                  Đóng
                </button>
              </div>
            </div>
          )}

          {/* TRẠNG THÁI: FAILED (THẤT BẠI) - NO QR */}
          {isFailed && (
            <div className="py-6 space-y-4 animate-fade-in-up">
              <div className="w-16 h-16 rounded-full bg-error/10 text-error flex items-center justify-center mx-auto shadow-sm">
                <span className="material-symbols-outlined text-[36px]">
                  error
                </span>
              </div>
              <div>
                <h4 className="text-title-lg font-bold text-on-surface">
                  Thanh toán chưa hoàn tất
                </h4>
                <p className="text-body-md text-on-surface-variant mt-1.5">
                  Giao dịch chưa được hoàn tất hoặc bị hủy bỏ từ cổng thanh toán.
                </p>
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleRetry}
                  className="w-full py-3 px-4 rounded-xl bg-primary text-on-primary font-bold text-label-md hover:bg-primary/90 transition-all shadow-sm"
                >
                  Thử thanh toán lại
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-2.5 rounded-xl border border-outline-variant text-on-surface-variant font-semibold text-label-md hover:bg-surface-container-high transition-colors"
                >
                  Đóng
                </button>
              </div>
            </div>
          )}

          {/* TRẠNG THÁI KHÔNG XÁC ĐỊNH / UNKNOWN - FAIL SAFE */}
          {isUnknown && (
            <div className="py-6 space-y-4 animate-fade-in-up">
              <div className="w-16 h-16 rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center mx-auto shadow-sm">
                <span className="material-symbols-outlined text-[36px]">
                  help_outline
                </span>
              </div>
              <div>
                <h4 className="text-title-lg font-bold text-on-surface">
                  Trạng thái giao dịch: {orderStatus}
                </h4>
                <p className="text-body-md text-on-surface-variant mt-1.5">
                  Hệ thống đang ghi nhận trạng thái từ máy chủ. Vui lòng kiểm tra lại.
                </p>
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleManualLookupRetry}
                  disabled={isRetryingLookup}
                  className="w-full py-3 px-4 rounded-xl bg-primary text-on-primary font-bold text-label-md hover:bg-primary/90 transition-all shadow-sm disabled:opacity-50"
                >
                  Kiểm tra lại
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-2.5 rounded-xl border border-outline-variant text-on-surface-variant font-semibold text-label-md hover:bg-surface-container-high transition-colors"
                >
                  Đóng
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
