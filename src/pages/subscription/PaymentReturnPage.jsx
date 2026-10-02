import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { subscriptionService } from "../../services/subscriptionService";
import { itineraryPurchaseService } from "../../services/itineraryPurchaseService";
import { useSubscription } from "../../context/SubscriptionContext";
import { PLAN_DISPLAY_NAMES } from "../../utils/subscriptionUtils";
import {
  getSinglePaymentIntent,
  clearSinglePaymentIntent,
} from "../../utils/itineraryPurchaseSession";

const ACTIVE_PAYMENT_SESSION_KEY = "localmate_active_payment_intent";

function getStoredSubscriptionOrderId() {
  try {
    const stored = sessionStorage.getItem(ACTIVE_PAYMENT_SESSION_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed?.orderId || null;
    }
  } catch {
    return null;
  }
  return null;
}

export default function PaymentReturnPage({ mode = "success" }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshSubscription } = useSubscription();

  const searchOrderId = searchParams.get("orderId");
  const singleIntent = getSinglePaymentIntent();
  const subscriptionOrderId = getStoredSubscriptionOrderId();

  // Initial detection of flow
  const [flow, setFlow] = useState(() => {
    if (singleIntent?.orderId && searchOrderId === singleIntent.orderId) return "single";
    if (subscriptionOrderId && searchOrderId === subscriptionOrderId) return "subscription";
    if (singleIntent?.orderId && !subscriptionOrderId) return "single";
    if (subscriptionOrderId) return "subscription";
    return null; // fallback: will try subscription first then single
  });

  const targetOrderId =
    searchOrderId ||
    (flow === "single" ? singleIntent?.orderId : subscriptionOrderId);

  const draftTripId = singleIntent?.draftTripId || null;

  const [loading, setLoading] = useState(() => Boolean(targetOrderId));
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");
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

  useEffect(() => {
    if (!targetOrderId) return;
    if (mode === "cancel") {
      if (flow === "subscription" || (!flow && subscriptionOrderId === targetOrderId)) {
        sessionStorage.removeItem(ACTIVE_PAYMENT_SESSION_KEY);
      }
      return;
    }

    let active = true;

    const checkSubscriptionOrder = async (orderId) => {
      try {
        const data = await subscriptionService.getOrder(orderId);
        if (!active) return;
        setFlow("subscription");
        setOrder(data);
        if (data?.status === "Paid") {
          refreshSubscription();
          sessionStorage.removeItem(ACTIVE_PAYMENT_SESSION_KEY);
        }
      } catch (err) {
        if (!active) return;
        // If flow was unknown, fallback to checking single itinerary order
        if (!flow) {
          checkSingleOrder(orderId);
          return;
        }
        setError(err.message || "Không thể kiểm tra trạng thái đơn hàng.");
      } finally {
        if (active && flow) setLoading(false);
      }
    };

    const checkSingleOrder = async (orderId) => {
      try {
        const data = await itineraryPurchaseService.getOrder(orderId);
        if (!active) return;
        setFlow("single");
        setOrder(data);

        if (data?.status === "Paid") {
          if (data.entitlement != null) {
            clearSinglePaymentIntent();
            stopPolling();
          } else {
            // Paid but entitlement pending: start polling
            stopPolling();
            pollTimerRef.current = setInterval(async () => {
              try {
                const refreshed = await itineraryPurchaseService.getOrder(orderId);
                if (!active) return;
                setOrder(refreshed);
                if (refreshed?.entitlement != null || refreshed?.status !== "Paid") {
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
        } else if (data?.status === "Failed" || data?.status === "Expired") {
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
    } else if (flow === "subscription") {
      checkSubscriptionOrder(targetOrderId);
    } else {
      // Unknown flow: try subscription first, fallback to single
      checkSubscriptionOrder(targetOrderId);
    }

    return () => {
      active = false;
      stopPolling();
    };
  }, [targetOrderId, flow, mode, refreshSubscription, singleIntent?.orderId, subscriptionOrderId, stopPolling]);

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
          order?.status === "Paid" ? (
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
          ) : mode === "cancel" || order?.status === "Failed" || order?.status === "Expired" ? (
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
                  {order?.status === "Expired"
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
                  className="w-full py-3.5 px-4 rounded-xl bg-surface-container-high text-on-surface font-bold text-label-md hover:bg-surface-container-highest transition-all"
                >
                  Về trang chủ
                </button>
              </div>
            </>
          )
        ) : (
          /* ================= SUBSCRIPTION FLOW (EXISTING) ================= */
          order?.status === "Paid" ? (
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
                  Gói <strong className="text-primary font-bold">{planDisplayName}</strong> của bạn đã được kích hoạt.
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
          ) : mode === "cancel" || order?.status === "Failed" ? (
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
                  Giao dịch chưa được hoàn tất hoặc đã bị huỷ. Bạn có thể tiếp tục xem và chọn gói bất cứ khi nào.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate("/subscription")}
                className="w-full py-3.5 px-4 rounded-xl bg-navy-dark hover:bg-navy-darkest text-white font-bold text-label-md transition-all shadow-sm"
              >
                Quay lại trang Gói dịch vụ
              </button>
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
              <button
                type="button"
                onClick={() => navigate("/subscription")}
                className="w-full py-3.5 px-4 rounded-xl bg-primary text-on-primary font-bold text-label-md hover:bg-primary/90 transition-all"
              >
                Về trang gói dịch vụ
              </button>
            </>
          )
        )}
      </div>
    </div>
  );
}
