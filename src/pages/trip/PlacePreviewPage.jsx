import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import PlaceBadges from "../../components/ui/PlaceBadges";
import { placeService } from "../../services/placeService";
import {
  formatCurrencyShort,
  formatDuration,
} from "../../utils/formatCurrency";
import MapEmbedPreview from "../../components/MapEmbedPreview";
import GoogleMapsButton from "../../components/GoogleMapsButton";
import PlaceReviews, { PlaceRatingSummary } from "../../components/place/PlaceReviews";
import OpeningHoursTable from "../../components/place/OpeningHoursTable";
import { useClock } from "../../hooks/useClock";
import { describeOpenState, getOpenStateNow } from "../../utils/openingHours";
import { weekdayInVietnam } from "../../utils/vnTime";

// Trạng thái "đang mở / đã đóng" tự đổi theo giờ thật
const CLOCK_TICK_MS = 60000;

export default function PlacePreviewPage() {
  const { placeId } = useParams();
  return <PlaceDetail key={placeId} placeId={placeId} />;
}

function PlaceDetail({ placeId }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isFromTimeline = Boolean(location.state?.fromTimeline);

  const [place, setPlace] = useState(null);
  const [loading, setLoading] = useState(true);
  // null = chưa tải xong danh sách quanh ga; trạng thái đang tải suy ra từ đây, không set trong effect
  const [nearbyPlaces, setNearbyPlaces] = useState(null);
  const hasStation = Boolean(place?.nearestStation?.stationId || place?.nearestStation?.stationName);
  const loadingCluster = hasStation && nearbyPlaces === null;
  const clusterPlaces = nearbyPlaces ?? [];
  const now = useClock(CLOCK_TICK_MS);

  useEffect(() => {
    placeService
      .getPlaceById(placeId)
      .then(setPlace)
      .catch(() => setPlace(null))
      .finally(() => setLoading(false));
  }, [placeId]);

  useEffect(() => {
    if (!place?.nearestStation?.stationId && !place?.nearestStation?.stationName) return undefined;

    let cancelled = false;
    placeService
      .getMetroClusters()
      .then((clusters) => {
        if (cancelled) return;
        const cluster = clusters?.find(
          (c) =>
            (place.nearestStation.stationId && c.stationId === place.nearestStation.stationId) ||
            (place.nearestStation.stationName && c.stationName === place.nearestStation.stationName),
        );
        if (cluster?.places) {
          const nearby = cluster.places
            .filter((p) => (p.placeId || p.id) !== place.id)
            .slice(0, 4);
          setNearbyPlaces(nearby);
        } else {
          setNearbyPlaces([]);
        }
      })
      .catch(() => {
        if (!cancelled) setNearbyPlaces([]);
      });

    return () => {
      cancelled = true;
    };
  }, [place]);

  const handlePlanTrip = () => {
    const stationOrder = place?.nearestStation?.stationOrder ?? null;
    navigate("/create", {
      state: {
        destinationStationOrder: stationOrder,
        note: `Ghé thăm ${place.name}`,
        suggestedPlace: {
          id: place.id,
          name: place.name,
          nearestStation: place.nearestStation,
        },
      },
    });
  };

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

  // openingHours cùng khuôn với API admin; hasData false (chưa nhập giờ) thì ẩn cả trạng thái lẫn bảng
  const openNow = describeOpenState(getOpenStateNow(place.openingHours, now));

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
            { icon: "storefront", label: "Giờ mở cửa", value: openNow },
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

        {place.openingHours?.hasData && (
          <section className="space-y-3 border-t border-border-soft pt-5">
            <h3 className="flex items-center gap-2 text-lg font-bold leading-7 text-navy-dark">
              <span aria-hidden="true" className="material-symbols-outlined text-xl text-primary">schedule</span>
              Lịch mở cửa trong tuần
            </h3>
            <OpeningHoursTable openingHours={place.openingHours} today={weekdayInVietnam(now)} />
          </section>
        )}

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

        {/* Gợi ý các địa điểm lân cận cùng cụm ga Metro */}
        {place.nearestStation && (clusterPlaces.length > 0 || loadingCluster) && (
          <div className="min-w-0 space-y-4 border-t border-border-soft pt-5">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-lg font-bold leading-7 text-navy-dark">
                <span aria-hidden="true" className="material-symbols-outlined text-xl text-primary">
                  explore
                </span>
                Địa điểm nổi bật quanh ga {place.nearestStation.stationName}
              </h3>
              <span className="text-xs text-text-muted">Cùng cụm Metro</span>
            </div>

            {loadingCluster ? (
              <p className="text-xs text-text-muted">Đang tải địa điểm lân cận...</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {clusterPlaces.map((spot) => {
                  const spotId = spot.placeId || spot.id;
                  const spotName = spot.placeName || spot.name;
                  return (
                    <button
                      key={spotId}
                      type="button"
                      onClick={() => navigate(`/place/${spotId}`)}
                      className="group flex flex-col text-left rounded-[8px] border border-border-soft bg-white p-2.5 hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy transition-all"
                    >
                      <div className="aspect-[4/3] w-full overflow-hidden rounded-[6px] bg-surface-variant mb-2">
                        {spot.imageUrl ? (
                          <img
                            src={spot.imageUrl}
                            alt={spotName}
                            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                          />
                        ) : (
                          <span className="material-symbols-outlined flex h-full items-center justify-center text-3xl text-navy/30">
                            location_on
                          </span>
                        )}
                      </div>
                      <span
                        title={spotName}
                        className="line-clamp-1 w-full text-sm font-semibold leading-5 text-navy-dark group-hover:text-primary"
                      >
                        {spotName}
                      </span>
                      <span className="line-clamp-1 text-xs text-text-muted">
                        {spot.placeCategory || spot.category}
                      </span>
                      {spot.distanceFromStationMeters != null && (
                        <span className="mt-1 text-[11px] font-medium text-primary">
                          Cách ga {Math.round(spot.distanceFromStationMeters)}m
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

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
          {isFromTimeline ? (
            <>
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
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="min-h-11 min-w-0 flex-1 basis-1/3 rounded-[8px] border border-border-soft bg-white px-3 py-3 text-sm font-semibold leading-5 text-navy hover:bg-chip-bg-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
              >
                Quay lại
              </button>

              <button
                type="button"
                onClick={handlePlanTrip}
                className="min-h-11 min-w-0 flex-1 basis-2/3 flex items-center justify-center gap-2 rounded-[8px] bg-navy px-3 py-3 text-sm font-semibold leading-5 text-white hover:bg-navy-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
              >
                <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
                  train
                </span>
                Lên lịch trình quanh {place.nearestStation?.stationName ? `ga ${place.nearestStation.stationName}` : "khu vực này"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

