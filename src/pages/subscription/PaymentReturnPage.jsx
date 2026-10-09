import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { subscriptionService } from "../../services/subscriptionService";
import { itineraryPurchaseService, singleOrderState } from "../../services/itineraryPurchaseService";
import { useAuth } from "../../context/AuthContext";
import { useSubscription } from "../../context/SubscriptionContext";
import { PLAN_DISPLAY_NAMES } from "../../utils/subscriptionUtils";
import {
  getSinglePaymentReturnIntent,
  openSinglePaymentCheckout,
  saveSinglePaymentIntent,
} from "../../utils/itineraryPurchaseSession";
import {
  getSubscriptionPaymentSession,
  clearSubscriptionPaymentSession,
} from "../../utils/subscriptionPaymentSession";
import { PAYMENT_ORDER_STATUS } from "../../utils/subscriptionUpgradeContract";

function SinglePaymentReturn({ ownerId, orderId, attemptId, draftTripId, openCheckout }) {
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");
  const [reading, setReading] = useState(true);
  const [retry, setRetry] = useState(0);
  const inFlight = useRef(false);

  useEffect(() => {
    let active = true;
    let timer;
    const current = () => {
      const session = getSinglePaymentReturnIntent(ownerId, orderId);
      return active && session?.orderId === orderId &&
        (session?.clientAttemptId ?? null) === attemptId;
    };
    const read = async () => {
      if (!current() || inFlight.current) return;
      inFlight.current = true;
      setReading(true);
      try {
        const data = await itineraryPurchaseService.getOrder(orderId);
        if (!current()) return;
        if (data?.orderId !== orderId || data.productKind !== "SingleItinerary") {
          throw new Error("Invalid owned order");
        }
        setOrder(data);
        setError("");
        if (!saveSinglePaymentIntent(ownerId, { ...data, clientAttemptId: attemptId, draftTripId })) {
          throw new Error("Cannot persist owned order context");
        }
        if (openCheckout && data.status === "Pending" && data.checkoutUrl) {
          openSinglePaymentCheckout(data.checkoutUrl);
          return;
        }
        if (data.status === "Pending" || (data.status === "Paid" && data.entitlement == null)) {
          timer = setTimeout(read, 2500);
        }
      } catch {
        if (current()) setError("Chưa thể kiểm tra đơn hàng. Vui lòng thử kiểm tra lại.");
      } finally {
        inFlight.current = false;
        if (current()) setReading(false);
      }
    };
    timer = setTimeout(read, 0);
    return () => { active = false; clearTimeout(timer); };
  }, [ownerId, orderId, attemptId, draftTripId, openCheckout, retry]);

  const state = singleOrderState(order);
  const title = state === "ENTITLEMENT_GRANTED" ? "Thanh toán lịch trình thành công!" :
    state === "VERIFYING" ? "Đang xác nhận quyền chốt lịch trình..." :
    state === "FAILED" ? "Thanh toán lịch trình chưa hoàn tất" :
    state === "EXPIRED" ? "Giao dịch mua lịch trình đã hết hạn" :
    state === "PAYMENT_READY" || state === "PREPARING" ? "Giao dịch đang chờ thanh toán" :
    reading ? "Đang kiểm tra đơn hàng đã sở hữu..." : "Thông tin thanh toán lịch trình";
  return <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8 [&_button]:min-h-11 [&_button:focus-visible]:outline [&_button:focus-visible]:outline-2 [&_button:focus-visible]:outline-offset-2 [&_button:focus-visible]:outline-primary">
    <div aria-live="polite" className="w-full max-w-lg rounded-[8px] bg-surface p-5 sm:p-8 border border-outline-variant/40 shadow-sm text-center space-y-5 break-words">
      <span className={`material-symbols-outlined text-[40px] ${state === "ENTITLEMENT_GRANTED" ? "text-emerald-600" : "text-primary"}`}>
        {state === "ENTITLEMENT_GRANTED" ? "check_circle" : reading ? "progress_activity" : "info"}
      </span>
      <h2 className="text-title-md font-bold">{title}</h2>
      {state === "ENTITLEMENT_GRANTED" && <p className="text-body-md text-on-surface-variant">
        Quyền chốt đã được xác nhận. Lượt mua chưa gắn với lịch trình; bạn có thể để dành và chọn dùng sau.
      </p>}
      {state === "VERIFYING" && <p className="text-body-md text-on-surface-variant">Thanh toán đã được ghi nhận. Đang xác nhận bằng chứng quyền chốt.</p>}
      {(state === "PAYMENT_READY" || state === "PREPARING") && <p className="text-body-md text-on-surface-variant">Đơn hàng vẫn Pending trên máy chủ. Hệ thống sẽ tiếp tục kiểm tra.</p>}
      {error && <p role="alert" className="text-body-sm text-error">{error}</p>}
      <button type="button" disabled={reading} onClick={() => setRetry((value) => value + 1)}
        className="w-full rounded-lg border px-4 py-3 disabled:opacity-50">Thử kiểm tra lại</button>
      {draftTripId && <button type="button" onClick={() => navigate("/draft")}
        className="w-full rounded-lg bg-primary text-on-primary px-4 py-3 font-semibold">Quay lại lịch trình nháp</button>}
      <button type="button" onClick={() => navigate("/trips")} className="w-full rounded-lg border px-4 py-3">Xem lịch trình</button>
    </div>
  </div>;
}

