const DAY_MS = 24 * 60 * 60 * 1000;
const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;

function parseDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.getTime();
}

function parseClock(value) {
  if (typeof value !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

const invalid = (code, message) => ({ valid: false, code, message });

export function validateTripForCalendar(trip, tripStatus) {
  if (tripStatus !== "finalized") {
    return invalid("calendar_requires_finalized_trip", "Chốt lịch trình trước khi thêm vào lịch.");
  }
  if (!trip?.plannedDate) {
    return invalid("calendar_requires_planned_date", "Lịch trình chưa có ngày dự kiến.");
  }
  if (parseDate(trip.plannedDate) === null) {
    return invalid("invalid_calendar_date", "Ngày dự kiến của lịch trình không hợp lệ.");
  }
  if (!trip.stops?.length) {
    return invalid("calendar_requires_stops", "Lịch trình chưa có điểm đến.");
  }
  if (trip.stops.some((stop) => parseClock(stop.time) === null)) {
    return invalid("calendar_stop_missing_time", "Một số địa điểm chưa có giờ cụ thể.");
  }
  if (trip.stops.some((stop) => !Number.isFinite(stop.durationMinutes)
    || stop.durationMinutes <= 0 || !Number.isSafeInteger(stop.durationMinutes * 60))) {
    return invalid("calendar_stop_missing_duration", "Một số địa điểm chưa có thời lượng hợp lệ.");
  }
  return { valid: true, code: null, message: null };
}

// Clock values belong to Vietnam, regardless of the device's timezone.
export function getCalendarStartTimes(trip) {
  const date = parseDate(trip.plannedDate);
  let dayOffset = 0;
  let previousClock = null;
  return trip.stops.map((stop) => {
    const clock = parseClock(stop.time);
    if (previousClock !== null && clock < previousClock) dayOffset += 1;
    previousClock = clock;
    return date + dayOffset * DAY_MS + clock * 60000 - VIETNAM_OFFSET_MS;
  });
}
