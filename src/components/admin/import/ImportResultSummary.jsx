import { Link } from "react-router-dom";
import { adminPlaceService } from "../../../services/adminPlaceService";
import { AdminSurface, NoticeBanner } from "../ui";
import { ADMIN_PRIMARY_BUTTON, ADMIN_SECONDARY_BUTTON } from "../adminStyles";

export default function ImportResultSummary({ commitResult }) {
  if (!commitResult) return null;
  const handleDownloadErrors = () => {
    const url = adminPlaceService.getErrorReportUrl(commitResult.importId);
    window.open(url, "_blank");
  };
  const hasFailures = commitResult.failedCount > 0;
  return <div className="space-y-6">
    <div className="flex items-start gap-3">
      <span aria-hidden="true" className={`material-symbols-outlined mt-1 text-[28px] ${hasFailures ? "text-amber-700" : "text-emerald-700"}`}>{hasFailures ? "warning" : "check_circle"}</span>
      <div className="min-w-0"><h2 className="text-lg font-bold leading-[26px] text-[#0F2148]">Hoàn tất tiến trình nhập địa điểm</h2><p className="mt-2 break-words text-[13px] text-[#5C6B8A]">Mã phiên: <code className="[overflow-wrap:anywhere]">{commitResult.importId}</code></p></div>
    </div>
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {[["Thành công", commitResult.committedCount, "text-emerald-700"], ["Đã bỏ qua", commitResult.skippedCount, "text-[#5C6B8A]"], ["Lỗi / Thất bại", commitResult.failedCount, "text-red-700"]].map(([label, value, color]) => <AdminSurface key={label}><dt className="text-[13px] text-[#5C6B8A]">{label}</dt><dd className={`mt-2 text-2xl font-bold ${color}`}>{value}</dd></AdminSurface>)}
    </dl>
    {hasFailures && <div className="space-y-3">
      <NoticeBanner notice={{ type: "warning", message: `Có ${commitResult.failedCount} dòng import bị lỗi. Tải file CSV báo lỗi chi tiết để sửa và import lại.` }} />
      <button type="button" onClick={handleDownloadErrors} className={ADMIN_SECONDARY_BUTTON}><span aria-hidden="true" className="material-symbols-outlined text-[20px]">download</span>Tải CSV báo lỗi</button>
    </div>}
    <Link to="/admin/places" className={ADMIN_PRIMARY_BUTTON}><span aria-hidden="true" className="material-symbols-outlined text-[20px]">location_on</span>Về danh sách quản lý địa điểm</Link>
  </div>;
}
