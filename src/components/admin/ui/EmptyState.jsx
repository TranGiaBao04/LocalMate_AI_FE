import { ADMIN_PRIMARY_BUTTON } from "../adminStyles";

export default function EmptyState({ icon = "inbox", title = "Chưa có dữ liệu", description, actionLabel, onAction, action, density = "default" }) {
  return <div className={`grid place-items-center px-4 text-center ${density === "compact" ? "py-6" : "py-8 md:py-10"}`}><div className="max-w-sm">
    <div className="mx-auto grid h-12 w-12 place-items-center rounded-[12px] bg-[#F4F6FA] text-[#8993AC]"><span aria-hidden="true" className="material-symbols-outlined text-[24px]">{icon}</span></div>
    <h3 className="mt-4 text-base font-semibold leading-6 text-[#0F2148]">{title}</h3>
    {description && <p className="mt-2 break-words text-sm leading-[22px] text-[#5C6B8A]">{description}</p>}
    {action ? <div className="mt-4">{action}</div> : actionLabel && onAction && <button type="button" onClick={onAction} className={`mt-4 ${ADMIN_PRIMARY_BUTTON}`}>{actionLabel}</button>}
  </div></div>;
}
