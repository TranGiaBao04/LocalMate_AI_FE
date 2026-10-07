import AdminSurface from "./AdminSurface";
import { ADMIN_INPUT, ADMIN_TERTIARY_BUTTON } from "../adminStyles";

export default function FilterBar({
  searchValue = "",
  searchPlaceholder = "Tìm kiếm...",
  searchLabel = "Tìm kiếm",
  onSearchChange,
  onClear,
  children,
  activeFilterCount,
  meta,
  onOpenMobileFilters,
}) {
  const hasFilters = Boolean(searchValue) || (activeFilterCount == null ? Boolean(children) : activeFilterCount > 0);
  return <AdminSurface density="compact" className="flex flex-wrap items-center gap-3">
    <div className="relative min-w-0 basis-full flex-1 lg:basis-64">
      <span aria-hidden="true" className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-[#8993AC]">search</span>
      <input type="search" aria-label={searchLabel} value={searchValue} onChange={(event) => onSearchChange?.(event.target.value)} placeholder={searchPlaceholder} className={`${ADMIN_INPUT} pl-10`} />
    </div>
    {children && <div className="flex min-w-0 max-w-full flex-wrap items-center gap-3 [&_select]:max-w-full [&_select]:rounded-[12px] [&_select]:border-[#DCE2EE] [&_select]:bg-white [&_select]:text-[#0F2148]">{children}</div>}
    {onOpenMobileFilters && <button type="button" onClick={onOpenMobileFilters} className={`${ADMIN_TERTIARY_BUTTON} md:hidden`}><span aria-hidden="true" className="material-symbols-outlined text-[20px]">filter_alt</span>Bộ lọc{activeFilterCount != null ? ` (${activeFilterCount})` : ""}</button>}
    {onClear && hasFilters && <button type="button" onClick={onClear} className={ADMIN_TERTIARY_BUTTON}><span aria-hidden="true" className="material-symbols-outlined text-[18px]">filter_alt_off</span>Xóa lọc</button>}
    {meta && <div className="w-full text-xs leading-[18px] text-[#5C6B8A]">{meta}</div>}
  </AdminSurface>;
}
