import { useState } from "react";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { adminPlaceService } from "../../../services/adminPlaceService";

export default function DownloadTemplateButton() {
  const [downloadingFormat, setDownloadingFormat] = useState(null);

  const handleDownload = async (format) => {
    setDownloadingFormat(format);
    try {
      const blob = await adminPlaceService.getImportTemplate(format);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = blob.fileName || `Place_Import_Template.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Lỗi tải file mẫu: " + (err.message || "Không thể tải file template."));
    } finally {
      setDownloadingFormat(null);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={Boolean(downloadingFormat)}
        onClick={() => handleDownload("xlsx")}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg transition disabled:opacity-50"
      >
        {downloadingFormat === "xlsx" ? (
          <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
        ) : (
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
        )}
        Tải file mẫu Excel (.xlsx)
      </button>

      <button
        type="button"
        disabled={Boolean(downloadingFormat)}
        onClick={() => handleDownload("csv")}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg transition disabled:opacity-50"
      >
        {downloadingFormat === "csv" ? (
          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
        ) : (
          <Download className="w-4 h-4 text-blue-600" />
        )}
        Tải file mẫu CSV (.csv)
      </button>
    </div>
  );
}
