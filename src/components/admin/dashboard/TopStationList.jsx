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
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] bg-[#F4F6FA] text-xs font-bold text-[#0F2148]">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="break-words text-sm font-semibold text-[#0F2148]">{station.name}</p>
                <span className="shrink-0 text-sm">
                  <span className="font-bold text-[#0F2148]">{countFormatter.format(station.tripCount)}</span>
                  <span className="ml-1.5 text-xs text-[#5C6B8A]">{percentFormatter.format(station.sharePercent)}%</span>
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#F4F6FA]">
                <div className="h-full rounded-full bg-[#2C56A8]" style={{ width: `${(station.tripCount / max) * 100}%` }} />
              </div>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-xs leading-5 text-[#5C6B8A]">
        {countFormatter.format(totalTrips)} lịch trình trong khoảng này. Ga của lịch trình là ga gần điểm xuất phát nhất.
      </p>
    </>
  );
}
