const neutral = "bg-[#F4F6FA] text-[#5C6B8A] ring-[#8993AC]/20";
const statusStyles = {
  active: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  pending: "bg-amber-50 text-amber-700 ring-amber-600/15",
  warning: "bg-amber-50 text-amber-700 ring-amber-600/15",
  inactive: neutral,
  neutral,
  failed: "bg-rose-50 text-rose-700 ring-rose-600/15",
  blocked: "bg-rose-50 text-rose-700 ring-rose-600/15",
  locked: "bg-rose-50 text-rose-700 ring-rose-600/15",
  error: "bg-rose-50 text-rose-700 ring-rose-600/15",
  info: "bg-blue-50 text-blue-700 ring-blue-600/15",
  violet: "bg-violet-50 text-violet-700 ring-violet-600/15",
};

export default function StatusBadge({ status = "inactive", label, variant, dot = false, icon }) {
  const style = statusStyles[String(variant ?? status).toLowerCase()] || neutral;
  return <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold leading-[18px] ring-1 ring-inset ${style}`}>
    {dot && <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />}
    {icon && <span aria-hidden="true" className="material-symbols-outlined text-[16px]">{icon}</span>}
    {label || status}
  </span>;
}
