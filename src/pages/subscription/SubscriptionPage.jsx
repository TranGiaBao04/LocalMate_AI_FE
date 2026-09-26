import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useSubscription } from "../../context/SubscriptionContext";
import SubscriptionSummary from "../../components/subscription/SubscriptionSummary";
import PlanCard from "../../components/subscription/PlanCard";
import { PLAN_CODES } from "../../utils/subscriptionUtils";

export default function SubscriptionPage() {
  const navigate = useNavigate();
  const { isDemo } = useAuth();
  const {
    plans,
    subscription,
    plansLoading,
    subscriptionLoading,
    subscriptionError,
    refreshAll,
  } = useSubscription();

  const [actionLoading] = useState(false);
  const [pageError, setPageError] = useState("");

  const currentPlanCode = subscription?.plan || PLAN_CODES.FREE;

  const handleSelectPlan = async () => {
    setPageError("");
    // S5-B will open PaymentCheckoutModal
  };

  const handleRenew = async () => {
    setPageError("");
    // S5-B will handle renew payment
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
          disabled={plansLoading || subscriptionLoading}
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant disabled:opacity-50"
          title="Làm mới thông tin"
          aria-label="Làm mới thông tin"
        >
          <span
            className={`material-symbols-outlined text-[20px] ${
              plansLoading || subscriptionLoading ? "animate-spin" : ""
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
        {(subscriptionError || pageError) && !isDemo && (
          <div className="card border border-error/30 bg-error/5 p-4 rounded-xl flex items-center justify-between gap-3 text-body-md text-error">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px]">
                error
              </span>
              <span>{pageError || subscriptionError}</span>
            </div>
            <button
              type="button"
              onClick={() => refreshAll()}
              className="text-label-md font-bold underline hover:no-underline flex-shrink-0"
            >
              Thử lại
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
    </div>
  );
}
