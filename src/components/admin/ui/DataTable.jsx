import EmptyState from "./EmptyState";
import AdminSurface from "./AdminSurface";
import AdminPagination from "./AdminPagination";
import LoadingState from "./LoadingState";

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
  renderMobileRow,
  tableLabel = "Dữ liệu quản trị",
}) {
  const resolveRowKey = (row, index) =>
    typeof rowKey === "function" ? rowKey(row, index) : row[rowKey] ?? index;

  return (
    <AdminSurface density="none" className="overflow-hidden">
      {loading && <span role="status" className="sr-only">Đang tải dữ liệu...</span>}
      <div className={`overflow-x-auto ${renderMobileRow ? "hidden md:block" : ""}`}>
        <table
          aria-label={tableLabel}
          aria-busy={loading}
          className="min-w-full border-collapse text-left [&_td_button]:min-h-11 [&_td_button]:min-w-11 md:[&_td_button]:min-h-10 md:[&_td_button]:min-w-10"
        >
          <thead className="border-b border-[#DCE2EE] bg-[#F8FAFC]">
            <tr>
              {columns.map((column) => {
                const sortable = column.sortable && onSort;
                const isSorted = sort?.key === column.key;
                const sortDirection = isSorted
                  ? (sort.direction === "desc" ? "descending" : "ascending")
                  : "none";
                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={sortable ? sortDirection : undefined}
                    className={`whitespace-nowrap px-4 py-3 text-xs font-semibold leading-4 text-[#5C6B8A] ${column.className || ""}`}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        aria-label={`Sắp xếp theo ${column.sortLabel ?? (typeof column.header === "string" ? column.header : column.key)}`}
                        onClick={() => onSort(column.key)}
                        className="inline-flex min-h-11 items-center gap-2 rounded-[8px] hover:text-[#1D3E82] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2C56A8]"
                      >
                        {column.header}
                        <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
                          {isSorted ? (sort.direction === "desc" ? "arrow_downward" : "arrow_upward") : "unfold_more"}
                        </span>
                      </button>
                    ) : column.header}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#DCE2EE]">
            {loading ? <LoadingState variant="table" columns={columns} /> : rows.map((row, rowIndex) => (
              <tr key={resolveRowKey(row, rowIndex)} className="hover:bg-[#F8FAFC]">
                {columns.map((column) => (
                  <td key={column.key} className={`px-4 py-4 text-sm leading-6 text-[#5C6B8A] ${column.cellClassName || ""}`}>
                    {column.render ? column.render(row, rowIndex) : row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {renderMobileRow && (
        <div className="space-y-3 p-4 md:hidden">
          {loading ? <LoadingState variant="card" /> : rows.map((row, index) => (
            <div key={resolveRowKey(row, index)}>{renderMobileRow(row, index)}</div>
          ))}
        </div>
      )}
      {!loading && rows.length === 0 && <EmptyState {...emptyState} />}
      {pagination && <AdminPagination {...pagination} onPageChange={onPageChange} />}
    </AdminSurface>
  );
}
