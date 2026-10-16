import { DAYS_OF_WEEK, formatDayHours } from "../../utils/openingHours";

// Bảng giờ mở cửa 7 thứ (khuôn PlaceOpeningHoursResponse của BE), dùng cho trang địa điểm và admin.
// today: dayOfWeek của hôm nay để làm nổi bật; bỏ trống thì không đánh dấu.
export default function OpeningHoursTable({ openingHours, today = null }) {
  if (!openingHours?.hasData) {
    return <p className="text-sm leading-6 text-text-muted">Chưa có thông tin giờ mở cửa.</p>;
  }
  const byDay = Object.fromEntries(openingHours.days.map((d) => [d.dayOfWeek, d]));
  return (
    <dl className="divide-y divide-border-soft">
      {DAYS_OF_WEEK.map(({ key, label }) => {
        const day = byDay[key] ?? { isClosed: false, openTime: null, closeTime: null };
        const isToday = key === today;
        return (
          <div
            key={key}
            className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5 text-sm leading-6 ${
              isToday ? "font-semibold text-navy-dark" : "text-text-muted"
            }`}
          >
            <dt className="flex items-center gap-2">
              {label}
              {isToday && (
                <span className="rounded-[4px] bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
                  Hôm nay
                </span>
              )}
            </dt>
            <dd className="break-words">{formatDayHours(day)}</dd>
          </div>
        );
      })}
    </dl>
  );
}
