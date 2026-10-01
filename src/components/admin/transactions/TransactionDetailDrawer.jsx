import { useState, useEffect } from "react";
import StatusBadge from "../ui/StatusBadge";
import ConfirmDialog from "../ui/ConfirmDialog";
import { adminTransactionService } from "../../../services/adminTransactionService";
import {
  formatVnDateTime,
  formatPlanPrice,
  PLAN_DISPLAY_NAMES,
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
};

function renderStatusPill(status) {
  if (!status) return <span className="text-slate-400">Khởi tạo</span>;
  const config = STATUS_BADGE_CONFIG[status] || { status: "inactive", label: status };
  return <StatusBadge status={config.status} label={config.label} />;
}

function TransactionDetailContent({
  transactionId,
  onClose,
  onReconciled,
  showNotice,
}) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reconciling, setReconciling] = useState(false);
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

  // Handle ESC key to close drawer
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !reconciling && !confirmOpen) {
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [reconciling, confirmOpen, onClose]);

  const handleRetry = () => {
    setLoading(true);
    setRefreshKey((k) => k + 1);
  };

  // Handle Reconcile PayOS Action
  const handleConfirmReconcile = async () => {
    if (!transactionId || reconciling) return;

    try {
      setReconciling(true);
      const result = await adminTransactionService.reconcileTransaction(transactionId);

      // Handle HTTP 200 operational statuses
      if (result?.status === "Reconciled") {
        const msg = result.statusChanged
          ? `Đối soát thành công: Trạng thái đổi từ "${result.localStatusBefore || "—"}" sang "${result.localStatusAfter || "—"}".`
          : "Đối soát hoàn tất thành công (trạng thái đồng bộ).";
        showNotice?.("success", msg);
      } else if (result?.status === "NoChange") {
        showNotice?.("info", "PayOS đã được kiểm tra, trạng thái giao dịch không thay đổi.");
      } else if (result?.status === "AlreadyPaid") {
        showNotice?.("info", "Giao dịch đã ở trạng thái đã thanh toán.");
      } else {
        showNotice?.("success", "Đối soát giao dịch hoàn tất.");
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
        return;
      }

      let errorMsg = err?.message || "Không thể thực hiện đối soát giao dịch.";
      if (err?.status === 503 || err?.code === "payment_provider_unavailable") {
        errorMsg = "PayOS hiện không khả dụng. Không có trạng thái giao dịch nào bị thay đổi.";
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
    <div
      role="presentation"
      className="fixed inset-0 z-[85] flex justify-end bg-slate-950/45 backdrop-blur-sm transition-opacity"
      onClick={(e) => {
        if (e.target === e.currentTarget && !reconciling && !confirmOpen) {
          onClose?.();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="transaction-detail-title"
        className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl transition-transform"
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-[#1d3e82]">
              <span className="material-symbols-outlined text-[22px]">receipt_long</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  id="transaction-detail-title"
                  className="font-mono text-base font-bold text-slate-950"
                >
                  #{transaction?.providerOrderCode || transactionId}
                </h2>
                {transaction?.status && renderStatusPill(transaction.status)}
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
                <span className="truncate font-mono">{transactionId}</span>
                <button
                  type="button"
                  onClick={() => handleCopyId(transactionId)}
                  className="inline-flex items-center hover:text-slate-600"
                  title="Sao chép ID giao dịch"
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
            disabled={reconciling}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
            aria-label="Đóng chi tiết"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Action Bar (Đối soát PayOS) */}
        {transaction && !loading && !error && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-6 py-3">
            <div>
              <p className="text-xs font-semibold text-slate-700">Thao tác quản trị</p>
              <p className="text-[11px] text-slate-400">
                {transaction.status === "Paid"
                  ? "Giao dịch đã thanh toán · PayOS có thể trả về AlreadyPaid"
                  : "Tra cứu trạng thái mới nhất từ PayOS và cập nhật hệ thống"}
              </p>
            </div>

            <button
              type="button"
              disabled={reconciling}
              onClick={() => setConfirmOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#1d3e82] px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#17366f] focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-wait disabled:opacity-60"
            >
              <span className={`material-symbols-outlined text-[16px] ${reconciling ? "animate-spin" : ""}`}>
                {reconciling ? "sync" : "published_with_changes"}
              </span>
              <span>{reconciling ? "Đang đối soát..." : "Đối soát PayOS"}</span>
            </button>
          </div>
        )}

        {/* Drawer Body */}
        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {/* Loading Skeleton */}
          {loading && (
            <div className="space-y-6 animate-pulse">
              <div className="space-y-3 rounded-2xl border border-slate-200 p-5">
                <div className="h-4 w-32 rounded bg-slate-200" />
                <div className="grid grid-cols-2 gap-4">
                  <div className="h-10 rounded bg-slate-100" />
                  <div className="h-10 rounded bg-slate-100" />
                  <div className="h-10 rounded bg-slate-100" />
                  <div className="h-10 rounded bg-slate-100" />
                </div>
              </div>
              <div className="space-y-3 rounded-2xl border border-slate-200 p-5">
                <div className="h-4 w-40 rounded bg-slate-200" />
                <div className="h-24 rounded bg-slate-100" />
              </div>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-rose-100 text-rose-600">
                <span className="material-symbols-outlined text-[26px]">error</span>
              </div>
              <h3 className="mt-3 font-bold text-rose-950">Lỗi tải dữ liệu</h3>
              <p className="mt-1 text-sm text-rose-700">{error}</p>
              <button
                type="button"
                onClick={handleRetry}
                className="mt-4 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-rose-700"
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
                <h3 id="order-info-heading" className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Thông tin đơn hàng & Thanh toán
                </h3>
                <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-sm sm:grid-cols-2">
                  <div>
                    <span className="text-xs text-slate-400">Khách hàng:</span>
                    <p className="font-semibold text-slate-900">{transaction.userFullName || "—"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400">Email:</span>
                    <p className="font-mono text-xs font-medium text-slate-800">{transaction.userEmail || "—"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400">Gói cước:</span>
                    <p className="font-semibold text-slate-900">
                      {PLAN_DISPLAY_NAMES[transaction.planCode] || transaction.planName || transaction.planCode || "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400">Loại thao tác:</span>
                    <p className="font-semibold text-slate-900">
                      {transaction.operationType === "Renewal" ? "Gia hạn gói" : "Mua mới gói"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400">Số tiền:</span>
                    <p className="text-base font-bold text-slate-950">
                      {transaction.amount != null ? formatPlanPrice(transaction.amount) : "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400">Đơn vị tiền tệ:</span>
                    <p className="font-semibold text-slate-900">{transaction.currency || "VND"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400">Thời gian tạo:</span>
                    <p className="font-medium text-slate-800">{formatVnDateTime(transaction.createdAt) || "—"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400">Hạn thanh toán:</span>
                    <p className="font-medium text-slate-800">{formatVnDateTime(transaction.expiresAt) || "—"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400">Thời gian thanh toán:</span>
                    <p className="font-medium text-emerald-700">
                      {transaction.paidAt ? formatVnDateTime(transaction.paidAt) : "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400">Liên kết phiên bản gói:</span>
                    <p className="font-medium text-slate-800">{transaction.planVersionBinding || "—"}</p>
                  </div>

                  {transaction.updatedAt && (
                    <div className="sm:col-span-2">
                      <span className="text-xs text-slate-400">Cập nhật lần cuối:</span>
                      <p className="font-medium text-slate-800">{formatVnDateTime(transaction.updatedAt)}</p>
                    </div>
                  )}

                  {(transaction.planId || transaction.planVersionId) && (
                    <div className="border-t border-slate-100 pt-2 text-xs text-slate-400 sm:col-span-2">
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

              {/* Section 2: Lịch sử chuyển trạng thái (Status History Timeline) */}
              <section aria-labelledby="status-history-heading" className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 id="status-history-heading" className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Lịch sử trạng thái ({statusHistory.length})
                  </h3>
                </div>

                {statusHistory.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-6 text-center text-sm text-slate-500">
                    Không có lịch sử trạng thái được ghi nhận cho giao dịch này.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {statusHistory.map((item, index) => {
                      const sourceLabel = STATUS_SOURCE_LABELS[item.source] || item.source || "—";
                      return (
                        <div
                          key={item.id || `hist-${index}`}
                          className="relative rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                            <div className="flex items-center gap-2">
                              {renderStatusPill(item.fromStatus)}
                              <span className="material-symbols-outlined text-[16px] text-slate-400">arrow_forward</span>
                              {renderStatusPill(item.toStatus)}
                            </div>
                            <span className="text-xs font-medium text-slate-400">
                              {formatVnDateTime(item.occurredAt)}
                            </span>
                          </div>

                          <div className="mt-2.5 grid grid-cols-1 gap-2 text-xs text-slate-600 sm:grid-cols-2">
                            <div>
                              <span className="text-slate-400">Nguồn cập nhật: </span>
                              <span className="font-semibold text-slate-800">{sourceLabel}</span>
                            </div>
                            {item.reasonCode && (
                              <div>
                                <span className="text-slate-400">Mã lý do: </span>
                                <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-700">
                                  {item.reasonCode}
                                </code>
                              </div>
                            )}
                            {item.actorUserId && (
                              <div>
                                <span className="text-slate-400">Người thực hiện: </span>
                                <span className="font-mono text-slate-700">{item.actorUserId}</span>
                              </div>
                            )}
                            {item.webhookReceiptId && (
                              <div>
                                <span className="text-slate-400">Mã biên nhận: </span>
                                <span className="font-mono text-slate-700">{item.webhookReceiptId}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Section 3: Bằng chứng biên nhận Webhook (Webhook Evidence) */}
              <section aria-labelledby="webhook-evidence-heading" className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 id="webhook-evidence-heading" className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Bằng chứng Webhook PayOS ({webhookReceipts.length})
                  </h3>
                </div>

                {webhookReceipts.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-6 text-center text-sm text-slate-500">
                    Không có biên nhận webhook nào cho giao dịch này.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {webhookReceipts.map((receipt, index) => (
                      <div
                        key={receipt.id || `receipt-${index}`}
                        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-slate-900">
                              #{receipt.providerOrderCode}
                            </span>
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                receipt.isSuccessful
                                  ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/15"
                                  : "bg-rose-50 text-rose-700 ring-1 ring-rose-600/15"
                              }`}
                            >
                              {receipt.isSuccessful ? "Thành công" : "Không thành công"}
                            </span>
                          </div>
                          <span className="text-xs font-medium text-slate-400">
                            {formatVnDateTime(receipt.receivedAt)}
                          </span>
                        </div>

                        <div className="mt-2.5 space-y-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Số tiền biên nhận:</span>
                            <span className="font-bold text-slate-900">
                              {receipt.amount != null ? formatPlanPrice(receipt.amount) : "—"}
                            </span>
                          </div>

                          <div>
                            <span className="text-slate-400">Mã băm SHA-256 (Payload):</span>
                            <p className="mt-0.5 break-all rounded bg-slate-50 p-2 font-mono text-[11px] text-slate-700 ring-1 ring-slate-200">
                              {receipt.rawPayloadSha256 || "—"}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 text-slate-500">
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

        {/* Drawer Footer */}
        <div className="border-t border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={reconciling}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog for Reconciliation */}
      <ConfirmDialog
        open={confirmOpen}
        tone="info"
        title="Đối soát giao dịch với PayOS?"
        message="Hệ thống sẽ kiểm tra trạng thái hiện tại từ PayOS và áp dụng quy tắc thanh toán hiện có nếu có thay đổi."
        confirmLabel="Đối soát"
        cancelLabel="Hủy bỏ"
        loading={reconciling}
        onConfirm={handleConfirmReconcile}
        onCancel={() => !reconciling && setConfirmOpen(false)}
      />
    </div>
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
      transactionId={transactionId}
      onClose={onClose}
      onReconciled={onReconciled}
      showNotice={showNotice}
    />
  );
}
