const NOTICE_STYLES = {
  success: { box: "border-emerald-200 bg-emerald-50 text-emerald-800", icon: "check_circle" },
  info: { box: "border-blue-200 bg-blue-50 text-blue-800", icon: "info" },
  warning: { box: "border-amber-200 bg-amber-50 text-amber-800", icon: "warning" },
  error: { box: "border-rose-200 bg-rose-50 text-rose-700", icon: "error" },
};

// notice: { type: "success" | "info" | "warning" | "error", message } | null
export default function NoticeBanner({ notice, onClose }) {
  if (!notice) return null;
  const style = NOTICE_STYLES[notice.type] ?? NOTICE_STYLES.info;

  return (
    <div role="status" className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${style.box}`}>
      <span className="material-symbols-outlined text-[20px]">{style.icon}</span>
      <span className="flex-1 leading-6">{notice.message}</span>
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Đóng thông báo" className="opacity-60 transition hover:opacity-100">
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      )}
    </div>
  );
}
