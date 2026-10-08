import { useRef } from "react";
import { AdminOverlayFrame } from "./ui";
import { ADMIN_SECONDARY_BUTTON, ADMIN_DESTRUCTIVE_BUTTON } from "./adminStyles";

export default function DeletePlaceDialog({ isOpen, place, onClose, onConfirm, loading }) {
  const cancelRef = useRef(null);
  return <AdminOverlayFrame open={Boolean(isOpen && place)} title="Xác nhận xóa mềm địa điểm"
    description="Thao tác này sẽ chuyển địa điểm sang trạng thái ẩn" onClose={onClose} loading={loading} initialFocusRef={cancelRef}
    footer={<><button ref={cancelRef} type="button" disabled={loading} onClick={onClose} className={ADMIN_SECONDARY_BUTTON}>Hủy bỏ</button><button type="button" disabled={loading} onClick={onConfirm} className={ADMIN_DESTRUCTIVE_BUTTON}>{loading ? "Đang xử lý..." : "Xác nhận xóa"}</button></>}>
    <div className="mb-4 border-l-2 border-amber-400 pl-3"><p className="break-words font-semibold">{place?.name}</p><p className="break-words text-sm text-[#5C6B8A]">{place?.address}</p></div>
    <p className="text-sm leading-[22px] text-[#5C6B8A]">Địa điểm sẽ bị đánh dấu xóa mềm (<code>IsDeleted</code>) và đổi trạng thái thành <code>Inactive</code>. Lịch trình cũ vẫn giữ nguyên tham chiếu tới địa điểm này.</p>
  </AdminOverlayFrame>;
}
