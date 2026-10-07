import { ADMIN_ICON_BUTTON } from "../adminStyles";

const NOTICE_STYLES = {
  success: { box: "border-emerald-200 bg-emerald-50 text-emerald-800", icon: "check_circle" },
  info: { box: "border-blue-200 bg-blue-50 text-blue-800", icon: "info" },
  warning: { box: "border-amber-200 bg-amber-50 text-amber-800", icon: "warning" },
  error: { box: "border-rose-200 bg-rose-50 text-rose-700", icon: "error" },
};

export default function NoticeBanner({ notice, onClose }) {
  if (!notice) return null;
  const style = NOTICE_STYLES[notice.type] ?? NOTICE_STYLES.info;
  return <div role={notice.type === "error" ? "alert" : "status"} className={`flex min-w-0 items-start gap-3 rounded-[12px] border p-4 text-sm leading-[22px] ${style.box}`}>
    <span aria-hidden="true" className="material-symbols-outlined text-[20px]">{style.icon}</span>
    <span className="min-w-0 flex-1 break-words">{notice.message}</span>
    {onClose && <button type="button" onClick={onClose} aria-label="Đóng thông báo" className={ADMIN_ICON_BUTTON}><span aria-hidden="true" className="material-symbols-outlined text-[20px]">close</span></button>}
  </div>;
}
