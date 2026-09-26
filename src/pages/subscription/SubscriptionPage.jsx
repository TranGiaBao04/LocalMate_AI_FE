import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useSubscription } from "../../context/SubscriptionContext";
import SubscriptionSummary from "../../components/subscription/SubscriptionSummary";
import PlanCard from "../../components/subscription/PlanCard";
import PaymentCheckoutModal from "../../components/subscription/PaymentCheckoutModal";
import { subscriptionService } from "../../services/subscriptionService";
import { PLAN_CODES } from "../../utils/subscriptionUtils";

const ACTIVE_PAYMENT_SESSION_KEY = "localmate_active_payment_intent";

export default function SubscriptionPage() {
  const navigate = useNavigate();
  const { isDemo, isLoggedIn } = useAuth();
  const {
    plans,
    subscription,
    plansLoading,
    plansError,
    subscriptionLoading,
    subscriptionError,
    refreshPlans,
    refreshSubscription,
    refreshAll,
  } = useSubscription();

  const [actionLoading, setActionLoading] = useState(false);
  const [pageError, setPageError] = useState("");
  const [pageSuccess, setPageSuccess] = useState("");

  const [paymentIntent, setPaymentIntent] = useState(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  const currentPlanCode = subscription?.plan || PLAN_CODES.FREE;

  // Khôi phục phiên thanh toán đang chờ từ sessionStorage (Session Resume)
  useEffect(() => {
    if (isDemo || !isLoggedIn) return;

    try {
      const stored = sessionStorage.getItem(ACTIVE_PAYMENT_SESSION_KEY);
      if (!stored) return;

      const parsed = JSON.parse(stored);
      if (!parsed?.orderId) return;

      // Fallback an toàn cho intent cũ chưa có trường flow
      parsed.flow = parsed.flow || "purchase";

      subscriptionService
        .getOrder(parsed.orderId)
        .then((order) => {
          if (order?.status === "Pending") {
            setPaymentIntent(parsed);
            setIsPaymentModalOpen(true);
          } else if (order?.status === "Paid") {
            sessionStorage.removeItem(ACTIVE_PAYMENT_SESSION_KEY);
            refreshSubscription();
          } else {
            // Failed, Expired, hoặc trạng thái khác
            sessionStorage.removeItem(ACTIVE_PAYMENT_SESSION_KEY);
          }
        })
        .catch(() => {
          sessionStorage.removeItem(ACTIVE_PAYMENT_SESSION_KEY);
        });
    } catch {
      sessionStorage.removeItem(ACTIVE_PAYMENT_SESSION_KEY);
    }
  }, [isDemo, isLoggedIn, refreshSubscription]);

  // Trích xuất intent khi có lỗi 409 pending_order_exists (FE flow marker)
  const extractReusableIntent = useCallback(
    (err, defaultPlanCode, flow = "purchase") => {
      const raw = err?.data?.extensions || err?.data || {};
      const orderId = raw.orderId || raw.OrderId;
      const qrCode = raw.qrCode || raw.QrCode;
      const checkoutUrl = raw.checkoutUrl || raw.CheckoutUrl;
      const amount = raw.amount || raw.Amount;
      const expiresAt = raw.expiresAt || raw.ExpiresAt;

      if (orderId && qrCode) {
        return {
          orderId,
          planCode: defaultPlanCode,
          flow,
          qrCode,
          checkoutUrl,
          amount,
          expiresAt,
        };
      }
      return null;
    },
    [],
  );

  // Xử lý tạo đơn hàng thanh toán gói mới
  const handleSelectPlan = async (planCode) => {
    if (isDemo) return;
    setPageError("");
    setPageSuccess("");
    setActionLoading(true);

    try {
      // Backend trả về HTTP 201 Created kèm CreatePaymentResponseDto
      const response = await subscriptionService.checkout(planCode);
      const intent = {
        orderId: response.orderId,
        planCode,
        flow: "purchase",
        qrCode: response.qrCode,
        checkoutUrl: response.checkoutUrl,
        amount: response.amount,
        expiresAt: response.expiresAt,
      };

      sessionStorage.setItem(ACTIVE_PAYMENT_SESSION_KEY, JSON.stringify(intent));
      setPaymentIntent(intent);
      setIsPaymentModalOpen(true);
    } catch (err) {
      if (err.code === "pending_order_exists") {
        const reusable = extractReusableIntent(err, planCode, "purchase");
        if (reusable) {
          sessionStorage.setItem(ACTIVE_PAYMENT_SESSION_KEY, JSON.stringify(reusable));
          setPaymentIntent(reusable);
          setIsPaymentModalOpen(true);
          return;
        }
      }

      if (err.code === "plan_already_active") {
        refreshSubscription();
        setPageError("Gói này hiện đang hoạt động trên tài khoản của bạn.");
      } else if (err.code === "already_covered_by_higher_plan") {
        refreshSubscription();
        setPageError("Gói hiện tại của bạn đã bao gồm đầy đủ quyền lợi này.");
      } else if (err.status === 502 || err.code === "payment_gateway_unavailable") {
        setPageError(
          "Cổng thanh toán PayOS tạm thời chưa thể kết nối. Vui lòng thử lại sau ít phút.",
        );
      } else if (err.code === "persisted_account_required" || err.status === 403) {
        setPageError(
          "Chức năng thanh toán yêu cầu tài khoản đã được đăng ký và lưu trên hệ thống.",
        );
      } else {
        setPageError(err.message || "Không thể khởi tạo giao dịch thanh toán.");
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Xử lý gia hạn gói hiện tại
  const handleRenew = async () => {
    if (isDemo) return;
    setPageError("");
    setPageSuccess("");
    setActionLoading(true);

    try {
      // Backend trả về HTTP 201 Created kèm CreatePaymentResponseDto
      const response = await subscriptionService.renew();
      const intent = {
        orderId: response.orderId,
        planCode: subscription?.plan,
        flow: "renew",
        qrCode: response.qrCode,
        checkoutUrl: response.checkoutUrl,
        amount: response.amount,
        expiresAt: response.expiresAt,
      };

      sessionStorage.setItem(ACTIVE_PAYMENT_SESSION_KEY, JSON.stringify(intent));
      setPaymentIntent(intent);
      setIsPaymentModalOpen(true);
    } catch (err) {
      if (err.code === "pending_order_exists") {
        const reusable = extractReusableIntent(err, subscription?.plan, "renew");
        if (reusable) {
          sessionStorage.setItem(ACTIVE_PAYMENT_SESSION_KEY, JSON.stringify(reusable));
          setPaymentIntent(reusable);
          setIsPaymentModalOpen(true);
          return;
        }
      }

      if (err.code === "no_active_subscription") {
        setPageError(
          "Bạn chưa có gói trả phí nào đang hoạt động để gia hạn. Vui lòng chọn gói mới.",
        );
      } else if (err.status === 502 || err.code === "payment_gateway_unavailable") {
        setPageError(
          "Cổng thanh toán PayOS tạm thời chưa thể kết nối. Vui lòng thử lại sau ít phút.",
        );
      } else {
        setPageError(err.message || "Không thể thực hiện gia hạn lúc này.");
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handlePaymentSuccess = () => {
    sessionStorage.removeItem(ACTIVE_PAYMENT_SESSION_KEY);
    refreshSubscription();
    setPageSuccess("Thanh toán thành công! Gói cước của bạn đã được cập nhật.");
  };

  const handleCloseModal = () => {
    setIsPaymentModalOpen(false);
  };

  const handleRetryPayment = (intent) => {
    setIsPaymentModalOpen(false);
    sessionStorage.removeItem(ACTIVE_PAYMENT_SESSION_KEY);
    if (!intent) return;
    if (intent.flow === "renew") {
      handleRenew();
    } else if (intent.planCode) {
      handleSelectPlan(intent.planCode);
    }
  };

  return (
    <div className="app-shell flex flex-col min-h-screen bg-background lg:pl-[220px]">
      {/* Top Header */}
      <header className="app-header sticky top-0 z-40 flex h-16 items-center justify-between border-b border-outline-variant/20 bg-surface/90 px-container-margin backdrop-blur-md lg:px-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors"
            aria-label="Quay lại"
          >
            <span className="material-symbols-outlined text-[22px]">
              arrow_back
            </span>
          </button>
          <div>
            <h1 className="text-title-md font-bold text-on-surface">
              Gói dịch vụ & Hội viên
            </h1>
            <p className="text-label-sm text-on-surface-variant hidden sm:block">
              Nâng cấp lượt tạo lịch trình AI và số lượng lịch trình lưu trữ
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => refreshAll()}
          disabled={plansLoading || subscriptionLoading || actionLoading}
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant disabled:opacity-50"
          title="Làm mới thông tin"
          aria-label="Làm mới thông tin"
        >
          <span
            className={`material-symbols-outlined text-[20px] ${
              plansLoading || subscriptionLoading || actionLoading ? "animate-spin" : ""
            }`}
          >
            refresh
          </span>
        </button>
      </header>

      {/* Main Content */}
      <main className="content-shell flex-1 px-container-margin py-6 lg:px-8 max-w-5xl mx-auto w-full space-y-8 pb-28 lg:pb-12">
        {/* Demo Account Banner */}
        {isDemo && (
          <div className="card border border-amber-300 bg-amber-50/80 p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-amber-600 text-[24px] flex-shrink-0 mt-0.5">
                info
              </span>
              <div>
                <h2 className="text-body-md font-bold text-amber-900">
                  Bạn đang sử dụng phiên bản Demo
                </h2>
                <p className="text-label-md text-amber-800 mt-0.5">
                  Tài khoản Demo không hỗ trợ lưu trữ lâu dài và các gói thành viên.
                  Vui lòng đăng nhập hoặc đăng ký tài khoản chính thức để chọn gói.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-white border border-amber-300 text-amber-900 text-label-md font-bold hover:bg-amber-100 transition-colors"
              >
                Đăng nhập
              </button>
              <button
                type="button"
                onClick={() => navigate("/register")}
                className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-amber-700 text-white text-label-md font-bold hover:bg-amber-800 transition-colors"
              >
                Đăng ký
              </button>
            </div>
          </div>
        )}

        {/* Global Page Error */}
        {(subscriptionError || pageError || (plansError && plans.length > 0)) && !isDemo && (
          <div className="card border border-error/30 bg-error/5 p-4 rounded-xl flex items-center justify-between gap-3 text-body-md text-error">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px]">
                error
              </span>
              <span>{pageError || subscriptionError || plansError}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setPageError("");
                refreshAll();
              }}
              className="text-label-md font-bold underline hover:no-underline flex-shrink-0"
            >
              Thử lại
            </button>
          </div>
        )}

        {/* Global Page Success */}
        {pageSuccess && (
          <div className="card border border-emerald-300 bg-emerald-50 p-4 rounded-xl flex items-center justify-between gap-3 text-body-md text-emerald-800">
            <div className="flex items-center gap-2">
              <span
                className="material-symbols-outlined text-[20px] text-emerald-600"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                check_circle
              </span>
              <span>{pageSuccess}</span>
            </div>
            <button
              type="button"
              onClick={() => setPageSuccess("")}
              className="text-label-sm font-bold text-emerald-700 hover:underline"
            >
              Đóng
            </button>
          </div>
        )}

        {/* Current Subscription & Usage Summary (Persisted users only) */}
        {!isDemo && (
          <section aria-labelledby="current-plan-heading">
            <h2 id="current-plan-heading" className="sr-only">
              Thông tin gói hiện tại
            </h2>
            <SubscriptionSummary
              subscription={subscription}
              loading={subscriptionLoading}
              onRenew={handleRenew}
            />
          </section>
        )}

        {/* Plan Catalog Grid */}
        <section className="space-y-4" aria-labelledby="catalog-heading">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div>
              <h2
                id="catalog-heading"
                className="text-title-lg font-bold text-on-surface"
              >
                Bảng gói cước LocalMate AI
              </h2>
              <p className="text-body-md text-on-surface-variant">
                Lựa chọn gói phù hợp với tần suất di chuyển và nhu cầu khám phá của bạn
              </p>
            </div>
          </div>

          {plansLoading && plans.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="card h-80 animate-pulse bg-surface-container-high rounded-3xl"
                />
              ))}
            </div>
          ) : !plansLoading && plans.length === 0 && plansError ? (
            <div
              role="alert"
              className="card border border-error/30 bg-error/5 p-8 rounded-3xl text-center space-y-4 max-w-lg mx-auto"
            >
              <div className="w-16 h-16 rounded-full bg-error/10 text-error flex items-center justify-center mx-auto">
                <span className="material-symbols-outlined text-[36px]">cloud_off</span>
              </div>
              <div className="space-y-1">
                <h3 className="text-title-md font-bold text-on-surface">
                  Không thể tải danh sách gói cước
                </h3>
                <p className="text-body-md text-on-surface-variant">
                  {plansError || "Hệ thống chưa thể lấy thông tin gói cước và giá mới nhất từ máy chủ."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => refreshPlans()}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-primary text-on-primary font-bold text-label-md hover:bg-primary/90 transition-all shadow-sm"
              >
                <span className="material-symbols-outlined text-[18px]">refresh</span>
                Thử lại
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
              {plans.map((plan) => (
                <PlanCard
                  key={plan.code}
                  plan={plan}
                  currentPlanCode={currentPlanCode}
                  onSelect={handleSelectPlan}
                  onRenew={handleRenew}
                  isDemo={isDemo}
                  loading={actionLoading}
                />
              ))}
            </div>
          )}
        </section>

        {/* Support & Notes Info */}
        <section className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-5 text-body-md text-on-surface-variant space-y-2">
          <div className="flex items-center gap-2 font-semibold text-on-surface">
            <span className="material-symbols-outlined text-primary text-[20px]">
              help_outline
            </span>
            <span>Thông tin cần lưu ý</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-label-md text-text-muted">
            <li>
              Hạn mức tạo lịch trình theo tháng được tính theo lịch và múi giờ Việt Nam (Asia/Ho Chi Minh).
            </li>
            <li>
              Các gói thanh toán hỗ trợ chuyển khoản an toàn qua cổng thanh toán PayOS và mã VietQR.
            </li>
            <li>
              Không tự động gia hạn trừ tiền thẻ — bạn toàn quyền quyết định khi nào muốn gia hạn thêm.
            </li>
          </ul>
        </section>
      </main>

      {/* Payment Checkout & QR Modal */}
      <PaymentCheckoutModal
        key={paymentIntent?.orderId || "empty"}
        isOpen={isPaymentModalOpen}
        onClose={handleCloseModal}
        paymentIntent={paymentIntent}
        onSuccess={handlePaymentSuccess}
        onRetryPayment={handleRetryPayment}
      />
    </div>
  );
}
