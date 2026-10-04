import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { formatCurrencyShort, formatDuration } from "../../utils/formatCurrency";

export default function CuratedItineraryCard({ itinerary, applyingId, applyError, onApply }) {
  const navigate = useNavigate();
  const { isDemo } = useAuth();

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => onApply(itinerary)}
        disabled={applyingId !== null}
        aria-busy={applyingId === itinerary.id}
        className="soft-shadow soft-shadow-hover overflow-hidden rounded-[20px] bg-white text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy disabled:cursor-wait"
      >
        <div className="relative h-[170px] bg-surface-variant">
          {itinerary.coverImageUrl ? (
            <img
              src={itinerary.coverImageUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <span aria-hidden="true" className="material-symbols-outlined flex h-full items-center justify-center text-4xl text-navy/30">route</span>
          )}
          {itinerary.stationName && (
            <span className="absolute left-2.5 top-2.5 rounded-full bg-navy-dark px-2 py-[3px] text-[10.5px] font-bold text-white">
              Ga {itinerary.stationName}
            </span>
          )}
        </div>
        <div className="p-4">
          <h4 className="text-[15px] font-bold text-[#111726]">
            {itinerary.title}
          </h4>
          {itinerary.description && (
            <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-relaxed text-text-muted">
              {itinerary.description}
            </p>
          )}
          <div className="mt-3 flex items-center justify-between gap-2 text-[12.5px]">
            <div className="flex items-center gap-1.5 text-text-muted">
              <span className="material-symbols-outlined text-[13px]">
                schedule
              </span>
              {formatDuration(itinerary.estimatedDurationMinutes)} · {itinerary.items.length} điểm
            </div>
            <div className="font-bold text-navy-dark">
              ~{formatCurrencyShort(itinerary.estimatedCostMin)} – {formatCurrencyShort(itinerary.estimatedCostMax)}/người
            </div>
          </div>
          <div className="mt-2 text-[12px] font-bold text-navy">
            {applyingId === itinerary.id ? "Đang tạo bản nháp..." : "Dùng lịch trình này ›"}
          </div>
        </div>
      </button>
      {applyError?.id === itinerary.id && (
        <p role="alert" className="px-1 text-[12.5px] text-error">
          {applyError.message}
          {isDemo && (
            <button type="button" onClick={() => navigate("/login")} className="ml-1 font-bold underline">
              Đăng nhập
            </button>
          )}
        </p>
      )}
    </div>
  );
}
