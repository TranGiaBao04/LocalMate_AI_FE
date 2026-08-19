import { useNavigate, useParams } from "react-router-dom";
import { mockPlaces } from "../../data/places.mock";
import { useTrip } from "../../context/TripContext";
import { formatCurrencyShort } from "../../utils/formatCurrency";

export default function ReplacePlacePage() {
  const { itemId } = useParams();
  const navigate = useNavigate();
  const { currentTrip, replaceItem } = useTrip();

  const currentItem = currentTrip?.items.find((i) => i.id === itemId);
  const alternatives = mockPlaces
    .filter((p) => p.id !== currentItem?.placeId && p.isActive)
    .slice(0, 5);

  const handleReplace = (placeId) => {
    if (currentTrip && itemId) {
      replaceItem(currentTrip.id, itemId, placeId);
      navigate("/draft");
    }
  };

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

        <div>
          <h1 className="text-title-md font-semibold text-on-surface">
            Thay thế địa điểm
          </h1>
          {currentItem && (
            <p className="text-label-md text-on-surface-variant">
              {currentItem.placeName}
            </p>
          )}
        </div>
      </header>

      <main className="content-shell flex-1 space-y-stack-md px-container-margin pb-8 pt-20 lg:px-8">
        <p className="text-body-md text-on-surface-variant mt-stack-md">
          Các gợi ý tương tự, phù hợp với lịch trình hiện tại:
        </p>

        <div className="grid gap-stack-md lg:grid-cols-2">
        {alternatives.map((place) => (
          <div key={place.id} className="card space-y-stack-sm">
            {place.imageUrl && (
              <img
                src={place.imageUrl}
                alt={place.name}
                className="h-36 w-full rounded-lg object-cover"
              />
            )}
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-body-md font-bold text-on-surface">
                  {place.name}
                </h3>
                <p className="text-label-md text-on-surface-variant">
                  {place.area} · Ga {place.nearestMetroStation}
                </p>
              </div>

              <span className="px-2 py-0.5 bg-primary-container/15 text-on-primary-container text-[10px] rounded-full font-bold ml-2">
                {place.category}
              </span>
            </div>

            <div className="flex items-center gap-4 text-on-surface-variant">
              <span className="flex items-center gap-1 text-label-md">
                <span className="material-symbols-outlined text-[14px]">
                  payments
                </span>
                {formatCurrencyShort(place.estimatedCostMin)}–
                {formatCurrencyShort(place.estimatedCostMax)}
              </span>

              {place.matchScore && (
                <span className="flex items-center gap-1 text-label-md text-primary font-bold">
                  {place.matchScore}% phù hợp
                </span>
              )}
            </div>

            <p className="text-label-md text-on-surface-variant italic">
              "{place.insights[0]}"
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => navigate(`/place/${place.id}`)}
                className="flex-1 py-2 border border-outline-variant text-on-surface-variant rounded-full text-label-md font-bold active:scale-95 transition-all hover:border-primary hover:text-primary"
              >
                Xem thông tin
              </button>

              <button
                onClick={() => handleReplace(place.id)}
                className="flex-1 py-2 bg-primary text-on-primary rounded-full text-label-md font-bold active:scale-95 transition-all"
              >
                Chọn địa điểm này
              </button>
            </div>
          </div>
        ))}
        </div>
      </main>
    </div>
  );
}
