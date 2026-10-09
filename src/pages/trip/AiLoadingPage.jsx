import { useEffect, useState } from "react";

const LOADING_STEPS = [
  "Đang phân tích vị trí xuất phát...",
  "Đang tìm cụm địa điểm gần tuyến Metro số 1...",
  "Đang lọc địa điểm theo ngân sách và sở thích...",
  "Đang sắp xếp timeline nháp...",
];

export default function AiLoadingPage() {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) =>
        prev < LOADING_STEPS.length - 1 ? prev + 1 : prev,
      );
    }, 600);

    return () => clearInterval(interval);
  }, []);

  return (
    <div aria-labelledby="ai-loading-title" className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center bg-background px-4 py-10 sm:px-8">
      <div aria-hidden="true" className="relative mb-6 flex items-center justify-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-[8px] border border-primary/20 bg-white">
          <span
            className="material-symbols-outlined text-primary animate-spin-slow motion-reduce:animate-none"
            style={{ fontSize: 40, fontVariationSettings: "'FILL' 1" }}
          >
            auto_awesome
          </span>
        </div>
      </div>

      <h2 id="ai-loading-title" className="mb-3 text-center text-[24px] font-bold leading-8 tracking-normal text-navy-dark sm:text-[28px] sm:leading-9">
        LocalMate đang tạo lịch trình...
      </h2>
      <p className="mb-8 max-w-sm text-center text-body-md leading-6 text-text-muted">
        AI đang phân tích sở thích và tìm những địa điểm phù hợp nhất cho bạn.
      </p>

      <div aria-label="Các bước xử lý minh hoạ" className="w-full space-y-2">
        {LOADING_STEPS.map((step, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 rounded-[8px] border p-3 transition-colors duration-500 motion-reduce:transition-none ${
              i <= currentStep ? "border-border-soft bg-white" : "border-transparent"
            }`}
          >
            <div
              aria-hidden="true"
              className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-colors motion-reduce:transition-none ${
                i < currentStep
                  ? "bg-primary"
                  : i === currentStep
                    ? "bg-primary-container animate-pulse motion-reduce:animate-none"
                    : "bg-surface-container-high"
              }`}
            >
              {i < currentStep ? (
                <span
                  className="material-symbols-outlined text-white text-[14px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  check
                </span>
              ) : (
                <div
                  className={`w-2 h-2 rounded-full ${i === currentStep ? "bg-primary" : "bg-outline-variant"}`}
                />
              )}
            </div>
            <span
              className={`min-w-0 break-words text-body-md leading-6 ${i === currentStep ? "text-on-surface font-medium" : "text-text-muted"}`}
            >
              {step}
            </span>
          </div>
        ))}
      </div>

      <div aria-hidden="true" className="w-full mt-6 h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-700 motion-reduce:transition-none"
          style={{
            width: `${((currentStep + 1) / LOADING_STEPS.length) * 100}%`,
          }}
        />
      </div>

      <p className="mt-4 text-center text-[13px] leading-5 text-text-muted">
        Tiến trình minh hoạ. Vui lòng chờ kết quả lịch trình.
      </p>
    </div>
  );
}
