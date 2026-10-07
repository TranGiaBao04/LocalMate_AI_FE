import DailyDataDisclosure from "./DailyDataDisclosure";
import { countFormatter, formatDayLabel, vndFormatter } from "./dashboardUtils";

// Doanh thu theo ngày thanh toán (PaidAt). BE trả đủ mọi ngày, ngày không có đơn = 0.
export default function RevenueChart({ days, totalRevenue }) {
  const max = Math.max(1, ...days.map((day) => day.revenue));
  const totalOrders = days.reduce((sum, day) => sum + day.paidOrders, 0);
  const peak = days.reduce((best, day) => (day.revenue > best.revenue ? day : best), days[0]);
  const middle = days[Math.floor((days.length - 1) / 2)];
  const gap = days.length > 90 ? "gap-px" : days.length > 31 ? "gap-0.5" : "gap-1.5";

  return (
    <div className="mt-4">
      <dl className="flex flex-wrap gap-x-8 gap-y-3">
        <Stat label="Tổng doanh thu" value={vndFormatter.format(totalRevenue)} />
        <Stat label="Đơn đã thanh toán" value={countFormatter.format(totalOrders)} />
        <Stat label="Ngày cao nhất" value={`${vndFormatter.format(peak.revenue)} · ${formatDayLabel(peak.date)}`} />
      </dl>

      <p className="mt-5 text-xs text-[#5C6B8A]">{vndFormatter.format(max)}</p>
      <div
        role="img"
        aria-label={`Doanh thu theo ngày từ ${formatDayLabel(days[0].date)} đến ${formatDayLabel(days.at(-1).date)}, tổng ${vndFormatter.format(totalRevenue)}`}
        className={`mt-1 flex h-48 items-end border-y border-dashed border-[#DCE2EE] ${gap}`}
      >
        {days.map((day) => (
          <div
            key={day.date}
            title={`${formatDayLabel(day.date)}: ${vndFormatter.format(day.revenue)} · ${day.paidOrders} đơn`}
            className={`min-w-0 flex-1 rounded-t-[4px] transition-colors motion-reduce:transition-none ${
              day.revenue > 0 ? "bg-[#2C56A8] hover:bg-[#1D3E82]" : "bg-[#F4F6FA]"
            }`}
            style={{ height: day.revenue > 0 ? `${Math.max(3, (day.revenue / max) * 100)}%` : "2px" }}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-[#5C6B8A]">
        <span>{formatDayLabel(days[0].date)}</span>
        {days.length > 2 && <span>{formatDayLabel(middle.date)}</span>}
        {days.length > 1 && <span>{formatDayLabel(days.at(-1).date)}</span>}
      </div>

      <DailyDataDisclosure days={days} revenue />

      <p className="mt-4 text-xs leading-5 text-[#5C6B8A]">
        Tính theo ngày thanh toán, chưa trừ phí PayOS. Màn Giao dịch lọc theo ngày tạo đơn nên số có thể khác.
      </p>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <dt className="text-xs text-[#5C6B8A]">{label}</dt>
      <dd className="mt-0.5 text-sm font-bold text-[#0F2148]">{value}</dd>
    </div>
  );
}
