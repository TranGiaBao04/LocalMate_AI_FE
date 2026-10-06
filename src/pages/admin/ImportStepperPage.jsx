import { useState } from "react";
import { FileSpreadsheet, CheckCircle2, FileText, BarChart3 } from "lucide-react";

import AdminPageHeader from "../../components/admin/AdminPageHeader";
import FileUploadStep from "../../components/admin/import/FileUploadStep";
import ImportPreviewTable from "../../components/admin/import/ImportPreviewTable";
import ImportModeSelector from "../../components/admin/import/ImportModeSelector";
import ImportResultSummary from "../../components/admin/import/ImportResultSummary";
import { adminPlaceService } from "../../services/adminPlaceService";

const STEPS = [
  { id: 1, label: "Tải file địa điểm", icon: FileSpreadsheet },
  { id: 2, label: "Xem trước & Thẩm định", icon: FileText },
  { id: 3, label: "Kết quả Import", icon: BarChart3 },
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
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Dữ liệu Metro"
        title="Nhập địa điểm từ CSV / Excel"
        description="Quy trình 3 bước thẩm định dữ liệu, kiểm tra nghi trùng và commit an toàn vào hệ thống"
      />

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
        {/* Stepper Header */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const isDone = currentStep > step.id;
            const isCurrent = currentStep === step.id;

            return (
              <div key={step.id} className="flex items-center gap-3 flex-1">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition ${isDone
                      ? "bg-emerald-600 text-white"
                      : isCurrent
                        ? "bg-primary text-white shadow-md ring-4 ring-blue-50"
                        : "bg-gray-100 text-gray-400"
                    }`}
                >
                  {isDone ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-4 h-4" />}
                </div>

                <div className="hidden sm:block">
                  <p className={`text-xs font-bold ${isCurrent ? "text-primary" : isDone ? "text-gray-900" : "text-gray-400"}`}>
                    Bước {step.id}: {step.label}
                  </p>
                </div>

                {index < STEPS.length - 1 && (
                  <div className={`h-0.5 flex-1 mx-2 hidden sm:block ${isDone ? "bg-emerald-500" : "bg-gray-200"}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Step 1: File Upload */}
        {currentStep === 1 && (
          <FileUploadStep onPreviewLoaded={handlePreviewLoaded} />
        )}

        {/* Step 2: Preview & Commit Mode */}
        {currentStep === 2 && preview && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-800">Báo cáo thẩm định dữ liệu preview</h2>
              <button
                type="button"
                onClick={() => {
                  setPreview(null);
                  setCurrentStep(1);
                }}
                className="text-xs text-gray-500 hover:text-gray-800 underline"
              >
                Tải lại file khác
              </button>
            </div>

            <ImportPreviewTable preview={preview} />

            <ImportModeSelector
              preview={preview}
              onCommit={handleCommit}
              loading={commitLoading}
            />
          </div>
        )}

        {/* Step 3: Result Summary */}
        {currentStep === 3 && (
          <ImportResultSummary
            commitResult={commitResult}
            preview={preview}
          />
        )}
      </div>
    </div>
  );
}
