import { useState, useEffect } from "react";
import { AdminOverlayFrame } from "../ui";
import { ADMIN_PRIMARY_BUTTON, ADMIN_SECONDARY_BUTTON, ADMIN_ICON_BUTTON } from "../adminStyles";
import StatusBadge from "../ui/StatusBadge";
import ConfirmDialog from "../ui/ConfirmDialog";
import EntitlementRepairPanel from "./EntitlementRepairPanel";
import EntitlementRepairDialog from "./EntitlementRepairDialog";
import CreditSourcesPanel from "./CreditSourcesPanel";
import { adminTransactionService } from "../../../services/adminTransactionService";
import { useAuth } from "../../../context/AuthContext";
import { ADMIN_PERMISSIONS } from "../../../constants";
import { hasAnyPermission } from "../../../utils/adminAccess";
import {
  formatVnDateTime,
  formatPlanPrice,
} from "../../../utils/subscriptionUtils";

const STATUS_SOURCE_LABELS = {
  Checkout: "Checkout",
  Webhook: "Webhook PayOS",
  ProviderLookup: "Tra cứu người dùng",
  LocalExpiration: "Hết hạn nội bộ",
  AdminReconcile: "Đối soát quản trị",
  BackgroundReconcile: "Đối soát tự động",
};

const STATUS_BADGE_CONFIG = {
  Paid: { status: "success", label: "Đã thanh toán" },
  Pending: { status: "pending", label: "Đang chờ" },
  Failed: { status: "failed", label: "Thất bại" },
  Expired: { status: "inactive", label: "Hết hạn" },
  ReviewRequired: { status: "info", label: "Cần kiểm tra" },
};

const OPERATION_LABELS = {
  Purchase: "Mua",
  Renewal: "Gia hạn",
  Upgrade: "Nâng cấp",
};

function renderStatusPill(status) {
  if (!status) return <span className="text-[#5C6B8A]">Khởi tạo</span>;
  const config = STATUS_BADGE_CONFIG[status] || { status: "inactive", label: status };
  return <StatusBadge status={config.status} label={config.label} />;
}

