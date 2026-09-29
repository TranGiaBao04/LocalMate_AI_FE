import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import logo from "../../assets/logo.jpg";

const menuItems = [
  { label: "Tổng quan", icon: "dashboard", to: "/admin", end: true },
  { label: "Người dùng", icon: "group", to: "/admin/users" },
  { label: "Địa điểm", icon: "location_on", to: "/admin/places" },
  { label: "Giao dịch", icon: "receipt_long", to: "/admin/transactions" },
  { label: "Phản hồi", icon: "reviews", to: "/admin/feedback" },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#f4f6fa] text-slate-900 lg:pl-[272px]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[272px] flex-col border-r border-slate-200 bg-[#102853] text-white lg:flex">
        <div className="flex h-20 items-center gap-3 border-b border-white/10 px-7">
          <div className="h-11 w-11 overflow-hidden rounded-xl bg-white shadow-sm">
            <img src={logo} alt="LocalMate AI" className="h-full w-full object-cover object-top" />
          </div>
          <div>
            <p className="font-bold tracking-tight">LocalMate AI</p>
            <p className="mt-0.5 text-[10px] font-semibold tracking-[0.18em] text-blue-200/70">ADMIN PORTAL</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-4 py-7" aria-label="Điều hướng quản trị">
          <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-200/45">Quản lý hệ thống</p>
          {menuItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium transition ${
                  isActive
                    ? "bg-white text-[#17366f] shadow-sm"
                    : "text-blue-100/75 hover:bg-white/10 hover:text-white"
                }`
              }
            >
              <span className="material-symbols-outlined text-[21px]">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => navigate("/home")}
            className="group mt-3 flex w-full items-center gap-3 rounded-xl border border-blue-300/40 bg-blue-300/15 px-3.5 py-3 text-left text-sm font-semibold text-white shadow-[0_8px_24px_rgba(2,12,35,.18)] transition hover:-translate-y-0.5 hover:border-blue-200/70 hover:bg-blue-200/25"
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-white text-[#17366f] shadow-sm transition group-hover:scale-105">
              <span className="material-symbols-outlined text-[19px]">storefront</span>
            </span>
            <span className="flex-1">Xem giao diện người dùng</span>
            <span className="material-symbols-outlined text-[18px] text-blue-100/70">arrow_outward</span>
          </button>
        </nav>

        <div className="border-t border-white/10 p-4">
          <button type="button" onClick={handleLogout} className="flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium text-blue-100/75 transition hover:bg-white/10 hover:text-white">
            <span className="material-symbols-outlined text-[21px]">logout</span>
            Đăng xuất
          </button>
        </div>
      </aside>

      <div className="min-h-screen">
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-200 bg-white/90 px-5 backdrop-blur-xl sm:px-8 lg:px-10">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 overflow-hidden rounded-xl bg-white shadow-sm lg:hidden">
              <img src={logo} alt="LocalMate AI" className="h-full w-full object-cover object-top" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Admin Portal</p>
              <p className="mt-0.5 font-semibold text-slate-800">Trung tâm vận hành</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button type="button" aria-label="Thông báo" className="relative grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-blue-200 hover:text-[#1d3e82]">
              <span className="material-symbols-outlined text-[21px]">notifications</span>
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-white bg-red-500" />
            </button>
            <div className="hidden h-9 w-px bg-slate-200 sm:block" />
            <div className="hidden items-center gap-3 sm:flex">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-100 text-sm font-bold text-[#1d3e82]">
                {(user?.fullName || "A").trim().charAt(0).toUpperCase()}
              </div>
              <div className="max-w-44">
                <p className="truncate text-sm font-semibold text-slate-800">{user?.fullName || "Quản trị viên"}</p>
                <p className="truncate text-xs text-slate-400">{user?.email || "admin@localmate.dev"}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="px-5 py-7 sm:px-8 lg:px-10 lg:py-9">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
