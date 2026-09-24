import { formatDistance } from "../../utils/formatCurrency";

export default function PlaceBadges({ place }) {
  const station = place.nearestStation;
  return (
    <div className="flex flex-wrap gap-2">
      {station && (
        <span className="inline-flex items-center gap-1 rounded-full bg-primary-container/20 px-3 py-1 text-label-md text-primary">
          <span className="material-symbols-outlined text-[16px]">train</span>
          {station.stationName} · {formatDistance(station.distanceMeters)}
        </span>
      )}
      {place.isVerified && (
        <span className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-label-md text-on-primary">
          <span className="material-symbols-outlined text-[16px]">verified</span>
          LocalMate Verified
        </span>
      )}
    </div>
  );
}
