import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { ADMIN_ICON_BUTTON } from "./adminStyles";

export default function AdminTopbar({ breadcrumbs, user, drawerOpen, menuTriggerRef, onOpenDrawer, accountOpen, onAccountChange, onUserInterface, onLogout }) {
  const accountRef = useRef(null);
  const accountTriggerRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!accountOpen) return undefined;
    menuRef.current?.querySelector('[role="menuitem"]')?.focus();
    const closeOutside = (event) => {
      if (!accountRef.current?.contains(event.target)) onAccountChange(false);
    };
    const handleKey = (event) => {
      if (event.key === "Escape") {
        onAccountChange(false);
        accountTriggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", closeOutside);
    document.addEventListener("focusin", closeOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      document.removeEventListener("focusin", closeOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [accountOpen, onAccountChange]);

  const handleMenuKey = (event) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const items = Array.from(menuRef.current?.querySelectorAll('[role="menuitem"]') ?? []);
    const index = items.indexOf(document.activeElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items[next]?.focus();
  };

  return (
    <header aria-label="Thanh công cụ quản trị" className="sticky top-0 z-30 flex h-16 min-w-0 items-center justify-between gap-3 border-b border-[#DCE2EE] bg-white px-4 md:px-6 xl:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button ref={menuTriggerRef} type="button" onClick={onOpenDrawer} aria-label="Mở menu quản trị" aria-expanded={drawerOpen} aria-controls={drawerOpen ? "admin-navigation-drawer" : undefined} className={`${ADMIN_ICON_BUTTON} xl:hidden`}><span aria-hidden="true" className="material-symbols-outlined text-[24px]">menu</span></button>
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-[13px] leading-[18px]">
          <Link to="/admin" className="hidden shrink-0 rounded-[8px] text-[#5C6B8A] hover:text-[#1D3E82] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2C56A8] md:inline">Quản trị</Link>
          {breadcrumbs.map((crumb, index) => {
            const last = index === breadcrumbs.length - 1;
            return <span key={crumb} className={`${last ? "flex min-w-0" : "hidden shrink-0 md:flex"} items-center gap-2`}>
              <span aria-hidden="true" className="hidden text-[#8993AC] md:inline">/</span>
              <span aria-current={last ? "page" : undefined} className={last ? "truncate font-semibold text-[#0F2148]" : "text-[#5C6B8A]"}>{crumb}</span>
            </span>;
          })}
        </nav>
      </div>
      <div ref={accountRef} className="relative shrink-0">
        <button ref={accountTriggerRef} type="button" onClick={() => onAccountChange(!accountOpen)} aria-haspopup="menu" aria-expanded={accountOpen} aria-label="Tài khoản" className="flex min-h-11 items-center gap-2 rounded-[10px] px-2 text-left transition-colors hover:bg-[#F8FAFC] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2C56A8] motion-reduce:transition-none">
          <span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-full bg-[#1D3E82]/10 text-sm font-semibold text-[#1D3E82]">{(user?.fullName || "A").trim().charAt(0).toUpperCase()}</span>
          <span className="hidden max-w-[160px] truncate text-[13px] font-semibold text-[#0F2148] sm:block">{user?.fullName}</span>
          <span aria-hidden="true" className="material-symbols-outlined text-[20px] text-[#5C6B8A]">expand_more</span>
        </button>
        {accountOpen && <div ref={menuRef} role="menu" aria-label="Tài khoản quản trị" onKeyDown={handleMenuKey} className="absolute right-0 top-full mt-2 w-[min(280px,calc(100vw-32px))] rounded-[12px] border border-[#DCE2EE] bg-white p-2 shadow-lg">
          <div className="mb-2 border-b border-[#DCE2EE] px-3 py-2">
            <p className="break-words text-sm font-semibold leading-[22px] text-[#0F2148]">{user?.fullName}</p>
            <p className="break-all text-xs leading-[18px] text-[#5C6B8A]">{user?.email}</p>
          </div>
          <button role="menuitem" type="button" onClick={onUserInterface} className="flex min-h-11 w-full items-center gap-3 rounded-[8px] px-3 text-left text-sm text-[#0F2148] hover:bg-[#F4F6FA] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2C56A8]"><span aria-hidden="true" className="material-symbols-outlined text-[20px]">storefront</span>Xem giao diện người dùng</button>
          <button role="menuitem" type="button" onClick={onLogout} className="flex min-h-11 w-full items-center gap-3 rounded-[8px] px-3 text-left text-sm text-red-700 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-600"><span aria-hidden="true" className="material-symbols-outlined text-[20px]">logout</span>Đăng xuất</button>
        </div>}
      </div>
    </header>
  );
}
