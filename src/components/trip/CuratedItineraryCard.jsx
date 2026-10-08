import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { formatCurrencyShort, formatDuration } from "../../utils/formatCurrency";

export default function CuratedItineraryCard({ itinerary, applyingId, applyError, onApply }) {
  const navigate = useNavigate();
  const { isDemo } = useAuth();

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <button
        type="button"
        onClick={() => onApply(itinerary)}
        disabled={applyingId !== null}
        aria-busy={applyingId === itinerary.id}
        className="group flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-[8px] border border-border-soft bg-white text-left transition-colors hover:border-navy/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy disabled:cursor-wait disabled:opacity-70 motion-reduce:transition-none"
      >
        <div className="aspect-[16/10] w-full flex-none overflow-hidden bg-surface-variant">
          {itinerary.coverImageUrl ? (
            <img
              src={itinerary.coverImageUrl}
              alt=""
              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105 motion-reduce:transform-none motion-reduce:transition-none"
            />
          ) : (
            <span aria-hidden="true" className="material-symbols-outlined flex h-full items-center justify-center text-4xl text-navy/30">route</span>
          )}
        </div>
        <div className="flex w-full min-w-0 flex-1 flex-col p-5">
          {itinerary.stationName && (
            <span className="mb-2 flex items-start gap-1.5 break-words text-xs font-medium leading-5 text-navy">
              <span aria-hidden="true" className="material-symbols-outlined flex-none text-base">train</span>
              Ga {itinerary.stationName}
            </span>
          )}
          <h4 title={itinerary.title} className="line-clamp-2 break-words text-base font-bold leading-6 text-navy-dark">
            {itinerary.title}
          </h4>
          {itinerary.description && (
            <p title={itinerary.description} className="mt-2 line-clamp-2 break-words text-sm leading-6 text-text-muted">
              {itinerary.description}
            </p>
          )}
          <div className="mt-auto space-y-3 pt-5 text-sm">
            <div className="flex flex-wrap items-center gap-1.5 text-text-muted">
              <span aria-hidden="true" className="material-symbols-outlined text-lg">
                schedule
              </span>
              {formatDuration(itinerary.estimatedDurationMinutes)} · {itinerary.items.length} điểm
            </div>
            <div className="border-t border-border-soft pt-3">
              <span className="mb-1 block text-xs leading-5 text-text-muted">Chi phí ước tính</span>
              <span className="block break-words font-semibold leading-6 text-navy-dark">~{formatCurrencyShort(itinerary.estimatedCostMin)} – {formatCurrencyShort(itinerary.estimatedCostMax)}/người</span>
            </div>
          </div>
          <div className="mt-4 flex min-h-11 items-center justify-center rounded-[8px] bg-chip-bg-alt px-3 py-2 text-center text-sm font-semibold text-navy group-hover:bg-navy group-hover:text-white">
            {applyingId === itinerary.id ? "Đang tạo bản nháp..." : "Dùng lịch trình này ›"}
          </div>
        </div>
      </button>
      {applyError?.id === itinerary.id && (
        <p role="alert" className="break-words px-1 text-sm leading-6 text-error">
          {applyError.message}
          {isDemo && (
            <button type="button" onClick={() => navigate("/login")} className="ml-1 inline-flex min-h-11 items-center rounded-[8px] px-2 font-semibold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy">
              Đăng nhập
            </button>
          )}
        </p>
      )}
    </div>
  );
}
