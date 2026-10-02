import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { generateTripCalendarBlob } from "../src/components/trip/export/tripCalendarGenerator.js";
import { validateTripForCalendar } from "../src/utils/tripCalendar.js";
import { blobToFile, buildTripExportFileName, canShareFile, downloadBlob, shareFile } from "../src/utils/exportFiles.js";

const names = ["Bến Thành", "Nguyễn Huệ", "Thảo Điền", "Ẩm thực Việt Nam"];
const fixture = (count = 5) => ({
  title: "Khám phá Bến Thành", plannedDate: "2026-10-03",
  tripId: "private-trip-id", userId: "private-user-id",
  stops: Array.from({ length: count }, (_, i) => ({
    order: i + 1, placeName: names[i % names.length], time: `${String(9 + i % 12).padStart(2, "0")}:00`,
    durationMinutes: 60, estimatedCost: 30000, nearestMetroStation: "Bến Thành",
    latitude: 10.77, longitude: 106.69,
    mapUrl: "https://www.google.com/maps/search/?api=1&query=10.77%2C106.69",
    reason: "private reasoning", review: "private review",
  })),
});
const unfold = (text) => text.replace(/\r\n[ \t]/g, "");
const generate = async (trip) => {
  const result = await generateTripCalendarBlob(trip, "finalized");
  assert.equal(result.valid, true);
  assert.equal(result.blob.type, "text/calendar;charset=utf-8");
  assert.ok(result.blob.size > 0);
  return unfold(await result.blob.text());
};

for (const count of [5, 10, 20]) {
  test(`${count} stops: complete UTF-8 calendar with one confirmed event and alarm per stop`, async () => {
    const trip = fixture(count);
    const before = JSON.stringify(trip);
    const text = await generate(trip);
    assert.match(text, /^BEGIN:VCALENDAR\r\n/);
    assert.match(text, /END:VCALENDAR\r\n?$/);
    for (const marker of ["BEGIN:VEVENT", "END:VEVENT", "DTSTART:", "DURATION:PT60M", "STATUS:CONFIRMED", "BEGIN:VALARM", "ACTION:DISPLAY", "TRIGGER:-PT15M"]) {
      assert.equal(text.split(marker).length - 1, count, marker);
    }
    for (const name of names) assert.ok(text.includes(name));
    assert.match(text, /GEO:10.77;106.69/);
    assert.match(text, /URL:https:\/\/www.google.com\/maps/);
    assert.doesNotMatch(text, /undefined|null|NaN|private-/);
    assert.equal(JSON.stringify(trip), before);
  });
}

test("Vietnam 09:00/10:30/13:00 converts to ordered UTC starts", async () => {
  const trip = fixture(3);
  ["09:00", "10:30", "13:00"].forEach((time, i) => { trip.stops[i].time = time; });
  const text = await generate(trip);
  assert.deepEqual([...text.matchAll(/DTSTART:(.+)/g)].map((m) => m[1].trim()), ["20261003T020000Z", "20261003T033000Z", "20261003T060000Z"]);
});

test("midnight rollover and month/year boundary", async () => {
  const trip = fixture(3);
  trip.plannedDate = "2026-12-31";
  ["23:00", "00:30", "02:00"].forEach((time, i) => { trip.stops[i].time = time; });
  const text = await generate(trip);
  assert.deepEqual([...text.matchAll(/DTSTART:(.+)/g)].map((m) => m[1].trim()), ["20261231T160000Z", "20261231T173000Z", "20261231T190000Z"]);
});

test("device timezones produce identical event times including DST zones", () => {
  const moduleUrl = new URL("../src/components/trip/export/tripCalendarGenerator.js", import.meta.url).href;
  const script = `import { generateTripCalendarBlob } from ${JSON.stringify(moduleUrl)}; const r = await generateTripCalendarBlob(${JSON.stringify(fixture(3))}, 'finalized'); console.log((await r.blob.text()).match(/DTSTART:.+/g).join('|'));`;
  const outputs = ["UTC", "Asia/Ho_Chi_Minh", "America/Los_Angeles", "Pacific/Auckland"].map((TZ) => {
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], { env: { ...process.env, TZ }, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  });
  assert.equal(new Set(outputs).size, 1);
});

