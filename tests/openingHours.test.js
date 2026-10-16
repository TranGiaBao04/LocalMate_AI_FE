import { describe, expect, it } from "vitest";
import { describeOpenState, formatDayHours, getOpenStateNow } from "../src/utils/openingHours";

const at = (date, hhmm) => new Date(`${date}T${hhmm}:00+07:00`).getTime();
const thu = (hhmm) => at("2026-10-08", hhmm); // thứ Năm
const unknown = (dayOfWeek) => ({ dayOfWeek, isClosed: false, openTime: null, closeTime: null });
const open = (dayOfWeek, from, to) => ({ dayOfWeek, isClosed: false, openTime: `${from}:00`, closeTime: `${to}:00` });
const closed = (dayOfWeek) => ({ dayOfWeek, isClosed: true, openTime: null, closeTime: null });
const week = (...overrides) => {
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(unknown);
  for (const day of overrides) days[days.findIndex((d) => d.dayOfWeek === day.dayOfWeek)] = day;
  return { placeId: "p1", hasData: true, days };
};

describe("formatDayHours", () => {
  it("covers closed, not entered, same-day and overnight hours", () => {
    expect(formatDayHours(closed("Monday"))).toBe("Nghỉ");
    expect(formatDayHours(unknown("Monday"))).toBe("Chưa rõ");
    expect(formatDayHours(open("Monday", "08:00", "22:00"))).toBe("08:00 – 22:00");
    expect(formatDayHours(open("Monday", "17:00", "02:00"))).toBe("17:00 – 02:00 (hôm sau)");
    expect(formatDayHours(open("Monday", "00:00", "00:00"))).toBe("Mở cả ngày");
  });
});

describe("getOpenStateNow", () => {
  it("is unknown without data or for a day not entered", () => {
    expect(getOpenStateNow(null, thu("10:00"))).toEqual({ status: "unknown" });
    expect(getOpenStateNow({ hasData: false, days: [] }, thu("10:00"))).toEqual({ status: "unknown" });
    expect(getOpenStateNow(week(open("Friday", "08:00", "22:00")), thu("10:00"))).toEqual({ status: "unknown" });
  });
  it("handles a same-day window before, during and after opening", () => {
    const hours = week(closed("Wednesday"), open("Thursday", "08:00", "22:00"));
    expect(getOpenStateNow(hours, thu("07:00"))).toEqual({ status: "closed", opensAt: "08:00", closedToday: false });
    expect(getOpenStateNow(hours, thu("09:55"))).toEqual({ status: "open", closesAt: "22:00", closesNextDay: false });
    expect(getOpenStateNow(hours, thu("22:00"))).toEqual({ status: "closed", opensAt: null, closedToday: false });
  });
  it("keeps yesterday's overnight window open in the early morning", () => {
    const hours = week(open("Wednesday", "17:00", "02:00"), open("Thursday", "17:00", "02:00"));
    expect(getOpenStateNow(hours, thu("01:00"))).toEqual({ status: "open", closesAt: "02:00", closesNextDay: false });
    expect(getOpenStateNow(hours, thu("03:00"))).toEqual({ status: "closed", opensAt: "17:00", closedToday: false });
    expect(getOpenStateNow(hours, thu("23:00"))).toEqual({ status: "open", closesAt: "02:00", closesNextDay: true });
  });
  it("treats 00:00–00:00 as open all day without stretching into the next morning", () => {
    const hours = week(open("Wednesday", "00:00", "00:00"), open("Thursday", "00:00", "00:00"));
    expect(getOpenStateNow(hours, thu("03:00"))).toEqual({ status: "open", allDay: true });
    expect(getOpenStateNow(hours, thu("23:59"))).toEqual({ status: "open", allDay: true });
    // thứ Năm mở 24 giờ, thứ Sáu nghỉ: 01:00 thứ Sáu là đã đóng
    const friday = week(open("Thursday", "00:00", "00:00"), closed("Friday"));
    expect(getOpenStateNow(friday, at("2026-10-09", "01:00"))).toEqual({ status: "closed", opensAt: null, closedToday: true });
  });
  it("wraps Sunday night into Monday morning", () => {
    const hours = week(open("Sunday", "18:00", "02:00"), closed("Monday"));
    expect(getOpenStateNow(hours, at("2026-10-12", "01:00")).status).toBe("open");
    expect(getOpenStateNow(hours, at("2026-10-12", "10:00"))).toEqual({ status: "closed", opensAt: null, closedToday: true });
  });
  it("does not claim closed before opening when yesterday was not entered", () => {
    const hours = week(open("Thursday", "08:00", "22:00"));
    expect(getOpenStateNow(hours, thu("07:00"))).toEqual({ status: "unknown" });
    expect(getOpenStateNow(hours, thu("10:00")).status).toBe("open");
  });
});

describe("describeOpenState", () => {
  it("builds the short Vietnamese line", () => {
    expect(describeOpenState({ status: "open", closesAt: "02:00", closesNextDay: true })).toBe("Đang mở cửa · đóng lúc 02:00 (hôm sau)");
    expect(describeOpenState({ status: "closed", opensAt: "17:00", closedToday: false })).toBe("Đang đóng cửa · mở lúc 17:00");
    expect(describeOpenState({ status: "closed", opensAt: null, closedToday: true })).toBe("Hôm nay nghỉ");
    expect(describeOpenState({ status: "closed", opensAt: null, closedToday: false })).toBe("Đang đóng cửa");
    expect(describeOpenState({ status: "unknown" })).toBeNull();
    expect(describeOpenState({ status: "open", allDay: true })).toBe("Đang mở cửa · mở cả ngày");
  });
});
