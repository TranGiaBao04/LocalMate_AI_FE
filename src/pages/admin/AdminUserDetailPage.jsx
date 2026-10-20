import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AdminErrorState, AdminPagination, AdminRecordCard, AdminSurface, DataTable, EmptyState, LoadingState, NoticeBanner, StatusBadge } from "../../components/admin/ui";
import { ADMIN_SECONDARY_BUTTON, ADMIN_SELECT, ADMIN_TERTIARY_BUTTON } from "../../components/admin/adminStyles";
import { createPortal } from "react-dom";
import { TransactionDetailDrawer } from "../../components/admin/transactions";
import { buildTransactionColumns } from "../../components/admin/transactions/transactionColumns";
import AssignRoleDialog from "../../components/admin/roles/AssignRoleDialog";
import GrantPlanDialog from "../../components/admin/users/GrantPlanDialog";
import LockUserDialog from "../../components/admin/users/LockUserDialog";
import UserAiUsageTab from "../../components/admin/users/UserAiUsageTab";
import { GRANT_SOURCE_LABELS, USER_STATUS_BADGE, describeGrantResult, describeLockResult, getGrantState } from "../../components/admin/users/userLabels";
import { ADMIN_PERMISSIONS } from "../../constants";
import { useAuth } from "../../context/AuthContext";
import { adminUserService } from "../../services/adminUserService";
import { hasAnyPermission } from "../../utils/adminAccess";
import { formatPlanPrice, formatVnDateTime, getSubscriptionPlanName } from "../../utils/subscriptionUtils";
import { formatPlannedDate } from "../../utils/vnTime";

const PAGE_SIZE = 10;
const TABS = [
  { key: "payments", label: "Lịch sử thanh toán" },
  { key: "trips", label: "Lịch sử chuyến đi" },
  { key: "ai", label: "Lịch sử AI" },
  { key: "grants", label: "Tặng gói" },
];
const TRIP_STATUS_BADGE = {
  Draft: { status: "pending", label: "Nháp" },
  Finalized: { status: "success", label: "Đã chốt" },
};
const TRAVEL_MODE_LABELS = { Auto: "Tự động", Walking: "Đi bộ", Motorbike: "Xe máy" };
const SELECT_CLASS = ADMIN_SELECT + " sm:w-auto";
const CARD_CLASS = "min-w-0 rounded-[12px] border border-[#DCE2EE] bg-white p-5";

const nextSort = (prev, key) => (prev.key === key
  ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
  : { key, direction: "desc" });

const formatLimit = (used, limit) => (limit == null ? `${used} · không giới hạn` : `${used}/${limit}`);

const TRIP_COLUMNS = [
  {
    key: "plannedStartAt",
    header: "Ngày đi",
    sortable: true,
    render: (row) => (row.plannedDate ? (
      <div>
        <p className="font-medium text-[#0F2148]">{formatPlannedDate(row.plannedDate)}</p>
        {row.startTime && <p className="mt-0.5 text-xs text-[#5C6B8A]">Bắt đầu {row.startTime.slice(0, 5)}</p>}
      </div>
    ) : <span className="text-[#8993AC]">Chưa chọn ngày</span>),
  },
  {
    key: "status",
    header: "Trạng thái",
    render: (row) => {
      const badge = TRIP_STATUS_BADGE[row.status] ?? { status: "inactive", label: row.status };
      return (
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={badge.status} label={badge.label} />
          {row.deletedAt && <StatusBadge status="inactive" label={`Đã xoá ${formatVnDateTime(row.deletedAt)}`} />}
        </div>
      );
    },
  },
  {
    key: "schedule",
    header: "Kế hoạch",
    render: (row) => (
      <div>
        <p className="text-[#0F2148]">{row.durationHours} giờ · {TRAVEL_MODE_LABELS[row.travelMode] ?? row.travelMode}</p>
        <p className="mt-0.5 text-xs text-[#5C6B8A]">{row.itemCount} địa điểm</p>
      </div>
    ),
  },
  {
    key: "budget",
    header: "Chi phí / người",
    render: (row) => (
      <div>
        <p className="font-semibold text-[#0F2148]">{formatPlanPrice(row.estimatedBudget)}</p>
        <p className="mt-0.5 text-xs text-[#5C6B8A]">Ngân sách {formatPlanPrice(row.budgetMax)}</p>
      </div>
    ),
  },
  { key: "createdAt", header: "Tạo lúc", sortable: true, render: (row) => formatVnDateTime(row.createdAt) },
  {
    key: "finalizedAt",
    header: "Chốt lúc",
    sortable: true,
    render: (row) => (row.finalizedAt ? formatVnDateTime(row.finalizedAt) : "—"),
  },
];

