import { AlertTriangle, Loader2 } from "lucide-react";

export default function DeletePlaceDialog({ isOpen, place, onClose, onConfirm, loading }) {
  if (!isOpen || !place) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-3 text-amber-600">
          <div className="p-3 bg-amber-50 rounded-full">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Xác nhận xóa mềm địa điểm</h3>
            <p className="text-xs text-gray-500">Thao tác này sẽ chuyển địa điểm sang trạng thái ẩn</p>
          </div>
        </div>

        <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-sm">
          <p className="font-semibold text-gray-800">{place.name}</p>
          <p className="text-xs text-gray-500 mt-0.5">{place.address}</p>
        </div>

        <p className="text-xs text-gray-600 leading-relaxed">
          Địa điểm sẽ bị đánh dấu xóa mềm (<code className="bg-gray-100 px-1 py-0.5 rounded">IsDeleted</code>) và đổi trạng thái thành <code className="bg-gray-100 px-1 py-0.5 rounded">Inactive</code>. Lịch trình cũ vẫn giữ nguyên tham chiếu tới địa điểm này.
        </p>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
          >
            Hủy bỏ
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition disabled:opacity-50"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Xác nhận xóa
          </button>
        </div>
      </div>
    </div>
  );
}
