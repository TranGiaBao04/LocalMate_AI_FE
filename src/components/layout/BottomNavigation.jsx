import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTrip } from "../../context/TripContext";
import { useSubscription } from "../../context/SubscriptionContext";
import { PLAN_CODES, PLAN_DISPLAY_NAMES } from "../../utils/subscriptionUtils";
import { canAccessAdmin } from "../../utils/adminAccess";
import { goHomeOrScrollTop } from "../../utils/scrollToTop";
import logo from "../../assets/logo.jpg";

// Dùng chung cho sidebar (label) và thanh dưới mobile (shortLabel ?? label)
const NAV_ITEMS = [
  { path: "/home", icon: "home", label: "Trang chủ" },
  {
    path: "/trips",
    icon: "confirmation_number",
    label: "Lịch trình",
    badgeKey: "trips",
    // Trang con của một chuyến đi: chi tiết, nháp, thay địa điểm, đã chốt
    activePaths: ["/trips", "/draft", "/replace", "/finalized"],
  },
  { path: "/metro", icon: "train", label: "Ga Metro", shortLabel: "Metro" },
  {
    path: "/explore",
    icon: "explore",
    label: "Khám phá",
    // Wizard tạo lịch mở từ trang này nên vẫn tô sáng mục
    activePaths: ["/explore", "/create"],
  },
  { path: "/subscription", icon: "workspace_premium", label: "Gói hội viên", shortLabel: "Hội viên" },
  { path: "/profile", icon: "person", label: "Tài khoản" },
];

// "/trips" khớp "/trips" và "/trips/<id>", không khớp "/trips-abc"
const matchesPath = (pathname, path) =>
  pathname === path || pathname.startsWith(`${path}/`);

const isItemActive = (pathname, item) =>
  (item.activePaths ?? [item.path]).some((path) => matchesPath(pathname, path));

export function NavigationItem({ item, isActive, onClick, variant = "bottom" }) {
  const activeClass =
    variant === "side" ? "bg-chip-bg text-navy" : "text-navy bg-chip-bg";
  const idleClass =
    variant === "side"
      ? "text-text-muted hover:bg-surface-container-low hover:text-navy-dark"
      : "text-text-muted hover:bg-surface-container-low hover:text-navy";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={isActive ? "page" : undefined}
      title={item.label}
      className={`transition-colors duration-200 motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-navy ${
        variant === "side"
          ? "flex min-h-11 w-full items-center gap-2 rounded-[8px] px-2.5 py-2.5 text-left"
          : "flex h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-[8px] px-0.5 py-2"
      } ${isActive ? activeClass : idleClass}`}
    >
      <span
        aria-hidden="true"
        className="material-symbols-outlined flex-none"
        style={{
          fontSize: variant === "side" ? "20px" : "24px",
          ...(isActive ? { fontVariationSettings: "'FILL' 1" } : {}),
        }}
      >
        {item.icon}
      </span>
      <span
        className={
          variant === "side"
            ? `min-w-0 flex-1 text-[13px] leading-5 [overflow-wrap:anywhere] ${isActive ? "font-bold" : "font-medium"}`
            : `w-full truncate text-center text-[11px] leading-4 ${isActive ? "font-bold" : "font-medium"}`
        }
      >
        {variant === "side" ? item.label : (item.shortLabel ?? item.label)}
      </span>{" "}
      {variant === "side" && item.badge && (
        <span className="flex-none rounded-full bg-white px-1.5 py-0.5 text-[11px] font-semibold leading-4 text-navy">
          {item.badge}
        </span>
      )}
    </button>
  );
}

