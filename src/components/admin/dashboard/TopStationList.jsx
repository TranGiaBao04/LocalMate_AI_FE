import { countFormatter, percentFormatter } from "./dashboardUtils";

// Ga của 1 lịch trình = ga gần điểm xuất phát nhất. sharePercent tính trên tổng lịch trình của mọi ga,
// nên khi chỉ lấy top N thì tổng % hiển thị < 100.
export default function TopStationList({ stations, totalTrips }) {
  const max = Math.max(1, ...stations.map((station) => station.tripCount));

  return (
    <>
      <ol className="mt-4 space-y-3">
        {stations.map((station, index) => (
          <li key={station.order} className="flex items-center gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-surface-container-low text-xs font-bold text-navy-darkest">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-semibold text-on-surface">{station.name}</p>
                <span className="shrink-0 text-sm">
                  <span className="font-bold text-navy-darkest">{countFormatter.format(station.tripCount)}</span>
                  <span className="ml-1.5 text-xs text-text-muted">{percentFormatter.format(station.sharePercent)}%</span>
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-container-low">
                <div className="h-full rounded-full bg-navy-mid" style={{ width: `${(station.tripCount / max) * 100}%` }} />
              </div>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-xs leading-5 text-text-muted">
        {countFormatter.format(totalTrips)} lịch trình trong khoảng này. Ga của lịch trình là ga gần điểm xuất phát nhất.
      </p>
    </>
  );
}
