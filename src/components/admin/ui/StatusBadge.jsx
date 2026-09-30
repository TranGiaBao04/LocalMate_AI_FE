const statusStyles = {
  active: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  pending: "bg-amber-50 text-amber-700 ring-amber-600/15",
  warning: "bg-amber-50 text-amber-700 ring-amber-600/15",
  inactive: "bg-slate-100 text-slate-600 ring-slate-500/15",
  failed: "bg-rose-50 text-rose-700 ring-rose-600/15",
  blocked: "bg-rose-50 text-rose-700 ring-rose-600/15",
  info: "bg-blue-50 text-blue-700 ring-blue-600/15",
};

export default function StatusBadge({ status = "inactive", label }) {
  const normalizedStatus = String(status).toLowerCase();
  const style = statusStyles[normalizedStatus] || statusStyles.inactive;

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${style}`}>
      {label || status}
    </span>
  );
}
