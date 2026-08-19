import { useNavigate } from "react-router-dom";
import { useTrip } from "../../context/TripContext";
import MobileLayout from "../../components/layout/MobileLayout";
import { mockPlaces } from "../../data/places.mock";
import {
  formatCurrencyShort,
  formatRelativeTime,
} from "../../utils/formatCurrency";

const STATUS_CONFIG = {
  draft: { label: "Nháp", color: "bg-tertiary-container/30 text-tertiary" },
  finalized: { label: "Đã chốt", color: "bg-primary/10 text-primary" },
  upcoming: {
    label: "Sắp đi",
    color: "bg-secondary-container/20 text-secondary",
  },
  completed: {
    label: "Đã đi",
    color: "bg-surface-container-high text-on-surface-variant",
  },
};

export default function MyTripsPage() {
  const navigate = useNavigate();
  const { savedTrips, deleteTrip } = useTrip();

  return (
    <MobileLayout>
      <header className="app-header flex h-16 items-center justify-between border-b border-outline-variant/20 px-container-margin py-stack-sm lg:px-8">
        <h1 className="text-headline-lg-mobile font-extrabold text-primary">
          My Trips
        </h1>

        <button
          onClick={() => navigate("/create")}
          className="flex items-center gap-1 px-4 py-2 bg-primary text-on-primary rounded-full text-label-md font-bold active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
          Tạo mới
        </button>
      </header>

      <main className="content-shell flex-1 space-y-stack-md px-container-margin pb-28 pt-20 lg:px-8 lg:pb-12">
        {savedTrips.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <span
              className="material-symbols-outlined text-outline-variant"
              style={{ fontSize: 72 }}
            >
              luggage
            </span>
            <p className="text-body-lg text-on-surface-variant text-center">
              Bạn chưa lưu lịch trình nào.
            </p>
            <button
              onClick={() => navigate("/create")}
              className="btn-primary w-auto px-8"
            >
              Tạo lịch trình
            </button>
          </div>
        ) : (
          <>
            <p className="text-body-md text-on-surface-variant">
              {savedTrips.length} lịch trình
            </p>

            <div className="grid gap-stack-md lg:grid-cols-2">
            {savedTrips.map((trip) => {
              const statusCfg = STATUS_CONFIG[trip.status];
              const coverPlace = mockPlaces.find(
                (place) => place.id === trip.items[0]?.placeId,
              );

              return (
                <div
                  key={trip.id}
                  className="card space-y-stack-sm active:scale-[0.98] transition-transform cursor-pointer"
                  onClick={() => navigate(`/trips/${trip.id}`)}
                >
                  {coverPlace?.imageUrl && (
                    <img
                      src={coverPlace.imageUrl}
                      alt={coverPlace.name}
                      className="h-40 w-full rounded-lg object-cover"
                    />
                  )}

                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-body-md font-bold text-on-surface truncate">
                        {trip.title}
                      </h3>
                      <p className="text-label-md text-on-surface-variant mt-0.5">
                        {trip.mainArea}
                      </p>
                    </div>

                    <span
                      className={`px-3 py-1 rounded-full text-label-md font-bold ml-2 flex-shrink-0 ${statusCfg.color}`}
                    >
                      {statusCfg.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="flex items-center gap-1 text-label-md text-on-surface-variant">
                      <span className="material-symbols-outlined text-[14px]">
                        schedule
                      </span>
                      {trip.durationHours} tiếng
                    </span>

                    <span className="flex items-center gap-1 text-label-md text-on-surface-variant">
                      <span className="material-symbols-outlined text-[14px]">
                        payments
                      </span>
                      ~{formatCurrencyShort(trip.estimatedBudget)}/người
                    </span>

                    <span className="flex items-center gap-1 text-label-md text-on-surface-variant">
                      <span className="material-symbols-outlined text-[14px]">
                        place
                      </span>
                      {trip.items.length} địa điểm
                    </span>

                    {trip.metroFriendly && (
                      <span className="flex items-center gap-1 text-label-md text-secondary">
                        <span className="material-symbols-outlined text-[14px]">
                          train
                        </span>
                        Metro
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-outline-variant/20">
                    <span className="text-label-md text-on-surface-variant">
                      {formatRelativeTime(trip.createdAt)}
                    </span>

                    <div
                      className="flex gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => navigate(`/trips/${trip.id}`)}
                        className="px-3 py-1.5 bg-primary text-on-primary rounded-full text-label-md font-bold active:scale-95 transition-all"
                      >
                        Xem
                      </button>

                      <button
                        onClick={() => deleteTrip(trip.id)}
                        className="px-3 py-1.5 border border-error/30 text-error rounded-full text-label-md font-bold active:scale-95 transition-all hover:bg-error-container"
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            </div>
          </>
        )}
      </main>
    </MobileLayout>
  );
}
