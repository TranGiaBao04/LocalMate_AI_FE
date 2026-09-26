import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTrip } from "../../context/TripContext";
import logo from "../../assets/logo.jpg";

const NAV_ITEMS = [
  { path: "/home", icon: "home", label: "Home" },
  { path: "/trips", icon: "map_search", label: "Trip" },
  { path: "/create", icon: "explore", label: "Explore" },
  { path: "/profile", icon: "person", label: "Person" },
];

const SIDEBAR_NAV_ITEMS = [
  { path: "/home", icon: "home", label: "Home" },
  {
    path: "/trips",
    icon: "confirmation_number",
    label: "My Trips",
    badgeKey: "trips",
  },
  { path: "/create", icon: "train", label: "Metro Stations" },
  { path: "/create", icon: "location_on", label: "Hot Check-in Spots" },
  { path: "/profile", icon: "person", label: "My Account" },
];

function NavigationItem({ item, isActive, onClick, variant = "bottom" }) {
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
          : "flex flex-col items-center justify-center px-3 py-1 rounded-full"
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
            : "text-label-md font-medium"
        }
      >
        {item.label}
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
  const { user } = useAuth();
  const { savedTrips } = useTrip();

  const navItems = SIDEBAR_NAV_ITEMS.map((item) => ({
    ...item,
    badge: item.badgeKey === "trips" ? `${savedTrips.length} saved` : null,
  }));

  const displayName = user?.fullName || "Khách";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <aside className="desktop-sidebar-bg fixed inset-y-0 left-0 z-50 hidden w-[220px] flex-col gap-[22px] border-r border-navy/10 px-3.5 py-6 lg:flex">
      <div className="flex items-center gap-2.5 px-1.5">
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
      </div>

      <nav className="flex flex-col gap-[3px]">
        {navItems.map((item, i) => (
          <NavigationItem
            key={`${item.path}-${i}`}
            item={item}
            isActive={
              pathname === item.path &&
              navItems.findIndex((n) => n.path === item.path) === i
            }
            onClick={() => navigate(item.path)}
            variant="side"
          />
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-3">
        {/* Gói subscription BE chưa có: chỉ giới thiệu, không hiển thị quota */}
        <div className="rounded-[20px] bg-navy/[0.06] p-3.5">
          <div className="flex items-center justify-between gap-2 text-[11.5px]">
            <span className="font-bold text-navy-dark">Gói Pro</span>
            <span className="flex-none rounded-full bg-border-soft px-2 py-0.5 text-[10.5px] font-bold text-text-muted">
              Sắp ra mắt
            </span>
          </div>
          <div className="mt-1.5 text-[11.5px] text-text-muted">
            Tạo lịch trình AI không giới hạn
          </div>
        </div>
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
            <div className="text-[11px] text-text-faint">Gói Tiêu chuẩn</div>
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
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-20 w-full items-center justify-around rounded-t-lg border-t border-outline-variant/20 bg-surface/90 px-4 shadow-[0_-4px_30px_rgba(20,30,60,0.08)] backdrop-blur-lg lg:hidden">
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
