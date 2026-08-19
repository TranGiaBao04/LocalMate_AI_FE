import { useNavigate, useParams } from "react-router-dom";
import { mockPlaces } from "../../data/places.mock";
import {
  formatCurrencyShort,
  formatDuration,
  buildGoogleMapsDirectionUrl,
} from "../../utils/formatCurrency";

export default function PlacePreviewPage() {
  const { placeId } = useParams();
  const navigate = useNavigate();
  const place = mockPlaces.find((p) => p.id === placeId);

  if (!place) {
    return (
      <div className="app-shell flex items-center justify-center">
        <p className="text-body-lg text-on-surface-variant">
          Không tìm thấy địa điểm.
        </p>
      </div>
    );
  }

  return (
    <div className="app-shell flex flex-col">
      <header className="app-header flex h-16 items-center gap-3 border-b border-outline-variant/20 px-container-margin py-stack-sm lg:px-8">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full hover:bg-surface-container-high flex items-center justify-center"
        >
          <span className="material-symbols-outlined text-on-surface-variant">
            arrow_back
          </span>
        </button>

        <h1 className="text-title-md font-semibold text-on-surface flex-1 truncate">
          {place.name}
        </h1>

        <span className="px-3 py-1 bg-primary-container/20 text-on-primary-container text-label-md font-bold rounded-full">
          {place.category}
        </span>
      </header>

      <main className="content-shell flex-1 space-y-stack-md px-container-margin pb-32 pt-20 lg:px-8">
        <div className="relative h-48 w-full overflow-hidden rounded-lg bg-surface-container-high lg:h-80">
          {place.imageUrl ? (
            <img
              src={place.imageUrl}
              alt={place.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span
                className="material-symbols-outlined text-primary"
                style={{ fontSize: 72, fontVariationSettings: "'FILL' 1" }}
              >
                place
              </span>
            </div>
          )}

          {place.matchScore && (
            <div className="absolute top-3 right-3 bg-primary text-on-primary px-3 py-1 rounded-full text-label-md font-bold">
              {place.matchScore}% phù hợp
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {[
            { icon: "location_on", label: "Khu vực", value: place.area },
            {
              icon: "train",
              label: "Ga gần nhất",
              value: place.nearestMetroStation,
            },
            {
              icon: "near_me",
              label: "Cách ga",
              value: `${place.distanceFromStationMeters}m`,
            },
            {
              icon: "payments",
              label: "Chi phí",
              value:
                place.estimatedCostMin === 0 && place.estimatedCostMax === 0
                  ? "Miễn phí"
                  : `${formatCurrencyShort(place.estimatedCostMin)}–${formatCurrencyShort(place.estimatedCostMax)}`,
            },
            {
              icon: "schedule",
              label: "Thời gian",
              value: formatDuration(place.suggestedDurationMinutes),
            },
            {
              icon: "wb_sunny",
              label: "Nên đến",
              value: place.bestTimeToVisit,
            },
          ].map((item) => (
            <div key={item.label} className="card flex items-center gap-2 p-3">
              <span className="material-symbols-outlined text-primary text-[20px]">
                {item.icon}
              </span>
              <div>
                <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">
                  {item.label}
                </p>
                <p className="text-body-md font-semibold text-on-surface">
                  {item.value}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {place.tags.map((tag) => (
            <span key={tag} className="chip text-label-md">
              {tag}
            </span>
          ))}
        </div>

        <div className="card space-y-stack-sm">
          <h3 className="text-title-md font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">
              auto_awesome
            </span>
            Vì sao LocalMate đề xuất?
          </h3>

          <ul className="space-y-2">
            {place.insights.map((insight, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-body-md text-on-surface-variant"
              >
                <span
                  className="material-symbols-outlined text-primary-container text-[16px] mt-0.5 flex-shrink-0"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  check_circle
                </span>
                {insight}
              </li>
            ))}
          </ul>
        </div>

        {place.notes.length > 0 && (
          <div className="card border-tertiary-container/30 bg-tertiary-container/10 space-y-2">
            <h3 className="text-label-md font-bold text-tertiary uppercase tracking-wider flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">
                info
              </span>
              Lưu ý
            </h3>

            {place.notes.map((note, i) => (
              <p key={i} className="text-body-md text-on-surface-variant">
                • {note}
              </p>
            ))}
          </div>
        )}
      </main>

      <div className="app-footer space-y-2 border-t border-outline-variant/20 px-container-margin py-stack-md lg:px-8">
        <a
          href={buildGoogleMapsDirectionUrl(place.latitude, place.longitude)}
          target="_blank"
          rel="noreferrer"
          className="btn-ghost flex items-center justify-center gap-2 py-3 rounded-full"
        >
          <span className="material-symbols-outlined text-[18px]">map</span>
          Mở Google Maps
        </a>

        <div className="flex gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex-1 py-3 border border-primary text-primary rounded-full font-semibold text-button active:scale-95 transition-all"
          >
            Giữ trong lịch trình
          </button>

          <button
            onClick={() => navigate(-1)}
            className="flex-1 py-3 bg-primary text-on-primary rounded-full font-semibold text-button active:scale-95 transition-all shadow-lg shadow-primary/30"
          >
            Quay lại timeline
          </button>
        </div>
      </div>
    </div>
  );
}
