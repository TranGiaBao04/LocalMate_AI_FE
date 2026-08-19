import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTrip } from "../../context/TripContext";
import {
  formatCurrencyShort,
  formatDuration,
} from "../../utils/formatCurrency";

export default function DraftItineraryPage() {
  const navigate = useNavigate();
  const { currentTrip, finalizeTrip, saveTrip } = useTrip();
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);

  if (!currentTrip) {
    return (
      <div className="app-shell flex flex-col items-center justify-center gap-4 px-container-margin">
        <span
          className="material-symbols-outlined text-primary"
          style={{ fontSize: 64 }}
        >
          map_search
        </span>
        <p className="text-body-lg text-on-surface-variant text-center">
          Chưa có lịch trình nào.
          <br />
          Hãy tạo lịch trình mới!
        </p>
        <button
          onClick={() => navigate("/create")}
          className="btn-primary w-auto px-8"
        >
          Tạo lịch trình
        </button>
      </div>
    );
  }

  const handleFinalize = () => {
    finalizeTrip(currentTrip.id);
    saveTrip({
      ...currentTrip,
      status: "finalized",
      finalizedAt: new Date().toISOString(),
    });
    setShowFinalizeModal(false);
    navigate("/finalized");
  };

  return (
    <div className="app-shell flex flex-col">
      <header className="app-header flex h-16 items-center justify-between border-b border-outline-variant/20 px-container-margin py-stack-sm lg:px-8">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full hover:bg-surface-container-high flex items-center justify-center"
        >
          <span className="material-symbols-outlined text-on-surface-variant">
            arrow_back
          </span>
        </button>
        <h1 className="text-title-md font-semibold text-on-surface">
          Lịch trình đề xuất
        </h1>
        <div className="px-3 py-1 bg-tertiary-container/30 text-tertiary rounded-full">
          <span className="text-label-md font-bold">Nháp</span>
        </div>
      </header>

      <main className="content-shell flex-1 space-y-stack-md px-container-margin pb-32 pt-20 lg:px-8">
        <div className="card bg-gradient-to-br from-primary/5 to-primary-container/10 border-primary/20">
          <h2 className="text-title-md font-bold text-on-surface mb-1">
            {currentTrip.title}
          </h2>
          <p className="text-body-md text-on-surface-variant mb-stack-md">
            {currentTrip.summary}
          </p>

          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { icon: "schedule", label: `${currentTrip.durationHours} tiếng` },
              {
                icon: "payments",
                label: formatCurrencyShort(currentTrip.estimatedBudget),
              },
              { icon: "place", label: `${currentTrip.items.length} điểm` },
            ].map((item) => (
              <div
                key={item.icon}
                className="bg-surface-container-lowest rounded-DEFAULT p-2"
              >
                <span className="material-symbols-outlined text-primary text-[18px]">
                  {item.icon}
                </span>
                <p className="text-label-md font-bold text-on-surface mt-0.5">
                  {item.label}
                </p>
              </div>
            ))}
          </div>

          {currentTrip.metroFriendly && (
            <div className="flex items-center gap-1.5 mt-stack-sm">
              <span className="material-symbols-outlined text-secondary text-[16px]">
                train
              </span>
              <span className="text-label-md text-secondary font-medium">
                Metro-friendly
              </span>
            </div>
          )}
        </div>

        <div className="space-y-0">
          {currentTrip.items.map((item, idx) => (
            <div key={item.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center text-[11px] font-bold flex-shrink-0 mt-1">
                  {idx + 1}
                </div>
                {idx < currentTrip.items.length - 1 && (
                  <div className="w-0.5 flex-1 bg-primary-container/30 my-1 min-h-[16px]" />
                )}
              </div>

              <div className="flex-1 mb-4">
                <div className="card space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-label-md text-primary font-bold">
                        {item.time}
                      </span>
                      <h3 className="text-body-md font-bold text-on-surface leading-tight">
                        {item.placeName}
                      </h3>
                    </div>
                    <span className="px-2 py-0.5 bg-primary-container/15 text-on-primary-container text-[10px] rounded-full font-bold ml-2 flex-shrink-0">
                      {item.placeCategory}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-on-surface-variant">
                    <span className="flex items-center gap-1 text-label-md">
                      <span className="material-symbols-outlined text-[14px]">
                        schedule
                      </span>
                      {formatDuration(item.durationMinutes)}
                    </span>
                    <span className="flex items-center gap-1 text-label-md">
                      <span className="material-symbols-outlined text-[14px]">
                        payments
                      </span>
                      {formatCurrencyShort(item.estimatedCost)}
                    </span>
                  </div>

                  <p className="text-label-md text-on-surface-variant italic">
                    "{item.reason}"
                  </p>

                  {item.travelNote && (
                    <div className="flex items-center gap-1.5 bg-secondary/5 rounded px-2 py-1">
                      <span className="material-symbols-outlined text-secondary text-[14px]">
                        train
                      </span>
                      <span className="text-label-md text-secondary">
                        {item.travelNote}
                      </span>
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => navigate(`/place/${item.placeId}`)}
                      className="flex-1 py-2 bg-primary text-on-primary rounded-full text-label-md font-bold flex items-center justify-center gap-1 active:scale-95 transition-all"
                    >
                      <span className="material-symbols-outlined text-[14px]">
                        info
                      </span>
                      Xem thông tin
                    </button>
                    <button
                      onClick={() => navigate(`/replace/${item.id}`)}
                      className="flex-1 py-2 border border-outline-variant text-on-surface-variant rounded-full text-label-md font-bold flex items-center justify-center gap-1 active:scale-95 transition-all hover:border-primary hover:text-primary"
                    >
                      <span className="material-symbols-outlined text-[14px]">
                        swap_horiz
                      </span>
                      Thay thế
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      <div className="app-footer flex gap-3 border-t border-outline-variant/20 px-container-margin py-stack-md lg:px-8">
        <button
          onClick={() => navigate("/create")}
          className="flex-1 py-3 border border-primary text-primary rounded-full font-semibold text-button active:scale-95 transition-all flex items-center justify-center gap-1"
        >
          <span className="material-symbols-outlined text-[18px]">refresh</span>
          Tạo lại
        </button>
        <button
          onClick={() => setShowFinalizeModal(true)}
          className="flex-1 py-3 bg-primary text-on-primary rounded-full font-semibold text-button active:scale-95 transition-all shadow-lg shadow-primary/30 flex items-center justify-center gap-1"
        >
          Chốt lịch trình
          <span className="material-symbols-outlined text-[18px]">
            check_circle
          </span>
        </button>
      </div>

      {showFinalizeModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center">
          <div className="w-full max-w-md bg-surface rounded-t-lg p-stack-lg space-y-stack-md animate-fade-in-up lg:rounded-lg">
            <div className="w-10 h-1 bg-outline-variant rounded-full mx-auto mb-2" />
            <h3 className="text-title-md font-bold text-on-surface text-center">
              Xác nhận chốt lịch trình?
            </h3>
            <p className="text-body-md text-on-surface-variant text-center">
              Lịch trình sẽ được lưu và sẵn sàng sử dụng.
            </p>
            <div className="card space-y-1">
              <p className="text-body-md text-on-surface">
                📍 {currentTrip.mainArea}
              </p>
              <p className="text-body-md text-on-surface">
                ⏱ {currentTrip.durationHours} tiếng · {currentTrip.items.length}{" "}
                địa điểm
              </p>
              <p className="text-body-md text-on-surface">
                💰 ~{formatCurrencyShort(currentTrip.estimatedBudget)}/người
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowFinalizeModal(false)}
                className="flex-1 py-3 border border-outline-variant text-on-surface-variant rounded-full font-semibold active:scale-95 transition-all"
              >
                Quay lại
              </button>
              <button
                onClick={handleFinalize}
                className="flex-1 py-3 bg-primary text-on-primary rounded-full font-semibold active:scale-95 transition-all shadow-lg shadow-primary/30"
              >
                Chốt lịch trình
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
