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
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center bg-background px-container-margin">
      <div className="relative mb-10 flex items-center justify-center">
        <div className="absolute w-32 h-32 bg-primary-container/30 blur-3xl rounded-full animate-pulse" />
        <div className="w-28 h-28 rounded-full bg-surface-container-lowest soft-shadow flex items-center justify-center relative z-10">
          <span
            className="material-symbols-outlined text-primary animate-spin-slow"
            style={{ fontSize: 56, fontVariationSettings: "'FILL' 1" }}
          >
            auto_awesome
          </span>
        </div>
      </div>

      <h2 className="text-headline-lg-mobile font-bold text-on-surface text-center mb-2">
        LocalMate đang tạo lịch trình...
      </h2>
      <p className="text-body-md text-on-surface-variant text-center mb-10 max-w-xs">
        AI đang phân tích sở thích và tìm những địa điểm phù hợp nhất cho bạn.
      </p>

      <div className="w-full space-y-3">
        {LOADING_STEPS.map((step, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-500 ${
              i <= currentStep ? "opacity-100" : "opacity-30"
            }`}
          >
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                i < currentStep
                  ? "bg-primary"
                  : i === currentStep
                    ? "bg-primary-container animate-pulse"
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
              className={`text-body-md ${i === currentStep ? "text-on-surface font-medium" : "text-on-surface-variant"}`}
            >
              {step}
            </span>
          </div>
        ))}
      </div>

      <div className="w-full mt-8 h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-700"
          style={{
            width: `${((currentStep + 1) / LOADING_STEPS.length) * 100}%`,
          }}
        />
      </div>

      <div className="absolute bottom-0 left-0 w-full h-1/4 pointer-events-none opacity-30">
        <div className="w-full h-full bg-gradient-to-t from-primary-container/20 to-transparent" />
      </div>
    </div>
  );
}
