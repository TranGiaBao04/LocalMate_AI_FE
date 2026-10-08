import { ADMIN_SECONDARY_BUTTON } from "../adminStyles";

export default function AdminErrorState({ message, onRetry, retryLabel = "Thử lại", variant = "compact" }) {
  return <div role="alert" className={`flex min-w-0 flex-wrap items-center gap-3 rounded-[12px] border border-rose-200 bg-rose-50 p-4 text-sm leading-[22px] text-rose-800 ${variant === "full" ? "justify-center py-8" : ""}`}>
    <span aria-hidden="true" className="material-symbols-outlined text-[20px]">error</span>
    <p className="min-w-0 flex-1 break-words">{message}</p>
    {onRetry && <button type="button" onClick={onRetry} className={ADMIN_SECONDARY_BUTTON}><span aria-hidden="true" className="material-symbols-outlined text-[20px]">refresh</span>{retryLabel}</button>}
  </div>;
}
