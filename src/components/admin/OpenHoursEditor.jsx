import { ADMIN_INPUT, ADMIN_SELECT, ADMIN_TERTIARY_BUTTON } from "./adminStyles";
import { DAYS_OF_WEEK } from "../../utils/openingHours";
import { timeToMinutes } from "../../utils/vnTime";
import { emptyHours, looksLikeOldAllDay } from "./openingHoursRows";

// Mỗi thứ: "unset" (chưa nhập, không gửi lên BE) | "open" (có giờ mở/đóng) | "allDay" (24 giờ) | "closed" (nghỉ cả ngày)
const STATES = [
  { value: "unset", label: "Chưa nhập" },
  { value: "open", label: "Mở cửa" },
  { value: "allDay", label: "Mở cả ngày (24 giờ)" },
  { value: "closed", label: "Nghỉ cả ngày" },
];
// Giờ điền sẵn khi admin chuyển một thứ sang "Mở cửa"
const DEFAULT_OPEN = "08:00";
const DEFAULT_CLOSE = "22:00";

const isOvernight = (r) =>
  r.state === "open" && r.openTime && r.closeTime && timeToMinutes(r.closeTime) < timeToMinutes(r.openTime);

export default function OpenHoursEditor({ value, onChange, errors = {}, disabled = false }) {
  const update = (dayOfWeek, patch) =>
    onChange(value.map((r) => (r.dayOfWeek === dayOfWeek ? { ...r, ...patch } : r)));
  const changeState = (row, state) =>
    update(
      row.dayOfWeek,
      state === "open"
        ? { state, openTime: row.openTime || DEFAULT_OPEN, closeTime: row.closeTime || DEFAULT_CLOSE }
        : { state },
    );
  const monday = value[0];
  const copyMonday = () =>
    onChange(value.map((r) => ({ ...r, state: monday.state, openTime: monday.openTime, closeTime: monday.closeTime })));
  const hasAny = value.some((r) => r.state !== "unset");

  return (
    <div className="space-y-4">
      <p className="text-sm leading-[22px] text-[#5C6B8A]">
        "Chưa nhập" là chưa có dữ liệu, khác với "Nghỉ cả ngày". Quán mở 24 giờ: chọn "Mở cả ngày". Quán đóng sau nửa đêm: nhập giờ đóng nhỏ hơn giờ mở (ví dụ 17:00 → 02:00).
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={disabled || monday.state === "unset"} onClick={copyMonday} className={ADMIN_TERTIARY_BUTTON}>
          Chép Thứ Hai cho cả tuần
        </button>
        <button type="button" disabled={disabled || !hasAny} onClick={() => onChange(emptyHours())} className={ADMIN_TERTIARY_BUTTON}>
          Xoá hết giờ mở cửa
        </button>
      </div>
      <div className="divide-y divide-[#DCE2EE]">
        {DAYS_OF_WEEK.map(({ key, label }) => {
          const row = value.find((r) => r.dayOfWeek === key);
          const error = errors[key];
          const errorId = `hours-${key}-error`;
          return (
            <fieldset key={key} disabled={disabled} className="grid min-w-0 gap-3 py-4 sm:grid-cols-[120px_minmax(0,1fr)]">
              <legend className="float-left text-sm font-semibold text-[#0F2148]">{label}</legend>
              <div className="min-w-0 space-y-3">
                <select
                  aria-label={`Trạng thái ${label}`}
                  value={row.state}
                  onChange={(e) => changeState(row, e.target.value)}
                  className={`${ADMIN_SELECT} !w-full sm:!w-56`}
                >
                  {STATES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                {row.state === "open" && (
                  <div className="grid min-w-0 grid-cols-2 gap-3">
                    <label className="min-w-0 text-xs text-[#5C6B8A]">
                      Giờ mở
                      <input aria-label={`Giờ mở cửa ${label}`} type="time" value={row.openTime}
                        onChange={(e) => update(key, { openTime: e.target.value })}
                        aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} className={`mt-2 ${ADMIN_INPUT}`} />
                    </label>
                    <label className="min-w-0 text-xs text-[#5C6B8A]">
                      Giờ đóng
                      <input aria-label={`Giờ đóng cửa ${label}`} type="time" value={row.closeTime}
                        onChange={(e) => update(key, { closeTime: e.target.value })}
                        aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} className={`mt-2 ${ADMIN_INPUT}`} />
                    </label>
                  </div>
                )}
                {isOvernight(row) && (
                  <p className="text-xs text-[#5C6B8A]">Mở qua đêm, đóng lúc {row.closeTime} sáng hôm sau.</p>
                )}
                {looksLikeOldAllDay(row) && (
                  <p className="text-xs font-medium text-amber-800">
                    00:00 – 23:59 bị hở 1 phút lúc nửa đêm. Nếu quán mở 24 giờ, hãy chọn "Mở cả ngày (24 giờ)".
                  </p>
                )}
                {error && <p id={errorId} className="text-xs font-medium text-red-700">{error}</p>}
              </div>
            </fieldset>
          );
        })}
      </div>
    </div>
  );
}
