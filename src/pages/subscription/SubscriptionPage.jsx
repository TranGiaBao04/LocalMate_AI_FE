import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useSubscription } from "../../context/SubscriptionContext";
import PageHeader from "../../components/layout/PageHeader";
import SubscriptionSummary from "../../components/subscription/SubscriptionSummary";
import PlanCard from "../../components/subscription/PlanCard";
import PaymentCheckoutModal from "../../components/subscription/PaymentCheckoutModal";
import CheckoutQuoteDialog from "../../components/subscription/CheckoutQuoteDialog";
import { useSubscriptionCheckoutQuote } from "../../hooks/useSubscriptionCheckoutQuote";
import { subscriptionService } from "../../services/subscriptionService";
import { isPaidSubscription, isFreeSubscription } from "../../utils/subscriptionUtils";
import {
  extractErrorCode,
  extractPendingPaymentMetadata,
  CUSTOMER_SUBSCRIPTION_ERROR_CODES,
  getCustomerErrorMessage,
  PAYMENT_ORDER_STATUS,
} from "../../utils/subscriptionUpgradeContract";
import {
  saveSubscriptionPaymentSession,
  getSubscriptionPaymentSession,
  clearSubscriptionPaymentSession,
} from "../../utils/subscriptionPaymentSession";

export default function SubscriptionPage() {
  const navigate = useNavigate();
  const { user, isDemo, isLoggedIn } = useAuth();
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

  const {
    quote,
    loading: quoteLoading,
    error: quoteError,
    selectedPlanCode,
    requestQuote,
    clearQuote,
  } = useSubscriptionCheckoutQuote({ ownerId: user?.id });

  const isQuoteDialogOpen = Boolean(selectedPlanCode);

  const isFree = isFreeSubscription(subscription);
  const isPaid = isPaidSubscription(subscription);
  const currentPlanCode = isPaid || isFree ? subscription?.plan : null;

  // Đồng bộ lại gói cước hiện tại hoặc danh mục gói khi gặp mã lỗi phân loại từ báo giá
  useEffect(() => {
    if (quoteError) {
      const code = extractErrorCode(quoteError);
      if (
        code === CUSTOMER_SUBSCRIPTION_ERROR_CODES.PLAN_ALREADY_ACTIVE ||
        code === CUSTOMER_SUBSCRIPTION_ERROR_CODES.ALREADY_COVERED_BY_HIGHER_PLAN
      ) {
        refreshSubscription();
      } else if (code === CUSTOMER_SUBSCRIPTION_ERROR_CODES.INVALID_PLAN_CODE) {
        refreshPlans();
      }
    }
  }, [quoteError, refreshSubscription, refreshPlans]);

  // Đảm bảo ranh giới tài khoản: Đóng modal thanh toán và huỷ intent nếu người dùng thay đổi hoặc đăng xuất
  const [prevUserId, setPrevUserId] = useState(user?.id);
  if (prevUserId !== user?.id) {
    setPrevUserId(user?.id);
    setPaymentIntent(null);
    setIsPaymentModalOpen(false);
  }

  // Khôi phục phiên thanh toán đang chờ từ owner-scoped session (Session Resume)
  // Backend GET /orders/{orderId} là cơ quan thẩm quyền duy nhất xác nhận trạng thái
  useEffect(() => {
    if (isDemo || !isLoggedIn || !user?.id) return undefined;

    let active = true;

    const resumeSession = async () => {
      const session = getSubscriptionPaymentSession(user.id);
      if (!session?.orderId) return;

      try {
        const order = await subscriptionService.getOrder(session.orderId);
        if (!active) return;

        if (order?.status === PAYMENT_ORDER_STATUS.PENDING) {
          const resumedIntent = {
            orderId: order.orderId,
            status: order.status,
            planCode: order.planCode,
            flow: session.flow || "purchase",
            qrCode: session.qrCode || null,
            checkoutUrl: session.checkoutUrl || null,
            amount: order.amount,
            expiresAt: order.expiresAt || null,
            type: order.type,
            listPrice: order.listPrice,
            creditAmount: order.creditAmount,
            ownerId: user.id,
          };
          saveSubscriptionPaymentSession(user.id, resumedIntent);
          setPaymentIntent(resumedIntent);
          setIsPaymentModalOpen(true);
        } else if (order?.status === PAYMENT_ORDER_STATUS.PAID) {
          clearSubscriptionPaymentSession(user.id);
          refreshSubscription();
          setPageSuccess("Thanh toán thành công! Gói cước của bạn đã được cập nhật.");
        } else if (order?.status === PAYMENT_ORDER_STATUS.REVIEW_REQUIRED) {
          const reviewIntent = {
            orderId: order.orderId,
            status: order.status,
            planCode: order.planCode,
            flow: session.flow || "purchase",
            qrCode: null,
            checkoutUrl: null,
            amount: order.amount,
            expiresAt: order.expiresAt || null,
            type: order.type,
            listPrice: order.listPrice,
            creditAmount: order.creditAmount,
            ownerId: user.id,
          };
          saveSubscriptionPaymentSession(user.id, reviewIntent);
          setPaymentIntent(reviewIntent);
          setIsPaymentModalOpen(true);
        } else if (
          order?.status === PAYMENT_ORDER_STATUS.FAILED ||
          order?.status === PAYMENT_ORDER_STATUS.EXPIRED
        ) {
          clearSubscriptionPaymentSession(user.id);
        }
      } catch (err) {
        if (!active) return;
        // 404: đơn hàng không tồn tại hoặc khác chủ sở hữu -> xoá session an toàn
        if (err?.status === 404 || err?.code === "payment_order_not_found") {
          clearSubscriptionPaymentSession(user.id);
        }
      }
    };

    resumeSession();

    return () => {
      active = false;
    };
  }, [isDemo, isLoggedIn, user?.id, refreshSubscription]);

  // Xử lý chọn gói: Mở dialog báo giá và gửi yêu cầu GET quote trước (KHÔNG checkout ngay)
  const handleSelectPlan = (planCode) => {
    if (isDemo || !planCode) return;
    setPageError("");
    setPageSuccess("");
    requestQuote(planCode);
  };

  const handleCloseQuoteDialog = () => {
    clearQuote();
  };

  const handleRenewFromQuote = () => {
    handleCloseQuoteDialog();
    handleRenew();
  };

  // Xác nhận tạo đơn hàng thanh toán sau khi người dùng đồng ý với báo giá hiển thị
  const handleConfirmQuote = async (planCode) => {
    if (isDemo || !planCode) return;
    setPageError("");
    setPageSuccess("");
    setActionLoading(true);

    try {
      // Backend POST /subscription/checkout: chỉ gửi { planCode }
      const response = await subscriptionService.checkout(planCode);
      clearQuote();

      // Dữ liệu từ phản hồi checkout là authoritative - bảo lưu toàn bộ các trường server trả về
      const intent = {
        orderId: response.orderId,
        planCode,
        flow: response.type === "Upgrade" ? "upgrade" : "purchase",
        qrCode: response.qrCode || null,
        checkoutUrl: response.checkoutUrl || null,
        amount: response.amount,
        expiresAt: response.expiresAt || null,
        status: response.status,
        type: response.type,
        listPrice: response.listPrice,
        creditAmount: response.creditAmount,
        ownerId: user?.id,
      };

      if (response.status === PAYMENT_ORDER_STATUS.PAID) {
        clearSubscriptionPaymentSession(user?.id);
        refreshSubscription();
        setPageSuccess("Thanh toán thành công! Gói cước của bạn đã được kích hoạt.");
      } else {
        saveSubscriptionPaymentSession(user?.id, intent);
        setPaymentIntent(intent);
        setIsPaymentModalOpen(true);
      }
    } catch (err) {
      const code = extractErrorCode(err);

      // Xử lý 409 Conflict: pending_order_exists, another_pending_order, payment_review_required
      if (
        code === CUSTOMER_SUBSCRIPTION_ERROR_CODES.PENDING_ORDER_EXISTS ||
        code === CUSTOMER_SUBSCRIPTION_ERROR_CODES.ANOTHER_PENDING_ORDER ||
        code === CUSTOMER_SUBSCRIPTION_ERROR_CODES.PAYMENT_REVIEW_REQUIRED
      ) {
        const metadata = extractPendingPaymentMetadata(err);
        if (metadata?.orderId) {
          clearQuote();
          let order = null;
          try {
            // Tra cứu đơn hàng sở hữu để lấy status và planCode thật sự từ Backend
            order = await subscriptionService.getOrder(metadata.orderId);
          } catch {
            // Bỏ qua lỗi mạng tức thời để hiển thị modal tra cứu an toàn
          }

          if (order?.status === PAYMENT_ORDER_STATUS.PAID) {
            clearSubscriptionPaymentSession(user?.id);
            refreshSubscription();
            setPageSuccess("Thanh toán thành công! Gói cước của bạn đã được kích hoạt.");
            return;
          }

          const isReviewRequired =
            code === CUSTOMER_SUBSCRIPTION_ERROR_CODES.PAYMENT_REVIEW_REQUIRED ||
            order?.status === PAYMENT_ORDER_STATUS.REVIEW_REQUIRED;

          const intent = {
            orderId: metadata.orderId,
            status: order?.status || (isReviewRequired ? PAYMENT_ORDER_STATUS.REVIEW_REQUIRED : undefined),
            planCode: order?.planCode || (code === CUSTOMER_SUBSCRIPTION_ERROR_CODES.ANOTHER_PENDING_ORDER ? undefined : planCode),
            flow: order?.type === "Upgrade" ? "upgrade" : order?.type === "Renewal" ? "renew" : "purchase",
            amount: order?.amount ?? metadata.amount,
            expiresAt: order?.expiresAt || metadata.expiresAt || null,
            type: order?.type || metadata.type,
            listPrice: order?.listPrice ?? metadata.listPrice,
            creditAmount: order?.creditAmount ?? metadata.creditAmount,
            qrCode: isReviewRequired ? null : (metadata.qrCode || null),
            checkoutUrl: isReviewRequired ? null : (metadata.checkoutUrl || null),
            ownerId: user?.id,
          };

          saveSubscriptionPaymentSession(user?.id, intent);
          setPaymentIntent(intent);
          setIsPaymentModalOpen(true);
          return;
        }
      }

      if (code === CUSTOMER_SUBSCRIPTION_ERROR_CODES.PAYMENT_REVIEW_REQUIRED) {
        clearQuote();
        setPageError(getCustomerErrorMessage(code));
      } else if (code === CUSTOMER_SUBSCRIPTION_ERROR_CODES.PLAN_ALREADY_ACTIVE) {
        refreshSubscription();
        setPageError(getCustomerErrorMessage(code));
        clearQuote();
      } else if (code === CUSTOMER_SUBSCRIPTION_ERROR_CODES.ALREADY_COVERED_BY_HIGHER_PLAN) {
        refreshSubscription();
        setPageError(getCustomerErrorMessage(code));
        clearQuote();
      } else if (code === CUSTOMER_SUBSCRIPTION_ERROR_CODES.TARGET_PLAN_ALREADY_SCHEDULED) {
        setPageError(getCustomerErrorMessage(code));
        clearQuote();
      } else if (err.status === 502 || code === CUSTOMER_SUBSCRIPTION_ERROR_CODES.PAYMENT_GATEWAY_UNAVAILABLE) {
        setPageError(
          "Cổng thanh toán PayOS tạm thời chưa thể kết nối. Vui lòng thử lại sau ít phút.",
        );
      } else if (code === CUSTOMER_SUBSCRIPTION_ERROR_CODES.PERSISTED_ACCOUNT_REQUIRED || err.status === 403) {
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
    if (isDemo || !isPaidSubscription(subscription)) return;
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
        qrCode: response.qrCode || null,
        checkoutUrl: response.checkoutUrl || null,
        amount: response.amount,
        expiresAt: response.expiresAt || null,
        status: response.status,
        type: response.type,
        listPrice: response.listPrice,
        creditAmount: response.creditAmount,
        ownerId: user?.id,
      };

      if (response.status === PAYMENT_ORDER_STATUS.PAID) {
        clearSubscriptionPaymentSession(user?.id);
        refreshSubscription();
        setPageSuccess("Gia hạn thành công! Gói cước của bạn đã được cập nhật.");
      } else {
        saveSubscriptionPaymentSession(user?.id, intent);
        setPaymentIntent(intent);
        setIsPaymentModalOpen(true);
      }
    } catch (err) {
      const code = extractErrorCode(err);

      if (
        code === CUSTOMER_SUBSCRIPTION_ERROR_CODES.PENDING_ORDER_EXISTS ||
        code === CUSTOMER_SUBSCRIPTION_ERROR_CODES.ANOTHER_PENDING_ORDER ||
        code === CUSTOMER_SUBSCRIPTION_ERROR_CODES.PAYMENT_REVIEW_REQUIRED
      ) {
        const metadata = extractPendingPaymentMetadata(err);
        if (metadata?.orderId) {
          let order = null;
          try {
            order = await subscriptionService.getOrder(metadata.orderId);
          } catch {
            // Bỏ qua lỗi mạng tức thời để hiển thị modal tra cứu an toàn
          }

          if (order?.status === PAYMENT_ORDER_STATUS.PAID) {
            clearSubscriptionPaymentSession(user?.id);
            refreshSubscription();
            setPageSuccess("Gia hạn thành công! Gói cước của bạn đã được cập nhật.");
            return;
          }

          const isReviewRequired =
            code === CUSTOMER_SUBSCRIPTION_ERROR_CODES.PAYMENT_REVIEW_REQUIRED ||
            order?.status === PAYMENT_ORDER_STATUS.REVIEW_REQUIRED;

          const intent = {
            orderId: metadata.orderId,
            status: order?.status || (isReviewRequired ? PAYMENT_ORDER_STATUS.REVIEW_REQUIRED : undefined),
            planCode: order?.planCode || (code === CUSTOMER_SUBSCRIPTION_ERROR_CODES.ANOTHER_PENDING_ORDER ? undefined : subscription?.plan),
            flow: "renew",
            amount: order?.amount ?? metadata.amount,
            expiresAt: order?.expiresAt || metadata.expiresAt || null,
            type: order?.type || metadata.type,
            listPrice: order?.listPrice ?? metadata.listPrice,
            creditAmount: order?.creditAmount ?? metadata.creditAmount,
            qrCode: isReviewRequired ? null : (metadata.qrCode || null),
            checkoutUrl: isReviewRequired ? null : (metadata.checkoutUrl || null),
            ownerId: user?.id,
          };

          saveSubscriptionPaymentSession(user?.id, intent);
          setPaymentIntent(intent);
          setIsPaymentModalOpen(true);
          return;
        }
      }

      if (code === CUSTOMER_SUBSCRIPTION_ERROR_CODES.PAYMENT_REVIEW_REQUIRED) {
        setPageError(getCustomerErrorMessage(code));
      } else if (code === CUSTOMER_SUBSCRIPTION_ERROR_CODES.NO_ACTIVE_SUBSCRIPTION) {
        refreshSubscription();
        setPageError(
          "Bạn chưa có gói trả phí nào đang hoạt động để gia hạn. Vui lòng chọn gói mới.",
        );
      } else if (err.status === 502 || code === CUSTOMER_SUBSCRIPTION_ERROR_CODES.PAYMENT_GATEWAY_UNAVAILABLE) {
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
    clearSubscriptionPaymentSession(user?.id);
    refreshSubscription();
    setPageSuccess("Thanh toán thành công! Gói cước của bạn đã được cập nhật.");
  };

  const handleCloseModal = () => {
    setIsPaymentModalOpen(false);
  };

  const handleRetryPayment = (intent) => {
    setIsPaymentModalOpen(false);
    clearSubscriptionPaymentSession(user?.id);
    if (!intent) return;
    if (intent.flow === "renew") {
      handleRenew();
    } else if (intent.planCode) {
      handleSelectPlan(intent.planCode);
    }
  };

  return (
    <div className="app-shell flex flex-col min-h-screen bg-background lg:pl-[220px]">
      <PageHeader title="Gói dịch vụ & Hội viên">
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
      </PageHeader>

      {/* Main Content */}
      <main className="content-shell flex-1 px-container-margin pt-20 lg:px-8 max-w-5xl mx-auto w-full space-y-8 pb-28 lg:pb-12">
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
              onRenew={isPaidSubscription(subscription) ? handleRenew : undefined}
              plans={plans}
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
                  onRenew={isPaid ? handleRenew : undefined}
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

      {/* Checkout Quote Preview Dialog */}
      <CheckoutQuoteDialog
        isOpen={isQuoteDialogOpen}
        onClose={handleCloseQuoteDialog}
        quote={quote}
        loading={quoteLoading}
        error={quoteError}
        onConfirm={handleConfirmQuote}
        confirmLoading={actionLoading}
        onRenew={handleRenewFromQuote}
      />

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
