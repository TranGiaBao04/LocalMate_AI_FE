import { StatusBadge } from "../ui";
import { countFormatter, formatMonthLabel, percentFormatter, vndFormatter } from "./dashboardUtils";

// Doanh thu tháng so với mốc hoà vốn. `target` luôn đọc từ API (BE đang để số tạm).
// progressPercent có thể > 100 khi vượt mục tiêu ⇒ thanh giới hạn ở 100%.
export default function BreakEvenCard({ data }) {
  const progressWidth = Math.min(100, Math.max(0, data.progressPercent));
  const monthEnded = data.daysElapsed >= data.daysInMonth;
  // Mức cần đạt nếu chia đều mục tiêu theo số ngày đã qua
  const pacePercent = (data.daysElapsed / data.daysInMonth) * 100;

  return (
    <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:items-center">
      <div>
        <p className="text-xs font-semibold text-[#5C6B8A]">
          Doanh thu tháng {formatMonthLabel(data.month)}
        </p>
        <p className="mt-2 flex flex-wrap items-baseline gap-x-2">
          <span className="text-[28px] font-bold leading-tight text-[#0F2148]">{vndFormatter.format(data.revenue)}</span>
          <span className="text-sm font-medium text-[#5C6B8A]">/ {vndFormatter.format(data.target)}</span>
        </p>
        <div className="mt-3"><StatusBadge variant={data.isAchieved ? "success" : "warning"} icon={data.isAchieved ? "task_alt" : "flag"}
          label={data.isAchieved ? "Đã hoà vốn" : `Còn thiếu ${vndFormatter.format(data.remaining)}`} /></div>
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="font-semibold text-[#0F2148]">{percentFormatter.format(data.progressPercent)}% mục tiêu</span>
          <span className="text-[#5C6B8A]">Ngày {data.daysElapsed}/{data.daysInMonth}</span>
        </div>
        <div
          role="progressbar"
          aria-label="Tiến độ hoà vốn"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progressWidth)}
          className="relative mt-2 h-3 rounded-full bg-[#F4F6FA]"
        >
          <div
            className={`h-full rounded-full ${data.isAchieved ? "bg-emerald-500" : "bg-[#2C56A8]"}`}
            style={{ width: `${progressWidth}%` }}
          />
          {!monthEnded && (
            <span
              title="Mức cần đạt theo số ngày đã qua"
              className="absolute -top-1 h-5 w-0.5 rounded-full bg-[#0F2148]/40"
              style={{ left: `${pacePercent}%` }}
            />
          )}
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Item label="Đơn đã thanh toán" value={countFormatter.format(data.paidOrders)} />
          <Item
            label={monthEnded ? "Doanh thu cả tháng" : "Dự kiến cuối tháng"}
            value={vndFormatter.format(monthEnded ? data.revenue : data.projected)}
          />
          <Item label="Mục tiêu tháng" value={vndFormatter.format(data.target)} />
        </dl>
        {!monthEnded && (
          <p className="mt-3 text-xs leading-5 text-[#5C6B8A]">
            Vạch đứng là mức cần đạt nếu chia đều mục tiêu theo ngày. Dự kiến tính theo tốc độ hiện tại.
          </p>
        )}
      </div>
    </div>
  );
}

function Item({ label, value }) {
  return (
    <div>
      <dt className="text-xs text-[#5C6B8A]">{label}</dt>
      <dd className="mt-0.5 text-sm font-bold text-[#0F2148]">{value}</dd>
    </div>
  );
}
