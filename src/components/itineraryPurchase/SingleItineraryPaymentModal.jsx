import { useEffect, useState, useRef, useCallback } from "react";
import QRCode from "react-qr-code";
import { itineraryPurchaseService } from "../../services/itineraryPurchaseService";
import {
  getSinglePaymentIntent,
  saveSinglePaymentIntent,
  clearSinglePaymentIntent,
} from "../../utils/itineraryPurchaseSession";
import { formatPlanPrice } from "../../utils/subscriptionUtils";

const POLLING_INTERVAL_MS = 3000;

function getInitialModalState() {
  const existing = getSinglePaymentIntent();
  if (existing?.orderId) {
    const isPaymentReady = Boolean(existing.qrCode || existing.checkoutUrl);
    return {
      uiState: isPaymentReady ? "PAYMENT_READY" : "PREPARING",
      order: {
        orderId: existing.orderId,
        amount: existing.amount,
        qrCode: existing.qrCode,
        checkoutUrl: existing.checkoutUrl,
        expiresAt: existing.expiresAt,
        status: existing.status || "Pending",
      },
      attemptId: existing.clientAttemptId || null,
      shouldPoll: true,
      shouldCheckout: false,
    };
  }
  if (existing?.clientAttemptId) {
    return {
      uiState: "CREATING",
      order: null,
      attemptId: existing.clientAttemptId,
      shouldPoll: false,
      shouldCheckout: true,
    };
  }
  return {
    uiState: "CREATING",
    order: null,
    attemptId: crypto.randomUUID(),
    shouldPoll: false,
    shouldCheckout: true,
  };
}

