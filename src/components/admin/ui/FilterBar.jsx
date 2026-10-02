export default function FilterBar({
  searchValue = "",
  searchPlaceholder = "Tìm kiếm...",
  onSearchChange,
  onClear,
  children,
}) {
  const hasFilters = Boolean(searchValue) || Boolean(children);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,.03)] lg:flex-row lg:items-center">
      <div className="relative min-w-0 flex-1 lg:max-w-md">
        <span className="material-symbols-outlined pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-slate-400">search</span>
        <input
          type="search"
          value={searchValue}
          onChange={(event) => onSearchChange?.(event.target.value)}
          placeholder={searchPlaceholder}
          className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100/60"
        />
      </div>
      {children && <div className="flex flex-wrap items-center gap-3">{children}</div>}
      {onClear && hasFilters && (
        <button type="button" onClick={onClear} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800">
          <span className="material-symbols-outlined text-[18px]">filter_alt_off</span>
          Xóa lọc
        </button>
      )}
    </div>
  );
}
