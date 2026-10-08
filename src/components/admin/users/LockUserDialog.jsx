import { useRef, useState } from "react";
import { AdminField, AdminOverlayFrame } from "../ui";
import { ADMIN_DESTRUCTIVE_BUTTON, ADMIN_PRIMARY_BUTTON, ADMIN_SECONDARY_BUTTON, ADMIN_INPUT } from "../adminStyles";
import { adminUserService } from "../../../services/adminUserService";
import { LOCK_ERROR_MESSAGES, LOCK_REASON_MAX_LENGTH } from "./userLabels";

// Khoá: bắt nhập lý do (ghi chú nội bộ). Mở khoá: chỉ xác nhận.
// Gọi API ngay trong dialog; thành công thì onDone(kết quả), trang cha đóng dialog và tải lại.
export default function LockUserDialog({ user, mode, onClose, onDone }) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const reasonRef = useRef(null);
  const isLock = mode === "lock";
  const trimmedReason = reason.trim();
  const reasonTooLong = trimmedReason.length > LOCK_REASON_MAX_LENGTH;
  const canSubmit = !submitting && (!isLock || (trimmedReason && !reasonTooLong));

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      const result = isLock
        ? await adminUserService.lockUser(user.id, trimmedReason)
        : await adminUserService.unlockUser(user.id);
      onDone(result);
    } catch (err) {
      setError(LOCK_ERROR_MESSAGES[err?.code] ?? err?.message ?? "Không thực hiện được. Vui lòng thử lại.");
      setSubmitting(false);
    }
  };

  return (
    <AdminOverlayFrame open title={isLock ? "Khoá tài khoản" : "Mở khoá tài khoản"} onClose={onClose} loading={submitting} initialFocusRef={reasonRef}
      footer={<>
        <button type="button" disabled={submitting} onClick={onClose} className={ADMIN_SECONDARY_BUTTON}>Hủy</button>
        <button type="submit" form="lock-user-form" disabled={!canSubmit} className={isLock ? ADMIN_DESTRUCTIVE_BUTTON : ADMIN_PRIMARY_BUTTON}>{submitting ? "Đang xử lý..." : isLock ? "Khoá tài khoản" : "Mở khoá"}</button>
      </>}>
      <form id="lock-user-form" onSubmit={handleSubmit} className="space-y-5">
        <p className="break-words text-sm leading-[22px] text-[#5C6B8A]"><strong className="text-[#0F2148]">{user.fullName}</strong> <span className="break-all">({user.email})</span>
          {isLock ? " sẽ bị đăng xuất và không đăng nhập được cho đến khi được mở khoá." : " sẽ đăng nhập và sử dụng lại được ngay."}
        </p>
        {isLock && <AdminField id="lock-reason" label="Lý do khoá *" error={reasonTooLong ? `Lý do tối đa ${LOCK_REASON_MAX_LENGTH} ký tự.` : ""} hint={`${trimmedReason.length}/${LOCK_REASON_MAX_LENGTH} · Ghi chú nội bộ`}>
          <textarea ref={reasonRef} id="lock-reason" rows={4} value={reason} onChange={event => setReason(event.target.value)} disabled={submitting} aria-invalid={reasonTooLong} aria-describedby={reasonTooLong ? "lock-reason-error lock-reason-hint" : "lock-reason-hint"} placeholder="Ghi chú nội bộ, chỉ hiện ở trang quản trị" className={ADMIN_INPUT + " h-auto resize-y py-3"} />
        </AdminField>}
        {error && <p role="alert" className="rounded-[12px] border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      </form>
    </AdminOverlayFrame>
  );
}