function TransactionDetailContent({
  transactionId,
  onClose,
  onReconciled,
  showNotice,
}) {
  const { user } = useAuth();
  const canManagePlans = hasAnyPermission(user, [ADMIN_PERMISSIONS.MANAGE_PLANS]);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [repairDialogOpen, setRepairDialogOpen] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch transaction detail with race condition protection
  useEffect(() => {
    let isCancelled = false;

    adminTransactionService
      .getTransactionDetail(transactionId)
      .then((data) => {
        if (isCancelled) return;
        setDetail(data);
        setError(null);
      })
      .catch((err) => {
        if (isCancelled) return;
        if (err?.code === "transaction_not_found" || err?.status === 404) {
          setError("Không tìm thấy thông tin giao dịch này.");
        } else {
          setError(err?.message || "Không thể tải chi tiết giao dịch.");
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [transactionId, refreshKey]);

  const handleRetry = () => {
    setLoading(true);
    setRefreshKey((k) => k + 1);
  };

  // Handle Reconcile PayOS Action
  const handleConfirmReconcile = async () => {
    if (!transactionId || reconciling || !canManagePlans) return;

    try {
      setReconciling(true);
      const result = await adminTransactionService.reconcileTransaction(transactionId);

      // Handle HTTP 200 operational statuses
      if (
        result?.localStatusAfter === "ReviewRequired" ||
        result?.settlementStatus === "CreditConflict"
      ) {
        showNotice?.(
          "warning",
          "Giao dịch cần kiểm tra tài chính. Chưa xác nhận thanh toán thành công; không tự động khôi phục hoặc xử lý credit."
        );
      } else if (result?.status === "Reconciled") {
        const msg = result.statusChanged
          ? `Đối soát hoàn tất: Trạng thái đổi từ "${result.localStatusBefore || "—"}" sang "${result.localStatusAfter || "—"}".`
          : "Đối soát hoàn tất, trạng thái giao dịch đã được kiểm tra.";
        showNotice?.("info", msg);
      } else if (result?.status === "NoChange") {
        showNotice?.("info", "PayOS đã được kiểm tra, trạng thái giao dịch không thay đổi.");
      } else if (result?.status === "AlreadyPaid") {
        showNotice?.("info", "Giao dịch đã ở trạng thái đã thanh toán.");
      } else {
        showNotice?.("info", "Đã nhận kết quả đối soát. Dữ liệu giao dịch sẽ được làm mới.");
      }

      setConfirmOpen(false);

      // 1. Refresh detail drawer
      setLoading(true);
      setRefreshKey((k) => k + 1);

      // 2. Refresh parent list & summary
      onReconciled?.(result);
    } catch (err) {
      // 403 Forbidden is already handled by adminApiClient dispatching ADMIN_API_EVENTS.FORBIDDEN
      // and displayed globally by AdminLayout. Do not emit duplicate local toast.
      if (err?.status === 403) {
        setConfirmOpen(false);
        return;
      }

      let errorMsg = err?.message || "Không thể thực hiện đối soát giao dịch.";
      if (err?.status === 503 || err?.code === "payment_provider_unavailable") {
        errorMsg = "PayOS hiện không khả dụng. Chưa thể xác nhận trạng thái giao dịch; vui lòng kiểm tra lại sau.";
      } else if (err?.status === 502 || err?.code === "payment_provider_mismatch") {
        errorMsg = "Dữ liệu trả về từ nhà cung cấp không khớp giao dịch.";
      } else if (err?.status === 404 || err?.code === "transaction_not_found") {
        errorMsg = "Không tìm thấy giao dịch để đối soát.";
      }
      showNotice?.("error", errorMsg);
    } finally {
      setReconciling(false);
    }
  };

  // Handle Entitlement Repair Action
  const handleConfirmRepair = async (reason) => {
    const trimmedReason = reason?.trim();
    if (
      !transactionId || !trimmedReason || repairing || !canManagePlans ||
      detail?.repairEligibility?.eligible !== true
    ) return;

    try {
      setRepairing(true);
      const response = await adminTransactionService.repairEntitlement(
        transactionId,
        trimmedReason
      );

      // Handle HTTP 200 outcomes: backend BE-127 returns `result`
      if (response?.result === "Repaired") {
        showNotice?.(
          "success",
          "Đã khôi phục entitlement theo kỳ lịch sử đã xác minh."
        );
      } else if (response?.result === "AlreadyGranted") {
        showNotice?.(
          "info",
          "Giao dịch đã có entitlement được ghi nhận. Không có quyền nào được cấp thêm."
        );
      } else {
        showNotice?.("info", "Đã nhận kết quả khôi phục. Dữ liệu giao dịch sẽ được làm mới.");
      }

      setRepairDialogOpen(false);

      // Refresh transaction DETAIL only (avoid unnecessary list/summary fetches)
      setLoading(true);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      // 403 Forbidden is handled globally by adminApiClient / AdminLayout.
      // Do not emit duplicate local toast.
      if (err?.status === 403) {
        setRepairDialogOpen(false);
        return;
      }

      // 409 Conflict / Ineligible: show safe local notice, close dialog, refresh detail
      if (err?.status === 409) {
        let noticeMsg = "Thao tác không thực hiện được ở trạng thái hiện tại. Dữ liệu đã được làm mới.";
        if (err?.code === "entitlement_repair_not_eligible") {
          noticeMsg = "Giao dịch hiện không còn đủ điều kiện khôi phục. Dữ liệu đã được làm mới.";
        } else if (err?.code === "entitlement_repair_conflict") {
          noticeMsg = "Bằng chứng entitlement hiện có xung đột với yêu cầu khôi phục. Dữ liệu đã được làm mới.";
        }
        const decisionCode = err?.data?.decisionCode;
        if (typeof decisionCode === "string" && /^[a-z][a-z0-9_]{0,63}$/.test(decisionCode)) {
          noticeMsg += ` (${decisionCode})`;
        }
        showNotice?.("error", noticeMsg);

        setRepairDialogOpen(false);
        setLoading(true);
        setRefreshKey((k) => k + 1);
        return;
      }

      // 400 Bad Request
      if (err?.status === 400) {
        showNotice?.("error", err?.message || "Yêu cầu khôi phục không hợp lệ.");
        return;
      }

      // 404 Not Found
      if (err?.status === 404 || err?.code === "transaction_not_found") {
        showNotice?.("error", "Không tìm thấy giao dịch để khôi phục entitlement.");
        setRepairDialogOpen(false);
        setLoading(true);
        setRefreshKey((k) => k + 1);
        return;
      }

      // 500 / Unexpected error
      showNotice?.("error", err?.message || "Không thể khôi phục entitlement.");
    } finally {
      setRepairing(false);
    }
  };

  const handleCopyId = (id) => {
    if (!id) return;
    navigator.clipboard?.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const transaction = detail?.transaction;
  const statusHistory = Array.isArray(detail?.statusHistory) ? detail.statusHistory : [];
  const webhookReceipts = Array.isArray(detail?.webhookReceipts) ? detail.webhookReceipts : [];

  return (
    <>
    <AdminOverlayFrame open variant="drawer" title={`Giao dịch #${transaction?.providerOrderCode || transactionId}`} onClose={onClose} loading={reconciling || repairing || confirmOpen || repairDialogOpen}
      footer={<button type="button" className={ADMIN_SECONDARY_BUTTON} onClick={onClose} disabled={reconciling || repairing}>Đóng</button>}>
        {/* Drawer Header */}
        <div className="flex min-w-0 items-start justify-between gap-3 border-b border-[#DCE2EE] pb-4 [overflow-wrap:anywhere]">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-blue-50 text-[#1d3e82]">
              <span className="material-symbols-outlined text-[22px]">receipt_long</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  id="transaction-detail-title"
                  className="font-mono text-base font-bold text-[#0F2148]"
                >
                  #{transaction?.providerOrderCode || transactionId}
                </h2>
                {transaction?.status && renderStatusPill(transaction.status)}
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-[#5C6B8A]">
                <span className="truncate font-mono">{transactionId}</span>
                <button
                  type="button"
                  onClick={() => handleCopyId(transactionId)}
                  className={ADMIN_ICON_BUTTON}
                  title="Sao chép ID giao dịch"
                  aria-label="Sao chép ID giao dịch"
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {copiedId ? "done" : "content_copy"}
                  </span>
                </button>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={reconciling || repairing}
            className={ADMIN_ICON_BUTTON}
            aria-label="Đóng chi tiết"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Action Bar (Đối soát PayOS) */}
        {transaction && !loading && !error && canManagePlans && (
          <div className="flex flex-wrap items-start gap-3 border-b border-[#DCE2EE] py-4">
            <div>
              <p className="text-xs font-semibold text-slate-700">Thao tác quản trị</p>
              <p className="text-xs text-[#5C6B8A]">
                {transaction.status === "Paid"
                  ? "Giao dịch đã thanh toán · PayOS có thể trả về AlreadyPaid"
                  : "Tra cứu trạng thái mới nhất từ PayOS và cập nhật hệ thống"}
              </p>
            </div>

            <button
              type="button"
              disabled={reconciling}
              onClick={() => setConfirmOpen(true)}
              className={ADMIN_PRIMARY_BUTTON}
            >
              <span className={`material-symbols-outlined text-[16px] ${reconciling ? "animate-spin" : ""}`}>
                {reconciling ? "sync" : "published_with_changes"}
              </span>
              <span>{reconciling ? "Đang đối soát..." : "Đối soát PayOS"}</span>
            </button>
          </div>
        )}

        {/* Drawer Body */}
        <div className="min-w-0 space-y-6 py-5 [overflow-wrap:anywhere]">
          {/* Loading Skeleton */}
          {loading && (
            <div className="space-y-6 animate-pulse">
              <div className="space-y-3 rounded-[12px] border border-[#DCE2EE] p-5">
                <div className="h-4 w-32 rounded bg-slate-200" />
                <div className="grid grid-cols-2 gap-4">
                  <div className="h-10 rounded bg-slate-100" />
                  <div className="h-10 rounded bg-slate-100" />
                  <div className="h-10 rounded bg-slate-100" />
                  <div className="h-10 rounded bg-slate-100" />
                </div>
              </div>
              <div className="space-y-3 rounded-[12px] border border-[#DCE2EE] p-5">
                <div className="h-4 w-40 rounded bg-slate-200" />
                <div className="h-24 rounded bg-slate-100" />
              </div>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="rounded-[12px] border border-rose-200 bg-rose-50 p-6 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-[12px] bg-rose-100 text-rose-600">
                <span className="material-symbols-outlined text-[26px]">error</span>
              </div>
              <h3 className="mt-3 font-bold text-rose-950">Lỗi tải dữ liệu</h3>
              <p className="mt-1 text-sm text-rose-700">{error}</p>
              <button
                type="button"
                onClick={handleRetry}
                className="mt-4 rounded-[12px] bg-rose-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-rose-700"
              >
                Thử lại
              </button>
            </div>
          )}

          {/* Data Loaded */}
          {!loading && !error && transaction && (
            <>
              {/* Section 1: Thông tin thanh toán & đơn hàng */}
              <section aria-labelledby="order-info-heading" className="space-y-3">
                <h3 id="order-info-heading" className="text-base font-semibold text-[#0F2148]">
                  Thông tin đơn hàng & Thanh toán
                </h3>
                <div className="grid grid-cols-1 gap-4 border-b border-[#DCE2EE] pb-5 text-sm sm:grid-cols-2">
                  <div>
                    <span className="text-xs text-[#5C6B8A]">Khách hàng:</span>
                    <p className="font-semibold text-[#0F2148]">{transaction.userFullName || "—"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-[#5C6B8A]">Email:</span>
                    <p className="font-mono text-xs font-medium text-slate-800">{transaction.userEmail || "—"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-[#5C6B8A]">Sản phẩm:</span>
                    <p className="font-semibold text-[#0F2148]">
                      {transaction.productKind === "SingleItinerary"
                        ? "Lịch trình đơn lẻ"
                        : transaction.planName || transaction.planCode || "Gói đăng ký"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-[#5C6B8A]">Loại thao tác:</span>
                    <p className="font-semibold text-[#0F2148]">
                      {OPERATION_LABELS[transaction.operationType] || transaction.operationType || "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-[#5C6B8A]">Thực trả:</span>
                    <p className="text-base font-bold text-[#0F2148]">
                      {transaction.amount != null ? formatPlanPrice(transaction.amount) : "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-[#5C6B8A]">Credit đã áp dụng:</span>
                    <p className="text-base font-semibold text-[#0F2148]">
                      {transaction.creditAmount != null ? formatPlanPrice(transaction.creditAmount) : "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-[#5C6B8A]">Giá gốc:</span>
                    <p className="text-base font-semibold text-[#0F2148]">
                      {transaction.listPrice != null ? formatPlanPrice(transaction.listPrice) : "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-[#5C6B8A]">Đơn vị tiền tệ:</span>
                    <p className="font-semibold text-[#0F2148]">{transaction.currency || "VND"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-[#5C6B8A]">Thời gian tạo:</span>
                    <p className="font-medium text-slate-800">{formatVnDateTime(transaction.createdAt) || "—"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-[#5C6B8A]">Hạn thanh toán:</span>
                    <p className="font-medium text-slate-800">{formatVnDateTime(transaction.expiresAt) || "—"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-[#5C6B8A]">Thời gian thanh toán:</span>
                    <p className="font-medium text-emerald-700">
                      {transaction.paidAt ? formatVnDateTime(transaction.paidAt) : "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-[#5C6B8A]">Liên kết phiên bản gói:</span>
                    <p className="font-medium text-slate-800">{transaction.planVersionBinding || "—"}</p>
                  </div>

                  {transaction.updatedAt && (
                    <div className="sm:col-span-2">
                      <span className="text-xs text-[#5C6B8A]">Cập nhật lần cuối:</span>
                      <p className="font-medium text-slate-800">{formatVnDateTime(transaction.updatedAt)}</p>
                    </div>
                  )}

                  {(transaction.planId || transaction.planVersionId) && (
                    <div className="border-t border-slate-100 pt-2 text-xs text-[#5C6B8A] sm:col-span-2">
                      {transaction.planId && (
                        <p>
                          Plan ID: <span className="font-mono text-slate-600">{transaction.planId}</span>
                        </p>
                      )}
                      {transaction.planVersionId && (
                        <p>
                          Version ID: <span className="font-mono text-slate-600">{transaction.planVersionId}</span>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </section>

              <CreditSourcesPanel sources={detail.creditSources} />

              {/* Section 2: Quyền hội viên & Section 3: Lịch sử khôi phục entitlement */}
              <EntitlementRepairPanel
                detail={detail}
                canManagePlans={canManagePlans}
                onOpenRepair={() => setRepairDialogOpen(true)}
                repairing={repairing}
              />

              {/* Section 4: Lịch sử chuyển trạng thái (Status History Timeline) */}
              <section aria-labelledby="status-history-heading" className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 id="status-history-heading" className="text-base font-semibold text-[#0F2148]">
                    Lịch sử trạng thái ({statusHistory.length})
                  </h3>
                </div>

                {statusHistory.length === 0 ? (
                  <div className="rounded-[12px] border border-[#DCE2EE] bg-slate-50/50 p-6 text-center text-sm text-[#5C6B8A]">
                    Không có lịch sử trạng thái được ghi nhận cho giao dịch này.
                  </div>
                ) : (
                  <ol className="space-y-3" aria-label="Lịch sử trạng thái">
                    {statusHistory.map((item, index) => {
                      const sourceLabel = STATUS_SOURCE_LABELS[item.source] || item.source || "—";
                      return (
                        <li
                          key={item.id || `hist-${index}`}
                          className="relative rounded-[12px] border border-[#DCE2EE] bg-white p-4 "
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                            <div className="flex items-center gap-2">
                              {renderStatusPill(item.fromStatus)}
                              <span className="material-symbols-outlined text-[16px] text-[#5C6B8A]">arrow_forward</span>
                              {renderStatusPill(item.toStatus)}
                            </div>
                            <span className="text-xs font-medium text-[#5C6B8A]">
                              {formatVnDateTime(item.occurredAt)}
                            </span>
                          </div>

                          <div className="mt-2.5 grid grid-cols-1 gap-2 text-xs text-slate-600 sm:grid-cols-2">
                            <div>
                              <span className="text-[#5C6B8A]">Nguồn cập nhật: </span>
                              <span className="font-semibold text-slate-800">{sourceLabel}</span>
                            </div>
                            {item.reasonCode && (
                              <div>
                                <span className="text-[#5C6B8A]">Mã lý do: </span>
                                <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-700">
                                  {item.reasonCode}
                                </code>
                              </div>
                            )}
                            {item.actorUserId && (
                              <div>
                                <span className="text-[#5C6B8A]">Người thực hiện: </span>
                                <span className="font-mono text-slate-700">{item.actorUserId}</span>
                              </div>
                            )}
                            {item.webhookReceiptId && (
                              <div>
                                <span className="text-[#5C6B8A]">Mã biên nhận: </span>
                                <span className="font-mono text-slate-700">{item.webhookReceiptId}</span>
                              </div>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </section>

              {/* Section 3: Bằng chứng biên nhận Webhook (Webhook Evidence) */}
              <section aria-labelledby="webhook-evidence-heading" className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 id="webhook-evidence-heading" className="text-base font-semibold text-[#0F2148]">
                    Bằng chứng Webhook PayOS ({webhookReceipts.length})
                  </h3>
                </div>

                {webhookReceipts.length === 0 ? (
                  <div className="rounded-[12px] border border-[#DCE2EE] bg-slate-50/50 p-6 text-center text-sm text-[#5C6B8A]">
                    Không có biên nhận webhook nào cho giao dịch này.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {webhookReceipts.map((receipt, index) => (
                      <div
                        key={receipt.id || `receipt-${index}`}
                        className="rounded-[12px] border border-[#DCE2EE] bg-white p-4 "
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-[#0F2148]">
                              #{receipt.providerOrderCode}
                            </span>
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                                receipt.isSuccessful
                                  ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/15"
                                  : "bg-rose-50 text-rose-700 ring-1 ring-rose-600/15"
                              }`}
                            >
                              {receipt.isSuccessful ? "Thành công" : "Không thành công"}
                            </span>
                          </div>
                          <span className="text-xs font-medium text-[#5C6B8A]">
                            {formatVnDateTime(receipt.receivedAt)}
                          </span>
                        </div>

                        <div className="mt-2.5 space-y-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-[#5C6B8A]">Số tiền biên nhận:</span>
                            <span className="font-bold text-[#0F2148]">
                              {receipt.amount != null ? formatPlanPrice(receipt.amount) : "—"}
                            </span>
                          </div>

                          <div>
                            <span className="text-[#5C6B8A]">Mã băm SHA-256 (Payload):</span>
                            <p className="mt-0.5 break-all rounded bg-slate-50 p-2 font-mono text-xs text-slate-700 ring-1 ring-slate-200">
                              {receipt.rawPayloadSha256 || "—"}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 text-[#5C6B8A]">
                            <span>
                              Trạng thái lưu trữ:{" "}
                              <strong className={receipt.hasRawPayload ? "text-blue-700" : "text-slate-600"}>
                                {receipt.hasRawPayload ? "Đang lưu trữ" : "Đã dọn dẹp"}
                              </strong>
                            </span>
                            {receipt.rawPayloadRetainUntil && (
                              <span>Hạn giữ: {formatVnDateTime(receipt.rawPayloadRetainUntil)}</span>
                            )}
                            {receipt.rawPayloadPurgedAt && (
                              <span>Đã xóa lúc: {formatVnDateTime(receipt.rawPayloadPurgedAt)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>

    </AdminOverlayFrame>

      {/* Confirmation Dialog for Reconciliation */}
      <ConfirmDialog
        open={confirmOpen && canManagePlans}
        tone="info"
        title="Đối soát giao dịch với PayOS?"
        message="Hệ thống sẽ kiểm tra trạng thái hiện tại từ PayOS và áp dụng quy tắc thanh toán hiện có nếu có thay đổi."
        confirmLabel="Đối soát"
        cancelLabel="Hủy bỏ"
        loading={reconciling}
        onConfirm={handleConfirmReconcile}
        onCancel={() => !reconciling && setConfirmOpen(false)}
      />

      {/* Entitlement Repair Dialog */}
      <EntitlementRepairDialog
        open={repairDialogOpen && canManagePlans && detail?.repairEligibility?.eligible === true}
        onClose={() => !repairing && setRepairDialogOpen(false)}
        onConfirm={handleConfirmRepair}
        submitting={repairing}
        planName={
          transaction?.planName ||
          transaction?.planCode ||
          "—"
        }
        proposedStartsAt={detail?.repairEligibility?.proposedStartsAt}
        proposedEndsAt={detail?.repairEligibility?.proposedEndsAt}
        reconstructionMode={detail?.repairEligibility?.reconstructionMode}
      />
    </>
  );
}

export default function TransactionDetailDrawer({
  isOpen,
  transactionId,
  onClose,
  onReconciled,
  showNotice,
}) {
  if (!isOpen || !transactionId) return null;

  return (
    <TransactionDetailContent
      key={transactionId}
      transactionId={transactionId}
      onClose={onClose}
      onReconciled={onReconciled}
      showNotice={showNotice}
    />
  );
}
