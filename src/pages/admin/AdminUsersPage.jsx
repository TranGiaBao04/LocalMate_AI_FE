import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AdminPageHeader from "../../components/admin/AdminPageHeader";
import { AdminErrorState, AdminPagination, AdminRecordCard, DataTable, EmptyState, FilterBar, LoadingState, NoticeBanner, StatusBadge } from "../../components/admin/ui";
import { ADMIN_SELECT, ADMIN_TERTIARY_BUTTON } from "../../components/admin/adminStyles";
import LockUserDialog from "../../components/admin/users/LockUserDialog";
import { USER_STATUS_BADGE, describeLockResult } from "../../components/admin/users/userLabels";
import { useAuth } from "../../context/AuthContext";
import { adminUserService } from "../../services/adminUserService";
import { formatVnDate } from "../../utils/subscriptionUtils";

const PAGE_SIZE = 20;
const EMPTY_FILTERS = { status: "", roleId: "", plan: "" };
const SELECT_CLASS = ADMIN_SELECT + " sm:w-auto";
const ACTION_CLASS = ADMIN_TERTIARY_BUTTON;

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [sort, setSort] = useState({ key: "createdAt", direction: "desc" });
  const [page, setPage] = useState(1);
  const [reloadCount, setReloadCount] = useState(0);
  const [response, setResponse] = useState({ key: null, data: null, error: "" });
  const [options, setOptions] = useState({ roles: [], plans: [] });
  const [lockTarget, setLockTarget] = useState(null); // { user, mode: "lock" | "unlock" }
  const [notice, setNotice] = useState(null);

  const query = useMemo(() => ({
    page,
    pageSize: PAGE_SIZE,
    sortBy: sort.key,
    sortDirection: sort.direction,
    search: debouncedSearch,
    ...filters,
  }), [page, sort, debouncedSearch, filters]);
  // Đang tải = kết quả hiện có chưa ứng với bộ lọc hiện tại
  const queryKey = `${JSON.stringify(query)}#${reloadCount}`;
  const loading = response.key !== queryKey;

  useEffect(() => {
    let active = true;
    adminUserService.getFilterOptions()
      .then((data) => {
        if (active) setOptions({ roles: data?.roles ?? [], plans: data?.plans ?? [] });
      })
      .catch(() => {}); // Thiếu danh sách lọc vẫn xem được bảng
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let active = true;
    adminUserService.getUsers(query)
      .then((data) => {
        if (active) setResponse({ key: queryKey, data, error: "" });
      })
      .catch((err) => {
        if (active) setResponse({ key: queryKey, data: null, error: err?.message || "Không tải được danh sách người dùng." });
      });
    return () => { active = false; };
  }, [query, queryKey]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(timer);
  }, [notice]);

  const changeFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const handleSort = (key) => {
    setSort((prev) => (prev.key === key
      ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
      : { key, direction: key === "createdAt" ? "desc" : "asc" }));
    setPage(1);
  };

  const handleClearFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setFilters(EMPTY_FILTERS);
    setPage(1);
  };

  const closeLockDialog = useCallback(() => setLockTarget(null), []);

  const handleLockDone = (result) => {
    setNotice(describeLockResult(result, lockTarget.mode, currentUser?.id));
    setLockTarget(null);
    setReloadCount((count) => count + 1); // canLock/canUnlock đổi theo trạng thái mới
  };

  const hasFilters = Boolean(search || filters.status || filters.roleId || filters.plan);
  const rows = loading ? [] : response.data?.items ?? [];

  const columns = useMemo(() => [
    {
      key: "fullName",
      header: "Người dùng",
      sortable: true,
      render: (row) => (
        <Link to={`/admin/users/${row.id}`} className="group block min-w-[160px] [overflow-wrap:anywhere]">
          <p className="font-semibold text-[#0F2148] group-hover:text-[#1d3e82]">{row.fullName}</p>
          <p className="mt-0.5 break-all text-xs text-[#5C6B8A]">{row.email}</p>
        </Link>
      ),
    },
    {
      key: "role",
      header: "Role",
      render: (row) => (
        <div>
          <p className="font-medium text-[#0F2148]">{row.role?.name}</p>
          {row.managesRoles && <p className="mt-0.5 text-xs text-violet-700">Quản lý phân quyền</p>}
        </div>
      ),
    },
    {
      key: "plan",
      header: "Gói hiện tại",
      render: (row) => (
        <div>
          <p className="font-medium text-[#0F2148]">{row.plan?.name || row.plan?.code}</p>
          {row.planEffectiveUntil && (
            <p className="mt-0.5 text-xs text-[#5C6B8A]">Đến {formatVnDate(row.planEffectiveUntil)}</p>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: "Trạng thái",
      sortable: true,
      render: (row) => {
        const badge = USER_STATUS_BADGE[row.status] ?? { status: "inactive", label: row.status };
        return (
          <div>
            <StatusBadge status={badge.status} label={badge.label} />
            {row.lockedAt && <p className="mt-1 text-xs text-[#5C6B8A]">Từ {formatVnDate(row.lockedAt)}</p>}
          </div>
        );
      },
    },
    {
      key: "createdAt",
      header: "Ngày tạo",
      sortable: true,
      render: (row) => formatVnDate(row.createdAt),
    },
    {
      key: "actions",
      header: "Thao tác",
      className: "text-right",
      cellClassName: "text-right",
      render: (row) => (
        <div className="flex flex-wrap justify-end gap-1">
          <Link to={`/admin/users/${row.id}`} className={`${ACTION_CLASS} text-[#1d3e82] hover:bg-blue-50`}>
            <span className="material-symbols-outlined text-[16px]">visibility</span>
            Xem
          </Link>
          {row.canLock && (
            <button type="button" onClick={() => setLockTarget({ user: row, mode: "lock" })} className={`${ACTION_CLASS} text-rose-600 hover:bg-rose-50`}>
              <span className="material-symbols-outlined text-[16px]">lock</span>
              Khoá
            </button>
          )}
          {row.canUnlock && (
            <button type="button" onClick={() => setLockTarget({ user: row, mode: "unlock" })} className={`${ACTION_CLASS} text-emerald-700 hover:bg-emerald-50`}>
              <span className="material-symbols-outlined text-[16px]">lock_open</span>
              Mở khoá
            </button>
          )}
        </div>
      ),
    },
  ], []);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Người dùng & Phân quyền"
        title="Quản lý người dùng"
        description="Tra cứu tài khoản, gói đang dùng, khoá và mở khoá đăng nhập."
      />

      <NoticeBanner notice={notice} onClose={() => setNotice(null)} />

      <FilterBar
        searchValue={search}
        searchPlaceholder="Tìm theo tên hoặc email (gõ không dấu được)"
        onSearchChange={setSearch}
        onClear={handleClearFilters}
      >
        <select value={filters.status} onChange={(event) => changeFilter("status", event.target.value)} aria-label="Lọc theo trạng thái" className={SELECT_CLASS}>
          <option value="">Tất cả trạng thái</option>
          <option value="Active">Hoạt động</option>
          <option value="Locked">Đã khoá</option>
        </select>
        {options.roles.length > 0 && (
          <select value={filters.roleId} onChange={(event) => changeFilter("roleId", event.target.value)} aria-label="Lọc theo role" className={SELECT_CLASS}>
            <option value="">Tất cả role</option>
            {options.roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
          </select>
        )}
        {options.plans.length > 0 && (
          <select value={filters.plan} onChange={(event) => changeFilter("plan", event.target.value)} aria-label="Lọc theo gói" className={SELECT_CLASS}>
            <option value="">Tất cả gói</option>
            {options.plans.map((plan) => (
              <option key={plan.code} value={plan.code}>{plan.name}{plan.isActive ? "" : " (đã tắt)"}</option>
            ))}
          </select>
        )}
      </FilterBar>

      {response.error && !loading && <AdminErrorState message={response.error} onRetry={() => setReloadCount((count) => count + 1)} />}
      {!loading && !response.error && response.data && <p className="text-sm text-[#5C6B8A]">{response.data.totalCount} người dùng · Trang {response.data.page} / {Math.max(1, response.data.totalPages)}</p>}
      {!response.error && <>
        <div className="hidden md:block [&_table]:w-full [&_table]:min-w-[900px]">
          <DataTable columns={columns} rows={rows} loading={loading} sort={sort} onSort={handleSort}
            emptyState={{ icon: "group", title: hasFilters ? "Không có người dùng phù hợp" : "Chưa có người dùng", description: hasFilters ? "Thử đổi từ khoá hoặc bộ lọc." : undefined, actionLabel: hasFilters ? "Xóa bộ lọc" : undefined, onAction: hasFilters ? handleClearFilters : undefined }} />
        </div>
        <div aria-label="Danh sách người dùng trên di động" className="space-y-3 md:hidden">
          {loading ? <LoadingState label="Đang tải người dùng" /> : rows.length ? rows.map((row) => (
            <AdminRecordCard key={row.id} title={columns[0].render(row)} status={columns[3].render(row)} primaryAction={columns[5].render(row)}>
              <dl className="grid grid-cols-2 gap-4">
                <div><dt className="mb-1 text-xs">Role</dt><dd>{columns[1].render(row)}</dd></div>
                <div><dt className="mb-1 text-xs">Gói hiện tại</dt><dd>{columns[2].render(row)}</dd></div>
                <div className="col-span-2"><dt className="mb-1 text-xs">Ngày tạo</dt><dd>{formatVnDate(row.createdAt)}</dd></div>
              </dl>
            </AdminRecordCard>
          )) : <EmptyState icon="group" title={hasFilters ? "Không có người dùng phù hợp" : "Chưa có người dùng"} actionLabel={hasFilters ? "Xóa bộ lọc" : undefined} onAction={hasFilters ? handleClearFilters : undefined} />}
        </div>
        {response.data && <AdminPagination {...response.data} onPageChange={setPage} disabled={loading} />}
      </>}

      {lockTarget && (
        <LockUserDialog user={lockTarget.user} mode={lockTarget.mode} onClose={closeLockDialog} onDone={handleLockDone} />
      )}
    </div>
  );
}
