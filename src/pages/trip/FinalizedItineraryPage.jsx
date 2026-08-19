import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTrip } from "../../context/TripContext";
import { useAuth } from "../../context/AuthContext";
import {
  formatCurrencyShort,
  formatDuration,
  buildGoogleMapsDirectionUrl,
} from "../../utils/formatCurrency";
import { mockPlaces } from "../../data/places.mock";

export default function FinalizedItineraryPage() {
  const navigate = useNavigate();
  const { currentTrip, saveTrip } = useTrip();
  const { isLoggedIn } = useAuth();
  const [saved, setSaved] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!currentTrip) {
    return (
      <div className="app-shell flex items-center justify-center">
        <p className="text-body-lg text-on-surface-variant">
          Không có lịch trình.
        </p>
      </div>
    );
  }

  const handleSave = () => {
    if (!isLoggedIn) {
      navigate("/login");
      return;
    }

    saveTrip(currentTrip);
    setSaved(true);
    setShowSaveModal(true);
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="app-shell flex flex-col">
      <header className="app-header flex h-16 items-center justify-between border-b border-outline-variant/20 px-container-margin py-stack-sm lg:px-8">
        <button
          onClick={() => navigate("/home")}
          className="w-9 h-9 rounded-full hover:bg-surface-container-high flex items-center justify-center"
        >
          <span className="material-symbols-outlined text-on-surface-variant">
            home
          </span>
        </button>
        <h1 className="text-title-md font-semibold text-on-surface">
          Lịch trình đã chốt
        </h1>
        <div className="px-3 py-1 bg-primary/10 text-primary rounded-full">
          <span className="text-label-md font-bold">✓ Finalized</span>
        </div>
      </header>

      <main className="content-shell flex-1 space-y-stack-md px-container-margin pb-36 pt-20 lg:px-8">
        <div className="card bg-gradient-to-br from-primary to-primary-container text-on-primary">
          <h2 className="text-title-md font-bold mb-1">{currentTrip.title}</h2>

          <div className="flex items-center gap-4 mt-2 flex-wrap">
            <span className="flex items-center gap-1 text-label-md opacity-90">
              <span className="material-symbols-outlined text-[14px]">
                schedule
              </span>
              {currentTrip.durationHours} tiếng
            </span>

            <span className="flex items-center gap-1 text-label-md opacity-90">
              <span className="material-symbols-outlined text-[14px]">
                payments
              </span>
              ~{formatCurrencyShort(currentTrip.estimatedBudget)}/người
            </span>

            <span className="flex items-center gap-1 text-label-md opacity-90">
              <span className="material-symbols-outlined text-[14px]">
                place
              </span>
              {currentTrip.items.length} địa điểm
            </span>

            {currentTrip.metroFriendly && (
              <span className="flex items-center gap-1 text-label-md opacity-90">
                <span className="material-symbols-outlined text-[14px]">
                  train
                </span>
                Metro-friendly
              </span>
            )}
          </div>
        </div>

        <div className="space-y-0">
          {currentTrip.items.map((item, idx) => {
            const place = mockPlaces.find((p) => p.id === item.placeId);

            return (
              <div key={item.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 mt-1 ${item.isVisited ? "bg-primary-container text-on-primary-container" : "bg-primary text-on-primary"}`}
                  >
                    {item.isVisited ? (
                      <span
                        className="material-symbols-outlined text-[16px]"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        check
                      </span>
                    ) : (
                      idx + 1
                    )}
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
                        <h3 className="text-body-md font-bold text-on-surface">
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

                    <div className="flex gap-2 pt-1">
                      {place && (
                        <a
                          href={buildGoogleMapsDirectionUrl(
                            place.latitude,
                            place.longitude,
                          )}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 py-2 bg-secondary/10 text-secondary rounded-full text-label-md font-bold flex items-center justify-center gap-1 active:scale-95 transition-all"
                        >
                          <span className="material-symbols-outlined text-[14px]">
                            map
                          </span>
                          Mở Maps
                        </a>
                      )}

                      <button
                        onClick={() => navigate(`/trips/${currentTrip.id}`)}
                        className="flex-1 py-2 border border-outline-variant text-on-surface-variant rounded-full text-label-md font-bold flex items-center justify-center gap-1 active:scale-95 hover:border-primary hover:text-primary transition-all"
                      >
                        <span className="material-symbols-outlined text-[14px]">
                          thumb_up
                        </span>
                        Đã ghé
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <div className="app-footer space-y-2 border-t border-outline-variant/20 px-container-margin py-stack-md lg:px-8">
        <div className="flex gap-3">
          <button
            onClick={handleShare}
            className="flex-1 py-3 border border-primary text-primary rounded-full font-semibold text-button active:scale-95 transition-all flex items-center justify-center gap-1"
          >
            <span className="material-symbols-outlined text-[18px]">
              {copied ? "check" : "share"}
            </span>
            {copied ? "Đã sao chép!" : "Chia sẻ"}
          </button>

          <button
            onClick={handleSave}
            disabled={saved}
            className={`flex-1 py-3 rounded-full font-semibold text-button active:scale-95 transition-all shadow-lg flex items-center justify-center gap-1 ${saved ? "bg-primary-container text-on-primary-container" : "bg-primary text-on-primary shadow-primary/30"}`}
          >
            <span className="material-symbols-outlined text-[18px]">
              {saved ? "bookmark" : "bookmark_add"}
            </span>
            {saved ? "Đã lưu" : "Lưu lịch trình"}
          </button>
        </div>
      </div>

      {showSaveModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center">
          <div className="w-full max-w-md bg-surface rounded-t-lg p-stack-lg space-y-stack-md animate-fade-in-up lg:rounded-lg">
            <div className="w-10 h-1 bg-outline-variant rounded-full mx-auto mb-2" />

            <div className="text-center">
              <div className="w-16 h-16 bg-primary-container/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <span
                  className="material-symbols-outlined text-primary"
                  style={{ fontSize: 36, fontVariationSettings: "'FILL' 1" }}
                >
                  bookmark
                </span>
              </div>
              <h3 className="text-title-md font-bold text-on-surface">
                Đã lưu vào My Trips!
              </h3>
              <p className="text-body-md text-on-surface-variant mt-1">
                Bạn có thể xem lại lịch trình bất cứ lúc nào.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowSaveModal(false)}
                className="flex-1 py-3 border border-outline-variant text-on-surface-variant rounded-full font-semibold active:scale-95"
              >
                Ở lại lịch trình
              </button>

              <button
                onClick={() => {
                  setShowSaveModal(false);
                  navigate("/trips");
                }}
                className="flex-1 py-3 bg-primary text-on-primary rounded-full font-semibold active:scale-95"
              >
                Xem My Trips
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
