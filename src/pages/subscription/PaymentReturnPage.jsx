import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { subscriptionService } from "../../services/subscriptionService";
import { useSubscription } from "../../context/SubscriptionContext";
import { PLAN_DISPLAY_NAMES } from "../../utils/subscriptionUtils";

const ACTIVE_PAYMENT_SESSION_KEY = "localmate_active_payment_intent";

function getStoredOrderId() {
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

  const targetOrderId = searchParams.get("orderId") || getStoredOrderId();
  const [loading, setLoading] = useState(() => Boolean(targetOrderId));
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!targetOrderId) return;

    let active = true;
    subscriptionService
      .getOrder(targetOrderId)
      .then((data) => {
        if (!active) return;
        setOrder(data);
        if (data?.status === "Paid") {
          refreshSubscription();
          sessionStorage.removeItem(ACTIVE_PAYMENT_SESSION_KEY);
        }
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || "Không thể kiểm tra trạng thái đơn hàng.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [targetOrderId, refreshSubscription]);

  const planDisplayName =
    PLAN_DISPLAY_NAMES[order?.planCode] || order?.planCode || "Gói dịch vụ";

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
        ) : order?.status === "Paid" ? (
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
        )}
      </div>
    </div>
  );
}
