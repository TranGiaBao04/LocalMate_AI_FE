import { useState } from "react";
import { todayInVietnam } from "../../../utils/vnTime";
import { RANGE_PRESETS, validateRange } from "./dashboardUtils";

const INPUT_CLASS =
  "h-10 rounded-[10px] border bg-white px-3 text-sm text-on-surface outline-none transition focus:border-navy-mid focus:ring-4 focus:ring-[#dde1ff]/60";

// Khoảng ngày cho KPI, biểu đồ doanh thu, top ga. "Tùy chọn" chỉ gọi API khi bấm Áp dụng và đã
// qua kiểm tra; serverErrors là lỗi 400 BE trả theo ô ({ from, to }).
export default function DashboardRangeFilter({ preset, range, serverErrors, onPresetChange, onApplyCustom }) {
  const [draft, setDraft] = useState(range);
  const [clientErrors, setClientErrors] = useState({});
  const today = todayInVietnam();
  // Ô đã sửa (clientErrors[field] = undefined) thì bỏ lỗi cũ của BE
  const errors = { ...serverErrors, ...clientErrors };
  const serverMessages = Object.values(serverErrors ?? {}).filter(Boolean);

  const selectPreset = (key) => {
    setClientErrors({});
    // Mở "Tùy chọn" từ khoảng đang xem để chỉ cần sửa 1 đầu
    if (key === "custom") setDraft(range);
    onPresetChange(key);
  };

  const updateDraft = (field) => (event) => {
    setDraft((current) => ({ ...current, [field]: event.target.value }));
    setClientErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleApply = (event) => {
    event.preventDefault();
    const nextErrors = validateRange(draft, today);
    setClientErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) onApplyCustom(draft);
  };

  return (
    <div className="flex flex-col items-stretch gap-3 sm:items-end">
      <div role="group" aria-label="Khoảng thời gian" className="inline-flex w-fit flex-wrap rounded-[10px] bg-surface-container-low p-1">
        {RANGE_PRESETS.map((option) => (
          <button
            key={option.key}
            type="button"
            aria-pressed={preset === option.key}
            onClick={() => selectPreset(option.key)}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${
              preset === option.key ? "bg-white text-navy-darkest shadow-sm" : "text-text-muted hover:text-navy-darkest"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {preset === "custom" ? (
        <form onSubmit={handleApply} noValidate className="flex flex-wrap items-start gap-2">
          <DateField
            id="dashboard-from"
            label="Từ ngày"
            value={draft.from}
            max={draft.to || today}
            error={errors.from}
            onChange={updateDraft("from")}
          />
          <DateField
            id="dashboard-to"
            label="Đến ngày"
            value={draft.to}
            min={draft.from}
            max={today}
            error={errors.to}
            onChange={updateDraft("to")}
          />
          <button
            type="submit"
            className="mt-5 h-10 rounded-[10px] bg-navy-darkest px-4 text-sm font-semibold text-white transition hover:bg-navy-dark"
          >
            Áp dụng
          </button>
        </form>
      ) : (
        serverMessages.length > 0 && (
          <p role="alert" className="text-xs text-error">{serverMessages.join(" ")}</p>
        )
      )}
    </div>
  );
}

function DateField({ id, label, error, ...inputProps }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-semibold text-text-muted">{label}</label>
      <input
        id={id}
        type="date"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${INPUT_CLASS} ${error ? "border-error" : "border-[#e3e7f1]"}`}
        {...inputProps}
      />
      {error && <p id={`${id}-error`} className="max-w-[220px] text-xs text-error">{error}</p>}
    </div>
  );
}
