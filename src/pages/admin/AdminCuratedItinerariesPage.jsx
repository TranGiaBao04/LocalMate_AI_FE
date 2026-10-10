import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AdminPageHeader from "../../components/admin/AdminPageHeader";
import { ADMIN_PRIMARY_BUTTON, ADMIN_TERTIARY_BUTTON } from "../../components/admin/adminStyles";
import { AdminErrorState, AdminPagination, AdminRecordCard, ConfirmDialog, DataTable, EmptyState, FilterBar, LoadingState, NoticeBanner, StatusBadge } from "../../components/admin/ui";
import { CURATED_BASE_PATH, describeUnavailable, formatCostRange } from "../../components/admin/curated/curatedLabels";
import { adminCuratedItineraryService } from "../../services/adminCuratedItineraryService";
import { formatDuration } from "../../utils/formatCurrency";
import { formatDateTimeInVietnam } from "../../utils/vnTime";

const PAGE_SIZE = 20;
const ACTION_CLASS = ADMIN_TERTIARY_BUTTON;

export default function AdminCuratedItinerariesPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState({ key: "updatedAt", direction: "desc" });
  const [page, setPage] = useState(1);
  const [reloadCount, setReloadCount] = useState(0);
  const [response, setResponse] = useState({ key: null, data: null, error: "" });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  // Trang form chuyển về kèm lời báo đã lưu
  const [notice, setNotice] = useState(() => location.state?.notice ?? null);

  const query = useMemo(() => ({
    page,
    pageSize: PAGE_SIZE,
    sortBy: sort.key,
    sortDirection: sort.direction,
    search: debouncedSearch,
  }), [page, sort, debouncedSearch]);
  const queryKey = `${JSON.stringify(query)}#${reloadCount}`;
  const loading = response.key !== queryKey;

  useEffect(() => {
    // Bỏ state khỏi history để F5 không hiện lại lời báo
    if (location.state?.notice) navigate(location.pathname, { replace: true, state: null });
  }, [location, navigate]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let active = true;
    adminCuratedItineraryService.getItineraries(query)
      .then((data) => {
        if (active) setResponse({ key: queryKey, data, error: "" });
      })
      .catch((err) => {
        if (active) setResponse({ key: queryKey, data: null, error: err?.message || "Không tải được danh sách lịch trình mẫu." });
      });
    return () => { active = false; };
  }, [query, queryKey]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(timer);
  }, [notice]);

  const reload = useCallback(() => setReloadCount((count) => count + 1), []);
  const rows = loading ? [] : response.data?.items ?? [];

  const handleSort = (key) => {
    setSort((prev) => (prev.key === key
      ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
      : { key, direction: key === "updatedAt" ? "desc" : "asc" }));
    setPage(1);
  };

  const handleClearSearch = () => {
    setSearch("");
    setDebouncedSearch("");
    setPage(1);
  };

  const handleDelete = async () => {
    setDeleting(true);
    let removed = true;
    try {
      await adminCuratedItineraryService.deleteItinerary(deleteTarget.id);
      setNotice({ type: "success", message: `Đã xoá lịch trình mẫu "${deleteTarget.title}".` });
    } catch (err) {
      // 404: người khác đã xoá trước, coi như xong
      removed = err?.code === "curated_itinerary_not_found";
      setNotice(removed
        ? { type: "success", message: `Lịch trình mẫu "${deleteTarget.title}" đã được xoá trước đó.` }
        : { type: "error", message: err?.message || "Không xoá được lịch trình mẫu. Vui lòng thử lại." });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
      // Xoá dòng cuối của trang thì lùi một trang
      if (removed && rows.length === 1 && page > 1) setPage(page - 1);
      else reload();
    }
  };

  const columns = useMemo(() => [
    {
      key: "title",
      header: "Lịch trình",
      sortLabel: "tiêu đề",
      sortable: true,
      render: (row) => (
        <div className="flex min-w-[240px] items-start gap-3">
          {row.coverImageUrl
            ? <img src={row.coverImageUrl} alt="" className="h-11 w-11 shrink-0 rounded-[8px] object-cover" />
            : <span aria-hidden="true" className="material-symbols-outlined grid h-11 w-11 shrink-0 place-items-center rounded-[8px] bg-[#F4F6FA] text-[#8993AC]">route</span>}
          <div className="min-w-0 [overflow-wrap:anywhere]">
            <Link to={`${CURATED_BASE_PATH}/edit/${row.id}`} className="font-semibold text-[#0F2148] hover:text-[#1d3e82]">{row.title}</Link>
            {row.stationName && <p className="mt-0.5 text-xs text-[#5C6B8A]">Ga {row.stationName}</p>}
          </div>
        </div>
      ),
    },
    {
      key: "items",
      header: "Chặng",
      render: (row) => {
        const warning = describeUnavailable(row);
        return (
          <div className="max-w-md [overflow-wrap:anywhere]">
            <p className="font-medium text-[#0F2148]">{row.items.length} địa điểm</p>
            <p className="mt-0.5 line-clamp-2 text-xs text-[#5C6B8A]">{row.items.map((item) => item.name).join(" → ")}</p>
            {warning && <div className="mt-2"><StatusBadge variant="warning" icon="warning" label={warning} /></div>}
          </div>
        );
      },
    },
    {
      key: "estimate",
      header: "Ước tính",
      render: (row) => (
        <div className="whitespace-nowrap">
          <p className="font-medium text-[#0F2148]">{formatDuration(row.estimatedDurationMinutes)}</p>
          <p className="mt-0.5 text-xs text-[#5C6B8A]">{formatCostRange(row.estimatedCostMin, row.estimatedCostMax)}</p>
        </div>
      ),
    },
    {
      key: "updatedAt",
      header: "Cập nhật",
      sortable: true,
      cellClassName: "whitespace-nowrap",
      render: (row) => formatDateTimeInVietnam(row.updatedAt),
    },
    {
      key: "actions",
      header: "Thao tác",
      className: "text-right",
      cellClassName: "text-right",
      render: (row) => (
        <div className="flex flex-wrap justify-end gap-1">
          <Link to={`${CURATED_BASE_PATH}/edit/${row.id}`} className={`${ACTION_CLASS} text-[#1d3e82] hover:bg-blue-50`}>
            <span aria-hidden="true" className="material-symbols-outlined text-[16px]">edit</span>
            Sửa
          </Link>
          <button type="button" onClick={() => setDeleteTarget(row)} className={`${ACTION_CLASS} text-rose-600 hover:bg-rose-50`}>
            <span aria-hidden="true" className="material-symbols-outlined text-[16px]">delete</span>
            Xoá
          </button>
        </div>
      ),
    },
  ], []);

  const emptyTitle = debouncedSearch ? "Không có lịch trình mẫu phù hợp" : "Chưa có lịch trình mẫu";

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Dữ liệu Metro"
        title="Lịch trình mẫu"
        description="Các lịch trình hiện ở trang Khám phá của app. Tạo, sửa, xoá đều có hiệu lực ngay, không có bản nháp."
      >
        <Link to={`${CURATED_BASE_PATH}/create`} className={ADMIN_PRIMARY_BUTTON}>
          <span aria-hidden="true" className="material-symbols-outlined text-[20px]">add</span>
          Tạo lịch trình mẫu
        </Link>
      </AdminPageHeader>

      <NoticeBanner notice={notice} onClose={() => setNotice(null)} />

      <FilterBar
        searchValue={search}
        searchPlaceholder="Tìm theo tiêu đề (gõ không dấu được)"
        onSearchChange={setSearch}
        onClear={handleClearSearch}
        activeFilterCount={0}
      />

      {response.error && !loading && <AdminErrorState message={response.error} onRetry={reload} />}
      {!loading && !response.error && response.data && (
        <p className="text-sm text-[#5C6B8A]">{response.data.totalCount} lịch trình mẫu · Trang {response.data.page} / {Math.max(1, response.data.totalPages)}</p>
      )}
      {!response.error && <>
        <div className="hidden md:block [&_table]:w-full [&_table]:min-w-[900px]">
          <DataTable columns={columns} rows={rows} loading={loading} sort={sort} onSort={handleSort} tableLabel="Danh sách lịch trình mẫu"
            emptyState={{ icon: "route", title: emptyTitle, description: debouncedSearch ? "Thử đổi từ khoá." : "Bấm \"Tạo lịch trình mẫu\" để thêm lịch đầu tiên." }} />
        </div>
        <div aria-label="Danh sách lịch trình mẫu trên di động" className="space-y-3 md:hidden">
          {loading ? <LoadingState label="Đang tải lịch trình mẫu" /> : rows.length ? rows.map((row) => (
            <AdminRecordCard key={row.id} title={columns[0].render(row)} primaryAction={columns[4].render(row)}>
              {columns[1].render(row)}
              <div className="mt-3">{columns[2].render(row)}</div>
              <p className="mt-3 text-xs">Cập nhật {formatDateTimeInVietnam(row.updatedAt)}</p>
            </AdminRecordCard>
          )) : <EmptyState icon="route" title={emptyTitle} />}
        </div>
        {response.data && <AdminPagination {...response.data} onPageChange={setPage} disabled={loading} />}
      </>}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xoá lịch trình mẫu"
        message={deleteTarget ? `Xoá "${deleteTarget.title}"? Lịch sẽ biến mất khỏi app ngay và không khôi phục được. Chuyến đi người dùng đã tạo từ lịch này không bị ảnh hưởng.` : ""}
        confirmLabel="Xoá lịch trình"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
