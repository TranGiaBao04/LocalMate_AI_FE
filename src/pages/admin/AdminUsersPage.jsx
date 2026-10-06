import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AdminPageHeader from "../../components/admin/AdminPageHeader";
import { DataTable, FilterBar, NoticeBanner, StatusBadge } from "../../components/admin/ui";
import LockUserDialog from "../../components/admin/users/LockUserDialog";
import { USER_STATUS_BADGE, describeLockResult } from "../../components/admin/users/userLabels";
import { useAuth } from "../../context/AuthContext";
import { adminUserService } from "../../services/adminUserService";
import { formatVnDate } from "../../utils/subscriptionUtils";

const PAGE_SIZE = 20;
const EMPTY_FILTERS = { status: "", roleId: "", plan: "" };
const SELECT_CLASS = "h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100/60";
const ACTION_CLASS = "inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition";

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
        <Link to={`/admin/users/${row.id}`} className="group block min-w-0">
          <p className="font-semibold text-slate-900 group-hover:text-[#1d3e82]">{row.fullName}</p>
          <p className="mt-0.5 break-all text-xs text-slate-500">{row.email}</p>
        </Link>
      ),
    },
    {
      key: "role",
      header: "Role",
      render: (row) => (
        <div>
          <p className="font-medium text-slate-800">{row.role?.name}</p>
          {row.managesRoles && <p className="mt-0.5 text-xs text-violet-700">Quản lý phân quyền</p>}
        </div>
      ),
    },
    {
      key: "plan",
      header: "Gói hiện tại",
      render: (row) => (
        <div>
          <p className="font-medium text-slate-800">{row.plan?.name || row.plan?.code}</p>
          {row.planEffectiveUntil && (
            <p className="mt-0.5 text-xs text-slate-500">Đến {formatVnDate(row.planEffectiveUntil)}</p>
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
            {row.lockedAt && <p className="mt-1 text-xs text-slate-500">Từ {formatVnDate(row.lockedAt)}</p>}
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
        <div className="flex justify-end gap-1">
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

      {response.error && !loading && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <span>{response.error}</span>
          <button type="button" onClick={() => setReloadCount((count) => count + 1)} className="shrink-0 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-700">
            Thử lại
          </button>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        sort={sort}
        onSort={handleSort}
        pagination={response.data && {
          page: response.data.page,
          totalPages: response.data.totalPages,
          totalCount: response.data.totalCount,
        }}
        onPageChange={setPage}
        emptyState={{
          icon: "group",
          title: hasFilters ? "Không có người dùng phù hợp" : "Chưa có người dùng",
          description: hasFilters ? "Thử đổi từ khoá hoặc bộ lọc." : undefined,
          actionLabel: hasFilters ? "Xóa bộ lọc" : undefined,
          onAction: hasFilters ? handleClearFilters : undefined,
        }}
      />

      {lockTarget && (
        <LockUserDialog user={lockTarget.user} mode={lockTarget.mode} onClose={closeLockDialog} onDone={handleLockDone} />
      )}
    </div>
  );
}
