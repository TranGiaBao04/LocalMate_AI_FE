import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { subscriptionService } from "../../services/subscriptionService";
import { itineraryPurchaseService } from "../../services/itineraryPurchaseService";
import { useAuth } from "../../context/AuthContext";
import { useSubscription } from "../../context/SubscriptionContext";
import { PLAN_DISPLAY_NAMES } from "../../utils/subscriptionUtils";
import {
  getSinglePaymentIntent,
  clearSinglePaymentIntent,
} from "../../utils/itineraryPurchaseSession";
import {
  getSubscriptionPaymentSession,
  clearSubscriptionPaymentSession,
} from "../../utils/subscriptionPaymentSession";
import { PAYMENT_ORDER_STATUS } from "../../utils/subscriptionUpgradeContract";

export default function PaymentReturnPage({ mode = "success" }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { refreshSubscription } = useSubscription();

  const searchOrderId = searchParams.get("orderId");
  const singleIntent = getSinglePaymentIntent();
  const subscriptionSession = getSubscriptionPaymentSession(user?.id);
  const subscriptionOrderId = subscriptionSession?.orderId;

  // Xác định luồng sản phẩm tách biệt rõ ràng
  // TUYỆT ĐỐI KHÔNG fallback sang Single khi gặp lỗi Subscription
  const flow = useMemo(() => {
    if (singleIntent?.orderId && searchOrderId === singleIntent.orderId) return "single";
    if (subscriptionOrderId && searchOrderId === subscriptionOrderId) return "subscription";
    if (singleIntent?.orderId && !subscriptionOrderId) return "single";
    if (subscriptionOrderId) return "subscription";
    return "subscription"; // Mặc định là subscription nếu không có explicit Single evidence
  }, [singleIntent?.orderId, subscriptionOrderId, searchOrderId]);

  const targetOrderId =
    searchOrderId ||
    (flow === "single" ? singleIntent?.orderId : subscriptionOrderId);

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

  // Luôn tra cứu đơn hàng từ server cho cả luồng return và cancel
  // Redirect query hoặc cancel param KHÔNG được tự ý gán Paid/Failed/Expired
  useEffect(() => {
    if (!targetOrderId) return undefined;

    let active = true;

    const checkSubscriptionOrder = async (orderId) => {
      try {
        const data = await subscriptionService.getOrder(orderId);
        if (!active) return;
        setOrder(data);

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

    const checkSingleOrder = async (orderId) => {
      try {
        const data = await itineraryPurchaseService.getOrder(orderId);
        if (!active) return;
        setOrder(data);

        if (data?.status === PAYMENT_ORDER_STATUS.PAID) {
          if (data.entitlement != null) {
            clearSinglePaymentIntent();
            stopPolling();
          } else {
            // Paid but entitlement pending: polling
            stopPolling();
            pollTimerRef.current = setInterval(async () => {
              try {
                const refreshed = await itineraryPurchaseService.getOrder(orderId);
                if (!active) return;
                setOrder(refreshed);
                if (refreshed?.entitlement != null || refreshed?.status !== PAYMENT_ORDER_STATUS.PAID) {
                  stopPolling();
                  if (refreshed?.entitlement != null) {
                    clearSinglePaymentIntent();
                  }
                }
              } catch {
                // Keep polling
              }
            }, 2500);
          }
        } else if (
          data?.status === PAYMENT_ORDER_STATUS.FAILED ||
          data?.status === PAYMENT_ORDER_STATUS.EXPIRED
        ) {
          stopPolling();
        }
      } catch (err) {
        if (!active) return;
        setError(err.message || "Không thể kiểm tra trạng thái đơn hàng.");
      } finally {
        if (active) setLoading(false);
      }
    };

    if (flow === "single") {
      checkSingleOrder(targetOrderId);
    } else {
      checkSubscriptionOrder(targetOrderId);
    }

    return () => {
      active = false;
      stopPolling();
    };
  }, [targetOrderId, flow, user?.id, refreshSubscription, stopPolling, retryTrigger]);

  const handleRetryLookup = () => {
    setRetryTrigger((prev) => prev + 1);
  };

  const planDisplayName =
    PLAN_DISPLAY_NAMES[order?.planCode] || order?.planCode || "Gói dịch vụ";
  const isSingleFlow = flow === "single";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md rounded-3xl bg-surface p-8 border border-outline-variant/30 shadow-xl text-center space-y-6">
        {loading ? (
          <div className="py-12 space-y-4">
            <span className="material-symbols-outlined text-primary text-[48px] animate-spin">
              progress_activity
            </span>
            <p className="text-body-md text-on-surface font-semibold">
              Đang xác nhận trạng thái thanh toán từ máy chủ...
            </p>
          </div>
        ) : isSingleFlow ? (
          /* ================= SINGLE ITINERARY FLOW ================= */
          order?.status === PAYMENT_ORDER_STATUS.PAID ? (
            order.entitlement != null ? (
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
                    Thanh toán lịch trình thành công!
                  </h2>
                  <p className="text-body-md text-on-surface-variant">
                    Thanh toán lịch trình đã được xác nhận. Bạn đã có thêm{" "}
                    <strong className="text-primary font-bold">1 lượt</strong>{" "}
                    chốt lịch trình.
                  </p>
                </div>
                <div className="space-y-3 pt-2">
                  {draftTripId ? (
                    <button
                      type="button"
                      onClick={() => navigate("/draft")}
                      className="w-full py-3.5 px-4 rounded-xl bg-primary text-on-primary font-bold text-label-md hover:bg-primary/90 transition-all shadow-md shadow-primary/25 flex items-center justify-center gap-2"
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        arrow_back
                      </span>
                      Quay lại lịch trình nháp
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => navigate("/trips")}
                    className={`w-full py-3.5 px-4 rounded-xl font-bold text-label-md transition-all ${
                      draftTripId
                        ? "bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
                        : "bg-primary text-on-primary hover:bg-primary/90 shadow-md shadow-primary/25"
                    }`}
                  >
                    Xem các lịch trình đã lưu
                  </button>
                </div>
              </>
            ) : (
              /* Paid but entitlement still resolving */
              <div className="py-6 space-y-4">
                <span className="material-symbols-outlined text-primary text-[48px] animate-spin">
                  progress_activity
                </span>
                <div className="space-y-2">
                  <h2 className="text-title-lg font-bold text-on-surface">
                    Đang xác nhận quyền chốt lịch trình...
                  </h2>
                  <p className="text-body-md text-on-surface-variant">
                    Thanh toán đã được ghi nhận. Hệ thống đang đồng bộ quyền lưu lịch trình cho bạn, vui lòng đợi trong giây lát.
                  </p>
                </div>
              </div>
            )
          ) : mode === "cancel" || order?.status === PAYMENT_ORDER_STATUS.FAILED || order?.status === PAYMENT_ORDER_STATUS.EXPIRED ? (
            <>
              <div className="w-20 h-20 rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center mx-auto shadow-sm">
                <span className="material-symbols-outlined text-[48px]">
                  arrow_back
                </span>
              </div>
              <div className="space-y-2">
                <h2 className="text-title-lg font-bold text-on-surface">
                  Bạn đã quay lại từ cổng thanh toán
                </h2>
                <p className="text-body-md text-on-surface-variant">
                  {order?.status === PAYMENT_ORDER_STATUS.EXPIRED
                    ? "Giao dịch đã hết hạn thanh toán."
                    : "Giao dịch mua thêm lịch trình chưa được hoàn tất hoặc đã bị huỷ. Bạn có thể tiếp tục xem và tạo lịch trình bất cứ khi nào."}
                </p>
              </div>
              <div className="space-y-3 pt-2">
                {draftTripId ? (
                  <button
                    type="button"
                    onClick={() => navigate("/draft")}
                    className="w-full py-3.5 px-4 rounded-xl bg-primary text-on-primary font-bold text-label-md hover:bg-primary/90 transition-all shadow-md shadow-primary/25"
                  >
                    Quay lại lịch trình nháp
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => navigate("/home")}
                  className={`w-full py-3.5 px-4 rounded-xl font-bold text-label-md transition-all ${
                    draftTripId
                      ? "bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
                      : "bg-primary text-on-primary hover:bg-primary/90 shadow-md shadow-primary/25"
                  }`}
                >
                  Về trang chủ
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="w-20 h-20 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto shadow-sm">
                <span className="material-symbols-outlined text-[48px]">
                  info
                </span>
              </div>
              <div className="space-y-2">
                <h2 className="text-title-lg font-bold text-on-surface">
                  Thông tin thanh toán
                </h2>
                <p className="text-body-md text-on-surface-variant">
                  {error || "Đơn hàng đang chờ xử lý hoặc đã kết thúc phiên làm việc."}
                </p>
              </div>
              <div className="space-y-3 pt-2">
                {error && (
                  <button
                    type="button"
                    onClick={handleRetryLookup}
                    className="w-full py-3.5 px-4 rounded-xl bg-primary text-on-primary font-bold text-label-md hover:bg-primary/90 transition-all shadow-sm"
                  >
                    Thử kiểm tra lại
                  </button>
                )}
                {draftTripId ? (
                  <button
                    type="button"
                    onClick={() => navigate("/draft")}
                    className="w-full py-3.5 px-4 rounded-xl bg-surface-container-high text-on-surface font-bold text-label-md hover:bg-surface-container-highest transition-all"
                  >
                    Quay lại lịch trình nháp
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => navigate("/home")}
                  className="w-full py-3.5 px-4 rounded-xl bg-surface-container-high text-on-surface font-bold text-label-md hover:bg-surface-container-highest transition-all"
                >
                  Về trang chủ
                </button>
              </div>
            </>
          )
        ) : (
          /* ================= SUBSCRIPTION FLOW (SERVER AUTHORITATIVE) ================= */
          order?.status === PAYMENT_ORDER_STATUS.PAID ? (
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
