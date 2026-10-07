import { useEffect, useRef } from "react";
import AdminSidebar from "./AdminSidebar";
import { ADMIN_ICON_BUTTON } from "./adminStyles";

export default function AdminMobileDrawer({ onClose, triggerRef, ...sidebarProps }) {
  const panelRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousRootOverflow = document.documentElement.style.overflow;
    const returnFocus = triggerRef.current;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    closeRef.current?.focus();
    const focusable = () => Array.from(panelRef.current?.querySelectorAll('a[href], button:not(:disabled), [tabindex="0"]') ?? []);
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
      if (event.key === "Tab") {
        const items = focusable();
        const first = items[0];
        const last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    const handleFocus = (event) => {
      if (!panelRef.current?.contains(event.target)) closeRef.current?.focus();
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("focusin", handleFocus);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.documentElement.style.overflow = previousRootOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusin", handleFocus);
      returnFocus?.focus();
    };
  }, [onClose, triggerRef]);

  return (
    <div className="fixed inset-0 z-[90] xl:hidden">
      <div aria-hidden="true" className="absolute inset-0 bg-[#0F2148]/40" onClick={onClose} />
      <div ref={panelRef} id="admin-navigation-drawer" role="dialog" aria-modal="true" aria-label="Menu quản trị" className="relative flex h-dvh w-[min(88vw,320px)] flex-col border-r border-[#DCE2EE] bg-white shadow-xl">
        <AdminSidebar {...sidebarProps} closeButton={<button ref={closeRef} type="button" onClick={onClose} aria-label="Đóng menu quản trị" className={ADMIN_ICON_BUTTON}><span aria-hidden="true" className="material-symbols-outlined text-[20px]">close</span></button>} />
      </div>
    </div>
  );
}
