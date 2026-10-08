import { useState, useRef } from "react";
import { AdminOverlayFrame } from "../ui";
import { ADMIN_PRIMARY_BUTTON, ADMIN_SECONDARY_BUTTON } from "../adminStyles";
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
    <AdminOverlayFrame open title="Khôi phục quyền hội viên?" description="Hệ thống sẽ khôi phục đúng kỳ quyền lịch sử đã được xác minh. Thao tác này không gia hạn gói và không thay đổi giao dịch thanh toán."
      onClose={onClose} loading={submitting} initialFocusRef={textareaRef}
      footer={<><button type="button" disabled={submitting} onClick={onClose} className={ADMIN_SECONDARY_BUTTON}>Hủy</button><button type="submit" form="repair-form" disabled={!isValid || submitting} className={ADMIN_PRIMARY_BUTTON}>{submitting ? "Đang xử lý..." : "Xác nhận khôi phục"}</button></>}>
        {/* Target Interval & Mode Summary */}
        <div className="mt-4 rounded-[12px] border border-[#DCE2EE] bg-slate-50/70 p-3.5 text-xs text-slate-700">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <span className="text-[#5C6B8A]">Gói cước:</span>
              <p className="font-semibold text-[#0F2148]">{planName}</p>
            </div>
            {reconstructionMode && (
              <div>
                <span className="text-[#5C6B8A]">Chế độ tái thiết:</span>
                <p className="break-words font-semibold text-[#0F2148] [overflow-wrap:anywhere]">{reconstructionMode}</p>
              </div>
            )}
            <div className="sm:col-span-2">
              <span className="text-[#5C6B8A]">Kỳ quyền dự kiến khôi phục:</span>
              <p className="font-medium text-slate-800">
                {formatVnDateTime(proposedStartsAt) || "—"}
                <span className="mx-1.5 text-[#5C6B8A]">→</span>
                {formatVnDateTime(proposedEndsAt) || "—"}
              </p>
            </div>
          </div>

          {isPast && (
            <div className="mt-2.5 flex items-start gap-2 rounded-[8px] border border-amber-200 bg-amber-50/80 p-2 text-xs text-amber-800">
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
        <form id="repair-form" onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <div className="flex items-center justify-between pb-1.5">
              <label
                htmlFor="repair-reason-input"
                className="text-xs font-semibold text-slate-800"
              >
                Lý do khôi phục <span className="text-rose-500">*</span>
              </label>
              <span
                className={`text-xs font-mono ${
                  reason.length > 500
                    ? "font-bold text-rose-600"
                    : reason.length >= 450
                    ? "text-amber-600"
                    : "text-[#5C6B8A]"
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
              className={`w-full rounded-[12px] border p-3 text-xs text-[#0F2148] placeholder-slate-400 transition focus:outline-none focus:ring-2 disabled:bg-slate-50 disabled:text-[#5C6B8A] ${
                hasControlChars
                  ? "border-rose-300 focus:border-rose-500 focus:ring-rose-100"
                  : "border-[#DCE2EE] focus:border-blue-500 focus:ring-blue-100"
              }`}
            />

            {hasControlChars ? (
              <p className="mt-1 text-xs font-medium text-rose-600">
                Lý do không được chứa ký tự xuống dòng hoặc ký tự điều khiển.
              </p>
            ) : (
              <p className="mt-1 text-xs text-[#5C6B8A]">
                Không nhập mật khẩu, token hoặc thông tin thanh toán nhạy cảm.
              </p>
            )}
          </div>

        </form>
    </AdminOverlayFrame>
  );
}

/**
 * Dialog nhập lý do và xác nhận khôi phục entitlement
 */
export default function EntitlementRepairDialog({ open, ...props }) {
  if (!open) return null;
  return <EntitlementRepairDialogInner {...props} />;
}
