import { EmptyState } from "../ui";
import { countFormatter, formatDayLabel } from "./dashboardUtils";

const columns = [["calls", "Lượt gọi"], ["succeeded", "Thành công"], ["failed", "Thất bại"],
  ["inputTokens", "Token vào"], ["outputTokens", "Token ra"], ["activeUsers", "Người dùng"]];
const dateLabel = (date) => `${formatDayLabel(date)}/${date.slice(0, 4)}`;

export default function AiUsageDailyChart({ days }) {
  if (!days.length) return <EmptyState density="compact" title="Chưa có dữ liệu theo ngày" />;
  const max = Math.max(1, ...days.map((day) => day.calls));
  return (
    <div className="mt-4 min-w-0">
      <div role="img" aria-label={`Lượt gọi AI theo ngày từ ${dateLabel(days[0].date)} đến ${dateLabel(days.at(-1).date)}, giờ Việt Nam`}
        className={`flex h-40 min-w-0 items-end border-y border-dashed border-[#DCE2EE] ${days.length > 90 ? "gap-0" : "gap-px"}`}>
        {days.map((day) => <div key={day.date} title={`${day.date}: ${countFormatter.format(day.calls)} lượt gọi`}
          className={`min-w-0 flex-1 rounded-t-[2px] ${day.calls > 0 ? "bg-[#2C56A8]" : "bg-[#E9EDF5]"}`}
          style={{ height: day.calls > 0 ? `${Math.max(2, day.calls / max * 100)}%` : "2px" }} />)}
      </div>
      <div className="mt-2 flex justify-between gap-2 text-xs text-[#5C6B8A]">
        <span>{dateLabel(days[0].date)}</span><span>{dateLabel(days.at(-1).date)}</span>
      </div>
      <details className="mt-4 min-w-0 border-t border-[#DCE2EE]">
        <summary className="min-h-11 cursor-pointer rounded-[8px] py-3 text-sm font-semibold text-[#1D3E82] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2C56A8]">Dữ liệu AI theo ngày</summary>
        <div role="region" aria-label="Bảng lượt dùng AI theo ngày" tabIndex={0}
          className="max-h-64 max-w-full overflow-auto rounded-[8px] border border-[#DCE2EE] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2C56A8]">
          <table className="w-full text-left text-xs leading-[18px]">
            <caption className="sr-only">Thống kê AI theo ngày Việt Nam</caption>
            <thead className="sticky top-0 bg-[#F8FAFC] text-[#5C6B8A]"><tr>
              <th scope="col" className="px-3 py-3">Ngày</th>
              {columns.map(([key, label]) => <th key={key} scope="col" className="px-3 py-3 text-right">{label}</th>)}
            </tr></thead>
            <tbody>{days.map((day) => <tr key={day.date} className="border-t border-[#DCE2EE]">
              <th scope="row" className="whitespace-nowrap px-3 py-3 font-medium"><time dateTime={day.date}>{dateLabel(day.date)}</time></th>
              {columns.map(([key]) => <td key={key} className="px-3 py-3 text-right tabular-nums">{typeof day[key] === "number" ? countFormatter.format(day[key]) : "—"}</td>)}
            </tr>)}</tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
