import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { DataTable, EmptyState, NoticeBanner, StatusBadge } from "../../components/admin/ui";
import { TransactionDetailDrawer } from "../../components/admin/transactions";
import { buildTransactionColumns } from "../../components/admin/transactions/transactionColumns";
import LockUserDialog from "../../components/admin/users/LockUserDialog";
import { USER_STATUS_BADGE, describeLockResult } from "../../components/admin/users/userLabels";
import { ADMIN_PERMISSIONS } from "../../constants";
import { useAuth } from "../../context/AuthContext";
import { adminUserService } from "../../services/adminUserService";
import { hasAnyPermission } from "../../utils/adminAccess";
import { formatPlanPrice, formatVnDateTime, getPlanDisplayName } from "../../utils/subscriptionUtils";
import { formatPlannedDate } from "../../utils/vnTime";

const PAGE_SIZE = 10;
const TABS = [
  { key: "payments", label: "Lịch sử thanh toán" },
  { key: "trips", label: "Lịch sử chuyến đi" },
];
const TRIP_STATUS_BADGE = {
  Draft: { status: "pending", label: "Nháp" },
  Finalized: { status: "success", label: "Đã chốt" },
};
const TRAVEL_MODE_LABELS = { Auto: "Tự động", Walking: "Đi bộ", Motorbike: "Xe máy" };
const SELECT_CLASS = "h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100/60";
const CARD_CLASS = "rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,.03)]";

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
        <p className="font-medium text-slate-800">{formatPlannedDate(row.plannedDate)}</p>
        {row.startTime && <p className="mt-0.5 text-xs text-slate-500">Bắt đầu {row.startTime.slice(0, 5)}</p>}
      </div>
    ) : <span className="text-slate-400">Chưa chọn ngày</span>),
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
        <p className="text-slate-800">{row.durationHours} giờ · {TRAVEL_MODE_LABELS[row.travelMode] ?? row.travelMode}</p>
        <p className="mt-0.5 text-xs text-slate-500">{row.itemCount} địa điểm</p>
      </div>
    ),
  },
  {
    key: "budget",
    header: "Chi phí / người",
    render: (row) => (
      <div>
        <p className="font-semibold text-slate-900">{formatPlanPrice(row.estimatedBudget)}</p>
        <p className="mt-0.5 text-xs text-slate-500">Ngân sách {formatPlanPrice(row.budgetMax)}</p>
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
    <Link to="/admin/users" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 transition hover:text-[#1d3e82]">
      <span className="material-symbols-outlined text-[18px]">arrow_back</span>
      Danh sách người dùng
    </Link>
  );
}

function LoadError({ message, onRetry }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
      <span>{message}</span>
      <button type="button" onClick={onRetry} className="shrink-0 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-700">
        Thử lại
      </button>
    </div>
  );
}

