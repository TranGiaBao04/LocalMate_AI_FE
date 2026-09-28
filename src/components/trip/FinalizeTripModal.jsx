import React from "react";

/**
 * Modal xác nhận chốt lịch trình chuyến đi (FE-60 / SPEC-02)
 *
 * @param {Object} props
 * @param {boolean} props.isOpen Cờ mở/đóng modal
 * @param {Function} props.onClose Callback khi bấm Hủy/Đóng
 * @param {Function} props.onConfirmFinalize Callback thực hiện gọi API chốt
 * @param {boolean} [props.isSubmitting] Trạng thái đang gửi API
 * @param {string} [props.error] Thông báo lỗi nếu có
 */
export function FinalizeTripModal({
  isOpen,
  onClose,
  onConfirmFinalize,
  isSubmitting = false,
  error = "",
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 space-y-5 transform transition-all scale-100">
        {/* Header Icon */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-2xl">lock_reset</span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Xác nhận chốt lịch trình</h3>
            <p className="text-xs text-gray-500">Khóa danh sách điểm dừng để sẵn sàng xuất phát</p>
          </div>
        </div>

        {/* Nội dung cảnh báo */}
        <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3.5 text-xs text-amber-900 space-y-1.5 leading-relaxed">
          <div className="flex items-center gap-1.5 font-semibold text-amber-950">
            <span className="material-symbols-outlined text-base text-amber-600">warning</span>
            <span>Lưu ý quan trọng:</span>
          </div>
          <p>
            Sau khi chốt, chuyến đi sẽ chuyển sang trạng thái <strong>Đã chốt (Finalized)</strong> và không thể thêm, xóa hoặc sắp xếp lại các chặng dừng.
          </p>
          <p className="text-amber-800/90">
            (Bạn vẫn có thể chia sẻ đường link công khai hoặc tạo bản sao để chỉnh sửa sau).
          </p>
        </div>

        {/* Thông báo lỗi nếu API thất bại */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl flex items-center gap-2">
            <span className="material-symbols-outlined text-base">error</span>
            <span>{error}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-xl transition-all disabled:opacity-50"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={onConfirmFinalize}
            disabled={isSubmitting}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                <span>Đang xử lý...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-lg">check_circle</span>
                <span>Chốt lịch trình</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default FinalizeTripModal;
