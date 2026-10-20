import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { subscriptionService } from "../../services/subscriptionService";
import { useAuth } from "../../context/AuthContext";
import { useSubscription } from "../../context/SubscriptionContext";
import { getPlanDisplayName } from "../../utils/subscriptionUtils";
import {
  getSubscriptionPaymentSession,
  clearSubscriptionPaymentSession,
} from "../../utils/subscriptionPaymentSession";
import { PAYMENT_ORDER_STATUS } from "../../utils/subscriptionUpgradeContract";

export default function PaymentReturnPage({ mode = "success" }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { refreshSubscription, plans } = useSubscription();

  const searchOrderId = searchParams.get("orderId");
  const subscriptionSession = getSubscriptionPaymentSession(user?.id);
  const subscriptionOrderId = subscriptionSession?.orderId;
  // Chỉ còn thanh toán gói: orderId trên URL, không có thì khôi phục từ phiên thanh toán đã lưu
  const targetOrderId = searchOrderId || subscriptionOrderId || null;

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

  const targetScope = `${user?.id ?? ""}:${targetOrderId ?? ""}`;
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
    if (!targetOrderId) return undefined;

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
  }, [targetOrderId, user?.id, refreshSubscription, stopPolling, retryTrigger]);

  const handleRetryLookup = () => {
    setLoading(true);
    setError("");
    setRetryTrigger((prev) => prev + 1);
  };

  const planDisplayName =
    getPlanDisplayName(order?.planCode, plans) || "Gói dịch vụ";

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
