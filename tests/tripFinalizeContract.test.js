import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { tripService } from "../src/services/tripService";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const originalFetch = globalThis.fetch;

beforeEach(() => {
  localStorage.clear();
  globalThis.fetch = vi.fn();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

// Đã gỡ mua lẻ: chốt lịch chỉ theo lượt lưu của gói, không gửi nguồn thanh toán
describe("tripService.finalizeTrip", () => {
  it("POST finalize không có body, rồi đọc lại lịch đầy đủ", async () => {
    globalThis.fetch
      .mockResolvedValueOnce(json({ tripId: "trip-one", status: "Finalized" }))
      .mockResolvedValueOnce(json({ id: "trip-one", status: "Finalized", items: [] }));

    const trip = await tripService.finalizeTrip("trip-one");

    const [finalizeUrl, finalizeInit] = globalThis.fetch.mock.calls[0];
    expect(finalizeUrl).toMatch(/\/trips\/trip-one\/finalize$/);
    expect(finalizeInit.method).toBe("POST");
    expect(finalizeInit.body).toBeUndefined();
    expect(globalThis.fetch.mock.calls[1][0]).toMatch(/\/trips\/trip-one$/);
    expect(trip.id).toBe("trip-one");
  });

  it("bỏ qua tham số thừa, không bao giờ gửi entitlementId", async () => {
    globalThis.fetch
      .mockResolvedValueOnce(json({ tripId: "trip-one", status: "Finalized" }))
      .mockResolvedValueOnce(json({ id: "trip-one", status: "Finalized", items: [] }));

    await tripService.finalizeTrip("trip-one", { fundingSource: "SingleEntitlement", entitlementId: "x" });

    expect(globalThis.fetch.mock.calls[0][1].body).toBeUndefined();
  });
});
