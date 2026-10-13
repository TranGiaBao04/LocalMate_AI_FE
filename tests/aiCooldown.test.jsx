import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Trip from "../src/context/TripContext";
import { useAiCooldown } from "../src/hooks/useAiCooldown";
import { getAiCooldownSeconds, getAiErrorMessage } from "../src/utils/aiErrors";

const failure = (code, data) => Object.assign(new Error("Server title"), { code, data });

describe("AI error helpers follow the backend's charged and retryAfterSeconds fields", () => {
  it("reads the wait only from the response and never invents one", () => {
    expect(getAiCooldownSeconds(failure("ai_cooldown", { retryAfterSeconds: 16 }))).toBe(16);
    expect(getAiCooldownSeconds(failure("ai_cooldown", { retryAfterSeconds: 15.2 }))).toBe(16);
    expect(getAiCooldownSeconds(failure("ai_unavailable", { charged: false, retryAfterSeconds: 30 }))).toBe(30);
    for (const data of [undefined, {}, { retryAfterSeconds: 0 }, { retryAfterSeconds: -5 }, { retryAfterSeconds: "soon" }]) {
      expect(getAiCooldownSeconds(failure("ai_unavailable", data))).toBe(0);
    }
    expect(getAiCooldownSeconds(undefined)).toBe(0);
  });
  it("tells whether a failed call was charged, with a neutral fallback when the field is absent", () => {
    expect(getAiErrorMessage(failure("ai_unavailable", { charged: false, retryAfterSeconds: 16 }))).toBe("AI đang bận, lần này không tính lượt. Bạn thử lại sau 16 giây nhé.");
    expect(getAiErrorMessage(failure("ai_unavailable", { charged: true, retryAfterSeconds: 16 }))).toBe("AI chưa xử lý được, lần này vẫn tính 1 lượt. Bạn thử lại sau 16 giây nhé.");
    // Không có số giây: AI bị tắt hoặc nội dung hỏng, không mời thử lại sau vài giây
    expect(getAiErrorMessage(failure("ai_unavailable", { charged: false }))).toBe("AI tạm thời chưa dùng được, lần này không tính lượt.");
    expect(getAiErrorMessage(failure("ai_unavailable", { charged: true }))).toBe("AI chưa xử lý được, lần này vẫn tính 1 lượt.");
    expect(getAiErrorMessage(failure("ai_unavailable", {}))).toBe("AI đang bận, bạn thử lại sau nhé.");
    expect(getAiErrorMessage(failure("ai_unavailable"))).toBe("AI đang bận, bạn thử lại sau nhé.");
  });
  it("separates the three 429 codes", () => {
    expect(getAiErrorMessage(failure("ai_cooldown", { retryAfterSeconds: 16 }))).toBe("AI vừa gặp lỗi. Bạn thử lại sau 16 giây nhé.");
    expect(getAiErrorMessage(failure("ai_cooldown"))).toBe("AI vừa gặp lỗi. Bạn thử lại sau ít giây nhé.");
    expect(getAiErrorMessage(failure("ai_daily_limit_reached"))).toBe("Bạn đã dùng hết lượt AI của hôm nay.");
    expect(getAiErrorMessage(failure("ai_trip_limit_reached"))).toBe("AI đã viết lại lý do cho lịch trình này đủ số lần cho phép.");
  });
});

describe("useAiCooldown", () => {
  let until;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-13T05:00:00Z"));
    until = 0;
    vi.spyOn(Trip, "useTrip").mockImplementation(() => ({ aiCooldownUntil: until }));
  });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it("counts down each second, reaches zero and stops its timer", () => {
    const view = renderHook(() => useAiCooldown());
    expect(view.result.current).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    until = Date.now() + 16000; view.rerender();
    expect(view.result.current).toBe(16);
    act(() => vi.advanceTimersByTime(5000)); expect(view.result.current).toBe(11);
    act(() => vi.advanceTimersByTime(11000)); expect(view.result.current).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("restarts for a later failure and clears its timer on unmount", () => {
    until = Date.now() + 3000;
    const view = renderHook(() => useAiCooldown());
    act(() => vi.advanceTimersByTime(3000)); expect(view.result.current).toBe(0);
    until = Date.now() + 30000; view.rerender();
    expect(view.result.current).toBe(30);
    view.unmount(); expect(vi.getTimerCount()).toBe(0);
  });
  it("is zero when the Trip context carries no cooldown", () => {
    Trip.useTrip.mockImplementation(() => ({}));
    expect(renderHook(() => useAiCooldown()).result.current).toBe(0);
  });
});