export function SideNavigation() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, isDemo } = useAuth();
  const { savedTrips, tripsLoading, tripsLoaded, tripsError } = useTrip();
  const { subscription, subscriptionLoading } = useSubscription();

  const navItems = NAV_ITEMS.map((item) => ({
    ...item,
    badge: item.badgeKey === "trips" && tripsLoaded && !tripsLoading && !tripsError
      ? `${savedTrips.length} đã lưu` : null,
  }));

  const displayName = user?.fullName || "Khách";
  const initial = displayName.charAt(0).toUpperCase();

  const currentPlan = subscription?.plan;
  const planDisplayName = PLAN_DISPLAY_NAMES[currentPlan] || currentPlan ||
    (subscriptionLoading ? "Đang tải gói..." : "Chưa xác định gói");
  const isPaid = currentPlan === PLAN_CODES.TRIP_PASS || currentPlan === PLAN_CODES.MEMBERSHIP;

  return (
    <aside aria-label="LocalMate AI" className="fixed inset-y-0 left-0 z-50 hidden w-[220px] flex-col gap-6 border-r border-border-soft bg-surface-container-lowest px-3 py-5 lg:flex">
      <button
        type="button"
        onClick={() => goHomeOrScrollTop(navigate, pathname, "/home")}
        aria-label="LocalMate AI, về Trang chủ"
        className="flex min-h-11 shrink-0 items-center gap-2.5 rounded-[8px] px-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
      >
        <div className="h-11 w-11 flex-none overflow-hidden rounded-[8px] border border-border-soft bg-white">
          <img
            src={logo}
            alt="LocalMate AI"
            className="h-full w-full object-cover object-top"
          />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-[5px]">
            <span className="text-[15px] font-extrabold text-navy-dark">
              LocalMate
            </span>
            <span className="rounded-[4px] bg-navy px-1 py-0.5 text-[10px] font-bold text-white">
              AI
            </span>
          </div>
          <div className="mt-1 text-[11px] leading-4 text-text-muted">
            Metro-friendly planner
          </div>
        </div>
      </button>

      <nav aria-label="Điều hướng chính" className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain p-0.5">
        {navItems.map((item, i) => (
          <NavigationItem
            key={`${item.path}-${i}`}
            item={item}
            isActive={
              isItemActive(pathname, item) &&
              navItems.findIndex((n) => n.path === item.path) === i
            }
            onClick={() => navigate(item.path)}
            variant="side"
          />
        ))}
      </nav>

      <div className="mt-auto flex shrink-0 flex-col gap-3 border-t border-border-soft pt-4">
        {canAccessAdmin(user) && (
          <button
            type="button"
            onClick={() => navigate("/admin")}
            className="flex min-h-11 w-full items-center gap-2 rounded-[8px] border border-border-soft px-2.5 py-2.5 text-left text-[13px] font-semibold leading-5 text-navy transition-colors hover:bg-surface-container-low focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy motion-reduce:transition-none"
          >
            <span aria-hidden="true" className="material-symbols-outlined flex-none text-[20px]">admin_panel_settings</span>
            Về giao diện quản trị
          </button>
        )}

        {/* Hộp thông tin gói dịch vụ */}
        {isDemo ? (
          <button
            type="button"
            className="w-full rounded-[8px] border border-border-soft bg-surface-container-low p-3 text-left transition-colors hover:bg-chip-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy motion-reduce:transition-none"
            onClick={() => navigate("/subscription")}
          >
            <span className="flex items-start justify-between gap-2 text-[13px] leading-5">
              <span className="font-bold text-navy-dark">Gói hội viên</span>{" "}
              <span className="flex-none rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                Demo
              </span>
            </span>{" "}
            <span className="mt-2 block text-[12px] leading-5 text-text-muted">
              Đăng ký để sử dụng đầy đủ
            </span>
          </button>
        ) : (
          <button
            type="button"
            className="w-full rounded-[8px] border border-border-soft bg-surface-container-low p-3 text-left transition-colors hover:bg-chip-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy motion-reduce:transition-none"
            onClick={() => navigate("/subscription")}
          >
            <span className="flex items-start justify-between gap-2 text-[13px] leading-5">
              <span className="min-w-0 font-bold text-navy-dark [overflow-wrap:anywhere]">{planDisplayName}</span>{" "}
              <span
                className={`flex-none rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  isPaid ? "bg-primary text-white" : "bg-border-soft text-text-muted"
                }`}
              >
                {isPaid ? "Đang dùng" : currentPlan === PLAN_CODES.FREE ? "Mặc định" : "Chưa xác nhận"}
              </span>
            </span>{" "}
            <span className="mt-2 block text-[12px] leading-5 text-text-muted">
              {isPaid ? "Quản lý gói & gia hạn" : currentPlan === PLAN_CODES.FREE ? "Nâng cấp gói tạo không giới hạn" : "Xem thông tin gói hội viên"}
            </span>
          </button>
        )}

        <button
          type="button"
          className="flex min-h-11 w-full items-center gap-2.5 rounded-[8px] p-2 text-left transition-colors hover:bg-surface-container-low focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy motion-reduce:transition-none"
          onClick={() => navigate("/profile")}
        >
          <span aria-hidden="true" className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-chip-bg text-[14px] font-bold text-navy">
            {initial}
          </span>
          <span className="min-w-0 flex-1">
            <span title={displayName} className="block truncate text-[13px] font-semibold leading-5 text-navy-dark">
              {displayName}
            </span>{" "}
            <span title={isDemo ? "Phiên Demo" : planDisplayName} className="block truncate text-[12px] leading-5 text-text-muted">
              {isDemo ? "Phiên Demo" : planDisplayName}
            </span>
          </span>
          <span aria-hidden="true" className="material-symbols-outlined flex-none text-[20px] text-text-muted">
            settings
          </span>
        </button>
      </div>
    </aside>
  );
}

export default function BottomNavigation() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <nav aria-label="Điều hướng di động" className="fixed bottom-0 left-0 right-0 z-50 flex h-20 w-full items-center gap-0.5 border-t border-border-soft bg-surface-container-lowest px-1 lg:hidden">
      {NAV_ITEMS.map((item) => (
        <NavigationItem
          key={item.path}
          item={item}
          isActive={pathname === item.path}
          onClick={() => navigate(item.path)}
        />
      ))}
    </nav>
  );
}
