import { useEffect, useRef } from "react";

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Xác nhận",
  cancelLabel = "Hủy",
  tone = "danger",
  loading = false,
  onConfirm,
  onCancel,
}) {
  const cancelButtonRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    cancelButtonRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !loading) onCancel?.();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [loading, onCancel, open]);

  if (!open) return null;

  const confirmStyle = tone === "danger"
    ? "bg-rose-600 hover:bg-rose-700 focus:ring-rose-200"
    : "bg-[#1d3e82] hover:bg-[#17366f] focus:ring-blue-200";

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/45 p-5 backdrop-blur-sm" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !loading && onCancel?.()}>
      <div role="dialog" aria-modal="true" aria-labelledby="admin-confirm-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className={`grid h-12 w-12 place-items-center rounded-xl ${tone === "danger" ? "bg-rose-50 text-rose-600" : "bg-blue-50 text-[#1d3e82]"}`}>
          <span className="material-symbols-outlined text-[25px]">{tone === "danger" ? "warning" : "help"}</span>
        </div>
        <h2 id="admin-confirm-title" className="mt-5 text-xl font-bold text-slate-950">{title}</h2>
        {message && <p className="mt-2 text-sm leading-6 text-slate-500">{message}</p>}
        <div className="mt-7 flex justify-end gap-3">
          <button ref={cancelButtonRef} type="button" disabled={loading} onClick={onCancel} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50">
            {cancelLabel}
          </button>
          <button type="button" disabled={loading} onClick={onConfirm} className={`min-w-24 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition focus:outline-none focus:ring-4 disabled:cursor-wait disabled:opacity-60 ${confirmStyle}`}>
            {loading ? "Đang xử lý..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
