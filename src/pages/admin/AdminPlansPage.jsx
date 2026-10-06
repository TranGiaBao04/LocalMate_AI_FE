import { useState, useEffect, useCallback, useMemo } from "react";
import {
  DataTable,
  FilterBar,
  ConfirmDialog,
  StatusBadge,
} from "../../components/admin/ui";
import AdminPageHeader from "../../components/admin/AdminPageHeader";
import { ADMIN_PRIMARY_BUTTON } from "../../components/admin/adminStyles";
import PlanFormModal from "../../components/admin/plans/PlanFormModal";
import PlanVersionHistoryModal from "../../components/admin/plans/PlanVersionHistoryModal";
import { adminPlanService } from "../../services/adminPlanService";
import { formatPlanPrice } from "../../utils/subscriptionUtils";

export default function AdminPlansPage() {
  // Data state
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Pagination & Sort state
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [sort, setSort] = useState({ key: "entitlementPriority", direction: "asc" });

  // Filters state
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(""); // "" | "true" | "false"
  const [typeFilter, setTypeFilter] = useState(""); // "" | "true" | "false"
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Modals state
  const [formModal, setFormModal] = useState({ open: false, mode: "create", plan: null });
  const [historyModal, setHistoryModal] = useState({ open: false, plan: null });
  const [statusDialog, setStatusDialog] = useState({
    open: false,
    plan: null,
    targetStatus: false,
    loading: false,
  });
  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    plan: null,
    loading: false,
  });

  // Global notice state
  const [notice, setNotice] = useState(null); // { type: "success" | "error", message: string }

  const showNotice = useCallback((type, message) => {
    setNotice({ type, message });
    setTimeout(() => {
      setNotice((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  }, []);

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch plans via clean Promise chain to prevent synchronous setState within effect
  useEffect(() => {
    let isCancelled = false;

    const params = {
      page,
      pageSize,
      search: debouncedSearch,
      sortBy: sort.key,
      sortDirection: sort.direction,
    };

    if (statusFilter !== "") {
      params.isActive = statusFilter === "true";
    }
    if (typeFilter !== "") {
      params.isSystem = typeFilter === "true";
    }

    adminPlanService
      .getPlans(params)
      .then((res) => {
        if (isCancelled) return;
        setPlans(Array.isArray(res?.items) ? res.items : []);
        setTotalPages(res?.totalPages ?? 1);
        setTotalCount(res?.totalCount ?? 0);
        setError(null);
      })
      .catch((err) => {
        if (isCancelled) return;
        setError(err?.message || "Không thể tải danh sách gói dịch vụ.");
      })
      .finally(() => {
        if (!isCancelled) setLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [page, pageSize, debouncedSearch, sort.key, sort.direction, statusFilter, typeFilter, refreshTrigger]);

  const reloadPlans = useCallback(() => {
    setLoading(true);
    setRefreshTrigger((k) => k + 1);
  }, []);

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
      return { key, direction: "asc" };
    });
    setPage(1);
  };

  // Clear filters
  const handleClearFilters = () => {
    setLoading(true);
    setSearch("");
    setDebouncedSearch("");
    setStatusFilter("");
    setTypeFilter("");
    setPage(1);
  };

  // Lifecycle action: Toggle status (FE-126)
  const handleToggleStatusClick = useCallback((plan) => {
    if (plan.code === "FREE" && plan.isActive) {
      showNotice("error", "Gói Free hệ thống luôn hoạt động và không thể vô hiệu hóa.");
      return;
    }

    setStatusDialog({
      open: true,
      plan,
      targetStatus: !plan.isActive,
      loading: false,
    });
  }, [showNotice]);

  const handleConfirmStatus = async () => {
    const { plan, targetStatus } = statusDialog;
    if (!plan) return;

    try {
      setStatusDialog((prev) => ({ ...prev, loading: true }));
      await adminPlanService.updatePlanStatus(plan.id, targetStatus);
      showNotice(
        "success",
        targetStatus
          ? `Đã kích hoạt gói "${plan.name}".`
          : `Đã tạm dừng gói "${plan.name}".`
      );
      setStatusDialog({ open: false, plan: null, targetStatus: false, loading: false });
      reloadPlans();
    } catch (err) {
      let msg = err?.message || "Không thể thay đổi trạng thái gói dịch vụ.";
      if (err?.code === "free_cannot_deactivate") {
        msg = "Gói Free hệ thống không thể vô hiệu hóa.";
      } else if (err?.code === "invalid_current_plan_version") {
        msg = "Gói chưa có phiên bản hợp lệ để kích hoạt.";
      }
      showNotice("error", msg);
      setStatusDialog((prev) => ({ ...prev, loading: false }));
    }
  };

  // Delete action
  const handleDeleteClick = useCallback((plan) => {
    if (plan.isSystem || plan.code === "FREE") {
      showNotice("error", "Không thể xóa gói hệ thống mặc định.");
      return;
    }
    if (plan.currentVersion != null) {
      showNotice("error", "Không thể xóa gói đã có lịch sử phiên bản phát hành. Bạn có thể tạm dừng gói thay thế.");
      return;
    }

    setDeleteDialog({
      open: true,
      plan,
      loading: false,
    });
  }, [showNotice]);

  const handleConfirmDelete = async () => {
    const { plan } = deleteDialog;
    if (!plan) return;

    try {
      setDeleteDialog((prev) => ({ ...prev, loading: true }));
      await adminPlanService.deletePlan(plan.id);
      showNotice("success", `Đã xóa gói "${plan.name}".`);
      setDeleteDialog({ open: false, plan: null, loading: false });
      reloadPlans();
    } catch (err) {
      let msg = err?.message || "Không thể xóa gói dịch vụ.";
      if (err?.code === "plan_in_use") {
        msg = "Không thể xóa gói dịch vụ đã có lịch sử phiên bản hoặc người dùng đăng ký.";
      } else if (err?.code === "system_plan_locked") {
        msg = "Gói hệ thống không được phép xóa.";
      }
      showNotice("error", msg);
      setDeleteDialog((prev) => ({ ...prev, loading: false }));
    }
  };

  // Table Columns
  const columns = useMemo(
    () => [
      {
        key: "code",
        header: "Mã gói",
        sortable: true,
        render: (row) => (
          <div className="flex flex-col gap-1">
            <span className="font-mono text-xs font-bold text-slate-800">
              {row.code}
            </span>
            {row.isSystem && (
              <span className="inline-flex w-fit items-center rounded bg-blue-100/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#17366f]">
                Hệ thống
              </span>
            )}
          </div>
        ),
      },
      {
        key: "name",
        header: "Tên gói",
        sortable: true,
        render: (row) => (
          <div>
            <p className="font-bold text-slate-900">{row.name}</p>
            <p className="mt-0.5 text-xs text-slate-400">
              Ưu tiên: <span className="font-semibold text-slate-600">{row.entitlementPriority}</span> · v{row.currentVersion?.versionNumber ?? 1}
            </p>
          </div>
        ),
      },
      {
        key: "price",
        header: "Giá bán",
        render: (row) => {
          const price = row.currentVersion?.price;
          return (
            <span className="font-semibold text-slate-900">
              {formatPlanPrice(price ?? 0)}
            </span>
          );
        },
      },
      {
        key: "durationDays",
        header: "Thời hạn",
        render: (row) => {
          if (row.code === "FREE") {
            return <span className="text-slate-400">Không áp dụng</span>;
          }
          const days = row.currentVersion?.durationDays;
          return days != null ? (
            <span>{days} ngày</span>
          ) : (
            <span className="text-slate-400">Không có thời hạn mua</span>
          );
        },
      },
      {
        key: "limits",
        header: "Hạn mức (AI / Lưu)",
        render: (row) => {
          const cv = row.currentVersion;
          const gen = cv?.generateLimit == null ? "∞" : `${cv.generateLimit} lượt`;
          const save = cv?.savedTripLimit == null ? "∞" : `${cv.savedTripLimit} chuyến`;
          return (
            <div className="text-xs">
              <span className="font-medium text-slate-700" title="Lượt tạo AI">
                AI: {gen}
              </span>
              <span className="mx-1 text-slate-300">·</span>
              <span className="font-medium text-slate-700" title="Lượt lưu chuyến">
                Lưu: {save}
              </span>
            </div>
          );
        },
      },
      {
        key: "activeSubscriberCount",
        header: "Đang dùng",
        render: (row) => (
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600">
            <span className="material-symbols-outlined text-[16px] text-slate-400">person</span>
            <span>{row.activeSubscriberCount ?? 0}</span>
          </div>
        ),
      },
      {
        key: "isActive",
        header: "Trạng thái",
        sortable: true,
        render: (row) => (
          <StatusBadge
            status={row.isActive ? "active" : "inactive"}
            label={row.isActive ? "Hoạt động" : "Tạm dừng"}
          />
        ),
      },
      {
        key: "actions",
        header: "Thao tác",
        className: "text-right",
        cellClassName: "text-right",
        render: (row) => {
          const isFree = row.code === "FREE";
          return (
            <div className="flex items-center justify-end gap-1">
              {/* Edit button */}
              <button
                type="button"
                onClick={() => setFormModal({ open: true, mode: "edit", plan: row })}
                className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                title="Chỉnh sửa gói"
                aria-label="Chỉnh sửa gói"
              >
                <span className="material-symbols-outlined text-[18px]">edit</span>
              </button>

              {/* Status toggle button */}
              <button
                type="button"
                onClick={() => handleToggleStatusClick(row)}
                disabled={isFree && row.isActive}
                className={`grid h-8 w-8 place-items-center rounded-lg transition ${
                  row.isActive
                    ? "text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                    : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                } ${isFree && row.isActive ? "cursor-not-allowed opacity-40" : ""}`}
                title={
                  isFree && row.isActive
                    ? "Gói Free hệ thống không thể tạm dừng"
                    : row.isActive
                      ? "Tạm dừng gói"
                      : "Kích hoạt gói"
                }
                aria-label={row.isActive ? "Tạm dừng gói" : "Kích hoạt gói"}
              >
                <span className="material-symbols-outlined text-[20px]">
                  {row.isActive ? "toggle_on" : "toggle_off"}
                </span>
              </button>

              {/* Version history button */}
              <button
                type="button"
                onClick={() => setHistoryModal({ open: true, plan: row })}
                className="grid h-8 w-8 place-items-center rounded-lg text-purple-600 transition hover:bg-purple-50 hover:text-purple-700"
                title="Xem lịch sử phiên bản"
                aria-label="Xem lịch sử phiên bản"
              >
                <span className="material-symbols-outlined text-[18px]">history</span>
              </button>

              {/* Delete button: chỉ hiển thị cho gói tùy chỉnh CHƯA phát hành phiên bản (currentVersion == null) để không khuyến khích thao tác chắc chắn trả về plan_in_use */}
              {!row.isSystem && row.code !== "FREE" && row.currentVersion == null && (
                <button
                  type="button"
                  onClick={() => handleDeleteClick(row)}
                  className="grid h-8 w-8 place-items-center rounded-lg text-rose-500 transition hover:bg-rose-50 hover:text-rose-700"
                  title="Xóa gói tùy chỉnh chưa phát hành"
                  aria-label="Xóa gói"
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              )}
            </div>
          );
        },
      },
    ],
    [handleDeleteClick, handleToggleStatusClick]
  );

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notice && (
        <div
          role="alert"
          className={`fixed right-5 top-5 z-[80] flex max-w-md items-start gap-3 rounded-2xl border p-4 shadow-xl backdrop-blur-md transition ${
            notice.type === "success"
              ? "border-emerald-200 bg-white text-emerald-900"
              : "border-rose-200 bg-white text-rose-900"
          }`}
        >
          <span
            className={`material-symbols-outlined text-[22px] ${
              notice.type === "success" ? "text-emerald-600" : "text-rose-600"
            }`}
          >
            {notice.type === "success" ? "check_circle" : "error"}
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

      {/* Page Header (FE-122) */}
      <AdminPageHeader
        eyebrow="Gói cước & Doanh thu"
        title="Quản lý gói dịch vụ"
        description="Quản lý danh mục gói cước, định giá, hạn mức sử dụng và lịch sử phiên bản của LocalMate AI."
      >
        <button
          type="button"
          onClick={() => setFormModal({ open: true, mode: "create", plan: null })}
          className={ADMIN_PRIMARY_BUTTON}
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          Tạo gói mới
        </button>
      </AdminPageHeader>

      {/* Filter Bar */}
      <FilterBar
        searchValue={search}
        searchPlaceholder="Tìm theo mã hoặc tên gói cước..."
        onSearchChange={setSearch}
        onClear={handleClearFilters}
      >
        <select
          value={statusFilter}
          onChange={(e) => {
            setLoading(true);
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Lọc theo trạng thái"
          className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100/60"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="true">Đang hoạt động</option>
          <option value="false">Tạm dừng</option>
        </select>

        <select
          value={typeFilter}
          onChange={(e) => {
            setLoading(true);
            setTypeFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Lọc theo loại gói"
          className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100/60"
        >
          <option value="">Tất cả loại gói</option>
          <option value="true">Gói hệ thống</option>
          <option value="false">Gói tùy chỉnh</option>
        </select>
      </FilterBar>

      {/* Error state */}
      {error && (
        <div className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[22px]">error</span>
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={reloadPlans}
            className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-700"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Plans DataTable (FE-123) */}
      <DataTable
        columns={columns}
        rows={plans}
        loading={loading}
        sort={sort}
        onSort={handleSort}
        pagination={{
          page,
          totalPages,
          totalCount,
        }}
        onPageChange={(newPage) => {
          setLoading(true);
          setPage(newPage);
        }}
        emptyState={{
          icon: "workspace_premium",
          title: "Chưa có gói dịch vụ nào phù hợp",
          description:
            search || statusFilter || typeFilter
              ? "Hãy thử thay đổi từ khóa tìm kiếm hoặc bỏ bớt các bộ lọc đang chọn."
              : "Bắt đầu bằng cách tạo gói dịch vụ mới đầu tiên cho hệ thống.",
          actionLabel: search || statusFilter || typeFilter ? "Xóa bộ lọc" : "Tạo gói mới",
          onAction:
            search || statusFilter || typeFilter
              ? handleClearFilters
              : () => setFormModal({ open: true, mode: "create", plan: null }),
        }}
      />

      {/* Plan Create/Edit Form Modal (FE-122, FE-124, FE-125) */}
      <PlanFormModal
        isOpen={formModal.open}
        mode={formModal.mode}
        plan={formModal.plan}
        onClose={() => setFormModal({ open: false, mode: "create", plan: null })}
        onSuccess={(result, message) => {
          showNotice("success", message);
          reloadPlans();
        }}
      />

      {/* Plan Version History Modal (FE-128) */}
      <PlanVersionHistoryModal
        isOpen={historyModal.open}
        plan={historyModal.plan}
        onClose={() => setHistoryModal({ open: false, plan: null })}
      />

      {/* Lifecycle Activate / Deactivate Confirmation Dialog (FE-126) */}
      <ConfirmDialog
        open={statusDialog.open}
        tone={statusDialog.targetStatus ? "info" : "danger"}
        title={
          statusDialog.targetStatus
            ? `Kích hoạt gói "${statusDialog.plan?.name}"?`
            : `Tạm dừng gói "${statusDialog.plan?.name}"?`
        }
        message={
          statusDialog.targetStatus
            ? "Gói dịch vụ này sẽ hiển thị công khai trên ứng dụng để người dùng mới có thể đăng ký và gia hạn."
            : `Gói dịch vụ sẽ ngừng cho phép người dùng mới đăng ký hoặc gia hạn. Các người dùng đang có gói hiệu lực (${
                statusDialog.plan?.activeSubscriberCount ?? 0
              } người) vẫn tiếp tục được hưởng đầy đủ quyền lợi cho đến khi hết hạn.`
        }
        confirmLabel={statusDialog.targetStatus ? "Kích hoạt gói" : "Tạm dừng gói"}
        cancelLabel="Hủy bỏ"
        loading={statusDialog.loading}
        onConfirm={handleConfirmStatus}
        onCancel={() =>
          !statusDialog.loading &&
          setStatusDialog({ open: false, plan: null, targetStatus: false, loading: false })
        }
      />

      {/* Custom Plan Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialog.open}
        tone="danger"
        title={`Xóa gói "${deleteDialog.plan?.name}"?`}
        message="Bạn có chắc chắn muốn xóa gói dịch vụ này? Thao tác này không thể hoàn tác và chỉ thực hiện được khi gói chưa có người dùng đăng ký hoặc lịch sử phát hành."
        confirmLabel="Xóa gói"
        cancelLabel="Hủy bỏ"
        loading={deleteDialog.loading}
        onConfirm={handleConfirmDelete}
        onCancel={() =>
          !deleteDialog.loading &&
          setDeleteDialog({ open: false, plan: null, loading: false })
        }
      />
    </div>
  );
}