function StatCard({ label, value, hint, icon, tone }) {
  return (
    <div className={`flex items-start justify-between gap-4 ${CARD_CLASS}`}>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        <p className="mt-2 break-words text-2xl font-bold tracking-tight text-slate-950">{value}</p>
        {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
      </div>
      <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${tone}`}>
        <span className="material-symbols-outlined text-[22px]">{icon}</span>
      </div>
    </div>
  );
}

function InfoRow({ label, children }) {
  return (
    <div className="flex flex-col gap-1 border-b border-slate-100 py-3 last:border-b-0 sm:flex-row sm:justify-between sm:gap-4">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-sm font-medium text-slate-800 sm:text-right">{children}</dd>
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
      <DataTable
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
        <p className="text-xs text-slate-500">Cần quyền xem doanh thu để mở chi tiết từng đơn.</p>
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
        <label className="inline-flex items-center gap-2 text-sm text-slate-600">
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
      <DataTable
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

function UserDetail({ userId }) {
  const { user: currentUser } = useAuth();
  const canViewPayments = hasAnyPermission(currentUser, [ADMIN_PERMISSIONS.VIEW_REVENUE]);
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

  const handleLockDone = (result) => {
    setNotice(describeLockResult(result, lockMode, currentUser?.id));
    setLockMode(null);
    reload();
  };

  const detail = response.data;

  if (!detail) {
    if (loading) {
      return (
        <div className="grid min-h-64 place-items-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-200 border-t-[#1d3e82]" aria-label="Đang tải người dùng" />
        </div>
      );
    }
    return (
      <div className="mx-auto max-w-[1440px] space-y-4">
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

  return (
    <div className="mx-auto max-w-[1440px] space-y-6">
      <BackLink />

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{detail.fullName}</h1>
            <StatusBadge status={statusBadge.status} label={statusBadge.label} />
          </div>
          <p className="mt-1 break-all text-sm text-slate-500">{detail.email}</p>
          <p className="mt-2 text-sm text-slate-600">
            Role: <strong className="text-slate-900">{detail.role?.name}</strong>
            {detail.managesRoles && <span className="ml-2 text-xs font-semibold text-violet-700">Quản lý phân quyền</span>}
          </p>
        </div>
        {(detail.canLock || detail.canUnlock) && (
          <button
            type="button"
            onClick={() => setLockMode(detail.canLock ? "lock" : "unlock")}
            className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition ${detail.canLock ? "bg-rose-600 hover:bg-rose-700" : "bg-[#1d3e82] hover:bg-[#17366f]"}`}
          >
            <span className="material-symbols-outlined text-[20px]">{detail.canLock ? "lock" : "lock_open"}</span>
            {detail.canLock ? "Khoá tài khoản" : "Mở khoá"}
          </button>
        )}
      </div>

      <NoticeBanner notice={notice} onClose={() => setNotice(null)} />
      {response.error && !loading && (
        <LoadError message={response.error.message || "Không tải lại được thông tin người dùng."} onRetry={reload} />
      )}

      {detail.status === "Locked" && (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900">
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

      <div className="grid gap-4 sm:grid-cols-3">
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
        <StatCard
          label="Lượt mua lẻ chưa dùng"
          value={stats.unusedSingleItineraryCount ?? 0}
          icon="confirmation_number"
          tone="bg-amber-50 text-amber-700"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={CARD_CLASS}>
          <h2 className="font-bold text-slate-900">Tài khoản</h2>
          <dl className="mt-2">
            <InfoRow label="Đăng nhập bằng">{loginMethods.length > 0 ? loginMethods.join(", ") : "—"}</InfoRow>
            <InfoRow label="Ngày tạo">{formatVnDateTime(detail.createdAt)}</InfoRow>
            <InfoRow label="Cập nhật lần cuối">{formatVnDateTime(detail.updatedAt)}</InfoRow>
          </dl>
        </section>
        <section className={CARD_CLASS}>
          <h2 className="font-bold text-slate-900">Gói hiện tại</h2>
          <dl className="mt-2">
            <InfoRow label="Gói">{getPlanDisplayName(subscription?.plan) || "—"}</InfoRow>
            <InfoRow label="Hiệu lực đến">{planUntil ? formatVnDateTime(planUntil) : "—"}</InfoRow>
            {subscription?.usage && (
              <InfoRow label="Lượt tạo lịch trình">
                {formatLimit(subscription.usage.generateUsed, subscription.usage.generateLimit)}
                {subscription.usage.resetAt && (
                  <span className="block text-xs font-normal text-slate-500">
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
          </dl>
        </section>
      </div>

      <section className="space-y-4">
        <div role="tablist" aria-label="Lịch sử của người dùng" className="flex gap-1 border-b border-slate-200">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={tab === item.key}
              onClick={() => setTab(item.key)}
              className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition ${tab === item.key ? "border-[#1d3e82] text-[#1d3e82]" : "border-transparent text-slate-500 hover:text-slate-800"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        {tab === "payments" ? (
          <UserPaymentsTab userId={userId} canViewDetail={canViewPayments} onChanged={reload} showNotice={showNotice} />
        ) : (
          <UserTripsTab userId={userId} />
        )}
      </section>

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
