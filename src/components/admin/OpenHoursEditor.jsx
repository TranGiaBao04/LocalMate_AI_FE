import { useState } from "react";
import { Clock } from "lucide-react";

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
    <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
      <div className="flex items-center gap-2 text-xs font-semibold text-gray-700">
        <Clock className="w-4 h-4 text-primary" />
        <span>Giờ mở cửa 7 ngày trong tuần (OpenHours)</span>
      </div>

      <div className="space-y-2 divide-y divide-gray-100">
        {DAYS_OF_WEEK.map((d) => {
          const item = hoursMap[d.key] || { dayOfWeek: d.key, openTime: "08:00", closeTime: "22:00", isClosed: false };

          return (
            <div key={d.key} className="pt-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium text-gray-700 w-20">{d.label}</span>

              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={item.isClosed}
                    onChange={(e) => handleDayChange(d.key, "isClosed", e.target.checked)}
                    className="rounded border-gray-300 text-primary focus:ring-blue-200 w-3.5 h-3.5"
                  />
                  <span className="text-xs text-gray-500">Đóng cửa</span>
                </label>

                {!item.isClosed && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-600">
                    <input
                      type="time"
                      value={item.openTime || "08:00"}
                      onChange={(e) => handleDayChange(d.key, "openTime", e.target.value)}
                      className="px-2 py-1 bg-white border border-gray-200 rounded text-xs focus:ring-1 focus:ring-blue-200"
                    />
                    <span>-</span>
                    <input
                      type="time"
                      value={item.closeTime || "22:00"}
                      onChange={(e) => handleDayChange(d.key, "closeTime", e.target.value)}
                      className="px-2 py-1 bg-white border border-gray-200 rounded text-xs focus:ring-1 focus:ring-blue-200"
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
