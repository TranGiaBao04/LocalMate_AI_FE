import { AdminOverlayFrame } from "./ui";
import { ADMIN_SECONDARY_BUTTON, ADMIN_PRIMARY_BUTTON } from "./adminStyles";

export default function ConflictModal({ isOpen, onClose, onReload }) {
  return <AdminOverlayFrame open={isOpen} title="Xung đột chỉnh sửa dữ liệu" description="Mã lỗi: 409 Concurrency Conflict" onClose={onClose}
    footer={<><button type="button" onClick={onClose} className={ADMIN_SECONDARY_BUTTON}>Đóng</button><button type="button" onClick={onReload} className={ADMIN_PRIMARY_BUTTON}><span aria-hidden="true" className="material-symbols-outlined text-[20px]">refresh</span>Tải lại dữ liệu mới nhất</button></>}>
    <p className="text-[#5C6B8A]">Địa điểm này đã được chỉnh sửa hoặc cập nhật bởi một Quản trị viên khác trong thời gian bạn thao tác. Để tránh ghi đè dữ liệu, vui lòng tải lại thông tin mới nhất.</p>
  </AdminOverlayFrame>;
}
