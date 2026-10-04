import { RefreshCw, ShieldAlert } from "lucide-react";

export default function ConflictModal({ isOpen, onClose, onReload }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-3 text-red-600">
          <div className="p-3 bg-red-50 rounded-full">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Xung đột chỉnh sửa dữ liệu</h3>
            <p className="text-xs text-gray-500">Mã lỗi: 409 Concurrency Conflict</p>
          </div>
        </div>

        <p className="text-xs text-gray-600 leading-relaxed">
          Địa điểm này đã được chỉnh sửa hoặc cập nhật bởi một Quản trị viên khác trong thời gian bạn thao tác. Để tránh ghi đè dữ liệu, vui lòng tải lại thông tin mới nhất.
        </p>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
          >
            Đóng
          </button>

          <button
            type="button"
            onClick={onReload}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition"
          >
            <RefreshCw className="w-4 h-4" />
            Tải lại dữ liệu mới nhất
          </button>
        </div>
      </div>
    </div>
  );
}
