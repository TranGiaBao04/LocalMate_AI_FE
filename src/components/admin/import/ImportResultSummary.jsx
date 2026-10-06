import { CheckCircle2, Download, ArrowLeft, Building2 } from "lucide-react";
import { Link } from "react-router-dom";
import { adminPlaceService } from "../../../services/adminPlaceService";

export default function ImportResultSummary({ commitResult, preview }) {
  if (!commitResult) return null;

  const handleDownloadErrors = () => {
    const url = adminPlaceService.getErrorReportUrl(commitResult.importId);
    window.open(url, "_blank");
  };

  return (
    <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm space-y-6 text-center max-w-xl mx-auto">
      <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
        <CheckCircle2 className="w-10 h-10" />
      </div>

      <div className="space-y-1">
        <h2 className="text-xl font-bold text-gray-900">Hoàn Tất Tiến Trình Import Địa Điểm</h2>
        <p className="text-xs text-gray-500">
          Mã phiên: <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono">{commitResult.importId}</code>
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-3 gap-3 text-left">
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
          <p className="text-[11px] text-emerald-700 font-medium">Thành công</p>
          <p className="text-2xl font-bold text-emerald-800">{commitResult.committedCount}</p>
        </div>

        <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
          <p className="text-[11px] text-gray-500 font-medium">Đã bỏ qua</p>
          <p className="text-2xl font-bold text-gray-800">{commitResult.skippedCount}</p>
        </div>

        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-[11px] text-red-700 font-medium">Lỗi / Thất bại</p>
          <p className="text-2xl font-bold text-red-800">{commitResult.failedCount}</p>
        </div>
      </div>

      {/* Error CSV Download button if there were failed rows */}
      {commitResult.failedCount > 0 && (
        <div className="p-4 bg-red-50/50 border border-red-100 rounded-xl flex items-center justify-between gap-3 text-left">
          <div className="text-xs text-red-800">
            <p className="font-bold">Có {commitResult.failedCount} dòng import bị lỗi</p>
            <p className="text-[11px] text-red-600">Tải file CSV báo lỗi chi tiết để sửa và import lại</p>
          </div>

          <button
            type="button"
            onClick={handleDownloadErrors}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition shadow-sm flex-shrink-0"
          >
            <Download className="w-4 h-4" />
            Tải CSV báo lỗi
          </button>
        </div>
      )}

      <div className="pt-4 flex items-center justify-center gap-3">
        <Link
          to="/admin/places"
          className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-primary hover:bg-[#17366f] rounded-xl transition shadow-sm"
        >
          <Building2 className="w-4 h-4" />
          Về danh sách quản lý địa điểm
        </Link>
      </div>
    </div>
  );
}
