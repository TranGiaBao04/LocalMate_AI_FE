import { countFormatter, formatDayLabel, vndFormatter } from "./dashboardUtils";

export default function DailyDataDisclosure({ days, revenue = false }) {
  return (
    <details className="mt-4 border-t border-[#DCE2EE] pt-2">
      <summary className="min-h-11 cursor-pointer rounded-[8px] py-3 text-sm font-semibold text-[#1D3E82] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2C56A8]">
        Dữ liệu theo ngày
      </summary>
      <div className="max-h-64 overflow-auto rounded-[8px] border border-[#DCE2EE]" tabIndex={0}
        role="region" aria-label={revenue ? "Bảng doanh thu theo ngày" : "Bảng lịch trình đã chốt theo ngày"}>
        <table className="w-full text-left text-xs leading-[18px]">
          <caption className="sr-only">{revenue ? "Doanh thu theo ngày thanh toán" : "Lịch trình theo ngày chốt"}, giờ Việt Nam</caption>
          <thead className="sticky top-0 bg-[#F8FAFC] text-[#5C6B8A]">
            <tr><th scope="col" className="px-3 py-3">Ngày</th>
              <th scope="col" className="px-3 py-3 text-right">{revenue ? "Doanh thu" : "Đã chốt"}</th>
              {revenue && <th scope="col" className="px-3 py-3 text-right">Đơn</th>}</tr>
          </thead>
          <tbody>{days.map((day) => <tr key={day.date} className="border-t border-[#DCE2EE]">
            <th scope="row" className="px-3 py-3 font-medium">{formatDayLabel(day.date)}</th>
            <td className="px-3 py-3 text-right tabular-nums">{revenue ? vndFormatter.format(day.revenue) : countFormatter.format(day.tripsFinalized)}</td>
            {revenue && <td className="px-3 py-3 text-right tabular-nums">{countFormatter.format(day.paidOrders)}</td>}
          </tr>)}</tbody>
        </table>
      </div>
    </details>
  );
}