function SingleItineraryPaymentModalInner({
  onClose,
  draftTripId,
  availability,
  onUseEntitlement,
}) {
  const [initialData] = useState(getInitialModalState);
  const [uiState, setUiState] = useState(initialData.uiState);
  const [order, setOrder] = useState(initialData.order);
  const [errorMessage, setErrorMessage] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);

  const pollTimerRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const activeAttemptRef = useRef(initialData.attemptId);

  // Stop polling and countdown
  const stopTimers = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }, []);

  // Poll order status
  const pollOrder = useCallback(
    async (orderId) => {
      if (!orderId) return;

      try {
        const orderData = await itineraryPurchaseService.getOrder(orderId);
        setOrder(orderData);

        if (orderData?.status === "Paid") {
          // Success rule: order.status === "Paid" ALONE IS NOT ENOUGH.
          // Must have order.entitlement != null.
          if (orderData.entitlement != null) {
            setUiState("ENTITLEMENT_GRANTED");
            stopTimers();
            saveSinglePaymentIntent({
              ...getSinglePaymentIntent(),
              orderId,
              status: "Paid",
              entitlement: orderData.entitlement,
            });
          } else {
            // Paid but entitlement evidence not yet verified
            setUiState("VERIFYING");
          }
        } else if (orderData?.status === "Failed") {
          setUiState("FAILED");
          setErrorMessage("Giao dịch không thành công hoặc đã bị từ chối.");
          stopTimers();
        } else if (orderData?.status === "Expired") {
          setUiState("EXPIRED");
          stopTimers();
        } else if (orderData?.status === "Pending") {
          if (orderData.qrCode || orderData.checkoutUrl) {
            setUiState("PAYMENT_READY");
          } else {
            setUiState("PREPARING");
          }
        }
      } catch {
        // Network hiccups during polling should not terminate the session
      }
    },
    [stopTimers],
  );

  // Start polling loop
  const startPolling = useCallback(
    (orderId) => {
      stopTimers();
      pollTimerRef.current = setInterval(() => {
        pollOrder(orderId);
      }, POLLING_INTERVAL_MS);
    },
    [pollOrder, stopTimers],
  );

  // Setup countdown
  const startCountdown = useCallback(
    (expiresAt, orderId) => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
      if (!expiresAt) return;

      const targetMs = new Date(expiresAt).getTime();
      const updateTimer = () => {
        const nowMs = Date.now();
        const diffSec = Math.max(0, Math.floor((targetMs - nowMs) / 1000));
        setSecondsLeft(diffSec);

        if (diffSec <= 0) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
          // Final check before marking Expired
          if (orderId) {
            pollOrder(orderId);
          }
        }
      };

      updateTimer();
      countdownTimerRef.current = setInterval(updateTimer, 1000);
    },
    [pollOrder],
  );

  // Execute checkout with a specific attempt ID
  const performCheckout = useCallback(
    async (attemptId) => {
      setUiState("CREATING");
      setErrorMessage("");
      activeAttemptRef.current = attemptId;

      try {
        const { status, data } =
          await itineraryPurchaseService.checkout(attemptId);

        // Check if component unmounted or attempt changed
        if (activeAttemptRef.current !== attemptId) return;

        setOrder(data);

        // Save session intent to survive refresh/reopen
        saveSinglePaymentIntent({
          clientAttemptId: attemptId,
          orderId: data.orderId,
          productKind: data.productKind,
          amount: data.amount,
          expiresAt: data.expiresAt,
          draftTripId,
          qrCode: data.qrCode,
          checkoutUrl: data.checkoutUrl,
        });

        if (status === 202) {
          // HTTP 202: durable attempt exists, but link not yet available
          setUiState("PREPARING");
          startPolling(data.orderId);
        } else {
          // HTTP 200: usable order representation
          if (data.status === "Paid" && data.entitlement != null) {
            setUiState("ENTITLEMENT_GRANTED");
          } else if (data.status === "Paid") {
            setUiState("VERIFYING");
            startPolling(data.orderId);
          } else if (data.status === "Expired") {
            setUiState("EXPIRED");
          } else if (data.status === "Failed") {
            setUiState("FAILED");
            setErrorMessage("Giao dịch không thành công.");
          } else if (data.qrCode || data.checkoutUrl) {
            setUiState("PAYMENT_READY");
            startCountdown(data.expiresAt, data.orderId);
            startPolling(data.orderId);
          } else {
            setUiState("PREPARING");
            startPolling(data.orderId);
          }
        }
      } catch (err) {
        if (activeAttemptRef.current !== attemptId) return;
        setUiState("FAILED");
        setErrorMessage(
          err.message || "Không thể khởi tạo giao dịch thanh toán. Vui lòng thử lại.",
        );
      }
    },
    [draftTripId, startCountdown, startPolling],
  );

  // Initialize on mount
  useEffect(() => {
    let timer;
    if (initialData.shouldCheckout) {
      timer = setTimeout(() => {
        performCheckout(initialData.attemptId);
      }, 0);
    } else if (initialData.shouldPoll && initialData.order?.orderId) {
      if (initialData.order.expiresAt) {
        startCountdown(initialData.order.expiresAt, initialData.order.orderId);
      }
      startPolling(initialData.order.orderId);
      timer = setTimeout(() => {
        pollOrder(initialData.order.orderId);
      }, 0);
    }

    return () => {
      clearTimeout(timer);
      stopTimers();
    };
  }, [initialData, performCheckout, startCountdown, startPolling, pollOrder, stopTimers]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && uiState !== "CREATING") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [uiState, onClose]);

  // Start a new deliberate purchase (generates a new UUID only on deliberate action)
  const handleStartNewAttempt = () => {
    clearSinglePaymentIntent();
    stopTimers();
    const newAttemptId = crypto.randomUUID();
    performCheckout(newAttemptId);
  };

  // User chooses to use the granted entitlement
  const handleUseEntitlement = () => {
    if (order?.entitlement && onUseEntitlement) {
      onUseEntitlement(order.entitlement);
      clearSinglePaymentIntent();
      onClose();
    }
  };

  const displayPrice = order?.amount ?? availability?.price ?? 29000;
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const formattedCountdown = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="single-purchase-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in"
    >
      <div className="w-full max-w-md rounded-3xl bg-surface border border-outline-variant/30 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-outline-variant/20 px-6 py-4 bg-surface-container-lowest">
          <div>
            <h3
              id="single-purchase-title"
              className="text-title-md font-bold text-on-surface"
            >
              Mua thêm 1 lịch trình
            </h3>
            <p className="text-label-sm text-on-surface-variant font-medium">
              Giá thanh toán:{" "}
              <strong className="text-primary font-extrabold">
                {formatPlanPrice(displayPrice)}
              </strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={uiState === "CREATING"}
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors disabled:opacity-40"
            aria-label="Đóng cửa sổ"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-center">
          {/* Explanation */}
          <div className="rounded-xl bg-primary/5 border border-primary/15 p-3 text-left">
            <div className="flex items-start gap-2">
              <span className="material-symbols-outlined text-primary text-[18px] shrink-0 mt-0.5">
                verified
              </span>
              <div className="text-body-sm text-on-surface space-y-0.5">
                <p className="font-semibold text-primary">
                  Quyền chốt lịch trình vĩnh viễn
                </p>
                <p className="text-on-surface-variant text-[11px] leading-relaxed">
                  Chốt thêm một lịch trình ngoài giới hạn gói hiện tại. Quyền này không hết hạn và chỉ dùng cho một lịch trình.
                </p>
              </div>
            </div>
          </div>

          {/* STATE: CREATING */}
          {uiState === "CREATING" && (
            <div className="py-12 space-y-4">
              <span className="material-symbols-outlined text-primary text-[48px] animate-spin">
                progress_activity
              </span>
              <p className="text-body-md text-on-surface font-semibold">
                Đang khởi tạo giao dịch thanh toán...
              </p>
              <p className="text-label-xs text-on-surface-variant">
                Vui lòng đợi trong giây lát.
              </p>
            </div>
          )}

          {/* STATE: PREPARING (HTTP 202 / Pending without link) */}
          {uiState === "PREPARING" && (
            <div className="py-10 space-y-4">
              <span className="material-symbols-outlined text-primary text-[44px] animate-spin">
                sync
              </span>
              <div className="space-y-1">
                <h4 className="text-title-md font-bold text-on-surface">
                  Đang chuẩn bị giao dịch thanh toán...
                </h4>
                <p className="text-body-sm text-on-surface-variant max-w-xs mx-auto">
                  Hệ thống đang kết nối tới cổng thanh toán. Mã QR sẽ hiển thị ngay khi sẵn sàng.
                </p>
              </div>
            </div>
          )}

          {/* STATE: PAYMENT_READY (Pending + QR / CheckoutUrl) */}
          {uiState === "PAYMENT_READY" && (
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
                  <span>{formattedCountdown}</span>
                </div>
              </div>

              {/* VietQR Code */}
              <div className="flex flex-col items-center justify-center">
                <div className="p-4 bg-white rounded-2xl border-2 border-outline-variant/40 shadow-inner flex items-center justify-center max-w-[240px] w-full aspect-square">
                  {order?.qrCode ? (
                    <QRCode
                      value={order.qrCode}
                      size={200}
                      style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                      viewBox="0 0 256 256"
                    />
                  ) : (
                    <div className="text-label-md text-text-muted">
                      Đang tải mã QR...
                    </div>
                  )}
                </div>
                <p className="text-label-sm text-text-muted mt-3 max-w-xs">
                  Mở ứng dụng Ngân hàng hoặc Ví điện tử để quét mã VietQR
                </p>
              </div>

              {/* Checkout URL Link */}
              {order?.checkoutUrl && (
                <div className="pt-1 space-y-2">
                  <a
                    href={order.checkoutUrl}
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
                    Nếu không quét được mã, bấm để mở cổng thanh toán PayOS
                  </p>
                </div>
              )}
            </>
          )}

          {/* STATE: VERIFYING (Paid but entitlement not yet present) */}
          {uiState === "VERIFYING" && (
            <div className="py-10 space-y-4">
              <span className="material-symbols-outlined text-primary text-[44px] animate-spin">
                hourglass_top
              </span>
              <div className="space-y-1">
                <h4 className="text-title-md font-bold text-on-surface">
                  Đang xác nhận quyền chốt lịch trình...
                </h4>
                <p className="text-body-sm text-on-surface-variant max-w-xs mx-auto">
                  Khoản thanh toán đã được nhận. Hệ thống đang cấp phát quyền lưu cho tài khoản.
                </p>
              </div>
            </div>
          )}

          {/* STATE: ENTITLEMENT_GRANTED (Authoritative success) */}
          {uiState === "ENTITLEMENT_GRANTED" && (
            <div className="py-6 space-y-5 animate-fade-in-up">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
                <span
                  className="material-symbols-outlined text-[40px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  check_circle
                </span>
              </div>
              <div className="space-y-1">
                <h4 className="text-title-lg font-bold text-on-surface">
                  Thanh toán thành công!
                </h4>
                <p className="text-body-md text-on-surface-variant font-medium">
                  Bạn đã có thêm 1 lượt chốt lịch trình.
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleUseEntitlement}
                  className="w-full py-3 px-4 rounded-xl bg-primary text-on-primary font-bold text-label-md hover:bg-primary/90 transition-all shadow-md shadow-primary/25"
                >
                  Dùng lượt này để chốt lịch trình
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-2.5 rounded-xl border border-outline-variant text-on-surface-variant font-semibold text-label-md hover:bg-surface-container-high transition-colors"
                >
                  Để sau
                </button>
              </div>
            </div>
          )}

          {/* STATE: EXPIRED */}
          {uiState === "EXPIRED" && (
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
                  onClick={handleStartNewAttempt}
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

          {/* STATE: FAILED */}
          {uiState === "FAILED" && (
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
                  {errorMessage || "Giao dịch chưa được hoàn tất hoặc đã bị hủy từ cổng thanh toán."}
                </p>
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleStartNewAttempt}
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
        </div>
      </div>
    </div>
  );
}

export default function SingleItineraryPaymentModal({ isOpen, ...props }) {
  if (!isOpen) return null;
  return <SingleItineraryPaymentModalInner {...props} />;
}
