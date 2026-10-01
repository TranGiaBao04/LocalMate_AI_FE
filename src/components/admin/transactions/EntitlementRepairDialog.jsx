import { useState, useEffect, useRef } from "react";
import { formatVnDateTime } from "../../../utils/subscriptionUtils";

function hasControlCharacters(str) {
  if (!str) return false;
  for (let i = 0; i < str.length; i += 1) {
    const code = str.charCodeAt(i);
    // U+0000..U+001F (C0 controls including \n, \r, \t) and U+007F..U+009F (C1 controls)
    if ((code >= 0 && code <= 31) || (code >= 127 && code <= 159)) {
      return true;
    }
  }
  return false;
}

function EntitlementRepairDialogInner({
  onClose,
  onConfirm,
  submitting = false,
  planName = "—",
  proposedStartsAt = null,
  proposedEndsAt = null,
  reconstructionMode = null,
}) {
  const [reason, setReason] = useState("");
  const [now] = useState(() => Date.now());
  const textareaRef = useRef(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && !submitting) {
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [submitting, onClose]);

  const trimmed = reason.trim();
  const hasControlChars = hasControlCharacters(reason);
  const isValid = trimmed.length > 0 && reason.length <= 500 && !hasControlChars;
  const isPast = proposedEndsAt && new Date(proposedEndsAt).getTime() < now;

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!isValid || submitting) return;
    onConfirm?.(trimmed);
  };

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) {
          onClose?.();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="entitlement-repair-dialog-title"
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl transition-all"
      >
        {/* Header Icon + Title */}
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-amber-600/20">
            <span className="material-symbols-outlined text-[26px]">build_circle</span>
          </div>
          <div className="min-w-0 flex-1">
            <h2
              id="entitlement-repair-dialog-title"
              className="text-lg font-bold text-slate-950"
            >
              Khôi phục quyền hội viên?
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Hệ thống sẽ khôi phục đúng kỳ quyền lịch sử đã được xác minh. Thao tác này không gia hạn gói và không thay đổi giao dịch thanh toán.
            </p>
          </div>
        </div>

        {/* Target Interval & Mode Summary */}
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-xs text-slate-700">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <span className="text-slate-400">Gói cước:</span>
              <p className="font-semibold text-slate-900">{planName}</p>
            </div>
            {reconstructionMode && (
              <div>
                <span className="text-slate-400">Chế độ tái thiết:</span>
                <p className="font-semibold text-slate-900">{reconstructionMode}</p>
              </div>
            )}
            <div className="sm:col-span-2">
              <span className="text-slate-400">Kỳ quyền dự kiến khôi phục:</span>
              <p className="font-medium text-slate-800">
                {formatVnDateTime(proposedStartsAt) || "—"}
                <span className="mx-1.5 text-slate-400">→</span>
                {formatVnDateTime(proposedEndsAt) || "—"}
              </p>
            </div>
          </div>

          {isPast && (
            <div className="mt-2.5 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/80 p-2 text-[11px] text-amber-800">
              <span className="material-symbols-outlined shrink-0 text-[16px] text-amber-600">
                warning
              </span>
              <span>
                Khoảng quyền này đã hết hạn. Việc khôi phục chỉ phục hồi bằng chứng lịch sử, không cấp thêm ngày sử dụng.
              </span>
            </div>
          )}
        </div>

        {/* Reason Input Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <div className="flex items-center justify-between pb-1.5">
              <label
                htmlFor="repair-reason-input"
                className="text-xs font-semibold text-slate-800"
              >
                Lý do khôi phục <span className="text-rose-500">*</span>
              </label>
              <span
                className={`text-[11px] font-mono ${
                  reason.length > 500
                    ? "font-bold text-rose-600"
                    : reason.length >= 450
                    ? "text-amber-600"
                    : "text-slate-400"
                }`}
              >
                {reason.length}/500
              </span>
            </div>

            <textarea
              id="repair-reason-input"
              ref={textareaRef}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Nhập lý do thực hiện khôi phục quyền (ví dụ: đối soát sau sự cố webhook)..."
              disabled={submitting}
              maxLength={500}
              className={`w-full rounded-xl border p-3 text-xs text-slate-900 placeholder-slate-400 transition focus:outline-none focus:ring-2 disabled:bg-slate-50 disabled:text-slate-500 ${
                hasControlChars
                  ? "border-rose-300 focus:border-rose-500 focus:ring-rose-100"
                  : "border-slate-200 focus:border-blue-500 focus:ring-blue-100"
              }`}
            />

            {hasControlChars ? (
              <p className="mt-1 text-[11px] font-medium text-rose-600">
                Lý do không được chứa ký tự xuống dòng hoặc ký tự điều khiển.
              </p>
            ) : (
              <p className="mt-1 text-[11px] text-slate-400">
                Không nhập mật khẩu, token hoặc thông tin thanh toán nhạy cảm.
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={!isValid || submitting}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#1d3e82] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#17366f] focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting && (
                <span className="material-symbols-outlined animate-spin text-[16px]">
                  sync
                </span>
              )}
              <span>{submitting ? "Đang xử lý..." : "Xác nhận khôi phục"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Dialog nhập lý do và xác nhận khôi phục entitlement
 */
export default function EntitlementRepairDialog({ open, ...props }) {
  if (!open) return null;
  return <EntitlementRepairDialogInner {...props} />;
}
