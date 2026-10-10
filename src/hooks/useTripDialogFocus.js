import { useLayoutEffect, useRef } from "react";

// Trip dialogs share focus behavior, while each consumer retains its own close/busy rules.
export default function useTripDialogFocus(open, returnFocusRef) {
  const dialogRef = useRef(null);
  useLayoutEffect(() => {
    if (!open) return undefined;
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const controls = () => Array.from(dialog.querySelectorAll(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )).filter(element => element.tabIndex >= 0 && !element.closest('[hidden], [aria-hidden="true"]'));
    const focusEntry = () => (dialog.querySelector('[data-dialog-initial]:not([disabled])') || controls()[0] || dialog).focus();
    focusEntry();
    const handleTab = (event) => {
      if (event.key !== "Tab") return;
      const elements = controls();
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (!first) { event.preventDefault(); dialog.focus(); }
      else if (!dialog.contains(document.activeElement) || document.activeElement === dialog) {
        event.preventDefault(); (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    };
    const containFocus = (event) => { if (!dialog.contains(event.target)) focusEntry(); };
    document.addEventListener("keydown", handleTab);
    document.addEventListener("focusin", containFocus);
    return () => {
      document.removeEventListener("keydown", handleTab);
      document.removeEventListener("focusin", containFocus);
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
      else returnFocusRef?.current?.focus();
    };
  }, [open, returnFocusRef]);
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (open && dialog && (!dialog.contains(document.activeElement) || document.activeElement.disabled)) dialog.focus();
  });
  return dialogRef;
}