function BackLink() {
  return (
    <Link to="/admin/users" className={ADMIN_TERTIARY_BUTTON}>
      <span className="material-symbols-outlined text-[18px]">arrow_back</span>
      Danh sách người dùng
    </Link>
  );
}

function LoadError({ message, onRetry }) {
  return <AdminErrorState message={message} onRetry={onRetry} />;
}

function UserHistoryRecords({ columns, rows, loading, sort, onSort, pagination, onPageChange, emptyState, label }) {
  return <div className="space-y-3">
    <div className="hidden md:block [&_table]:w-full [&_table]:min-w-[900px]"><DataTable columns={columns} rows={rows} loading={loading} sort={sort} onSort={onSort} emptyState={emptyState} /></div>
    <div aria-label={label} className="space-y-3 md:hidden">
      {loading ? <LoadingState label="Đang tải lịch sử" /> : rows.length ? rows.map(row => {
        const identity = columns[0];
        const status = columns.find(column => column.key === "status");
        const action = columns.find(column => column.key === "actions");
        return <AdminRecordCard key={row.id} title={identity.render ? identity.render(row) : row[identity.key]} status={status?.render(row)} primaryAction={action?.render(row)}>
          <dl className="space-y-3">{columns.filter(column => ![identity.key, "status", "actions"].includes(column.key)).map(column => (
            <div key={column.key}><dt className="mb-1 text-xs">{column.header}</dt><dd>{column.render ? column.render(row) : row[column.key]}</dd></div>
          ))}</dl>
        </AdminRecordCard>;
      }) : <EmptyState {...emptyState} />}
    </div>
    {pagination && <AdminPagination {...pagination} onPageChange={onPageChange} disabled={loading} />}
  </div>;
}

