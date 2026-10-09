import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTrip } from "../../context/TripContext";
import { useAuth } from "../../context/AuthContext";
import { formatCurrencyShort, formatDuration } from "../../utils/formatCurrency";
import { buildDirectionsUrl } from "../../utils/googleMaps";

export default function FinalizedItineraryPage() {
  const navigate = useNavigate();
  const { currentTrip, savedTrips, saveTrip } = useTrip();
  const { isLoggedIn, isDemo } = useAuth();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveErrorCode, setSaveErrorCode] = useState("");
  const savePending = useRef(false);
  const alreadySaved = saved || savedTrips.some((trip) => trip.id === currentTrip?.id);

  if (!currentTrip) {
    return (
      <div className="app-shell flex min-w-0 items-center justify-center px-4 text-center">
        <p className="text-body-lg text-on-surface-variant">
          Không có lịch trình.
        </p>
      </div>
    );
  }

  const handleSave = async () => {
    if (savePending.current || alreadySaved) return;
    if (isDemo) {
      setSaveError("Đăng nhập bằng tài khoản để lưu chuyến đi.");
      return;
    }
    if (!isLoggedIn) {
      navigate("/login");
      return;
    }

    savePending.current = true;
    setSaving(true);
    setSaveError("");
    setSaveErrorCode("");
    try {
      await saveTrip(currentTrip);
      setSaved(true);
      setShowSaveModal(true);
    } catch (err) {
      setSaveErrorCode(err.code || "");
      if (err.code === "saved_trip_quota_exceeded") {
        setSaveError("Bạn đã đạt giới hạn lịch trình được lưu của gói hiện tại.");
      } else {
        setSaveError(err.status === 404
          ? "Không tìm thấy lịch trình để lưu. Vui lòng tạo lại lịch trình."
          : err.status === 401 || err.status === 403
            ? "Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại."
            : "Không thể lưu lịch trình lúc này. Vui lòng thử lại.");
      }
    } finally {
      savePending.current = false;
      setSaving(false);
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="app-shell flex min-w-0 flex-col">
      <header className="app-header flex h-16 items-center justify-between gap-3 border-b border-border-soft !bg-white px-4 py-2 sm:px-6 lg:px-8">
        <button
          aria-label="Về trang chủ"
          onClick={() => navigate("/home")}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px] hover:bg-primary/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          <span className="material-symbols-outlined text-on-surface-variant">
            home
          </span>
        </button>
        <h1 className="min-w-0 text-body-md font-semibold leading-5 text-navy-dark sm:text-title-md">
          Lịch trình đã chốt
        </h1>
        <div className="shrink-0 rounded-[4px] border border-primary/20 bg-primary/5 px-2 py-1 text-primary">
          <span className="text-label-md font-bold">✓ Finalized</span>
        </div>
      </header>

      <main className="content-shell !mx-auto !max-w-[960px] min-w-0 flex-1 space-y-6 px-4 pb-64 pt-24 sm:px-6 lg:px-8">
        <div className="space-y-4 border-b border-border-soft pb-6 text-navy-dark">
          <h2 className="break-words text-[24px] font-bold leading-8 tracking-normal sm:text-[28px] sm:leading-9">{currentTrip.title}</h2>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-text-muted">
            <span className="flex max-w-full flex-wrap items-center gap-1.5 text-body-md">
              <span className="material-symbols-outlined text-[14px]">
                schedule
              </span>
              {currentTrip.durationHours} tiếng
            </span>

            <span className="flex max-w-full flex-wrap items-center gap-1.5 text-body-md">
              <span className="material-symbols-outlined text-[14px]">
                payments
              </span>
              ~{formatCurrencyShort(currentTrip.estimatedBudget)}/người
            </span>

            <span className="flex max-w-full flex-wrap items-center gap-1.5 text-body-md">
              <span className="material-symbols-outlined text-[14px]">
                place
              </span>
              {currentTrip.items.length} địa điểm
            </span>

            {currentTrip.metroFriendly && (
              <span className="flex max-w-full flex-wrap items-center gap-1.5 text-body-md text-secondary">
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
            return (
              <div key={item.id} className="flex min-w-0 gap-3 sm:gap-4">
                <div className="flex flex-col items-center">
                  <div
                    className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold ${item.isVisited ? "bg-primary-container text-on-primary-container" : "bg-primary text-on-primary"}`}
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

                <div className="mb-6 min-w-0 flex-1">
                  <div className="space-y-3 rounded-[8px] border border-border-soft bg-white p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1 basis-40">
                        <span className="text-label-md text-primary font-bold">
                          {item.time}
                        </span>
                        <h3 className="mt-1 break-words text-body-lg font-semibold leading-6 text-navy-dark">
                          {item.placeName}
                        </h3>
                      </div>

                      <span className="max-w-full break-words rounded-[4px] bg-primary/5 px-2 py-1 text-[12px] font-medium leading-5 text-primary">
                        {item.placeCategory}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-on-surface-variant">
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

                    <div className="flex flex-wrap gap-2 border-t border-border-soft pt-3">
                      {item.latitude && item.longitude && (
                        <a
                          href={buildDirectionsUrl({
                            destLat: item.latitude,
                            destLng: item.longitude,
                            destName: item.placeName,
                            destPlaceId: item.googlePlaceId,
                          })}
                          target="_blank"
                          rel="noreferrer"
                          className="flex min-h-11 min-w-0 flex-1 basis-24 items-center justify-center gap-1 rounded-[8px] border border-secondary/20 bg-secondary/5 px-2 py-2 text-[13px] font-semibold text-secondary transition-colors hover:bg-secondary/10 motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-secondary"
                        >
                          <span className="material-symbols-outlined text-[14px]">
                            map
                          </span>
                          Mở Maps
                        </a>
                      )}

                      <button
                        onClick={() => navigate(`/trips/${currentTrip.id}`)}
                        className="flex min-h-11 min-w-0 flex-1 basis-24 items-center justify-center gap-1 rounded-[8px] border border-border-soft px-2 py-2 text-[13px] font-semibold text-primary transition-colors hover:border-primary motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
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

      <div className="app-footer max-h-[45dvh] space-y-3 overflow-y-auto border-t border-border-soft !bg-white px-4 py-3 sm:px-6 lg:px-8">
        {saveError && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-[8px] border border-error/20 bg-error-container/10 p-3 text-[13px] leading-5 text-error">
            <span className="min-w-0 flex-1 basis-48 break-words">{saveError}</span>
            {saveErrorCode === "saved_trip_quota_exceeded" ? (
              <button
                type="button"
                onClick={() => navigate("/subscription")}
                className="min-h-11 shrink-0 rounded-[4px] px-2 font-semibold text-primary underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              >
                Nâng cấp
              </button>
            ) : isDemo ? (
              <button type="button" onClick={() => navigate("/login")} className="min-h-11 shrink-0 rounded-[4px] px-2 font-semibold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                Đăng nhập
              </button>
            ) : null}
          </div>
        )}
        <div className="flex gap-3">
          <button
            onClick={handleShare}
            className="flex min-h-12 min-w-0 flex-1 items-center justify-center gap-1 rounded-[8px] border border-border-soft px-2 py-3 text-body-md font-semibold text-primary transition-colors hover:bg-primary/5 motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            <span className="material-symbols-outlined text-[18px]">
              {copied ? "check" : "share"}
            </span>
            {copied ? "Đã sao chép!" : "Chia sẻ"}
          </button>

          <button
            onClick={handleSave}
            disabled={alreadySaved || saving}
            className={`flex min-h-12 min-w-0 flex-1 items-center justify-center gap-1 rounded-[8px] px-2 py-3 text-body-md font-semibold transition-colors disabled:opacity-70 motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${alreadySaved ? "bg-primary-container text-on-primary-container" : "bg-primary text-on-primary"}`}
          >
            <span className="material-symbols-outlined text-[18px]">
              {alreadySaved ? "bookmark" : "bookmark_add"}
            </span>
            {alreadySaved ? "Đã lưu" : saving ? "Đang lưu..." : "Lưu lịch trình"}
          </button>
        </div>
      </div>

      {showSaveModal && (
        <div role="dialog" aria-modal="true" aria-labelledby="save-trip-title" className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-6">
          <div className="max-h-[92dvh] w-full max-w-lg space-y-5 overflow-y-auto overscroll-contain rounded-t-[8px] border border-border-soft bg-white p-5 animate-fade-in-up motion-reduce:animate-none sm:rounded-[8px] sm:p-6">
            <div aria-hidden="true" className="mx-auto mb-2 h-1 w-10 rounded-full bg-border-soft sm:hidden" />

            <div className="text-center">
              <div aria-hidden="true" className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-[8px] border border-primary/20 bg-primary/5">
                <span
                  className="material-symbols-outlined text-primary"
                  style={{ fontSize: 28, fontVariationSettings: "'FILL' 1" }}
                >
                  bookmark
                </span>
              </div>
              <h3 id="save-trip-title" className="text-title-md font-bold text-on-surface">
                Đã lưu vào My Trips!
              </h3>
              <p className="text-body-md text-on-surface-variant mt-1">
                Bạn có thể xem lại lịch trình bất cứ lúc nào.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => setShowSaveModal(false)}
                className="min-h-11 flex-1 rounded-[8px] border border-border-soft px-4 py-3 font-semibold text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              >
                Ở lại lịch trình
              </button>

              <button
                onClick={() => {
                  setShowSaveModal(false);
                  navigate("/trips");
                }}
                className="min-h-11 flex-1 rounded-[8px] bg-primary px-4 py-3 font-semibold text-on-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
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
