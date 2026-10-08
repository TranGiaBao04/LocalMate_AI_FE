import { useState } from "react";
import DownloadTemplateButton from "./DownloadTemplateButton";
import { adminPlaceService } from "../../../services/adminPlaceService";
import { AdminSurface, LoadingState, NoticeBanner } from "../ui";

export default function FileUploadStep({ onPreviewLoaded }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);

  const handleFile = async (file) => {
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["xlsx", "csv"].includes(ext)) {
      setError("Định dạng file không hỗ trợ. Vui lòng chọn file .xlsx hoặc .csv.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Dung lượng file vượt quá 10MB. Vui lòng chọn file nhỏ hơn.");
      return;
    }
    setError("");
    setSelectedFile(file);
    setLoading(true);
    try {
      const result = await adminPlaceService.previewImport(file);
      onPreviewLoaded(result);
    } catch (err) {
      setError(err.message || "Tải và phân tích file thất bại. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  return <div className="space-y-6">
    <AdminSurface variant="subtle" className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
      <div className="min-w-0">
        <h2 className="text-base font-semibold leading-6 text-[#0F2148]">File mẫu địa điểm</h2>
        <p className="mt-1 text-sm leading-[22px] text-[#5C6B8A]">Có sẵn các cột tiêu đề và 3 dòng dữ liệu ví dụ.</p>
      </div>
      <DownloadTemplateButton />
    </AdminSurface>
    <label className={`relative flex min-h-60 min-w-0 flex-col items-center justify-center gap-3 rounded-[12px] border-2 border-dashed border-[#DCE2EE] bg-white p-6 text-center focus-within:ring-2 focus-within:ring-[#2C56A8] ${loading ? "cursor-wait" : "cursor-pointer hover:border-[#2C56A8]"}`}>
      <input type="file" accept=".xlsx, .csv" aria-label="Chọn file địa điểm CSV hoặc Excel" aria-describedby={error ? "import-file-help import-file-error" : "import-file-help"} aria-invalid={Boolean(error)} className="sr-only" disabled={loading} onChange={(e) => handleFile(e.target.files?.[0])} />
      {loading ? <div className="min-w-0 break-words"><LoadingState label={`Đang đọc và phân tích file địa điểm (${selectedFile?.name})...`} /><p className="mt-2 text-xs text-[#5C6B8A]">Đang thẩm định từng dòng và kiểm tra nghi trùng</p></div> : <>
        <span aria-hidden="true" className="material-symbols-outlined text-[36px] text-[#2C56A8]">upload_file</span>
        <span className="text-base font-semibold leading-6 text-[#0F2148]">Chọn file CSV / Excel để tải lên</span>
      </>}
      <span id="import-file-help" className="text-[13px] leading-[18px] text-[#5C6B8A]">Định dạng .xlsx hoặc .csv · Tối đa 10MB</span>
    </label>
    {error && <div id="import-file-error"><NoticeBanner notice={{ type: "error", message: error }} /></div>}
  </div>;
}
