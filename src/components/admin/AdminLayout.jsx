import { useCallback, useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { ADMIN_API_EVENTS } from "../../api/adminApiClient";
import { hasAnyPermission } from "../../utils/adminAccess";
import { goHomeOrScrollTop } from "../../utils/scrollToTop";
import { ADMIN_SECTIONS } from "./adminSections";
import { ADMIN_ICON_BUTTON } from "./adminStyles";
import AdminSidebar from "./AdminSidebar";
import AdminMobileDrawer from "./AdminMobileDrawer";
import AdminTopbar from "./AdminTopbar";

const DASHBOARD_ITEM = { label: "Tổng quan", icon: "grid_view", to: "/admin", end: true };

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { pathname } = location;
  const { user, logout, refreshProfile } = useAuth();
  const [apiNotice, setApiNotice] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [routeKey, setRouteKey] = useState(location.key);
  const menuTriggerRef = useRef(null);

  // Route changes also close overlays initiated by navigation outside the menu.
  if (routeKey !== location.key) {
    setRouteKey(location.key);
    setDrawerOpen(false);
    setAccountMenuOpen(false);
  }

  const visibleSections = ADMIN_SECTIONS.filter((section) => hasAnyPermission(user, section.permissions));
  const groups = [{ label: "Tổng quan", items: [DASHBOARD_ITEM] }];
  visibleSections.forEach((section) => {
    let group = groups.find((candidate) => candidate.label === section.navGroup);
    if (!group) {
      group = { label: section.navGroup, items: [] };
      groups.push(group);
    }
    group.items.push({ label: section.navLabel, icon: section.icon, to: `/admin/${section.path}` });
  });
  const currentSection = ADMIN_SECTIONS.find((section) => pathname === `/admin/${section.path}` || pathname.startsWith(`/admin/${section.path}/`));
  const breadcrumbs = currentSection ? [currentSection.navGroup, currentSection.navLabel] : [DASHBOARD_ITEM.label];
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  useEffect(() => {
    const handleUnauthorized = (event) => {
      logout();
      navigate("/login", { replace: true, state: { message: event.detail?.message || "Phiên đăng nhập đã hết hạn." } });
    };
    const handleForbidden = (event) => {
      setApiNotice(event.detail?.message || "Bạn không có quyền thực hiện thao tác này.");
      refreshProfile().catch(() => {});
    };
    window.addEventListener(ADMIN_API_EVENTS.UNAUTHORIZED, handleUnauthorized);
    window.addEventListener(ADMIN_API_EVENTS.FORBIDDEN, handleForbidden);
    return () => {
      window.removeEventListener(ADMIN_API_EVENTS.UNAUTHORIZED, handleUnauthorized);
      window.removeEventListener(ADMIN_API_EVENTS.FORBIDDEN, handleForbidden);
    };
  }, [logout, navigate, refreshProfile]);

  useEffect(() => {
    if (!apiNotice) return undefined;
    const timer = setTimeout(() => setApiNotice(""), 4500);
    return () => clearTimeout(timer);
  }, [apiNotice]);

  useEffect(() => {
    const desktop = window.matchMedia?.("(min-width: 1280px)");
    const closeOnDesktop = (event) => {
      if (event.matches) {
        setDrawerOpen(false);
        setAccountMenuOpen(false);
      }
    };
    desktop?.addEventListener("change", closeOnDesktop);
    return () => desktop?.removeEventListener("change", closeOnDesktop);
  }, []);

  const closeOverlays = () => {
    closeDrawer();
    setAccountMenuOpen(false);
  };
  const handleLogout = () => {
    closeOverlays();
    logout();
    navigate("/login", { replace: true });
  };
  const sidebarProps = {
    groups, user, sectionCount: visibleSections.length,
    onNavigate: closeOverlays,
    onHome: () => { closeOverlays(); goHomeOrScrollTop(navigate, pathname, "/admin"); },
    onUserInterface: () => { closeOverlays(); navigate("/home"); },
    onLogout: handleLogout,
  };

  return (
    <div className="min-h-screen bg-[#F4F6FA] font-sans text-sm leading-[22px] tracking-normal text-[#0F2148] xl:pl-[248px]">
      <div inert={drawerOpen} aria-hidden={drawerOpen ? true : undefined}>
        <aside aria-label="Điều hướng desktop" className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-[#DCE2EE] bg-white xl:flex"><AdminSidebar {...sidebarProps} /></aside>
        <div className="min-w-0">
          <AdminTopbar breadcrumbs={breadcrumbs} user={user} drawerOpen={drawerOpen} menuTriggerRef={menuTriggerRef}
            onOpenDrawer={() => { setAccountMenuOpen(false); setDrawerOpen(true); }}
            accountOpen={accountMenuOpen} onAccountChange={setAccountMenuOpen}
            onUserInterface={sidebarProps.onUserInterface} onLogout={handleLogout} />
          {apiNotice && <div role="alert" className="fixed left-4 right-4 top-20 z-[70] flex items-start gap-3 rounded-[12px] border border-amber-200 bg-white p-4 text-sm leading-[22px] shadow-lg sm:left-auto sm:max-w-sm">
            <span aria-hidden="true" className="material-symbols-outlined text-[20px] text-amber-600">warning</span>
            <span className="min-w-0 flex-1 break-words">{apiNotice}</span>
            <button type="button" onClick={() => setApiNotice("")} aria-label="Đóng thông báo" className={ADMIN_ICON_BUTTON}><span aria-hidden="true" className="material-symbols-outlined text-[20px]">close</span></button>
          </div>}
          <main id="admin-content" className="min-w-0 p-4 md:p-6 xl:p-8"><div className="mx-auto min-w-0 max-w-[1440px]"><Outlet /></div></main>
        </div>
      </div>
      {drawerOpen && <AdminMobileDrawer {...sidebarProps} onClose={closeDrawer} triggerRef={menuTriggerRef} />}
    </div>
  );
}
