import { useEffect, useState, useRef, useCallback } from "react";
import QRCode from "react-qr-code";
import { useAuth } from "../../context/AuthContext";
import {
  itineraryPurchaseService, canPurchaseSingle,
  isAvailableSingleEntitlement, singleOrderState,
} from "../../services/itineraryPurchaseService";
import {
  getSinglePaymentIntent, saveSinglePaymentIntent, prepareSinglePaymentReturn,
} from "../../utils/itineraryPurchaseSession";
import { formatPlanPrice } from "../../utils/subscriptionUtils";

const POLLING_INTERVAL_MS = 3000;

function SingleItineraryPaymentModalInner({
  ownerId, onClose, draftTripId, availability, onUseEntitlement,
}) {
  const [initialIntent] = useState(() => getSinglePaymentIntent(ownerId));
  const [uiState, setUiState] = useState(
    initialIntent?.orderId ? "READING" : initialIntent?.clientAttemptId ? "UNCERTAIN" : "IDLE",
  );
  const [order, setOrder] = useState(null);
  const [readError, setReadError] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const activeRef = useRef(false);
  const generationRef = useRef(0);
  const attemptRef = useRef(initialIntent?.clientAttemptId ?? null);
  const orderIdRef = useRef(initialIntent?.orderId ?? null);
  const checkoutRef = useRef(false);
  const lookupRef = useRef(false);
  const timerRef = useRef(null);
  const dialogRef = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    dialogRef.current?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);
  const purchaseAllowed = canPurchaseSingle(availability);

  const stopPolling = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const isCurrent = useCallback((generation, attemptId, orderId) => {
    const stored = getSinglePaymentIntent(ownerId);
    return activeRef.current && generationRef.current === generation &&
      attemptRef.current === attemptId && orderIdRef.current === orderId &&
      (stored?.clientAttemptId ?? null) === attemptId && (stored?.orderId ?? null) === orderId;
  }, [ownerId]);

  const acceptOrder = useCallback((data, attemptId) => {
    setOrder(data);
    setUiState(singleOrderState(data));
    setReadError("");
    saveSinglePaymentIntent(ownerId, {
      ...data, clientAttemptId: attemptId, draftTripId,
    });
  }, [ownerId, draftTripId]);

  const readOrder = useCallback(async (generation, attemptId, orderId) => {
    if (!isCurrent(generation, attemptId, orderId)) return false;
    if (lookupRef.current) return true;
    lookupRef.current = true;
    try {
      const data = await itineraryPurchaseService.getOrder(orderId);
      if (!isCurrent(generation, attemptId, orderId)) return false;
      if (data?.orderId !== orderId || data.productKind !== "SingleItinerary" ||
        !Number.isSafeInteger(data.amount) || data.amount <= 0) {
        throw new Error("Invalid owned order");
      }
      acceptOrder(data, attemptId);
      return data.status === "Pending" || (data.status === "Paid" && data.entitlement == null);
    } catch {
      if (!isCurrent(generation, attemptId, orderId)) return false;
      setReadError("Chưa thể xác nhận trạng thái. Vui lòng kiểm tra lại.");
      return true;
    } finally {
      lookupRef.current = false;
    }
  }, [isCurrent, acceptOrder]);

  const startPolling = useCallback((generation, attemptId, orderId, delay = POLLING_INTERVAL_MS) => {
    stopPolling();
    const tick = async () => {
      const keepReading = await readOrder(generation, attemptId, orderId);
      if (keepReading && isCurrent(generation, attemptId, orderId)) {
        timerRef.current = setTimeout(tick, POLLING_INTERVAL_MS);
      }
    };
    timerRef.current = setTimeout(tick, delay);
  }, [stopPolling, readOrder, isCurrent]);

  const performCheckout = useCallback(async (newPurchase = false) => {
    if (!activeRef.current || checkoutRef.current || !purchaseAllowed) return;
    const attemptId = newPurchase || !attemptRef.current
      ? crypto.randomUUID() : attemptRef.current;
    stopPolling();
    const generation = ++generationRef.current;
    attemptRef.current = attemptId;
    orderIdRef.current = null;
    setOrder(null);
    setReadError("");
    // Persistence is a prerequisite, not a best-effort step after the charge.
    if (!saveSinglePaymentIntent(ownerId, { clientAttemptId: attemptId, draftTripId })) {
      setUiState("STORAGE_UNAVAILABLE");
      return;
    }
    checkoutRef.current = true;
    setUiState("CREATING");
    try {
      const { status, data } = await itineraryPurchaseService.checkout(attemptId);
      if (!isCurrent(generation, attemptId, null)) return;
      if (!data?.orderId || data.productKind !== "SingleItinerary" ||
        !Number.isSafeInteger(data.amount) || data.amount <= 0) {
        throw new Error("Invalid checkout response");
      }
      orderIdRef.current = data.orderId;
      acceptOrder(data, attemptId);
      if (status === 202 && data.status == null) setUiState("PREPARING");
      if ((status === 202 && data.status == null) || data.status === "Pending" ||
        (data.status === "Paid" && data.entitlement == null)) {
        startPolling(generation, attemptId, data.orderId);
      }
    } catch {
      if (activeRef.current && generationRef.current === generation &&
        getSinglePaymentIntent(ownerId)?.clientAttemptId === attemptId) {
        setUiState("UNCERTAIN");
      }
    } finally {
      checkoutRef.current = false;
    }
  }, [purchaseAllowed, stopPolling, ownerId, draftTripId, isCurrent, acceptOrder, startPolling]);

  useEffect(() => {
    ++generationRef.current;
    activeRef.current = true;
    let initialTimer;
    if (initialIntent?.orderId) {
      startPolling(generationRef.current, attemptRef.current, initialIntent.orderId, 0);
    } else if (!initialIntent) {
      initialTimer = setTimeout(() => performCheckout(), 0);
    }
    return () => {
      activeRef.current = false;
      clearTimeout(initialTimer);
      stopPolling();
    };
  }, [initialIntent, performCheckout, startPolling, stopPolling]);

  useEffect(() => {
    if (!order?.expiresAt || order.status !== "Pending") return undefined;
    const update = () => {
      const remaining = Math.max(0, Math.floor((Date.parse(order.expiresAt) - Date.now()) / 1000));
      setSecondsLeft(Number.isFinite(remaining) ? remaining : 0);
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [order?.expiresAt, order?.status]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Tab") {
        const controls = dialogRef.current?.querySelectorAll('button:not(:disabled), a[href]');
        const first = controls?.[0];
        const last = controls?.[controls.length - 1];
        if (!first) event.preventDefault();
        else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first.focus();
        }
      }
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const retryRead = () => {
    if (orderIdRef.current && !lookupRef.current) {
      startPolling(generationRef.current, attemptRef.current, orderIdRef.current, 0);
    }
  };
  const handleUseEntitlement = () => {
    if (activeRef.current && isAvailableSingleEntitlement(order?.entitlement)) {
      onUseEntitlement?.(order.entitlement);
    }
  };
  const amount = order ? order.amount : availability?.price;
  const validAmount = Number.isSafeInteger(amount) && amount > 0;
  const countdown = `${String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:${String(secondsLeft % 60).padStart(2, "0")}`;
  const granted = uiState === "ENTITLEMENT_GRANTED";
  const terminal = uiState === "FAILED" || uiState === "EXPIRED";
  const canStartAnother = purchaseAllowed && (granted || terminal);
  const unavailable = !purchaseAllowed && !initialIntent && !order;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="single-purchase-title"
      ref={dialogRef} tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-sm [&_button]:min-h-11 [&_button]:rounded-[8px] [&_button:focus-visible]:outline [&_button:focus-visible]:outline-2 [&_button:focus-visible]:outline-offset-2 [&_button:focus-visible]:outline-primary [&_a:focus-visible]:outline [&_a:focus-visible]:outline-2 [&_a:focus-visible]:outline-primary">
      <div className="w-full max-w-md rounded-[8px] bg-surface border border-outline-variant/30 shadow-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-24px)] min-w-0 break-words">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-outline-variant/20 px-4 sm:px-6 py-4">
          <div className="min-w-0">
            <h3 id="single-purchase-title" className="text-title-md font-bold text-on-surface">Mua thêm 1 lịch trình</h3>
            <p className="text-label-sm text-on-surface-variant">
              Giá thanh toán: <strong className="text-primary">{validAmount ? formatPlanPrice(amount) : "Chưa xác định"}</strong>
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng cửa sổ" title="Đóng cửa sổ"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:bg-surface-container-high">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <div className="p-4 sm:p-6 min-h-0 overflow-y-auto space-y-5 text-center" aria-live="polite">
          <p className="text-body-sm text-on-surface-variant">
            Một lượt chốt vĩnh viễn, ngoài hạn mức gói. Lượt mua chưa gắn với lịch trình và chỉ dùng khi bạn chọn chốt; có thể để dành cho sau.
          </p>
          {unavailable ? (
            <p role="alert" className="text-body-md text-on-surface-variant">Hiện chưa thể mua thêm lịch trình. Vui lòng tải lại thông tin khả dụng.</p>
          ) : uiState === "CREATING" || uiState === "READING" || uiState === "PREPARING" || uiState === "VERIFYING" ? (
            <div className="py-8 space-y-3" role="status">
              <span className="material-symbols-outlined text-primary text-[40px] animate-spin">progress_activity</span>
              <h4 className="text-title-md font-bold">
                {uiState === "VERIFYING" ? "Đang xác nhận quyền chốt lịch trình..." :
                  uiState === "PREPARING" ? "Đang chuẩn bị giao dịch thanh toán..." :
                  uiState === "READING" ? "Đang kiểm tra đơn hàng đã sở hữu..." :
                  "Đang khởi tạo giao dịch thanh toán..."}
              </h4>
            </div>
          ) : uiState === "PAYMENT_READY" ? (
            <>
              <div className="flex justify-between gap-3 rounded-lg bg-primary/10 p-3 text-primary font-semibold">
                <span>Chờ thanh toán</span><span>{countdown}</span>
              </div>
              {order.qrCode && <div className="mx-auto p-4 bg-white rounded-lg border max-w-[240px] aspect-square">
                <QRCode value={order.qrCode} size={200} style={{ height: "auto", maxWidth: "100%", width: "100%" }} />
              </div>}
              {order.checkoutUrl && <a href={`/payment/success?singleCheckout=${encodeURIComponent(order.orderId)}`}
                target="_blank" rel="noopener noreferrer"
                onClick={(event) => {
                  if (!prepareSinglePaymentReturn(ownerId, {
                    orderId: order.orderId, productKind: order.productKind,
                    clientAttemptId: attemptRef.current, draftTripId,
                  })) {
                    event.preventDefault();
                    setReadError("Chưa thể mở thanh toán an toàn. Vui lòng thử lại.");
                  }
                }}
                className="inline-flex w-full justify-center gap-2 rounded-lg bg-navy-dark py-3 px-4 text-white font-semibold">
                Mở trang thanh toán PayOS<span className="material-symbols-outlined text-[20px]">open_in_new</span>
              </a>}
            </>
          ) : granted ? (
            <div className="space-y-4">
              <span className="material-symbols-outlined text-emerald-600 text-[40px]">check_circle</span>
              <h4 className="text-title-md font-bold">Thanh toán thành công!</h4>
              <p>Bạn đã có thêm 1 lượt chốt lịch trình.</p>
              {draftTripId && onUseEntitlement && isAvailableSingleEntitlement(order?.entitlement) && (
                <button type="button" onClick={handleUseEntitlement}
                  className="w-full rounded-lg bg-primary py-3 px-4 text-on-primary font-semibold">
                  Dùng lượt này để chốt lịch trình
                </button>
              )}
              <button type="button" onClick={onClose} className="w-full rounded-lg border py-3">Để sau</button>
            </div>
          ) : terminal ? (
            <div className="space-y-3" role="status">
              <span className="material-symbols-outlined text-[36px]">{uiState === "EXPIRED" ? "timer_off" : "error"}</span>
              <h4 className="text-title-md font-bold">{uiState === "EXPIRED" ? "Mã thanh toán đã hết hạn" : "Thanh toán chưa hoàn tất"}</h4>
              <p className="text-body-sm text-on-surface-variant">Trạng thái hiện tại được xác nhận từ máy chủ. Bạn có thể kiểm tra lại đơn hàng.</p>
            </div>
          ) : uiState === "UNCERTAIN" ? (
            <div className="space-y-3" role="alert">
              <h4 className="text-title-md font-bold">Chưa xác nhận được giao dịch</h4>
              <p className="text-body-sm text-on-surface-variant">Kết nối bị gián đoạn. Thử lại cùng lượt mua để tránh tạo thêm giao dịch.</p>
              <button type="button" disabled={!purchaseAllowed} onClick={() => performCheckout()}
                className="w-full rounded-lg bg-primary py-3 px-4 text-on-primary font-semibold disabled:opacity-50">Thử lại cùng lượt mua</button>
            </div>
          ) : uiState === "STORAGE_UNAVAILABLE" ? (
            <p role="alert">Chưa thể lưu lượt mua an toàn trên trình duyệt. Vui lòng kiểm tra bộ nhớ phiên rồi thử lại.</p>
          ) : uiState === "UNRESOLVED" ? (
            <p role="status">Chưa xác nhận được trạng thái đơn hàng.</p>
          ) : null}
          {readError && <p role="alert" className="text-body-sm text-error">{readError}</p>}
          {(order?.orderId || (uiState === "READING" && initialIntent?.orderId)) && <button type="button" onClick={retryRead}
            className="w-full rounded-lg border py-2.5">Kiểm tra lại trạng thái</button>}
          {canStartAnother && <button type="button" onClick={() => performCheckout(true)}
            className="w-full rounded-lg border py-2.5">Mua thêm một lượt mới</button>}
        </div>
      </div>
    </div>
  );
}

export default function SingleItineraryPaymentModal({ isOpen, ...props }) {
  const { user, isDemo } = useAuth();
  const [openedOwner] = useState(user?.id);
  if (!isOpen || !user?.id || isDemo || user.id !== openedOwner) return null;
  return <SingleItineraryPaymentModalInner key={user.id} ownerId={user.id} {...props} />;
}
