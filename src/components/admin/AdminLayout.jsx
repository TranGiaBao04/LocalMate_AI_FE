import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { ADMIN_API_EVENTS } from "../../api/adminApiClient";
import { ADMIN_PERMISSIONS } from "../../constants";
import { hasAnyPermission } from "../../utils/adminAccess";
import { ADMIN_SECTIONS } from "./adminSections";
import { NavigationItem } from "../layout/BottomNavigation";
import { goHomeOrScrollTop } from "../../utils/scrollToTop";
import logo from "../../assets/logo.jpg";

const DASHBOARD_ITEM = { label: "Tổng quan", icon: "grid_view", to: "/admin", end: true };

const getInitial = (name) => (name || "A").trim().charAt(0).toUpperCase();

// "/admin" chỉ khớp đúng trang Tổng quan; mục khác khớp cả trang con ("/admin/places/<id>")
const isMenuItemActive = (pathname, item) =>
  item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`);

export default function AdminLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, logout, refreshProfile } = useAuth();
  const [apiNotice, setApiNotice] = useState("");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef(null);

  const visibleSections = ADMIN_SECTIONS.filter((section) => hasAnyPermission(user, section.permissions));
  const menuItems = [
    DASHBOARD_ITEM,
    ...visibleSections.map((section) => ({ label: section.label, icon: section.icon, to: `/admin/${section.path}` })),
  ];
  const currentSection = ADMIN_SECTIONS.find((section) => pathname.startsWith(`/admin/${section.path}`));
  const breadcrumbs = currentSection ? [currentSection.group, currentSection.label] : [DASHBOARD_ITEM.label];
  const canManagePlaces = hasAnyPermission(user, [ADMIN_PERMISSIONS.MANAGE_PLACES]);

  useEffect(() => {
    const handleUnauthorized = (event) => {
      logout();
      navigate("/login", {
        replace: true,
        state: { message: event.detail?.message || "Phiên đăng nhập đã hết hạn." },
      });
    };

    const handleForbidden = (event) => {
      setApiNotice(event.detail?.message || "Bạn không có quyền thực hiện thao tác này.");
      // Quyền có thể vừa bị thu hồi: nạp lại để ẩn menu không còn quyền
      refreshProfile().catch(() => {});
    };

    window.addEventListener(ADMIN_API_EVENTS.UNAUTHORIZED, handleUnauthorized);
    window.addEventListener(ADMIN_API_EVENTS.FORBIDDEN, handleForbidden);
    return () => {
      window.removeEventListener(ADMIN_API_EVENTS.UNAUTHORIZED, handleUnauthorized);
      window.removeEventListener(ADMIN_API_EVENTS.FORBIDDEN, handleForbidden);
    };
  }, [logout, navigate, refreshProfile]);

  // Timer tách riêng: refreshProfile làm AuthProvider render lại ⇒ effect trên chạy lại,
  // nếu timer nằm trong đó sẽ bị clear và toast không tự tắt
  useEffect(() => {
    if (!apiNotice) return undefined;
    const timer = setTimeout(() => setApiNotice(""), 4500);
    return () => clearTimeout(timer);
  }, [apiNotice]);

  // Menu tài khoản: đóng khi bấm ra ngoài hoặc nhấn Esc
  useEffect(() => {
    if (!accountMenuOpen) return undefined;
    const handlePointerDown = (event) => {
      if (!accountMenuRef.current?.contains(event.target)) setAccountMenuOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setAccountMenuOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [accountMenuOpen]);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background text-on-surface lg:pl-[220px]">
      {/* Cùng khung với SideNavigation bên người dùng, chỉ khác nội dung */}
      <aside className="desktop-sidebar-bg fixed inset-y-0 left-0 z-50 hidden w-[220px] flex-col gap-[22px] border-r border-navy/10 px-3.5 py-6 lg:flex">
        <button
          type="button"
          onClick={() => goHomeOrScrollTop(navigate, pathname, "/admin")}
          aria-label="LocalMate AI, về Tổng quan"
          className="flex items-center gap-2.5 rounded-xl px-1.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
        >
          <div className="h-[42px] w-[42px] flex-none overflow-hidden rounded-xl bg-white shadow-[0_1px_2px_rgba(20,30,60,0.1)]">
            <img src={logo} alt="LocalMate AI" className="h-full w-full object-cover object-top" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-[5px]">
              <span className="text-[15px] font-extrabold tracking-tight text-navy-dark">LocalMate</span>
              <span className="rounded-[5px] bg-navy px-[5px] py-0.5 text-[9.5px] font-extrabold text-white">AI</span>
            </div>
            <div className="mt-px text-[10.5px] text-text-muted">Admin Portal</div>
          </div>
        </button>

        <nav className="flex flex-col gap-[3px] overflow-y-auto" aria-label="Điều hướng quản trị">
          {menuItems.map((item) => (
            <NavigationItem
              key={item.to}
              item={item}
              isActive={isMenuItemActive(pathname, item)}
              onClick={() => navigate(item.to)}
              variant="side"
            />
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-3">
          <button
            type="button"
            onClick={() => navigate("/home")}
            className="flex w-full items-center gap-2.5 rounded-xl bg-navy px-3 py-2.5 text-left text-[13px] font-semibold text-white transition hover:bg-navy-dark"
          >
            <span className="material-symbols-outlined text-[18px]">storefront</span>
            Về giao diện người dùng
          </button>

          {/* Cùng kiểu hộp "Gói thành viên" bên người dùng */}
          <div className="rounded-[20px] bg-navy/[0.06] p-3.5">
            <div className="flex items-center justify-between gap-2 text-[11.5px]">
              <span className="min-w-0 truncate font-bold text-navy-dark">Vai trò: {user?.role}</span>
              {Array.isArray(user?.permissions) && (
                <span className="flex-none rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-white">
                  {user.permissions.length} quyền
                </span>
              )}
            </div>
            <div className="mt-1 text-[11px] text-text-muted">
              Truy cập {visibleSections.length} khu vực quản trị
            </div>
          </div>

          <div className="flex items-center gap-2.5 rounded-xl px-1.5 py-1">
            <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-navy text-[13px] font-bold text-white">
              {getInitial(user?.fullName)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-bold text-navy-dark">{user?.fullName}</div>
              <div className="truncate text-[11px] text-text-faint">{user?.email}</div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Đăng xuất"
              title="Đăng xuất"
              className="grid h-7 w-7 flex-none place-items-center rounded-full text-text-faint transition hover:bg-[#E8ECF7] hover:text-navy-dark"
            >
              <span className="material-symbols-outlined text-[16px]">logout</span>
            </button>
          </div>
        </div>
      </aside>

      <div className="min-h-screen">
        {apiNotice && (
          <div role="alert" className="fixed right-5 top-5 z-[70] flex max-w-sm items-start gap-3 rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm text-on-surface shadow-xl">
            <span className="material-symbols-outlined text-[20px] text-amber-600">warning</span>
            <span className="flex-1 font-medium">{apiNotice}</span>
            <button type="button" onClick={() => setApiNotice("")} aria-label="Đóng thông báo" className="text-text-faint hover:text-on-surface">
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        )}

        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-navy/10 bg-background/90 px-5 backdrop-blur-xl sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => goHomeOrScrollTop(navigate, pathname, "/admin")}
              aria-label="LocalMate AI, về Tổng quan"
              className="h-9 w-9 flex-none overflow-hidden rounded-xl bg-white shadow-[0_1px_2px_rgba(20,30,60,0.1)] lg:hidden"
            >
              <img src={logo} alt="LocalMate AI" className="h-full w-full object-cover object-top" />
            </button>
            <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
              <Link to="/admin" className="hidden shrink-0 text-text-muted transition hover:text-navy-darkest md:inline">
                Quản trị hệ thống
              </Link>
              {breadcrumbs.map((crumb, index) => {
                const isLast = index === breadcrumbs.length - 1;
                return (
                  <span key={crumb} className={`items-center gap-1.5 ${isLast ? "flex min-w-0" : "hidden md:flex"}`}>
                    <span className="material-symbols-outlined hidden text-[16px] text-text-faint md:inline">chevron_right</span>
                    <span className={isLast ? "truncate font-semibold text-on-surface" : "shrink-0 text-text-muted"}>{crumb}</span>
                  </span>
                );
              })}
            </nav>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {canManagePlaces && (
              <>
                <Link
                  to="/admin/places"
                  className="hidden h-10 items-center gap-2 rounded-[10px] bg-navy-darkest px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-dark sm:inline-flex"
                >
                  <span className="material-symbols-outlined text-[20px]">add_circle</span>
                  Thêm địa điểm
                </Link>
                <Link
                  to="/admin/import"
                  className="hidden h-10 items-center gap-2 rounded-[10px] border border-border-soft bg-white px-3.5 text-sm font-semibold text-navy-darkest transition hover:border-navy-mid/40 md:inline-flex"
                >
                  <span className="material-symbols-outlined text-[20px]">upload_file</span>
                  Import
                </Link>
              </>
            )}

            {/* Màn lớn đã có tài khoản + đăng xuất ở cuối sidebar */}
            <div ref={accountMenuRef} className="relative lg:hidden">
              <button
                type="button"
                onClick={() => setAccountMenuOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={accountMenuOpen}
                aria-label="Tài khoản"
                className="flex items-center gap-1 rounded-full p-1 pr-2 transition hover:bg-surface-container-low"
              >
                <span className="grid h-8 w-8 place-items-center rounded-full bg-navy-darkest text-xs font-bold text-white">
                  {getInitial(user?.fullName)}
                </span>
                <span className="material-symbols-outlined text-[18px] text-text-muted">expand_more</span>
              </button>

              {accountMenuOpen && (
                <div role="menu" className="absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-2xl border border-border-soft bg-white py-2 shadow-xl">
                  <div className="border-b border-[#eef1f8] px-4 pb-3 pt-1">
                    <p className="truncate text-sm font-semibold text-on-surface">{user?.fullName}</p>
                    <p className="truncate text-xs text-text-muted">{user?.email}</p>
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => navigate("/home")}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-on-surface transition hover:bg-surface-container-low"
                  >
                    <span className="material-symbols-outlined text-[20px] text-text-muted">storefront</span>
                    Xem giao diện người dùng
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-error transition hover:bg-error-container/40"
                  >
                    <span className="material-symbols-outlined text-[20px]">logout</span>
                    Đăng xuất
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <nav aria-label="Điều hướng quản trị" className="flex gap-2 overflow-x-auto border-b border-navy/10 bg-white px-5 py-3 lg:hidden">
          {menuItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-1.5 rounded-[10px] px-3 py-2 text-sm font-medium transition ${
                  isActive ? "bg-navy-darkest text-white" : "text-on-surface-variant hover:bg-surface-container-low"
                }`
              }
            >
              <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <main className="px-5 py-7 sm:px-8 lg:py-8">
          {/* Khung nội dung chung: trang con không tự đặt max-width hay lề ngoài */}
          <div className="mx-auto max-w-[1440px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
