import { useState } from "react";
import { ADMIN_TERTIARY_BUTTON } from "../../components/admin/adminStyles";

import AdminPageHeader from "../../components/admin/AdminPageHeader";
import FileUploadStep from "../../components/admin/import/FileUploadStep";
import ImportPreviewTable from "../../components/admin/import/ImportPreviewTable";
import ImportModeSelector from "../../components/admin/import/ImportModeSelector";
import ImportResultSummary from "../../components/admin/import/ImportResultSummary";
import { adminPlaceService } from "../../services/adminPlaceService";

const STEPS = [
  { id: 1, label: "Tải file địa điểm", icon: "upload_file" },
  { id: 2, label: "Xem trước & Thẩm định", icon: "fact_check" },
  { id: 3, label: "Kết quả Import", icon: "task_alt" },
];

export default function ImportStepperPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [preview, setPreview] = useState(null);
  const [commitResult, setCommitResult] = useState(null);
  const [commitLoading, setCommitLoading] = useState(false);

  const handlePreviewLoaded = (previewData) => {
    setPreview(previewData);
    setCurrentStep(2);
  };

  const handleCommit = async (mode) => {
    if (!preview?.importId) return;
    setCommitLoading(true);
    try {
      const res = await adminPlaceService.commitImport({
        importId: preview.importId,
        mode,
      });
      setCommitResult(res);
      setCurrentStep(3);
    } catch (err) {
      alert(err.message || "Commit địa điểm vào DB thất bại.");
    } finally {
      setCommitLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <AdminPageHeader eyebrow="Dữ liệu Metro" title="Nhập địa điểm từ CSV / Excel" description="Thẩm định dữ liệu trước khi nhập địa điểm vào hệ thống." />
      <ol aria-label="Tiến trình nhập địa điểm" className="grid grid-cols-3 gap-2 border-b border-[#DCE2EE] pb-6 sm:gap-4">
        {STEPS.map((step) => {
          const done = currentStep > step.id;
          const current = currentStep === step.id;
          return <li key={step.id} aria-current={current ? "step" : undefined} className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <span aria-hidden="true" className={`grid h-10 w-10 shrink-0 place-items-center rounded-[12px] ${done ? "bg-emerald-50 text-emerald-700" : current ? "bg-[#1D3E82] text-white" : "bg-white text-[#8993AC]"}`}>
              <span className="material-symbols-outlined text-[20px]">{done ? "check" : step.icon}</span>
            </span>
            <span className="min-w-0">
              <span className="block text-xs leading-[18px] text-[#5C6B8A]">Bước {step.id}{done ? " · Hoàn tất" : current ? " · Hiện tại" : ""}</span>
              <span className={`block break-words text-[13px] font-semibold leading-[18px] ${current ? "text-[#1D3E82]" : "text-[#5C6B8A]"}`}>{step.label}</span>
            </span>
          </li>;
        })}
      </ol>
      {currentStep === 1 && <FileUploadStep onPreviewLoaded={handlePreviewLoaded} />}
      {currentStep === 2 && preview && <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold leading-[26px] text-[#0F2148]">Thẩm định dữ liệu</h2>
          <button type="button" disabled={commitLoading} onClick={() => { setPreview(null); setCurrentStep(1); }} className={ADMIN_TERTIARY_BUTTON}>
            <span aria-hidden="true" className="material-symbols-outlined text-[20px]">upload_file</span>Tải lại file khác
          </button>
        </div>
        <ImportPreviewTable preview={preview} />
        <ImportModeSelector preview={preview} onCommit={handleCommit} loading={commitLoading} />
      </div>}
      {currentStep === 3 && <ImportResultSummary commitResult={commitResult} preview={preview} />}
    </div>
  );
}
