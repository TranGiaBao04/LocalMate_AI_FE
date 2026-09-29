export default function EmptyState({
  icon = "inbox",
  title = "Chưa có dữ liệu",
  description,
  actionLabel,
  onAction,
}) {
  return (
    <div className="grid min-h-64 place-items-center px-6 py-12 text-center">
      <div className="max-w-sm">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-400">
          <span className="material-symbols-outlined text-[28px]">{icon}</span>
        </div>
        <h3 className="mt-4 font-bold text-slate-900">{title}</h3>
        {description && <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>}
        {actionLabel && onAction && (
          <button type="button" onClick={onAction} className="mt-5 rounded-xl bg-[#1d3e82] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#17366f]">
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
