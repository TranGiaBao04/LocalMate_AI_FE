import { toSafeFileStem } from "../../../utils/exportFiles.js";
import { getCalendarStartTimes, validateTripForCalendar } from "../../../utils/tripCalendar.js";

export async function generateTripCalendarBlob(trip, tripStatus) {
  const validation = validateTripForCalendar(trip, tripStatus);
  if (!validation.valid) return validation;

  const starts = getCalendarStartTimes(trip);
  const slug = toSafeFileStem(trip.title).toLowerCase();
  const events = trip.stops.map((stop, index) => {
    const place = stop.placeName || "Địa điểm chưa có tên";
    const position = `${index + 1}/${trip.stops.length}`;
    const hasGeo = Number.isFinite(stop.latitude) && Number.isFinite(stop.longitude)
      && Math.abs(stop.latitude) <= 90 && Math.abs(stop.longitude) <= 180;
    const description = [
      `Điểm ${position} trong lịch trình LocalMate AI.`,
      `Thời lượng: ${stop.durationMinutes} phút`,
      Number.isFinite(stop.estimatedCost) ? `Chi phí dự kiến: ${new Intl.NumberFormat("vi-VN").format(stop.estimatedCost)}đ` : null,
      stop.nearestMetroStation ? `Metro gần nhất: ${stop.nearestMetroStation}` : null,
      "Giờ địa phương TP.HCM (UTC+7)",
      hasGeo && stop.mapUrl ? `Maps: ${stop.mapUrl}` : null,
    ].filter(Boolean).join("\n");

    const durationSeconds = stop.durationMinutes * 60;
    return {
      uid: `localmate-${slug}-${trip.plannedDate}-${index + 1}@localmate.ai`,
      title: `LocalMate • ${position} • ${place}`,
      location: place,
      description,
      start: new Date(starts[index]).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z"),
      startInputType: "utc",
      startOutputType: "utc",
      duration: { minutes: Math.floor(durationSeconds / 60), seconds: durationSeconds % 60 },
      status: "CONFIRMED",
      ...(hasGeo && { geo: { lat: stop.latitude, lon: stop.longitude } }),
      ...(hasGeo && stop.mapUrl && { url: stop.mapUrl }),
      alarms: [{ action: "display", description: `Sắp đến giờ: ${place}`, trigger: { minutes: 15, before: true } }],
    };
  });

  const { createEvents } = await import("ics");
  const { error, value } = createEvents(events, {
    calName: `LocalMate - ${trip.title || "Lịch trình"}`,
    productId: "LocalMate AI",
  });
  if (error || !value) throw new Error("Calendar file generation failed.");
  return { valid: true, blob: new Blob([value], { type: "text/calendar;charset=utf-8" }) };
}