for (const [label, mutate, status, code] of [
  ["Draft", () => {}, "draft", "calendar_requires_finalized_trip"],
  ["missing date", (t) => { t.plannedDate = null; }, "finalized", "calendar_requires_planned_date"],
  ["invalid date", (t) => { t.plannedDate = "2026-02-30"; }, "finalized", "invalid_calendar_date"],
  ["invalid leap day", (t) => { t.plannedDate = "2026-02-29"; }, "finalized", "invalid_calendar_date"],
  ["bad date format", (t) => { t.plannedDate = "03/10/2026"; }, "finalized", "invalid_calendar_date"],
  ["no stops", (t) => { t.stops = []; }, "finalized", "calendar_requires_stops"],
  ...[null, "24:00", "9:00", "12:60", "09:00:00"].map((time) => [`invalid time ${time}`, (t) => { t.stops[2].time = time; }, "finalized", "calendar_stop_missing_time"]),
  ...[null, NaN, 0, -1, Infinity, 0.001, Number.MAX_VALUE].map((duration) => [`invalid duration ${duration}`, (t) => { t.stops[2].durationMinutes = duration; }, "finalized", "calendar_stop_missing_duration"]),
]) {
  test(`${label} rejects whole calendar without Blob`, async () => {
    const trip = fixture(); mutate(trip);
    assert.equal(validateTripForCalendar(trip, status).code, code);
    const result = await generateTripCalendarBlob(trip, status);
    assert.equal(result.valid, false);
    assert.equal(result.code, code);
    assert.equal(result.blob, undefined);
  });
}

test("leap date and early morning correctly move UTC into previous date", async () => {
  const trip = fixture(1); trip.plannedDate = "2028-03-01"; trip.stops[0].time = "00:30";
  assert.match(await generate(trip), /DTSTART:20280229T173000Z/);
});

test("fractional minutes retain exact seconds rather than fabricating duration", async () => {
  const trip = fixture(1); trip.stops[0].durationMinutes = 1.5;
  assert.match(await generate(trip), /DURATION:PT1M30S/);
});

test("invalid/missing coordinates omit both GEO and Maps URL", async () => {
  for (const [lat, lon] of [[null, 106], [10, NaN], [91, 106], [10, 181]]) {
    const trip = fixture(1); trip.stops[0].latitude = lat; trip.stops[0].longitude = lon;
    assert.doesNotMatch(await generate(trip), /GEO:|URL:|Maps:/);
  }
});

test("repeated exports retain sanitized UIDs and content without leaking IDs", async () => {
  const trip = fixture(); trip.title = "Bến Thành / : ?";
  const first = await generate(trip); const second = await generate(trip);
  const uids = (text) => [...text.matchAll(/UID:(.+)/g)].map((m) => m[1].trim());
  assert.deepEqual(uids(first), uids(second));
  assert.equal(new Set(uids(first)).size, 5);
  assert.equal(uids(first)[0], "localmate-ben-thanh-2026-10-03-1@localmate.ai");
});

test("shared File/name/share utilities support ICS and unsupported share fallback", async () => {
  const result = await generateTripCalendarBlob(fixture(), "finalized");
  const file = blobToFile(result.blob, buildTripExportFileName({ title: fixture().title, plannedDate: fixture().plannedDate, extension: "ics" }));
  assert.equal(file.name, "LocalMate_Kham-Pha-Ben-Thanh_2026-10-03.ics");
  assert.equal(file.type, "text/calendar;charset=utf-8");
  assert.equal(canShareFile(file, {}), false);
  assert.equal(await shareFile(file, {}, {}), false);
  let shared;
  await shareFile(file, {}, { canShare: () => true, share: async (data) => { shared = data.files[0]; } });
  assert.equal(shared, file);
});

test("download twice creates and releases two object URLs using shared helper", async () => {
  const originalDocument = globalThis.document; const originalWindow = globalThis.window;
  const originalCreate = URL.createObjectURL; const originalRevoke = URL.revokeObjectURL;
  const revoked = []; let clicks = 0; let created = 0; let removed = 0;
  try {
    URL.createObjectURL = () => `blob:test-${++created}`;
    URL.revokeObjectURL = (url) => revoked.push(url);
    globalThis.document = { createElement: () => ({ style: {}, click: () => { clicks++; }, remove: () => { removed++; } }), body: { appendChild: () => {} } };
    globalThis.window = { setTimeout: (callback) => callback() };
    const { blob } = await generateTripCalendarBlob(fixture(), "finalized");
    downloadBlob(blob, "test.ics"); downloadBlob(blob, "test.ics");
    assert.equal(clicks, 2); assert.equal(removed, 2);
    assert.deepEqual(revoked, ["blob:test-1", "blob:test-2"]);
  } finally {
    globalThis.document = originalDocument; globalThis.window = originalWindow;
    URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke;
  }
});
