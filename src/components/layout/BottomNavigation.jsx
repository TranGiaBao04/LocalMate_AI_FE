import { useLocation, useNavigate } from "react-router-dom";

const NAV_ITEMS = [
  { path: "/home", icon: "home", label: "Home" },
  { path: "/trips", icon: "map_search", label: "Trip" },
  { path: "/create", icon: "explore", label: "Explore" },
  { path: "/profile", icon: "person", label: "Person" },
];

function NavigationItem({ item, isActive, onClick, variant = "bottom" }) {
  const activeClass =
    variant === "side"
      ? "bg-primary text-on-primary shadow-md shadow-primary/20"
      : "text-primary bg-primary-container/20";
  const idleClass =
    variant === "side"
      ? "text-on-surface-variant hover:bg-surface-container-low"
      : "text-on-surface-variant hover:bg-surface-container-high";

  return (
    <button
      onClick={onClick}
      className={`transition-all duration-200 active:scale-95 ${
        variant === "side"
          ? "w-full flex items-center gap-3 rounded-lg px-4 py-3 text-left"
          : "flex flex-col items-center justify-center px-3 py-1 rounded-full"
      } ${isActive ? activeClass : idleClass}`}
    >
      <span
        className="material-symbols-outlined"
        style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
      >
        {item.icon}
      </span>
      <span className="text-label-md font-medium">{item.label}</span>
    </button>
  );
}

export function SideNavigation() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <aside className="desktop-sidebar-bg fixed inset-y-0 left-0 z-50 hidden w-72 border-r border-white/50 px-5 py-6 shadow-[8px_0_30px_rgba(0,107,95,0.08)] backdrop-blur-xl lg:flex lg:flex-col">
      <div className="mb-8 flex items-center gap-3 px-2">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-container/20 text-primary">
          <span
            className="material-symbols-outlined"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            explore
          </span>
        </div>
        <div>
          <p className="text-title-md font-extrabold text-primary">
            LocalMate AI
          </p>
          <p className="text-label-md text-on-surface-variant">
            Metro-friendly planner
          </p>
        </div>
      </div>

      <nav className="flex flex-col gap-2">
        {NAV_ITEMS.map((item) => (
          <NavigationItem
            key={item.path}
            item={item}
            isActive={pathname === item.path}
            onClick={() => navigate(item.path)}
            variant="side"
          />
        ))}
      </nav>
    </aside>
  );
}

export default function BottomNavigation() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-20 w-full items-center justify-around rounded-t-lg border-t border-outline-variant/20 bg-surface/90 px-4 shadow-[0_-4px_30px_rgba(0,107,95,0.08)] backdrop-blur-lg lg:hidden">
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
