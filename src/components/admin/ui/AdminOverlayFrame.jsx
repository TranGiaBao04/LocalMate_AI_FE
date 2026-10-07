import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

const overlays = [];
const previousInert = new Map();
let previousOverflow;

// Shared overlays can nest without unlocking the page or exposing a lower dialog.
function syncBackground() {
  const top = overlays.at(-1);
  if (!top) {
    for (const [element, inert] of previousInert) element.inert = inert;
    previousInert.clear();
    document.body.style.overflow = previousOverflow;
    return;
  }
  for (const element of document.body.children) {
    if (!previousInert.has(element)) previousInert.set(element, element.inert);
    element.inert = element !== top;
  }
}

function focusableElements(panel) {
  return [...panel.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')].filter((element) => {
    const style = window.getComputedStyle(element);
    return !element.disabled && element.tabIndex >= 0 && !element.closest("[hidden], [inert]") && style.display !== "none" && style.visibility !== "hidden";
  });
}

export default function AdminOverlayFrame({ open, title, description, children, footer, onClose, loading = false, initialFocusRef, variant = "modal" }) {
  const id = useId();
  const rootRef = useRef(null);
  const panelRef = useRef(null);
  const behavior = useRef({ onClose, loading });

  useEffect(() => { behavior.current = { onClose, loading }; }, [onClose, loading]);
  useEffect(() => {
    if (!open) return undefined;
    const root = rootRef.current;
    const panel = panelRef.current;
    const trigger = document.activeElement;
    if (overlays.length === 0) previousOverflow = document.body.style.overflow;
    overlays.push(root);
    document.body.style.overflow = "hidden";
    syncBackground();
    const initial = initialFocusRef?.current;
    (initial && !initial.disabled ? initial : focusableElements(panel)[0] ?? panel).focus();

    const isTop = () => overlays.at(-1) === root;
    const handleKey = (event) => {
      if (!isTop()) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!behavior.current.loading) behavior.current.onClose?.();
      }
      if (event.key !== "Tab") return;
      const items = focusableElements(panel);
      const first = items[0] ?? panel;
      const last = items.at(-1) ?? panel;
      if (!items.length || !panel.contains(document.activeElement) || (event.shiftKey ? document.activeElement === first : document.activeElement === last) || document.activeElement === panel) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    };
    const handleFocus = (event) => {
      if (isTop() && !panel.contains(event.target)) (focusableElements(panel)[0] ?? panel).focus();
    };
    document.addEventListener("keydown", handleKey, true);
    document.addEventListener("focusin", handleFocus, true);
    return () => {
      const wasTop = isTop();
      document.removeEventListener("keydown", handleKey, true);
      document.removeEventListener("focusin", handleFocus, true);
      overlays.splice(overlays.indexOf(root), 1);
      syncBackground();
      if (wasTop && trigger?.isConnected && !trigger.closest("[inert]")) trigger.focus();
    };
  }, [open, initialFocusRef]);

  if (!open) return null;
  return createPortal(
    <div ref={rootRef} role="presentation" className={`fixed inset-0 z-[100] flex bg-[#0F2148]/45 ${variant === "drawer" ? "justify-end" : "items-center justify-center p-3 sm:p-6"}`} onMouseDown={(event) => {
      if (event.target === event.currentTarget && overlays.at(-1) === rootRef.current && !loading) {
        // Keep the pointer's default focus change from undoing restored focus.
        event.preventDefault();
        onClose?.();
      }
    }}>
      <section ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={description ? `${id}-description` : undefined} aria-busy={loading} tabIndex={-1} className={`flex min-h-0 min-w-0 w-full flex-col border border-[#DCE2EE] bg-white text-sm leading-[22px] text-[#0F2148] shadow-xl outline-none [overflow-wrap:anywhere] ${variant === "drawer" ? "h-[100dvh] max-w-lg" : "max-h-[calc(100dvh-24px)] max-w-md rounded-[16px] sm:max-h-[calc(100dvh-48px)]"}`}>
        <header className="min-w-0 shrink-0 px-5 pb-4 pt-5"><h2 id={`${id}-title`} className="text-lg font-bold leading-[26px]">{title}</h2></header>
        {(description || children) && <div className="min-h-0 min-w-0 overflow-y-auto px-5 pb-5">{description && <p id={`${id}-description`} className="mb-4 text-sm leading-[22px] text-[#5C6B8A]">{description}</p>}{children}</div>}
        {footer && <footer className="flex shrink-0 flex-wrap justify-end gap-3 border-t border-[#DCE2EE] p-4">{footer}</footer>}
      </section>
    </div>, document.body,
  );
}
