import EmptyState from "./EmptyState";

export default function DataTable({
  columns,
  rows,
  rowKey = "id",
  loading = false,
  emptyState,
  sort,
  onSort,
  pagination,
  onPageChange,
}) {
  const resolveRowKey = (row, index) =>
    typeof rowKey === "function" ? rowKey(row, index) : row[rowKey] ?? index;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,.03)]">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left">
          <thead className="border-b border-slate-200 bg-slate-50/80">
            <tr>
              {columns.map((column) => {
                const isSorted = sort?.key === column.key;
                return (
                  <th key={column.key} scope="col" className={`whitespace-nowrap px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500 ${column.className || ""}`}>
                    {column.sortable && onSort ? (
                      <button type="button" onClick={() => onSort(column.key)} className="inline-flex items-center gap-1.5 hover:text-slate-900">
                        {column.header}
                        <span className="material-symbols-outlined text-[16px]">
                          {isSorted ? (sort.direction === "desc" ? "arrow_downward" : "arrow_upward") : "unfold_more"}
                        </span>
                      </button>
                    ) : column.header}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading
              ? Array.from({ length: 5 }, (_, index) => (
                  <tr key={`loading-${index}`}>
                    {columns.map((column) => (
                      <td key={column.key} className="px-5 py-4"><div className="h-4 animate-pulse rounded bg-slate-100" /></td>
                    ))}
                  </tr>
                ))
              : rows.map((row, rowIndex) => (
                  <tr key={resolveRowKey(row, rowIndex)} className="transition hover:bg-slate-50/70">
                    {columns.map((column) => (
                      <td key={column.key} className={`px-5 py-4 text-sm text-slate-600 ${column.cellClassName || ""}`}>
                        {column.render ? column.render(row, rowIndex) : row[column.key]}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {!loading && rows.length === 0 && (
        <EmptyState {...emptyState} />
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>Trang {pagination.page} / {pagination.totalPages}{pagination.totalCount != null ? ` · ${pagination.totalCount} kết quả` : ""}</span>
          <div className="flex gap-2">
            <button type="button" disabled={pagination.page <= 1} onClick={() => onPageChange?.(pagination.page - 1)} className="rounded-lg border border-slate-200 px-3 py-2 font-semibold transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Trước</button>
            <button type="button" disabled={pagination.page >= pagination.totalPages} onClick={() => onPageChange?.(pagination.page + 1)} className="rounded-lg border border-slate-200 px-3 py-2 font-semibold transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Sau</button>
          </div>
        </div>
      )}
    </div>
  );
}
