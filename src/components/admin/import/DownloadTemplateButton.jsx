import { useState } from "react";
import { ADMIN_SECONDARY_BUTTON } from "../adminStyles";
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

  return <div className="flex flex-wrap gap-2">
    {["xlsx", "csv"].map((format) => <button key={format} type="button" disabled={Boolean(downloadingFormat)} onClick={() => handleDownload(format)} className={ADMIN_SECONDARY_BUTTON}>
      <span aria-hidden="true" className={`material-symbols-outlined text-[20px] ${downloadingFormat === format ? "animate-spin motion-reduce:animate-none" : ""}`}>{downloadingFormat === format ? "progress_activity" : "download"}</span>
      Tải mẫu {format === "xlsx" ? "Excel (.xlsx)" : "CSV (.csv)"}
    </button>)}
  </div>;
}
