import { ADMIN_INPUT } from "./adminStyles";

const DAYS_OF_WEEK = [
  { key: "Monday", label: "Thứ Hai" },
  { key: "Tuesday", label: "Thứ Ba" },
  { key: "Wednesday", label: "Thứ Tư" },
  { key: "Thursday", label: "Thứ Năm" },
  { key: "Friday", label: "Thứ Sáu" },
  { key: "Saturday", label: "Thứ Bảy" },
  { key: "Sunday", label: "Chủ Nhật" },
];

export default function OpenHoursEditor({ value = [], onChange }) {
  // Map value array into dictionary by day
  const hoursMap = value.reduce((acc, item) => {
    acc[item.dayOfWeek] = item;
    return acc;
  }, {});

  const handleDayChange = (dayKey, field, val) => {
    const current = hoursMap[dayKey] || { dayOfWeek: dayKey, openTime: "08:00", closeTime: "22:00", isClosed: false };
    const updated = { ...current, [field]: val };

    const newArray = DAYS_OF_WEEK.map((d) => {
      if (d.key === dayKey) return updated;
      return hoursMap[d.key] || { dayOfWeek: d.key, openTime: "08:00", closeTime: "22:00", isClosed: false };
    });

    onChange(newArray);
  };

  return (
    <div className="divide-y divide-[#DCE2EE]">
      {DAYS_OF_WEEK.map((d) => {
        const item = hoursMap[d.key] || {dayOfWeek:d.key,openTime:"08:00",closeTime:"22:00",isClosed:false};
        return <fieldset key={d.key} className="grid min-w-0 gap-3 py-4 sm:grid-cols-[120px_minmax(0,1fr)]">
          <legend className="float-left text-sm font-semibold text-[#0F2148]">{d.label}</legend>
          <div className="min-w-0 space-y-3">
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-[#5C6B8A]"><input type="checkbox" checked={item.isClosed} onChange={(e) => handleDayChange(d.key,"isClosed",e.target.checked)} aria-label={`Đóng cửa ${d.label}`} className="h-4 w-4 rounded border-[#DCE2EE] text-[#2C56A8]" />Đóng cửa</label>
            {!item.isClosed && <div className="grid min-w-0 grid-cols-2 gap-3"><label className="min-w-0 text-xs text-[#5C6B8A]">Mở cửa<input aria-label={`Giờ mở cửa ${d.label}`} type="time" value={item.openTime || "08:00"} onChange={(e) => handleDayChange(d.key,"openTime",e.target.value)} className={`mt-2 ${ADMIN_INPUT}`} /></label><label className="min-w-0 text-xs text-[#5C6B8A]">Đóng cửa<input aria-label={`Giờ đóng cửa ${d.label}`} type="time" value={item.closeTime || "22:00"} onChange={(e) => handleDayChange(d.key,"closeTime",e.target.value)} className={`mt-2 ${ADMIN_INPUT}`} /></label></div>}
          </div>
        </fieldset>;
      })}
    </div>
  );
}
