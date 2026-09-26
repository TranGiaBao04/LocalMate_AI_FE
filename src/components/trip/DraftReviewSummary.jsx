import React from "react";
import { formatCurrencyShort, formatDuration } from "../../utils/formatCurrency";

/**
 * Component hiển thị tóm tắt và checklist xem lại lịch trình trước khi chốt (FE-59 / SPEC-02)
 *
 * @param {Object} props
 * @param {Object} props.trip Object lịch trình nháp hiện tại
 * @param {Function} [props.onOpenFinalizeModal] Callback mở modal xác nhận chốt
 */
export function DraftReviewSummary({ trip, onOpenFinalizeModal }) {
  if (!trip) return null;

  const items = trip.items || [];
  const totalStops = items.length;
  const totalBudget = trip.totalBudget ?? items.reduce((acc, item) => acc + Number(item.estimatedCost || 0), 0);
  const totalMinutes = trip.totalDurationMinutes ?? (totalStops * 90);

  return (
    <div className="w-full bg-white rounded-2xl border border-emerald-100 p-5 shadow-sm space-y-4 mb-6">
      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-emerald-600 text-xl">fact_check</span>
          <h3 className="font-bold text-gray-900 text-base">Tổng quan & Xem lại trước khi chốt</h3>
        </div>
        <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 border border-amber-200">
          Bản nháp (Draft)
        </span>
      </div>

      {/* Grid thông số tóm tắt */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-emerald-50/60 rounded-xl p-3 text-center border border-emerald-100/50">
          <p className="text-xs text-gray-500 font-medium mb-1">Tổng chi phí</p>
          <p className="text-sm font-bold text-emerald-700">{formatCurrencyShort(totalBudget)}</p>
        </div>

        <div className="bg-blue-50/60 rounded-xl p-3 text-center border border-blue-100/50">
          <p className="text-xs text-gray-500 font-medium mb-1">Số điểm dừng</p>
          <p className="text-sm font-bold text-blue-700">{totalStops} địa điểm</p>
        </div>

        <div className="bg-purple-50/60 rounded-xl p-3 text-center border border-purple-100/50">
          <p className="text-xs text-gray-500 font-medium mb-1">Thời lượng đi</p>
          <p className="text-sm font-bold text-purple-700">{formatDuration(totalMinutes)}</p>
        </div>
      </div>

      {/* Checklist trước khi chốt */}
      <div className="space-y-2 bg-gray-50 rounded-xl p-3 text-xs text-gray-600">
        <div className="flex items-center gap-2 text-gray-700 font-medium mb-1">
          <span className="material-symbols-outlined text-sm text-emerald-600">check_circle</span>
          <span>Checklist sẵn sàng:</span>
        </div>
        <div className="flex items-center gap-2 pl-5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          <span>Đã kiểm tra thứ tự các điểm dừng dọc lộ trình.</span>
        </div>
        <div className="flex items-center gap-2 pl-5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          <span>Phù hợp di chuyển tuyến Metro & đi bộ/xe máy.</span>
        </div>
      </div>

      {/* Action button mở modal chốt */}
      {onOpenFinalizeModal && (
        <button
          onClick={onOpenFinalizeModal}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-lg">lock</span>
          Chốt lịch trình này ngay
        </button>
      )}
    </div>
  );
}

export default DraftReviewSummary;
