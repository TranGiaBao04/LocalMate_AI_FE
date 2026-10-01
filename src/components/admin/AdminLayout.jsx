import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { ADMIN_API_EVENTS } from "../../api/adminApiClient";
import logo from "../../assets/logo.jpg";

const menuItems = [
  { label: "Tổng quan", icon: "grid_view", to: "/admin", end: true },
  { label: "Quản lý Ga Metro", icon: "train", to: "/admin/stations" },
  { label: "Địa điểm & Tiện ích", icon: "location_on", to: "/admin/places" },
  { label: "Nhập dữ liệu Excel", icon: "upload_file", to: "/admin/import" },
  { label: "Gói thành viên", icon: "loyalty", to: "/admin/plans" },
  { label: "Giao dịch PayOS", icon: "payments", to: "/admin/transactions" },
  { label: "Quản lý Users", icon: "group", to: "/admin/users" },
  { label: "Phân quyền & Quản trị", icon: "admin_panel_settings", to: "/admin/permissions" },
];

const pageTitles = {
  "/admin": "Tổng quan hệ thống",
  "/admin/stations": "Quản lý Ga Metro",
  "/admin/places": "Địa điểm & Tiện ích",
  "/admin/import": "Nhập dữ liệu Excel",
  "/admin/plans": "Gói thành viên",
  "/admin/transactions": "Giao dịch PayOS",
  "/admin/users": "Quản lý Users",
  "/admin/permissions": "Phân quyền & Quản trị",
};

export default function AdminLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const [apiNotice, setApiNotice] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const displayName = user?.fullName || "LocalMate Admin";
  const initials = useMemo(
    () => displayName.split(" ").filter(Boolean).slice(-2).map((part) => part[0]).join("").toUpperCase(),
    [displayName],
  );

  useEffect(() => {
    let noticeTimer;
    const handleUnauthorized = (event) => {
      logout();
      navigate("/login", { replace: true, state: { message: event.detail?.message || "Phiên đăng nhập đã hết hạn." } });
    };
    const handleForbidden = (event) => {
      setApiNotice(event.detail?.message || "Bạn không có quyền thực hiện thao tác này.");
      clearTimeout(noticeTimer);
      noticeTimer = setTimeout(() => setApiNotice(""), 4500);
    };
    window.addEventListener(ADMIN_API_EVENTS.UNAUTHORIZED, handleUnauthorized);
    window.addEventListener(ADMIN_API_EVENTS.FORBIDDEN, handleForbidden);
    return () => {
      clearTimeout(noticeTimer);
      window.removeEventListener(ADMIN_API_EVENTS.UNAUTHORIZED, handleUnauthorized);
      window.removeEventListener(ADMIN_API_EVENTS.FORBIDDEN, handleForbidden);
    };
  }, [logout, navigate]);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const sidebar = (
    <>
      <div className="flex h-[88px] items-center gap-3 border-b border-white/10 px-6">
        <div className="h-11 w-11 flex-none overflow-hidden rounded-xl bg-white shadow-sm">
          <img src={logo} alt="LocalMate AI" className="h-full w-full object-cover object-top" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[17px] font-extrabold tracking-tight text-white">LocalMate</span>
          <span className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-extrabold text-[#0f2042]">AI</span>
        </div>
      </div>
      <div className="mx-4 mt-5 flex items-center gap-2 rounded-xl border border-blue-300/15 bg-blue-300/10 px-3 py-2.5 text-[11px] font-semibold text-blue-200">
        <span className="material-symbols-outlined text-[16px]">shield</span>
        CỔNG QUẢN TRỊ HỆ THỐNG
      </div>
      <nav className="admin-sidebar-scroll flex-1 space-y-1 overflow-y-auto px-4 py-5" aria-label="Điều hướng quản trị">
        {menuItems.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3.5 py-3 text-[13px] font-semibold transition ${isActive ? "bg-blue-600 text-white shadow-[0_8px_22px_rgba(37,99,235,.28)]" : "text-slate-300 hover:bg-white/[0.08] hover:text-white"}`}>
            <span className="material-symbols-outlined text-[20px]">{item.icon}</span>{item.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-white/10 p-4">
        <button type="button" onClick={() => navigate("/home")} className="mb-2 flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-left text-[13px] font-semibold text-blue-200 transition hover:bg-white/10 hover:text-white">
          <span className="material-symbols-outlined text-[20px]">storefront</span><span className="flex-1">Giao diện người dùng</span><span className="material-symbols-outlined text-[17px]">open_in_new</span>
        </button>
        <div className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-500 text-xs font-bold text-white">{initials || "A"}</div>
          <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-white">{displayName}</p><p className="truncate text-[10px] text-slate-400">Super Administrator</p></div>
          <button type="button" onClick={handleLogout} aria-label="Đăng xuất" className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white"><span className="material-symbols-outlined text-[19px]">logout</span></button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#f4f6fa] text-slate-900 lg:pl-[258px]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[258px] flex-col bg-[#0f2042] text-white lg:flex">{sidebar}</aside>
      {mobileMenuOpen && <button type="button" aria-label="Đóng menu" onClick={() => setMobileMenuOpen(false)} className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden" />}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col bg-[#0f2042] text-white transition-transform lg:hidden ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}>{sidebar}</aside>
      <div className="min-h-screen">
        {apiNotice && <div role="alert" className="fixed right-5 top-5 z-[70] flex max-w-sm items-start gap-3 rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-xl"><span className="material-symbols-outlined text-[20px] text-amber-600">warning</span><span className="flex-1 font-medium">{apiNotice}</span><button type="button" onClick={() => setApiNotice("")} aria-label="Đóng thông báo" className="text-slate-400 hover:text-slate-700"><span className="material-symbols-outlined text-[18px]">close</span></button></div>}
        <header className="flex h-[88px] items-center gap-3 border-b border-slate-200 bg-white px-4 sm:px-7 lg:px-8">
          <button type="button" onClick={() => setMobileMenuOpen(true)} aria-label="Mở menu" className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 text-slate-600 lg:hidden"><span className="material-symbols-outlined">menu</span></button>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-600">Admin Portal</p>
            <p className="mt-1 truncate text-base font-extrabold text-[#0f2042]">{pageTitles[pathname] || "Quản trị hệ thống"}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={() => navigate("/admin/places")} className="hidden h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700 sm:flex"><span className="material-symbols-outlined text-[18px]">add_circle</span>Thêm địa điểm</button>
            <button type="button" onClick={() => navigate("/admin/import")} className="hidden h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition hover:border-blue-200 hover:text-blue-700 xl:flex"><span className="material-symbols-outlined text-[18px]">upload_file</span>Import</button>
            <button type="button" aria-label="Thông báo" className="relative grid h-10 w-10 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:text-blue-700"><span className="material-symbols-outlined text-[20px]">notifications</span></button>
            <div className="hidden h-8 w-px bg-slate-200 sm:block" />
            <div className="hidden items-center gap-2.5 sm:flex"><div className="grid h-9 w-9 place-items-center rounded-full bg-blue-100 text-xs font-extrabold text-blue-800">{initials || "A"}</div><div className="hidden xl:block"><p className="max-w-36 truncate text-xs font-bold text-slate-800">{displayName}</p><p className="text-[10px] text-slate-400">Administrator</p></div></div>
          </div>
        </header>
        <main className="px-4 py-6 sm:px-7 lg:px-8 lg:py-7"><div className="mx-auto max-w-[1540px]"><Outlet /></div></main>
      </div>
    </div>
  );
}
