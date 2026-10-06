import { countFormatter, formatDayLabel, percentFormatter } from "./dashboardUtils";

// Lịch trình đã chốt theo ngày chốt (giờ VN). BE trả đủ mọi ngày, ngày không có = 0.
export default function TripsFinalizedChart({ days, total }) {
  const max = Math.max(1, ...days.map((day) => day.tripsFinalized));
  const peak = days.reduce((best, day) => (day.tripsFinalized > best.tripsFinalized ? day : best), days[0]);
  const middle = days[Math.floor((days.length - 1) / 2)];
  const gap = days.length > 90 ? "gap-px" : days.length > 31 ? "gap-0.5" : "gap-1.5";

  return (
    <div className="mt-4">
      <dl className="flex flex-wrap gap-x-8 gap-y-3">
        <Stat label="Tổng đã chốt" value={`${countFormatter.format(total)} lịch trình`} />
        <Stat label="Trung bình mỗi ngày" value={percentFormatter.format(total / days.length)} />
        <Stat
          label="Ngày cao nhất"
          value={`${countFormatter.format(peak.tripsFinalized)} · ${formatDayLabel(peak.date)}`}
        />
      </dl>

      <p className="mt-5 text-[11px] text-text-faint">{countFormatter.format(max)}</p>
      <div
        role="img"
        aria-label={`Lịch trình đã chốt theo ngày từ ${formatDayLabel(days[0].date)} đến ${formatDayLabel(days.at(-1).date)}, tổng ${countFormatter.format(total)}`}
        className={`mt-1 flex h-48 items-end border-y border-dashed border-[#e3e7f1] ${gap}`}
      >
        {days.map((day) => (
          <div
            key={day.date}
            title={`${formatDayLabel(day.date)}: ${countFormatter.format(day.tripsFinalized)} lịch trình`}
            className={`min-w-0 flex-1 rounded-t-[3px] transition ${
              day.tripsFinalized > 0 ? "bg-navy-mid/80 hover:bg-navy-darkest" : "bg-surface-container-low"
            }`}
            style={{
              height: day.tripsFinalized > 0 ? `${Math.max(3, (day.tripsFinalized / max) * 100)}%` : "2px",
            }}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-text-faint">
        <span>{formatDayLabel(days[0].date)}</span>
        {days.length > 2 && <span>{formatDayLabel(middle.date)}</span>}
        {days.length > 1 && <span>{formatDayLabel(days.at(-1).date)}</span>}
      </div>

      <p className="mt-4 text-xs leading-5 text-text-muted">
        Tính theo ngày chốt, gồm cả lịch trình bị xoá sau khi chốt. Khác với &quot;Lịch trình đã tạo&quot; ở trên,
        vốn đếm mọi lịch trình theo ngày tạo.
      </p>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-bold text-navy-darkest">{value}</dd>
    </div>
  );
}
