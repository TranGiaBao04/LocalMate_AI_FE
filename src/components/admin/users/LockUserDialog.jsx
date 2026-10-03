import { useEffect, useRef, useState } from "react";
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

  useEffect(() => {
    reasonRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, submitting]);

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
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/45 p-5 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && !submitting && onClose()}
    >
      <form onSubmit={handleSubmit} role="dialog" aria-modal="true" aria-labelledby="lock-user-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className={`grid h-12 w-12 place-items-center rounded-xl ${isLock ? "bg-rose-50 text-rose-600" : "bg-blue-50 text-[#1d3e82]"}`}>
          <span className="material-symbols-outlined text-[25px]">{isLock ? "lock" : "lock_open"}</span>
        </div>
        <h2 id="lock-user-title" className="mt-5 text-xl font-bold text-slate-950">
          {isLock ? "Khoá tài khoản" : "Mở khoá tài khoản"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          <strong className="text-slate-800">{user.fullName}</strong> ({user.email})
          {isLock
            ? " sẽ bị đăng xuất và không đăng nhập được cho đến khi được mở khoá."
            : " sẽ đăng nhập và sử dụng lại được ngay."}
        </p>

        {isLock && (
          <div className="mt-5">
            <label htmlFor="lock-reason" className="text-sm font-semibold text-slate-700">
              Lý do khoá <span className="text-rose-600">*</span>
            </label>
            <textarea
              ref={reasonRef}
              id="lock-reason"
              rows={4}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={submitting}
              aria-invalid={reasonTooLong}
              placeholder="Ghi chú nội bộ, chỉ hiện ở trang quản trị"
              className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100/60"
            />
            <div className="mt-1 flex justify-between gap-3 text-xs">
              <span className="text-rose-600">{reasonTooLong ? `Lý do tối đa ${LOCK_REASON_MAX_LENGTH} ký tự.` : ""}</span>
              <span className={reasonTooLong ? "text-rose-600" : "text-slate-400"}>
                {trimmedReason.length}/{LOCK_REASON_MAX_LENGTH}
              </span>
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">{error}</p>
        )}

        <div className="mt-7 flex justify-end gap-3">
          <button type="button" disabled={submitting} onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50">
            Hủy
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className={`min-w-24 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-60 ${isLock ? "bg-rose-600 hover:bg-rose-700 focus:ring-rose-200" : "bg-[#1d3e82] hover:bg-[#17366f] focus:ring-blue-200"}`}
          >
            {submitting ? "Đang xử lý..." : isLock ? "Khoá tài khoản" : "Mở khoá"}
          </button>
        </div>
      </form>
    </div>
  );
}
