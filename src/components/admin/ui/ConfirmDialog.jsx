import { useRef } from "react";
import AdminOverlayFrame from "./AdminOverlayFrame";
import { ADMIN_DESTRUCTIVE_BUTTON, ADMIN_PRIMARY_BUTTON, ADMIN_SECONDARY_BUTTON } from "../adminStyles";

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Xác nhận",
  cancelLabel = "Hủy",
  tone = "danger",
  loading = false,
  onConfirm,
  onCancel,
}) {
  const cancelButtonRef = useRef(null);
  return (
    <AdminOverlayFrame
      open={open}
      title={title}
      description={message}
      onClose={onCancel}
      loading={loading}
      initialFocusRef={cancelButtonRef}
      footer={<>
        <button ref={cancelButtonRef} type="button" disabled={loading} onClick={onCancel} className={ADMIN_SECONDARY_BUTTON}>
          {cancelLabel}
        </button>
        <button type="button" disabled={loading} onClick={onConfirm} className={tone === "danger" ? ADMIN_DESTRUCTIVE_BUTTON : ADMIN_PRIMARY_BUTTON}>
          {loading ? "Đang xử lý..." : confirmLabel}
        </button>
      </>}
    >
      <div className={`grid h-11 w-11 place-items-center rounded-[12px] ${tone === "danger" ? "bg-rose-50 text-rose-600" : "bg-blue-50 text-[#1D3E82]"}`}>
        <span aria-hidden="true" className="material-symbols-outlined text-[24px]">{tone === "danger" ? "warning" : "help"}</span>
      </div>
    </AdminOverlayFrame>
  );
}
