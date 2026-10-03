import StatusBadge from "../ui/StatusBadge";
import { formatPlanPrice, formatVnDateTime } from "../../../utils/subscriptionUtils";

// Cột bảng giao dịch dùng chung: màn Giao dịch và lịch sử thanh toán trong chi tiết user
const OPERATION_CONFIG = {
  Purchase: { label: "Mua", icon: "shopping_cart", color: "text-blue-700" },
  Renewal: { label: "Gia hạn", icon: "autorenew", color: "text-purple-700" },
  Upgrade: { label: "Nâng cấp", icon: "upgrade", color: "text-teal-700" },
};

const STATUS_BADGE_CONFIG = {
  Paid: { status: "success", label: "Đã thanh toán" },
  Pending: { status: "pending", label: "Đang chờ" },
  Failed: { status: "failed", label: "Thất bại" },
  Expired: { status: "inactive", label: "Hết hạn" },
  ReviewRequired: { status: "info", label: "Cần kiểm tra" },
};

/**
 * @param {Object} options
 * @param {(id: string) => void} [options.onOpenDetail] bỏ trống ⇒ không có cột "Thao tác" (thiếu quyền ViewRevenue)
 * @param {boolean} [options.showCustomer=true] false khi đã ở trang của một user
 */
export function buildTransactionColumns({ onOpenDetail, showCustomer = true } = {}) {
  return [
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
    showCustomer && {
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
      header: "Sản phẩm",
      sortable: true,
      render: (row) => {
        const displayName =
          row.productKind === "SingleItinerary"
            ? "Lịch trình đơn lẻ"
            : row.planName || row.planCode || "Gói đăng ký";
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
        const config = OPERATION_CONFIG[row.operationType] || {
          label: row.operationType || "—",
          icon: "help_outline",
          color: "text-slate-600",
        };
        return (
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-semibold ${config.color}`}
          >
            <span className="material-symbols-outlined text-[16px]">
              {config.icon}
            </span>
            {config.label}
          </span>
        );
      },
    },
    {
      key: "amount",
      header: "Thực trả",
      sortable: true,
      render: (row) => (
        <div className="min-w-[120px]">
          <p className="font-semibold text-slate-900">
            {row.amount != null ? formatPlanPrice(row.amount) : "—"}
          </p>
          {row.operationType === "Upgrade" && (
            <div className="mt-1 space-y-0.5 text-xs text-slate-500">
              <p>Credit: {row.creditAmount != null ? formatPlanPrice(row.creditAmount) : "—"}</p>
              <p>Giá gốc: {row.listPrice != null ? formatPlanPrice(row.listPrice) : "—"}</p>
            </div>
          )}
        </div>
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
    onOpenDetail && {
      key: "actions",
      header: "Thao tác",
      className: "text-right",
      cellClassName: "text-right",
      render: (row) => (
        <button
          type="button"
          onClick={() => onOpenDetail(row.id)}
          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#1d3e82] transition hover:bg-blue-50 hover:text-[#17366f]"
          title="Xem chi tiết giao dịch"
          aria-label={`Xem chi tiết đơn hàng #${row.providerOrderCode || row.id}`}
        >
          <span className="material-symbols-outlined text-[16px]">visibility</span>
          <span>Xem chi tiết</span>
        </button>
      ),
    },
  ].filter(Boolean);
}
