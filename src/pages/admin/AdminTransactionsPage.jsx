import { useState, useEffect, useCallback, useMemo } from "react";
import {
  DataTable,
  FilterBar,
  StatusBadge,
} from "../../components/admin/ui";
import { adminTransactionService } from "../../services/adminTransactionService";
import {
  formatVnDateTime,
  formatPlanPrice,
  PLAN_DISPLAY_NAMES,
} from "../../utils/subscriptionUtils";
import { downloadBlob } from "../../utils/exportFiles";
import { TransactionDetailDrawer } from "../../components/admin/transactions";

const STATUS_OPTIONS = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "Pending", label: "Đang chờ" },
  { value: "Paid", label: "Đã thanh toán" },
  { value: "Failed", label: "Thất bại" },
  { value: "Expired", label: "Hết hạn" },
];

const OPERATION_OPTIONS = [
  { value: "", label: "Tất cả loại giao dịch" },
  { value: "Purchase", label: "Mua gói" },
  { value: "Renewal", label: "Gia hạn" },
];

const STATUS_BADGE_CONFIG = {
  Paid: { status: "success", label: "Đã thanh toán" },
  Pending: { status: "pending", label: "Đang chờ" },
  Failed: { status: "failed", label: "Thất bại" },
  Expired: { status: "inactive", label: "Hết hạn" },
};

