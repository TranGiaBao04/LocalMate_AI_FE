import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import PlaceBadges from "../../components/ui/PlaceBadges";
import { placeService } from "../../services/placeService";
import {
  formatCurrencyShort,
  formatDuration,
} from "../../utils/formatCurrency";
import MapEmbedPreview from "../../components/MapEmbedPreview";
import GoogleMapsButton from "../../components/GoogleMapsButton";
import PlaceReviews, { PlaceRatingSummary } from "../../components/place/PlaceReviews";

export default function PlacePreviewPage() {
  const { placeId } = useParams();
  return <PlaceDetail key={placeId} placeId={placeId} />;
}

function PlaceDetail({ placeId }) {
  const navigate = useNavigate();
  const [place, setPlace] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    placeService
      .getPlaceById(placeId)
      .then(setPlace)
      .catch(() => setPlace(null))
      .finally(() => setLoading(false));
  }, [placeId]);

  if (loading) {
    return (
      <div className="app-shell flex items-center justify-center">
        <p role="status" className="px-5 text-sm leading-6 text-text-muted">Đang tải...</p>
      </div>
    );
  }

  if (!place) {
    return (
      <div className="app-shell flex items-center justify-center">
        <p className="px-5 text-sm leading-6 text-text-muted">
          Không tìm thấy địa điểm.
        </p>
      </div>
    );
  }

  return (
    <div className="app-shell flex flex-col">
      <header className="app-header flex h-16 items-center gap-3 border-b border-border-soft px-container-margin lg:px-8">
        <button
          type="button"
          aria-label="Quay lại"
          onClick={() => navigate(-1)}
          className="flex h-11 w-11 flex-none items-center justify-center rounded-[8px] text-navy hover:bg-chip-bg-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
        >
          <span aria-hidden="true" className="material-symbols-outlined">
            arrow_back
          </span>
        </button>

        <h1 title={place.name} className="min-w-0 flex-1 truncate text-lg font-semibold leading-7 text-navy-dark">
          {place.name}
        </h1>

        <span title={place.category} className="max-w-[112px] flex-none rounded-[8px] bg-chip-bg-alt px-2 py-1 text-xs font-medium leading-5 text-navy">
          <span className="line-clamp-2 break-words">
          {place.category}
          </span>
        </span>
      </header>

      <main className="content-shell min-w-0 max-w-none flex-1 space-y-6 px-container-margin pb-60 pt-20 lg:px-8 2xl:max-w-[1680px]">
        <div className="relative h-48 w-full overflow-hidden rounded-[8px] bg-surface-variant lg:h-80">
          {place.imageUrl ? (
            <img
              src={place.imageUrl}
              alt={place.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span
                aria-hidden="true"
                className="material-symbols-outlined text-primary"
                style={{ fontSize: 72, fontVariationSettings: "'FILL' 1" }}
              >
                place
              </span>
            </div>
          )}

          {place.matchScore && (
            <div className="absolute right-3 top-3 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-on-primary">
              {place.matchScore}% phù hợp
            </div>
          )}
        </div>

        <h2 className="break-words text-2xl font-bold leading-8 text-navy-dark">{place.name}</h2>
        <PlaceBadges place={place} />
        <PlaceRatingSummary averageRating={place.averageRating} reviewCount={place.reviewCount} />

        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 border-y border-border-soft py-5 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { icon: "location_on", label: "Địa chỉ", value: place.address },
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
              value: place.suggestedDurationMinutes
                ? formatDuration(place.suggestedDurationMinutes)
                : null,
            },
            {
              icon: "wb_sunny",
              label: "Nên đến",
              value: place.bestTimeToVisit,
            },
          ]
            .filter((item) => item.value)
            .map((item) => (
              <div
                key={item.label}
                className="min-w-0"
              >
                  <dt className="flex items-center gap-2 text-xs leading-5 text-text-muted">
                    <span aria-hidden="true" className="material-symbols-outlined flex-none text-xl text-primary">{item.icon}</span>
                    {item.label}
                  </dt>
                  <dd className="mt-1 break-words text-sm font-medium leading-6 text-navy-dark">
                    {item.value}
                  </dd>
              </div>
            ))}
        </dl>

        {place.description && (
          <p className="whitespace-pre-line break-words text-sm leading-7 text-text-muted">
            {place.description}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {place.tags.map((tag) => (
            <span key={tag.id} className="max-w-full break-words rounded-full border border-border-soft bg-white px-3 py-1.5 text-xs leading-5 text-navy">
              {tag.name}
            </span>
          ))}
        </div>

        {place.insights?.length > 0 && (
          <div className="space-y-4 border-t border-border-soft pt-5">
            <h3 className="flex items-start gap-2 text-lg font-bold leading-7 text-navy-dark">
              <span aria-hidden="true" className="material-symbols-outlined flex-none text-xl text-primary">
                auto_awesome
              </span>
              Vì sao LocalMate đề xuất?
            </h3>

            <ul className="space-y-2">
              {place.insights.map((insight, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 break-words text-sm leading-6 text-text-muted"
                >
                  <span
                    aria-hidden="true"
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
        )}

        {place.notes?.length > 0 && (
          <div className="space-y-3 rounded-[8px] border border-tertiary-container/40 bg-tertiary-container/10 p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-on-tertiary-container">
              <span aria-hidden="true" className="material-symbols-outlined text-lg">
                info
              </span>
              Lưu ý
            </h3>

            {place.notes.map((note, i) => (
              <p key={i} className="break-words text-sm leading-6 text-on-surface-variant">
                • {note}
              </p>
            ))}
          </div>
        )}

        {/* SPEC-03 / FE-68: Nhúng Google Maps Preview */}
        <div className="min-w-0 space-y-4">
          <h3 className="flex items-center gap-2 text-lg font-bold leading-7 text-navy-dark">
            <span aria-hidden="true" className="material-symbols-outlined text-xl text-primary">
              map
            </span>
            Vị trí trên bản đồ
          </h3>
          <MapEmbedPreview
            lat={place.latitude}
            lng={place.longitude}
            placeName={place.name}
            googlePlaceId={place.googlePlaceId}
            address={place.area}
            initExpanded={true}
          />
        </div>

        <PlaceReviews
          placeId={placeId}
          averageRating={place.averageRating}
          reviewCount={place.reviewCount}
        />
      </main>

      <div className="app-footer space-y-3 border-t border-border-soft px-container-margin py-3 lg:px-8">
        {/* SPEC-03 / FE-65 & FE-67: chỉ đường từ vị trí hiện tại của người dùng tới địa điểm */}
        <GoogleMapsButton
          destLat={place.latitude}
          destLng={place.longitude}
          destName={place.name}
          destPlaceId={place.googlePlaceId}
          variant="primary"
          size="lg"
          className="min-h-11 w-full !rounded-[8px] text-sm !shadow-none motion-reduce:transition-none motion-reduce:transform-none"
        >
          Mở Google Maps chỉ đường
        </GoogleMapsButton>

        <div className="flex items-stretch gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="min-h-11 min-w-0 flex-1 rounded-[8px] border border-border-soft bg-white px-3 py-3 text-sm font-semibold leading-5 text-navy hover:bg-chip-bg-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
          >
            Giữ trong lịch trình
          </button>

          <button
            type="button"
            onClick={() => navigate(-1)}
            className="min-h-11 min-w-0 flex-1 rounded-[8px] bg-navy px-3 py-3 text-sm font-semibold leading-5 text-white hover:bg-navy-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
          >
            Quay lại timeline
          </button>
        </div>
      </div>
    </div>
  );
}
