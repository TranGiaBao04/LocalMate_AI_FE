import { ADMIN_SECONDARY_BUTTON } from "../adminStyles";

export default function AdminPagination({ page, totalPages, totalCount, onPageChange, disabled = false }) {
  if (totalPages <= 1) return null;
  return <nav aria-label="Phân trang" className="flex flex-wrap items-center justify-between gap-3 border-t border-[#DCE2EE] px-4 py-4 text-sm leading-[22px] text-[#5C6B8A]">
    <span>Trang {page} / {totalPages}{totalCount != null ? ` · ${totalCount} kết quả` : ""}</span>
    <div className="flex gap-2">
      <button type="button" disabled={disabled || page <= 1} onClick={() => onPageChange?.(page - 1)} className={ADMIN_SECONDARY_BUTTON}><span aria-hidden="true" className="material-symbols-outlined text-[20px]">chevron_left</span>Trước</button>
      <button type="button" disabled={disabled || page >= totalPages} onClick={() => onPageChange?.(page + 1)} className={ADMIN_SECONDARY_BUTTON}>Sau<span aria-hidden="true" className="material-symbols-outlined text-[20px]">chevron_right</span></button>
    </div>
  </nav>;
}