export default function AdminTransactionsPage() {
  // Table data state
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Pagination & Sorting state
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [sort, setSort] = useState({ key: "createdAt", direction: "desc" });

  // Filter state
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [operationFilter, setOperationFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Summary state
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState(null);

  // Export state
  const [exporting, setExporting] = useState(false);

  // Detail drawer state (FE-133, FE-134)
  const [selectedTransactionId, setSelectedTransactionId] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Notification state
  const [notice, setNotice] = useState(null); // { type: "success" | "info" | "error", message: string }

  const showNotice = useCallback((type, message) => {
    setNotice({ type, message });
    setTimeout(() => {
      setNotice((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  }, []);

  const handleOpenDetail = useCallback((id) => {
    setSelectedTransactionId(id);
    setDetailOpen(true);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setDetailOpen(false);
    setSelectedTransactionId(null);
  }, []);

  // Validate date range
  const dateError = useMemo(() => {
    if (fromDate && toDate && fromDate > toDate) {
      return "Ngày bắt đầu không được lớn hơn ngày kết thúc.";
    }
    return null;
  }, [fromDate, toDate]);

  // Debounce search input (350ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Canonical filter parameters
  const canonicalFilters = useMemo(
    () => ({
      search: debouncedSearch,
      status: statusFilter,
      operationType: operationFilter,
      fromDate,
      toDate,
    }),
    [debouncedSearch, statusFilter, operationFilter, fromDate, toDate]
  );

  // Fetch summary cards
  useEffect(() => {
    if (dateError) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSummaryLoading(false);
      return;
    }

    let isCancelled = false;

    adminTransactionService
      .getSummary(canonicalFilters)
      .then((data) => {
        if (isCancelled) return;
        setSummary(data);
        setSummaryError(null);
      })
      .catch((err) => {
        if (isCancelled) return;
        setSummaryError(err?.message || "Không thể tải số liệu tổng quan.");
      })
      .finally(() => {
        if (!isCancelled) setSummaryLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [canonicalFilters, dateError, refreshTrigger]);

  // Fetch transactions table data
  useEffect(() => {
    if (dateError) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }

    let isCancelled = false;

    const queryParams = {
      ...canonicalFilters,
      page,
      pageSize,
      sortBy: sort.key,
      sortDirection: sort.direction,
    };

    adminTransactionService
      .getTransactions(queryParams)
      .then((res) => {
        if (isCancelled) return;
        setTransactions(Array.isArray(res?.items) ? res.items : []);
        setTotalPages(res?.totalPages ?? 1);
        setTotalCount(res?.totalCount ?? 0);
        setError(null);
      })
      .catch((err) => {
        if (isCancelled) return;
        setError(err?.message || "Không thể tải danh sách giao dịch.");
      })
      .finally(() => {
        if (!isCancelled) setLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [canonicalFilters, page, pageSize, sort.key, sort.direction, dateError, refreshTrigger]);

  const reloadData = useCallback(() => {
    setLoading(true);
    setSummaryLoading(true);
    setRefreshTrigger((k) => k + 1);
  }, []);

  const handleReconciled = useCallback(() => {
    reloadData();
  }, [reloadData]);

  // Handle Sort
  const handleSort = (key) => {
    setLoading(true);
    setSort((prev) => {
      if (prev.key === key) {
        return {
          key,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      }
      return { key, direction: "desc" };
    });
    setPage(1);
  };

  // Clear filters
  const handleClearFilters = () => {
    setLoading(true);
    setSummaryLoading(true);
    setSearch("");
    setDebouncedSearch("");
    setStatusFilter("");
    setOperationFilter("");
    setFromDate("");
    setToDate("");
    setPage(1);
  };

  const hasActiveFilters = Boolean(
    search || statusFilter || operationFilter || fromDate || toDate
  );

  // Handle CSV Export
  const handleExportCsv = async () => {
    if (dateError) {
      showNotice("error", "Khoảng thời gian lọc không hợp lệ. Vui lòng kiểm tra lại.");
      return;
    }

    try {
      setExporting(true);
      const blob = await adminTransactionService.exportTransactions(canonicalFilters);
      const fileName = blob?.fileName || "localmate-transactions.csv";
      downloadBlob(blob, fileName);
      showNotice("success", "Xuất tệp CSV giao dịch thành công.");
    } catch (err) {
      if (err?.code === "transaction_export_limit_exceeded") {
        showNotice(
          "error",
          "Số lượng giao dịch vượt quá giới hạn xuất (tối đa 10.000 dòng). Vui lòng thu hẹp khoảng thời gian hoặc áp dụng thêm bộ lọc."
        );
      } else {
        showNotice("error", err?.message || "Không thể xuất danh sách giao dịch.");
      }
    } finally {
      setExporting(false);
    }
  };

  // Table Columns (FE-130)
  const columns = useMemo(
    () => [
      {
        key: "createdAt",
        header: "Thời gian tạo",
        sortable: true,
        render: (row) => (
          <div>
            <p className="font-medium text-slate-800">
              {formatVnDateTime(row.createdAt)}
            </p>
            {row.paidAt && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-emerald-600">
                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                <span>Thanh toán: {formatVnDateTime(row.paidAt)}</span>
              </p>
            )}
          </div>
        ),
      },
      {
        key: "providerOrderCode",
        header: "Mã đơn hàng",
        sortable: true,
        render: (row) => (
          <div className="flex flex-col">
            <span className="font-mono text-xs font-bold text-slate-900">
              #{row.providerOrderCode || row.id}
            </span>
            {row.providerOrderCode && row.id && (
              <span
                className="max-w-[130px] truncate font-mono text-[10px] text-slate-400"
                title={row.id}
              >
                {row.id}
              </span>
            )}
          </div>
        ),
      },
      {
        key: "userEmail",
        header: "Khách hàng",
        sortable: true,
        render: (row) => (
          <div>
            <p className="font-medium text-slate-900">
              {row.userFullName || "Khách hàng"}
            </p>
            <p className="mt-0.5 font-mono text-xs text-slate-500">
              {row.userEmail}
            </p>
          </div>
        ),
      },
      {
        key: "planCode",
        header: "Gói cước",
        sortable: true,
        render: (row) => {
          const displayName =
            PLAN_DISPLAY_NAMES[row.planCode] || row.planName || row.planCode || "—";
          return (
            <span className="inline-flex items-center rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
              {displayName}
            </span>
          );
        },
      },
      {
        key: "operationType",
        header: "Loại thao tác",
        sortable: true,
        render: (row) => {
          const isRenewal = row.operationType === "Renewal";
          return (
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                isRenewal ? "text-purple-700" : "text-blue-700"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">
                {isRenewal ? "autorenew" : "shopping_cart"}
              </span>
              {isRenewal ? "Gia hạn" : "Mua gói"}
            </span>
          );
        },
      },
      {
        key: "amount",
        header: "Số tiền",
        sortable: true,
        render: (row) => (
          <span className="font-semibold text-slate-900">
            {row.amount != null ? formatPlanPrice(row.amount) : "—"}
          </span>
        ),
      },
      {
        key: "status",
        header: "Trạng thái",
        sortable: true,
        render: (row) => {
          const config = STATUS_BADGE_CONFIG[row.status] || {
            status: "inactive",
            label: row.status,
          };
          return <StatusBadge status={config.status} label={config.label} />;
        },
      },
      {
        key: "actions",
        header: "Thao tác",
        className: "text-right",
        cellClassName: "text-right",
        render: (row) => (
          <button
            type="button"
            onClick={() => handleOpenDetail(row.id)}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#1d3e82] transition hover:bg-blue-50 hover:text-[#17366f]"
            title="Xem chi tiết giao dịch"
            aria-label={`Xem chi tiết đơn hàng #${row.providerOrderCode || row.id}`}
          >
            <span className="material-symbols-outlined text-[16px]">visibility</span>
            <span>Xem chi tiết</span>
          </button>
        ),
      },
    ],
    [handleOpenDetail]
  );

  return (
    <div className="mx-auto max-w-[1440px] space-y-6">
      {/* Toast Notification */}
      {notice && (
        <div
          role="alert"
          className={`fixed right-5 top-5 z-[80] flex max-w-md items-start gap-3 rounded-2xl border p-4 shadow-xl backdrop-blur-md transition ${
            notice.type === "success"
              ? "border-emerald-200 bg-white text-emerald-900"
              : notice.type === "info"
                ? "border-blue-200 bg-white text-blue-900"
                : "border-rose-200 bg-white text-rose-900"
          }`}
        >
          <span
            className={`material-symbols-outlined text-[22px] ${
              notice.type === "success"
                ? "text-emerald-600"
                : notice.type === "info"
                  ? "text-blue-600"
                  : "text-rose-600"
            }`}
          >
            {notice.type === "success"
              ? "check_circle"
              : notice.type === "info"
                ? "info"
                : "error"}
          </span>
          <div className="flex-1 text-sm font-medium leading-relaxed">
            {notice.message}
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Đóng thông báo"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {/* Page Header (FE-129, FE-136) */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold text-[#1d3e82]">Quản trị hệ thống</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            Quản lý giao dịch
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Theo dõi đơn hàng, doanh thu thanh toán qua PayOS và lịch sử giao dịch gói dịch vụ.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          disabled={exporting || Boolean(dateError)}
          className="inline-flex items-center gap-2 rounded-xl bg-[#1d3e82] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#17366f] focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[20px]">
            {exporting ? "hourglass_top" : "download"}
          </span>
          {exporting ? "Đang xuất CSV..." : "Xuất CSV"}
        </button>
      </div>

      {/* Summary Cards (FE-132) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Gross Revenue */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,.03)]">
          {summaryLoading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-4 w-28 rounded bg-slate-100" />
              <div className="h-7 w-36 rounded bg-slate-200" />
              <div className="h-3 w-44 rounded bg-slate-100" />
            </div>
          ) : (
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Doanh thu gộp
                </p>
                <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
                  {summary ? formatPlanPrice(summary.grossRevenue) : "0đ"}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Tổng tiền từ giao dịch thành công
                </p>
              </div>
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                <span className="material-symbols-outlined text-[24px]">payments</span>
              </div>
            </div>
          )}
        </div>

        {/* Card 2: Total Transactions */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,.03)]">
          {summaryLoading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-4 w-28 rounded bg-slate-100" />
              <div className="h-7 w-24 rounded bg-slate-200" />
              <div className="h-3 w-40 rounded bg-slate-100" />
            </div>
          ) : (
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Tổng giao dịch
                </p>
                <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
                  {summary?.totalTransactions?.toLocaleString("vi-VN") ?? 0}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Tất cả đơn hàng theo bộ lọc
                </p>
              </div>
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-blue-50 text-[#1d3e82]">
                <span className="material-symbols-outlined text-[24px]">receipt_long</span>
              </div>
            </div>
          )}
        </div>

        {/* Card 3: Paid Count */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,.03)]">
          {summaryLoading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-4 w-28 rounded bg-slate-100" />
              <div className="h-7 w-24 rounded bg-slate-200" />
              <div className="h-3 w-40 rounded bg-slate-100" />
            </div>
          ) : (
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Đã thanh toán
                </p>
                <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-700">
                  {summary?.paidCount?.toLocaleString("vi-VN") ?? 0}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {summary?.totalTransactions > 0
                    ? `${Math.round(
                        (summary.paidCount / summary.totalTransactions) * 100
                      )}% tổng số đơn hàng`
                    : "Giao dịch hoàn tất thành công"}
                </p>
              </div>
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                <span className="material-symbols-outlined text-[24px]">check_circle</span>
              </div>
            </div>
          )}
        </div>

        {/* Card 4: Pending Count with Failed & Expired indicators */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,.03)]">
          {summaryLoading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-4 w-28 rounded bg-slate-100" />
              <div className="h-7 w-24 rounded bg-slate-200" />
              <div className="h-3 w-40 rounded bg-slate-100" />
            </div>
          ) : (
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Đang chờ xử lý
                </p>
                <p className="mt-2 text-2xl font-bold tracking-tight text-amber-700">
                  {summary?.pendingCount?.toLocaleString("vi-VN") ?? 0}
                </p>
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                  <span>Thất bại: <strong className="text-rose-600">{summary?.failedCount ?? 0}</strong></span>
                  <span>·</span>
                  <span>Hết hạn: <strong className="text-slate-600">{summary?.expiredCount ?? 0}</strong></span>
                </div>
              </div>
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700">
                <span className="material-symbols-outlined text-[24px]">pending_actions</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {summaryError && (
        <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          <span>Không thể tải dữ liệu thống kê: {summaryError}</span>
          <button
            type="button"
            onClick={reloadData}
            className="font-semibold underline hover:text-amber-950"
          >
            Tải lại
          </button>
        </div>
      )}

      {/* Filter Bar (FE-131) */}
      <FilterBar
        searchValue={search}
        searchPlaceholder="Tìm mã đơn, email khách hàng, gói cước..."
        onSearchChange={(val) => {
          setSearch(val);
        }}
        onClear={handleClearFilters}
      >
        <select
          value={statusFilter}
          onChange={(e) => {
            setLoading(true);
            setSummaryLoading(true);
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Lọc theo trạng thái"
          className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100/60"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <select
          value={operationFilter}
          onChange={(e) => {
            setLoading(true);
            setSummaryLoading(true);
            setOperationFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Lọc theo loại giao dịch"
          className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100/60"
        >
          {OPERATION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 focus-within:border-blue-300 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-100/60">
            <span className="text-xs font-semibold text-slate-400">Từ</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setLoading(true);
                setSummaryLoading(true);
                setFromDate(e.target.value);
                setPage(1);
              }}
              aria-label="Lọc từ ngày"
              className="bg-transparent text-sm text-slate-700 outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 focus-within:border-blue-300 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-100/60">
            <span className="text-xs font-semibold text-slate-400">Đến</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setLoading(true);
                setSummaryLoading(true);
                setToDate(e.target.value);
                setPage(1);
              }}
              aria-label="Lọc đến ngày"
              className="bg-transparent text-sm text-slate-700 outline-none"
            />
          </div>
        </div>
      </FilterBar>

      {/* Date Validation Alert */}
      {dateError && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span className="material-symbols-outlined text-[20px]">warning</span>
          <span>{dateError}</span>
        </div>
      )}

      {/* Table Error state */}
      {error && (
        <div className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[22px]">error</span>
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={reloadData}
            className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-700"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Transactions DataTable (FE-130) */}
      <DataTable
        columns={columns}
        rows={transactions}
        loading={loading}
        sort={sort}
        onSort={handleSort}
        pagination={{
          page,
          totalPages,
          totalItems: totalCount,
        }}
        onPageChange={(newPage) => {
          setLoading(true);
          setPage(newPage);
        }}
        emptyState={{
          icon: "receipt_long",
          title: "Chưa có giao dịch nào phù hợp",
          description: hasActiveFilters
            ? "Hãy thử thay đổi từ khóa tìm kiếm hoặc điều chỉnh khoảng thời gian lọc."
            : "Chưa có dữ liệu giao dịch nào được ghi nhận trên hệ thống.",
          actionLabel: hasActiveFilters ? "Xóa bộ lọc" : undefined,
          onAction: hasActiveFilters ? handleClearFilters : undefined,
        }}
      />

      {/* Transaction Detail Drawer (FE-133, FE-134) */}
      <TransactionDetailDrawer
        isOpen={detailOpen}
        transactionId={selectedTransactionId}
        onClose={handleCloseDetail}
        onReconciled={handleReconciled}
        showNotice={showNotice}
      />
    </div>
  );
}