function StatCard({ label, value, hint, icon, tone }) {
  return (
    <AdminSurface className="flex min-w-0 items-start justify-between gap-3" density="compact">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-[#5C6B8A]">{label}</p>
        <p className="mt-2 break-words text-xl font-bold text-[#0F2148]">{value}</p>
        {hint && <p className="mt-1 text-xs text-[#8993AC]">{hint}</p>}
      </div>
      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-[8px] ${tone}`}>
        <span className="material-symbols-outlined text-[22px]">{icon}</span>
      </div>
    </AdminSurface>
  );
}

function InfoRow({ label, children }) {
  return (
    <div className="flex flex-col gap-1 border-b border-[#DCE2EE] py-3 last:border-b-0 sm:flex-row sm:justify-between sm:gap-4">
      <dt className="shrink-0 text-sm text-[#5C6B8A]">{label}</dt>
      <dd className="min-w-0 break-words text-sm font-medium text-[#0F2148] sm:text-right">{children}</dd>
    </div>
  );
}

function UserPaymentsTab({ userId, canViewDetail, onChanged, showNotice }) {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ key: "createdAt", direction: "desc" });
  const [reloadCount, setReloadCount] = useState(0);
  const [response, setResponse] = useState({ key: null, data: null, error: "" });
  const [detailId, setDetailId] = useState(null);
  const queryKey = [page, sort.key, sort.direction, reloadCount].join("|");
  const loading = response.key !== queryKey;

  useEffect(() => {
    let active = true;
    adminUserService.getUserPayments(userId, { page, pageSize: PAGE_SIZE, sortBy: sort.key, sortDirection: sort.direction })
      .then((data) => {
        if (active) setResponse({ key: queryKey, data, error: "" });
      })
      .catch((err) => {
        if (active) setResponse({ key: queryKey, data: null, error: err?.message || "Không tải được lịch sử thanh toán." });
      });
    return () => { active = false; };
  }, [userId, page, sort, queryKey]);

  const openDetail = useCallback((id) => setDetailId(id), []);
  // Xem chi tiết đơn gọi /admin/transactions/{id}, cần ViewRevenue
  const columns = useMemo(
    () => buildTransactionColumns({ onOpenDetail: canViewDetail ? openDetail : undefined, showCustomer: false }),
    [canViewDetail, openDetail]
  );

  return (
    <div className="space-y-3">
      {response.error && !loading && (
        <LoadError message={response.error} onRetry={() => setReloadCount((count) => count + 1)} />
      )}
      <UserHistoryRecords
        label="Lịch sử thanh toán trên di động"
        columns={columns}
        rows={loading ? [] : response.data?.items ?? []}
        loading={loading}
        sort={sort}
        onSort={(key) => {
          setSort((prev) => nextSort(prev, key));
          setPage(1);
        }}
        pagination={response.data && {
          page: response.data.page,
          totalPages: response.data.totalPages,
          totalCount: response.data.totalCount,
        }}
        onPageChange={setPage}
        emptyState={{ icon: "receipt_long", title: "Chưa có giao dịch nào" }}
      />
      {!canViewDetail && (
        <p className="text-xs text-[#5C6B8A]">Cần quyền xem doanh thu để mở chi tiết từng đơn.</p>
      )}
      <TransactionDetailDrawer
        isOpen={Boolean(detailId)}
        transactionId={detailId}
        onClose={() => setDetailId(null)}
        onReconciled={() => {
          setReloadCount((count) => count + 1);
          onChanged();
        }}
        showNotice={showNotice}
      />
    </div>
  );
}

function UserTripsTab({ userId }) {
  const [status, setStatus] = useState("");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ key: "createdAt", direction: "desc" });
  const [reloadCount, setReloadCount] = useState(0);
  const [response, setResponse] = useState({ key: null, data: null, error: "" });
  const queryKey = [status, includeDeleted, page, sort.key, sort.direction, reloadCount].join("|");
  const loading = response.key !== queryKey;

  useEffect(() => {
    let active = true;
    adminUserService.getUserTrips(userId, {
      status,
      includeDeleted,
      page,
      pageSize: PAGE_SIZE,
      sortBy: sort.key,
      sortDirection: sort.direction,
    })
      .then((data) => {
        if (active) setResponse({ key: queryKey, data, error: "" });
      })
      .catch((err) => {
        if (active) setResponse({ key: queryKey, data: null, error: err?.message || "Không tải được lịch sử chuyến đi." });
      });
    return () => { active = false; };
  }, [userId, status, includeDeleted, page, sort, queryKey]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4">
        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
          aria-label="Lọc chuyến đi theo trạng thái"
          className={SELECT_CLASS}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="Draft">Nháp</option>
          <option value="Finalized">Đã chốt</option>
        </select>
        <label className="inline-flex items-center gap-2 text-sm text-[#5C6B8A]">
          <input
            type="checkbox"
            checked={includeDeleted}
            onChange={(event) => {
              setIncludeDeleted(event.target.checked);
              setPage(1);
            }}
            className="h-4 w-4 rounded border-slate-300"
          />
          Hiện cả chuyến đã xoá
        </label>
      </div>
      {response.error && !loading && (
        <LoadError message={response.error} onRetry={() => setReloadCount((count) => count + 1)} />
      )}
      <UserHistoryRecords
        label="Lịch sử chuyến đi trên di động"
        columns={TRIP_COLUMNS}
        rows={loading ? [] : response.data?.items ?? []}
        loading={loading}
        sort={sort}
        onSort={(key) => {
          setSort((prev) => nextSort(prev, key));
          setPage(1);
        }}
        pagination={response.data && {
          page: response.data.page,
          totalPages: response.data.totalPages,
          totalCount: response.data.totalCount,
        }}
        onPageChange={setPage}
        emptyState={{ icon: "route", title: "Chưa có chuyến đi nào" }}
      />
    </div>
  );
}

const GRANT_COLUMNS = [
  {
    key: "plan",
    header: "Gói",
    render: (row) => (
      <div>
        <p className="font-medium text-[#0F2148]">{row.plan?.name || row.plan?.code}</p>
        <p className="mt-0.5 text-xs text-[#5C6B8A]">{row.days} ngày</p>
      </div>
    ),
  },
  {
    key: "status",
    header: "Trạng thái",
    render: (row) => {
      const state = getGrantState(row);
      return <StatusBadge status={state.status} label={state.label} />;
    },
  },
  { key: "startsAt", header: "Từ", render: (row) => formatVnDateTime(row.startsAt) },
  { key: "endsAt", header: "Đến", render: (row) => formatVnDateTime(row.endsAt) },
  { key: "source", header: "Nguồn", render: (row) => GRANT_SOURCE_LABELS[row.source] ?? row.source },
  { key: "reason", header: "Lý do", render: (row) => (row.reason ? <span className="whitespace-pre-line">{row.reason}</span> : "—") },
  { key: "grantedBy", header: "Người tặng", render: (row) => row.grantedBy?.fullName ?? "—" },
  { key: "createdAt", header: "Tặng lúc", render: (row) => formatVnDateTime(row.createdAt) },
];

// Mọi gói đã tặng (không phân trang), mới nhất trước. reloadKey đổi sau mỗi lần tặng.
function UserGrantsTab({ userId, reloadKey }) {
  const [retryCount, setRetryCount] = useState(0);
  const [response, setResponse] = useState({ key: null, rows: [], error: "" });
  const queryKey = `${reloadKey}|${retryCount}`;
  const loading = response.key !== queryKey;

  useEffect(() => {
    let active = true;
    adminUserService.getGrants(userId)
      .then((data) => {
        // UserHistoryRecords cần `id`
        if (active) setResponse({ key: queryKey, rows: (data ?? []).map((grant) => ({ ...grant, id: grant.grantId })), error: "" });
      })
      .catch((err) => {
        if (active) setResponse({ key: queryKey, rows: [], error: err?.message || "Không tải được lịch sử tặng gói." });
      });
    return () => { active = false; };
  }, [userId, queryKey]);

  if (!loading && response.error) {
    return <LoadError message={response.error} onRetry={() => setRetryCount((count) => count + 1)} />;
  }
  return (
    <UserHistoryRecords
      label="Lịch sử tặng gói"
      columns={GRANT_COLUMNS}
      rows={loading ? [] : response.rows}
      loading={loading}
      emptyState={{ icon: "redeem", title: "Chưa được tặng gói nào" }}
    />
  );
}

function UserDetail({ userId }) {
  const { user: currentUser } = useAuth();
  const canManageUsers = hasAnyPermission(currentUser, [ADMIN_PERMISSIONS.MANAGE_USERS]);
  const canViewPayments = hasAnyPermission(currentUser, [ADMIN_PERMISSIONS.VIEW_REVENUE]);
  const canManageRoles = hasAnyPermission(currentUser, [ADMIN_PERMISSIONS.MANAGE_ROLES]);
  const canManagePlans = hasAnyPermission(currentUser, [ADMIN_PERMISSIONS.MANAGE_PLANS]);
  const [assignRoleOpen, setAssignRoleOpen] = useState(false);
  const [grantOpen, setGrantOpen] = useState(false);
  const [grantCount, setGrantCount] = useState(0);
  const [reloadCount, setReloadCount] = useState(0);
  const [response, setResponse] = useState({ key: null, data: null, error: null });
  const [tab, setTab] = useState("payments");
  const [lockMode, setLockMode] = useState(null);
  const [notice, setNotice] = useState(null);
  const loading = response.key !== reloadCount;

  useEffect(() => {
    let active = true;
    adminUserService.getUser(userId)
      .then((data) => {
        if (active) setResponse({ key: reloadCount, data, error: null });
      })
      .catch((err) => {
        // Tải lại lỗi thì giữ dữ liệu cũ, trừ khi user đã không còn
        if (active) {
          setResponse((prev) => ({
            key: reloadCount,
            data: err?.code === "user_not_found" ? null : prev.data,
            error: err,
          }));
        }
      });
    return () => { active = false; };
  }, [userId, reloadCount]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(timer);
  }, [notice]);

  const reload = useCallback(() => setReloadCount((count) => count + 1), []);
  const showNotice = useCallback((type, message) => setNotice({ type, message }), []);
  const closeLockDialog = useCallback(() => setLockMode(null), []);
  const closeAssignRole = useCallback(() => setAssignRoleOpen(false), []);
  const closeGrantDialog = useCallback(() => setGrantOpen(false), []);

  const handleGrantDone = (result) => {
    setNotice(describeGrantResult(result));
    setGrantOpen(false);
    setGrantCount((count) => count + 1);
    setTab("grants");
    reload(); // gói hiện tại có thể đổi ngay
  };

  const handleRoleAssigned = (result) => {
    setNotice({ type: "success", message: `Đã chuyển sang role "${result.roleName}".` });
    setAssignRoleOpen(false);
    reload(); // managesRoles, canLock/canUnlock đổi theo role mới
  };

  const handleLockDone = (result) => {
    setNotice(describeLockResult(result, lockMode, currentUser?.id));
    setLockMode(null);
    reload();
  };

  const detail = response.data;

  if (!detail) {
    if (loading) {
      return (
        <LoadingState label="Đang tải người dùng" />
      );
    }
    return (
      <div className="space-y-4">
        <BackLink />
        {response.error?.code === "user_not_found" ? (
          <div className={CARD_CLASS}>
            <EmptyState icon="person_off" title="Không tìm thấy người dùng" description="Tài khoản không tồn tại hoặc đã bị xoá." />
          </div>
        ) : (
          <LoadError message={response.error?.message || "Không tải được thông tin người dùng."} onRetry={reload} />
        )}
      </div>
    );
  }

  const statusBadge = USER_STATUS_BADGE[detail.status] ?? { status: "inactive", label: detail.status };
  const subscription = detail.subscription;
  const planUntil = subscription?.effectiveUntil ?? subscription?.endsAt;
  const loginMethods = [detail.hasPassword && "Email & mật khẩu", ...(detail.loginProviders ?? [])].filter(Boolean);
  const stats = detail.stats ?? {};
  const visibleTabs = TABS.filter((item) =>
    (item.key !== "ai" || canManageUsers) && (item.key !== "grants" || canManagePlans));
  // Mất quyền khi đang mở tab thì ẩn panel
  const tabVisible = visibleTabs.some((item) => item.key === tab);

  return (
    <div className="min-w-0 space-y-6 [overflow-wrap:anywhere]">
      <BackLink />

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[28px] font-bold leading-9 text-[#0F2148] [overflow-wrap:anywhere]">{detail.fullName}</h1>
            <StatusBadge status={statusBadge.status} label={statusBadge.label} />
          </div>
          <p className="mt-1 break-all text-sm text-[#5C6B8A]">{detail.email}</p>
          <p className="mt-2 text-sm text-[#5C6B8A]">
            Role: <strong className="text-[#0F2148]">{detail.role?.name}</strong>
            {detail.managesRoles && <span className="ml-2 text-xs font-semibold text-violet-700">Quản lý phân quyền</span>}
            {/* BE chặn tự đổi role của chính mình (409 cannot_change_own_role) */}
            {canManageRoles && detail.id !== currentUser?.id && (
              <button type="button" onClick={() => setAssignRoleOpen(true)} className={ADMIN_TERTIARY_BUTTON + " mt-2 sm:ml-3 sm:mt-0"}>
                Đổi role
              </button>
            )}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {canManagePlans && (
            <button
              type="button"
              onClick={() => setGrantOpen(true)}
              disabled={detail.status === "Locked"}
              title={detail.status === "Locked" ? "Không thể tặng gói cho tài khoản đang bị khoá" : undefined}
              className={ADMIN_SECONDARY_BUTTON}
            >
              <span className="material-symbols-outlined text-[20px]">redeem</span>
              Tặng gói
            </button>
          )}
          {(detail.canLock || detail.canUnlock) && (
            <button
              type="button"
              onClick={() => setLockMode(detail.canLock ? "lock" : "unlock")}
              className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-[12px] px-4 py-2.5 text-sm font-semibold text-white transition ${detail.canLock ? "bg-rose-600 hover:bg-rose-700" : "bg-[#1d3e82] hover:bg-[#17366f]"}`}
            >
              <span className="material-symbols-outlined text-[20px]">{detail.canLock ? "lock" : "lock_open"}</span>
              {detail.canLock ? "Khoá tài khoản" : "Mở khoá"}
            </button>
          )}
        </div>
      </div>

      {notice && createPortal(<div className="fixed bottom-4 left-4 right-4 z-[110] mx-auto max-w-xl"><NoticeBanner notice={notice} onClose={() => setNotice(null)} /></div>, document.body)}
      {response.error && !loading && (
        <LoadError message={response.error.message || "Không tải lại được thông tin người dùng."} onRetry={reload} />
      )}

      {detail.status === "Locked" && (
        <section className="rounded-[12px] border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900">
          <p className="font-semibold">
            Tài khoản đang bị khoá{detail.lockedAt ? ` từ ${formatVnDateTime(detail.lockedAt)}` : ""}
          </p>
          <p className="mt-1">
            Người khoá: {detail.lockedBy ? `${detail.lockedBy.fullName} (${detail.lockedBy.email})` : "Không rõ"}
          </p>
          {detail.lockReason && (
            <p className="mt-2 whitespace-pre-line">
              <span className="font-semibold">Lý do (ghi chú nội bộ):</span> {detail.lockReason}
            </p>
          )}
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Chuyến đi"
          value={stats.tripCount ?? 0}
          hint={`${stats.finalizedTripCount ?? 0} đã chốt · ${stats.deletedTripCount ?? 0} đã xoá`}
          icon="route"
          tone="bg-blue-50 text-[#1d3e82]"
        />
        <StatCard
          label="Đã thanh toán"
          value={formatPlanPrice(stats.totalPaid)}
          hint={`${stats.paidOrderCount ?? 0} đơn thành công, chưa trừ hoàn tiền`}
          icon="payments"
          tone="bg-emerald-50 text-emerald-700"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={CARD_CLASS}>
          <h2 className="font-bold text-[#0F2148]">Tài khoản</h2>
          <dl className="mt-2">
            <InfoRow label="Đăng nhập bằng">{loginMethods.length > 0 ? loginMethods.join(", ") : "—"}</InfoRow>
            <InfoRow label="Ngày tạo">{formatVnDateTime(detail.createdAt)}</InfoRow>
            <InfoRow label="Cập nhật lần cuối">{formatVnDateTime(detail.updatedAt)}</InfoRow>
          </dl>
        </section>
        <section className={CARD_CLASS}>
          <h2 className="font-bold text-[#0F2148]">Gói hiện tại</h2>
          <dl className="mt-2">
            <InfoRow label="Gói">
              {getSubscriptionPlanName(subscription) || "—"}
              {subscription?.isTrial && <span className="ml-1.5 text-xs font-semibold text-blue-700">· Dùng thử</span>}
            </InfoRow>
            <InfoRow label={subscription?.isTrial ? "Dùng thử đến" : "Hiệu lực đến"}>{planUntil ? formatVnDateTime(planUntil) : "—"}</InfoRow>
            {subscription?.usage && (
              <InfoRow label="Lượt tạo lịch trình">
                {formatLimit(subscription.usage.generateUsed, subscription.usage.generateLimit)}
                {subscription.usage.resetAt && (
                  <span className="block text-xs font-normal text-[#5C6B8A]">
                    Làm mới {formatVnDateTime(subscription.usage.resetAt)}
                  </span>
                )}
              </InfoRow>
            )}
            {subscription?.savedTrips && (
              <InfoRow label="Lịch trình đã lưu">
                {formatLimit(subscription.savedTrips.used, subscription.savedTrips.limit)}
              </InfoRow>
            )}
            {subscription?.ai && (
              <InfoRow label="Lượt AI hôm nay">
                {subscription.ai.dailyUsed}/{subscription.ai.dailyLimit}
                {subscription.ai.resetAt && (
                  <span className="block text-xs font-normal text-[#5C6B8A]">
                    Làm mới {formatVnDateTime(subscription.ai.resetAt)}
                  </span>
                )}
              </InfoRow>
            )}
          </dl>
        </section>
      </div>

      <section className="space-y-4">
        <div role="tablist" aria-label="Lịch sử của người dùng" className="flex flex-wrap gap-1 border-b border-[#DCE2EE]">
          {visibleTabs.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              id={`user-history-${item.key}`}
              aria-controls={`user-history-panel-${item.key}`}
              aria-selected={tab === item.key}
              onClick={() => setTab(item.key)}
              className={`-mb-px min-h-11 border-b-2 px-4 py-2.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2C56A8] ${tab === item.key ? "border-[#1d3e82] text-[#1d3e82]" : "border-transparent text-[#5C6B8A] hover:text-[#0F2148]"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        {tabVisible && <div role="tabpanel" id={`user-history-panel-${tab}`} aria-labelledby={`user-history-${tab}`}>
        {tab === "payments" ? (
          <UserPaymentsTab userId={userId} canViewDetail={canViewPayments} onChanged={reload} showNotice={showNotice} />
        ) : tab === "trips" ? (
          <UserTripsTab userId={userId} />
        ) : tab === "grants" ? (
          <UserGrantsTab userId={userId} reloadKey={grantCount} />
        ) : (
          <UserAiUsageTab key={`${userId}:${currentUser?.id ?? ""}`} userId={userId} />
        )}
        </div>}
      </section>

      {assignRoleOpen && (
        <AssignRoleDialog user={detail} onClose={closeAssignRole} onAssigned={handleRoleAssigned} />
      )}

      {grantOpen && (
        <GrantPlanDialog user={detail} onClose={closeGrantDialog} onDone={handleGrantDone} />
      )}

      {lockMode && (
        <LockUserDialog user={detail} mode={lockMode} onClose={closeLockDialog} onDone={handleLockDone} />
      )}
    </div>
  );
}

export default function AdminUserDetailPage() {
  const { userId } = useParams();
  // key: đổi user thì reset toàn bộ state (tab, trang, bộ lọc)
  return <UserDetail key={userId} userId={userId} />;
}
