import { useState } from "react";
import { UploadCloud, FileSpreadsheet, Loader2, AlertCircle } from "lucide-react";
import DownloadTemplateButton from "./DownloadTemplateButton";
import { adminPlaceService } from "../../../services/adminPlaceService";

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

  return (
    <div className="space-y-6">
      {/* Template download section */}
      <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-xs font-bold text-primary">Tải file mẫu địa điểm chuẩn cấu trúc</p>
          <p className="text-[11px] text-primary">
            File mẫu chứa sẵn các cột tiêu đề và 3 dòng dữ liệu ví dụ chuẩn hóa
          </p>
        </div>
        <DownloadTemplateButton />
      </div>

      {/* Upload Zone */}
      <label className="relative flex flex-col items-center justify-center w-full h-56 border-2 border-dashed border-gray-300 rounded-2xl cursor-pointer hover:border-primary hover:bg-blue-50/20 transition bg-white shadow-sm p-6">
        <input
          type="file"
          accept=".xlsx, .csv"
          className="sr-only"
          disabled={loading}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />

        {loading ? (
          <div className="flex flex-col items-center gap-3 text-primary">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <span className="text-xs font-semibold">Đang đọc và phân tích file địa điểm ({selectedFile?.name})...</span>
            <span className="text-[11px] text-gray-400">Đang thẩm định dữ liệu từng dòng & kiểm tra nghi trùng</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="p-4 bg-blue-50 text-primary rounded-full">
              <UploadCloud className="w-8 h-8" />
            </div>
            <p className="text-sm font-bold text-gray-800">
              Kéo thả file CSV / Excel vào đây hoặc click để tải lên
            </p>
            <p className="text-xs text-gray-400">Hỗ trợ định dạng .xlsx và .csv (Tối đa 10MB)</p>
          </div>
        )}
      </label>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-600 font-medium">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
