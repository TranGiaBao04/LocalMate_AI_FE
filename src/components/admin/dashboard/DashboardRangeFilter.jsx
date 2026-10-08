import { useState } from "react";
import { todayInVietnam } from "../../../utils/vnTime";
import { RANGE_PRESETS, validateRange } from "./dashboardUtils";
import { AdminField } from "../ui";
import { ADMIN_INPUT, ADMIN_PRIMARY_BUTTON } from "../adminStyles";

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
    <div className="flex min-w-0 flex-col items-stretch gap-3 lg:items-end">
      <div role="group" aria-label="Khoảng thời gian" className="inline-flex w-fit max-w-full flex-wrap gap-1 rounded-[12px] bg-[#E9EDF5] p-1">
        {RANGE_PRESETS.map((option) => (
          <button
            key={option.key}
            type="button"
            aria-pressed={preset === option.key}
            onClick={() => selectPreset(option.key)}
            className={`min-h-11 rounded-[8px] px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2C56A8] motion-reduce:transition-none ${
              preset === option.key ? "bg-white text-[#1D3E82] shadow-sm" : "text-[#5C6B8A] hover:text-[#1D3E82]"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {preset === "custom" ? (
        <form onSubmit={handleApply} noValidate className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
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
            className={`sm:mt-[26px] self-start ${ADMIN_PRIMARY_BUTTON}`}
          >
            Áp dụng
          </button>
        </form>
      ) : (
        serverMessages.length > 0 && (
          <p role="alert" className="text-xs text-red-700">{serverMessages.join(" ")}</p>
        )
      )}
    </div>
  );
}

function DateField({ id, label, error, ...inputProps }) {
  return (
    <AdminField id={id} label={label} error={error}>
      <input
        id={id}
        type="date"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={ADMIN_INPUT}
        {...inputProps}
      />
    </AdminField>
  );
}