export default function PaymentReturnPage({ mode = "success" }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { refreshSubscription } = useSubscription();

  const searchOrderId = searchParams.get("orderId");
  const checkoutOrderId = searchParams.get("singleCheckout");
  const singleIntent = getSinglePaymentReturnIntent(user?.id, searchOrderId || checkoutOrderId);
  const subscriptionSession = getSubscriptionPaymentSession(user?.id);
  const subscriptionOrderId = subscriptionSession?.orderId;

  // Xác định luồng sản phẩm tách biệt rõ ràng
  // TUYỆT ĐỐI KHÔNG fallback sang Single khi gặp lỗi Subscription
  const flow = useMemo(() => {
    if (checkoutOrderId) return singleIntent?.orderId === checkoutOrderId ? "single" : "unresolved";
    // 1. Khớp chính xác orderId với Single intent
    if (singleIntent?.orderId && searchOrderId === singleIntent.orderId) return "single";
    // 2. Khớp chính xác orderId với Subscription session
    if (subscriptionOrderId && searchOrderId === subscriptionOrderId) return "subscription";
    // 3. Nếu không có query orderId, ưu tiên khôi phục intent cục bộ
    if (!searchOrderId) {
      if (subscriptionOrderId) return "subscription";
      if (singleIntent?.orderId) return "single";
    }
    // 4. Khi có orderId lạ không khớp, mặc định là subscription (sản phẩm chính) - KHÔNG suy diễn Single
    return "subscription";
  }, [singleIntent?.orderId, subscriptionOrderId, searchOrderId, checkoutOrderId]);

  const targetOrderId =
    (flow === "unresolved" ? null : searchOrderId || checkoutOrderId ||
    (flow === "single" ? singleIntent?.orderId : subscriptionOrderId));

  const draftTripId = singleIntent?.draftTripId || null;

  const [loading, setLoading] = useState(() => Boolean(targetOrderId));
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");
  const [retryTrigger, setRetryTrigger] = useState(0);
  const pollTimerRef = useRef(null);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  const targetScope = `${user?.id ?? ""}:${flow}:${targetOrderId ?? ""}`;
  const [prevTargetScope, setPrevTargetScope] = useState(targetScope);
  if (prevTargetScope !== targetScope) {
    setPrevTargetScope(targetScope);
    setOrder(null);
    setError("");
    setLoading(Boolean(targetOrderId));
  }

  // Luôn tra cứu đơn hàng từ server cho cả luồng return và cancel
  // Redirect query hoặc cancel param KHÔNG được tự ý gán Paid/Failed/Expired
  useEffect(() => {
    if (!targetOrderId || flow === "single") return undefined;

    let active = true;

    const checkSubscriptionOrder = async (orderId) => {
      try {
        const data = await subscriptionService.getOrder(orderId);
        if (!active) return;
        setOrder(data);
        setError("");

        if (data?.status === PAYMENT_ORDER_STATUS.PAID) {
          refreshSubscription();
          clearSubscriptionPaymentSession(user?.id);
        } else if (
          data?.status === PAYMENT_ORDER_STATUS.FAILED ||
          data?.status === PAYMENT_ORDER_STATUS.EXPIRED
        ) {
          clearSubscriptionPaymentSession(user?.id);
        }
      } catch (err) {
        if (!active) return;
        // KHÔNG BAO GIỜ fallback sang Single khi gặp lỗi tra cứu subscription
        setError(err.message || "Không thể kiểm tra trạng thái đơn hàng.");
      } finally {
        if (active) setLoading(false);
      }
    };

    checkSubscriptionOrder(targetOrderId);

    return () => {
      active = false;
      stopPolling();
    };
  }, [targetOrderId, flow, user?.id, refreshSubscription, stopPolling, retryTrigger]);

  const handleRetryLookup = () => {
    setLoading(true);
    setError("");
    setRetryTrigger((prev) => prev + 1);
  };

  const planDisplayName =
    PLAN_DISPLAY_NAMES[order?.planCode] || order?.planCode || "Gói dịch vụ";
  const isSingleFlow = flow === "single";

  if (isSingleFlow) return <SinglePaymentReturn
    key={`${targetScope}:${singleIntent?.clientAttemptId ?? ""}`}
    ownerId={user?.id} orderId={targetOrderId}
    attemptId={singleIntent?.clientAttemptId ?? null} draftTripId={draftTripId}
    openCheckout={checkoutOrderId === targetOrderId}
  />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8 [&_button]:rounded-[8px] [&_button]:min-h-11 [&_button:focus-visible]:outline [&_button:focus-visible]:outline-2 [&_button:focus-visible]:outline-offset-2 [&_button:focus-visible]:outline-primary">
      <div aria-live="polite" className="w-full max-w-lg rounded-[8px] bg-surface p-5 sm:p-8 border border-outline-variant/40 shadow-sm text-center space-y-6 break-words">
        {loading ? (
          <div className="py-12 space-y-4">
            <span className="material-symbols-outlined text-primary text-[48px] animate-spin">
              progress_activity
            </span>
            <p className="text-body-md text-on-surface font-semibold">
              Đang xác nhận trạng thái thanh toán từ máy chủ...
            </p>
          </div>
        ) : (
          /* ================= SUBSCRIPTION FLOW (SERVER AUTHORITATIVE) ================= */
          error ? (
            <>
              <div className="w-20 h-20 rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center mx-auto shadow-sm">
                <span className="material-symbols-outlined text-[48px]">
                  info
                </span>
              </div>
              <div className="space-y-2">
                <h2 className="text-title-lg font-bold text-on-surface">
                  Thông tin thanh toán
                </h2>
                <p className="text-body-md text-on-surface-variant">
                  {error}
                </p>
              </div>
              <div className="space-y-3 pt-2">
                {targetOrderId && (
                  <button
                    type="button"
                    onClick={handleRetryLookup}
                    className="w-full py-3.5 px-4 rounded-xl bg-primary text-on-primary font-bold text-label-md hover:bg-primary/90 transition-all shadow-sm"
                  >
                    Thử kiểm tra lại
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => navigate("/subscription")}
                  className="w-full py-3.5 px-4 rounded-xl bg-surface-container-high text-on-surface font-bold text-label-md hover:bg-surface-container-highest transition-all"
                >
                  Về trang gói dịch vụ
                </button>
              </div>
            </>
          ) : order?.status === PAYMENT_ORDER_STATUS.PAID ? (
            <>
              <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
                <span
                  className="material-symbols-outlined text-[48px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  check_circle
                </span>
              </div>
              <div className="space-y-2">
                <h2 className="text-title-lg font-bold text-on-surface">
                  Thanh toán thành công!
                </h2>
                <p className="text-body-md text-on-surface-variant">
                  Gói <strong className="text-primary font-bold">{planDisplayName}</strong> của bạn đã được kích hoạt thành công.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate("/subscription")}
                className="w-full py-3.5 px-4 rounded-xl bg-primary text-on-primary font-bold text-label-md hover:bg-primary/90 transition-all shadow-md shadow-primary/25"
              >
                Về trang gói dịch vụ
              </button>
            </>
          ) : order?.status === PAYMENT_ORDER_STATUS.REVIEW_REQUIRED ? (
            <>
              <div className="w-20 h-20 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto shadow-sm">
                <span className="material-symbols-outlined text-[48px]">
                  rate_review
                </span>
              </div>
              <div className="space-y-2">
                <h2 className="text-title-lg font-bold text-on-surface">
                  Thanh toán đang cần được kiểm tra
                </h2>
                <p className="text-body-md text-on-surface-variant">
                  Giao dịch đang cần kiểm tra đối soát, vui lòng liên hệ bộ phận hỗ trợ hoặc đợi hệ thống xử lý. Vui lòng không thực hiện thanh toán lại.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate("/subscription")}
                className="w-full py-3.5 px-4 rounded-xl bg-navy-dark hover:bg-navy-darkest text-white font-bold text-label-md transition-all shadow-sm"
              >
                Về trang gói dịch vụ
              </button>
            </>
          ) : order?.status === PAYMENT_ORDER_STATUS.EXPIRED ? (
            <>
              <div className="w-20 h-20 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto shadow-sm">
                <span className="material-symbols-outlined text-[48px]">
                  timer_off
                </span>
              </div>
              <div className="space-y-2">
                <h2 className="text-title-lg font-bold text-on-surface">
                  Mã thanh toán đã hết hạn
                </h2>
                <p className="text-body-md text-on-surface-variant">
                  Giao dịch đã quá thời gian chờ thanh toán từ cổng thanh toán.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate("/subscription")}
                className="w-full py-3.5 px-4 rounded-xl bg-primary text-on-primary font-bold text-label-md hover:bg-primary/90 transition-all shadow-sm"
              >
                Quay lại trang Gói dịch vụ
              </button>
            </>
          ) : order?.status === PAYMENT_ORDER_STATUS.FAILED ? (
            <>
              <div className="w-20 h-20 rounded-full bg-error/10 text-error flex items-center justify-center mx-auto shadow-sm">
                <span className="material-symbols-outlined text-[48px]">
                  error
                </span>
              </div>
              <div className="space-y-2">
                <h2 className="text-title-lg font-bold text-on-surface">
                  Thanh toán chưa hoàn tất
                </h2>
                <p className="text-body-md text-on-surface-variant">
                  Giao dịch chưa được hoàn tất hoặc đã bị huỷ. Bạn có thể tiếp tục xem và chọn gói bất cứ khi nào.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate("/subscription")}
                className="w-full py-3.5 px-4 rounded-xl bg-primary text-on-primary font-bold text-label-md hover:bg-primary/90 transition-all shadow-sm"
              >
                Quay lại trang Gói dịch vụ
              </button>
            </>
          ) : order?.status === PAYMENT_ORDER_STATUS.PENDING ? (
            <>
              <div className="w-20 h-20 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto shadow-sm">
                <span className="material-symbols-outlined text-[48px]">
                  schedule
                </span>
              </div>
              <div className="space-y-2">
                <h2 className="text-title-lg font-bold text-on-surface">
                  {mode === "cancel"
                    ? "Bạn đã quay lại từ cổng thanh toán"
                    : "Giao dịch đang chờ thanh toán"}
                </h2>
                <p className="text-body-md text-on-surface-variant">
                  {mode === "cancel"
                    ? "Giao dịch vẫn đang ở trạng thái chờ thanh toán trên hệ thống. Bạn có thể tiếp tục thanh toán hoặc kiểm tra lại."
                    : "Hệ thống đang chờ xác nhận thanh toán từ ngân hàng hoặc cổng thanh toán."}
                </p>
              </div>
              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  onClick={handleRetryLookup}
                  className="w-full py-3.5 px-4 rounded-xl bg-primary text-on-primary font-bold text-label-md hover:bg-primary/90 transition-all shadow-sm"
                >
                  Kiểm tra lại trạng thái
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/subscription")}
                  className="w-full py-3.5 px-4 rounded-xl bg-surface-container-high text-on-surface font-bold text-label-md hover:bg-surface-container-highest transition-all"
                >
                  Về trang gói dịch vụ
                </button>
              </div>
            </>
          ) : (
            /* Error or unresolved state */
            <>
              <div className="w-20 h-20 rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center mx-auto shadow-sm">
                <span className="material-symbols-outlined text-[48px]">
                  info
                </span>
              </div>
              <div className="space-y-2">
                <h2 className="text-title-lg font-bold text-on-surface">
                  Thông tin thanh toán
                </h2>
                <p className="text-body-md text-on-surface-variant">
                  {error || (order ? `Trạng thái: ${order.status}` : "Đơn hàng đang chờ xử lý hoặc đã kết thúc phiên làm việc.")}
                </p>
              </div>
              <div className="space-y-3 pt-2">
                {targetOrderId && (
                  <button
                    type="button"
                    onClick={handleRetryLookup}
                    className="w-full py-3.5 px-4 rounded-xl bg-primary text-on-primary font-bold text-label-md hover:bg-primary/90 transition-all shadow-sm"
                  >
                    Thử kiểm tra lại
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => navigate("/subscription")}
                  className="w-full py-3.5 px-4 rounded-xl bg-surface-container-high text-on-surface font-bold text-label-md hover:bg-surface-container-highest transition-all"
                >
                  Về trang gói dịch vụ
                </button>
              </div>
            </>
          )
        )}
      </div>
    </div>
  );
}
