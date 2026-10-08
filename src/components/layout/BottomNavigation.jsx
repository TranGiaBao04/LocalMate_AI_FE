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
    variant === "side" ? "bg-navy text-white" : "text-navy bg-navy/10";
  const idleClass =
    variant === "side"
      ? "text-[#3A4256] hover:bg-[#E8ECF7]"
      : "text-text-muted hover:bg-surface-container-high";

  return (
    <button
      onClick={onClick}
      className={`transition-all duration-200 active:scale-95 ${
        variant === "side"
          ? "w-full flex items-center gap-[11px] rounded-xl px-3 py-2.5 text-left"
          : "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-0.5 py-1.5"
      } ${isActive ? activeClass : idleClass}`}
    >
      <span
        className="material-symbols-outlined flex-none"
        style={{
          fontSize: variant === "side" ? "18px" : undefined,
          ...(isActive ? { fontVariationSettings: "'FILL' 1" } : {}),
        }}
      >
        {item.icon}
      </span>
      <span
        className={
          variant === "side"
            ? `flex-1 min-w-0 truncate text-[13.5px] ${isActive ? "font-bold" : "font-medium"}`
            : "w-full truncate text-center text-label-sm"
        }
      >
        {variant === "side" ? item.label : (item.shortLabel ?? item.label)}
      </span>
      {variant === "side" && item.badge && (
        <span className="flex-none rounded-full bg-navy/10 px-[7px] py-0.5 text-[10.5px] font-bold text-navy">
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
  const { savedTrips } = useTrip();
  const { subscription } = useSubscription();

  const navItems = NAV_ITEMS.map((item) => ({
    ...item,
    badge: item.badgeKey === "trips" ? `${savedTrips.length} đã lưu` : null,
  }));

  const displayName = user?.fullName || "Khách";
  const initial = displayName.charAt(0).toUpperCase();

  const currentPlan = subscription?.plan || PLAN_CODES.FREE;
  const planDisplayName = PLAN_DISPLAY_NAMES[currentPlan] || currentPlan;
  const isPaid = currentPlan === PLAN_CODES.TRIP_PASS || currentPlan === PLAN_CODES.MEMBERSHIP;

  return (
    <aside className="desktop-sidebar-bg fixed inset-y-0 left-0 z-50 hidden w-[220px] flex-col gap-[22px] border-r border-navy/10 px-3.5 py-6 lg:flex">
      <button
        type="button"
        onClick={() => goHomeOrScrollTop(navigate, pathname, "/home")}
        aria-label="LocalMate AI, về Trang chủ"
        className="flex items-center gap-2.5 rounded-xl px-1.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
      >
        <div className="h-[42px] w-[42px] flex-none overflow-hidden rounded-xl bg-white shadow-[0_1px_2px_rgba(20,30,60,0.1)]">
          <img
            src={logo}
            alt="LocalMate AI"
            className="h-full w-full object-cover object-top"
          />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-[5px]">
            <span className="text-[15px] font-extrabold tracking-tight text-navy-dark">
              LocalMate
            </span>
            <span className="rounded-[5px] bg-navy px-[5px] py-0.5 text-[9.5px] font-extrabold text-white">
              AI
            </span>
          </div>
          <div className="mt-px text-[10.5px] text-text-muted">
            Metro-friendly planner
          </div>
        </div>
      </button>

      <nav className="flex flex-col gap-[3px]">
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

      <div className="mt-auto flex flex-col gap-3">
        {canAccessAdmin(user) && (
          <button
            type="button"
            onClick={() => navigate("/admin")}
            className="flex w-full items-center gap-2.5 rounded-xl bg-navy px-3 py-2.5 text-left text-[13px] font-semibold text-white transition hover:bg-navy-dark"
          >
            <span className="material-symbols-outlined text-[18px]">admin_panel_settings</span>
            Về giao diện quản trị
          </button>
        )}

        {/* Hộp thông tin gói dịch vụ */}
        {isDemo ? (
          <div
            className="rounded-[20px] bg-navy/[0.06] p-3.5 cursor-pointer hover:bg-navy/[0.09] transition-colors"
            onClick={() => navigate("/subscription")}
          >
            <div className="flex items-center justify-between gap-2 text-[11.5px]">
              <span className="font-bold text-navy-dark">Gói hội viên</span>
              <span className="flex-none rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[10px] font-bold">
                Demo
              </span>
            </div>
            <div className="mt-1 text-[11px] text-text-muted">
              Đăng ký để sử dụng đầy đủ
            </div>
          </div>
        ) : (
          <div
            className="rounded-[20px] bg-navy/[0.06] p-3.5 cursor-pointer hover:bg-navy/[0.09] transition-colors"
            onClick={() => navigate("/subscription")}
          >
            <div className="flex items-center justify-between gap-2 text-[11.5px]">
              <span className="font-bold text-navy-dark">{planDisplayName}</span>
              <span
                className={`flex-none rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  isPaid ? "bg-primary text-white" : "bg-border-soft text-text-muted"
                }`}
              >
                {isPaid ? "Đang dùng" : "Mặc định"}
              </span>
            </div>
            <div className="mt-1 text-[11px] text-text-muted">
              {isPaid ? "Quản lý gói & gia hạn" : "Nâng cấp gói tạo không giới hạn"}
            </div>
          </div>
        )}

        <div
          className="flex cursor-pointer items-center gap-2.5 rounded-xl px-1.5 py-1 hover:bg-[#E8ECF7]"
          onClick={() => navigate("/profile")}
        >
          <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-navy text-[13px] font-bold text-white">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-bold text-navy-dark">
              {displayName}
            </div>
            <div className="text-[11px] text-text-faint">
              {isDemo ? "Phiên Demo" : planDisplayName}
            </div>
          </div>
          <span className="material-symbols-outlined flex-none text-[16px] text-text-faint">
            settings
          </span>
        </div>
      </div>
    </aside>
  );
}

export default function BottomNavigation() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-20 w-full items-center rounded-t-lg border-t border-outline-variant/20 bg-surface/90 px-1 shadow-[0_-4px_30px_rgba(20,30,60,0.08)] backdrop-blur-lg lg:hidden">
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
