import React from "react";

/**
 * Component hiển thị giao diện khi không tìm thấy kết quả Match AI hoặc ngoài vùng phục vụ (FE-38)
 *
 * @param {Object} props
 * @param {'OutOfServiceArea' | 'InsufficientCandidates' | 'NetworkError' | string} props.reason Lý do trạng thái rỗng
 * @param {string} [props.message] Thông điệp tùy chỉnh bổ sung
 * @param {Function} [props.onAdjustLocation] Callback khi bấm điều chỉnh vị trí
 * @param {Function} [props.onChangeCriteria] Callback khi bấm thay đổi ngân sách/sở thích
 * @param {Function} [props.onRetry] Callback khi bấm thử lại
 * @param {Function} [props.onRetryDefault] Callback khi bấm thử lại với cấu hình chuẩn
 */
export function EmptyMatchingState({
  reason = "InsufficientCandidates",
  message,
  onAdjustLocation,
  onChangeCriteria,
  onRetry,
  onRetryDefault,
}) {
  const renderContent = () => {
    switch (reason) {
      case "OutOfServiceArea":
        return {
          icon: "location_off",
          badgeColor: "bg-amber-100 text-amber-800 border-amber-300",
          title: "Vị trí ngoài vùng phục vụ",
          description:
            message ||
            "LocalMate AI hiện chỉ hỗ trợ tạo lịch trình thông minh tại khu vực TP. Hồ Chí Minh và các điểm tiếp giáp tuyến Metro.",
          actions: (
            <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
              {onAdjustLocation && (
                <button
                  onClick={onAdjustLocation}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-lg">edit_location_alt</span>
                  Điều chỉnh vị trí xuất phát
                </button>
              )}
              {onChangeCriteria && (
                <button
                  onClick={onChangeCriteria}
                  className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-lg">tune</span>
                  Thay đổi bộ lọc
                </button>
              )}
            </div>
          ),
        };

      case "NetworkError":
        return {
          icon: "cloud_off",
          badgeColor: "bg-rose-100 text-rose-800 border-rose-300",
          title: "Không thể kết nối máy chủ AI",
          description:
            message ||
            "Hệ thống ghép nối AI đang gặp gián đoạn tạm thời hoặc vượt quá thời gian phản hồi. Vui lòng kiểm tra lại kết nối internet.",
          actions: (
            <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-lg">refresh</span>
                  Thử lại kết nối
                </button>
              )}
            </div>
          ),
        };

      case "InsufficientCandidates":
      default:
        return {
          icon: "search_off",
          badgeColor: "bg-blue-100 text-blue-800 border-blue-300",
          title: "Chưa tìm thấy địa điểm phù hợp",
          description:
            message ||
            "Không có địa điểm nào đáp ứng đồng thời cả ngân sách, khoảng thời gian và sở thích bạn đã chọn. Bạn có thể mở rộng tiêu chí tìm kiếm.",
          actions: (
            <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
              {onChangeCriteria && (
                <button
                  onClick={onChangeCriteria}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-lg">tune</span>
                  Nâng ngân sách & Sở thích
                </button>
              )}
              {onRetryDefault && (
                <button
                  onClick={onRetryDefault}
                  className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-lg">auto_awesome</span>
                  Gợi ý mặc định
                </button>
              )}
            </div>
          ),
        };
    }
  };

  const config = renderContent();

  return (
    <div className="w-full max-w-lg mx-auto p-6 bg-white/90 backdrop-blur-md rounded-2xl border border-gray-100 shadow-xl text-center flex flex-col items-center my-6 transition-all">
      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border mb-4 shadow-sm ${config.badgeColor}`}>
        <span className="material-symbols-outlined text-3xl">{config.icon}</span>
      </div>

      <h3 className="text-xl font-bold text-gray-900 mb-2">{config.title}</h3>
      <p className="text-sm text-gray-600 leading-relaxed mb-6 max-w-md">{config.description}</p>

      {config.actions}
    </div>
  );
}

export default EmptyMatchingState;
