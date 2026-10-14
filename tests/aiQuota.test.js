import { describe, expect, it } from "vitest";
import { getAiQuota, getAiQuotaHint, isGenerateQuotaExhausted } from "../src/utils/subscriptionUtils";

const now = new Date("2026-10-13T05:00:00Z").getTime();
const resetAt = "2026-10-13T17:00:00Z";

describe("getAiQuota", () => {
  it("returns the counters and never a negative remainder", () => {
    expect(getAiQuota({ ai: { dailyUsed: 1, dailyLimit: 3, resetAt } }, now)).toEqual({ used: 1, limit: 3, remaining: 2, resetAt });
    expect(getAiQuota({ ai: { dailyUsed: 5, dailyLimit: 3, resetAt } }, now).remaining).toBe(0);
  });
  it("returns null without counters or once the reset time has passed", () => {
    expect(getAiQuota(null, now)).toBeNull();
    expect(getAiQuota({ plan: "Free" }, now)).toBeNull();
    expect(getAiQuota({ ai: { dailyUsed: 1, resetAt } }, now)).toBeNull();
    expect(getAiQuota({ ai: { dailyUsed: 3, dailyLimit: 3, resetAt } }, new Date(resetAt).getTime())).toBeNull();
  });
});

describe("getAiQuotaHint", () => {
  it("separates remaining, used up and a plan without AI", () => {
    expect(getAiQuotaHint({ used: 1, limit: 3, remaining: 2, resetAt })).toBe("Mỗi lần tính 1 lượt AI. Còn 2/3 lượt hôm nay.");
    expect(getAiQuotaHint({ used: 3, limit: 3, remaining: 0, resetAt })).toBe("Bạn đã dùng hết lượt AI hôm nay. Lượt mới có từ 00:00 14/10/2026.");
    expect(getAiQuotaHint({ used: 0, limit: 0, remaining: 0, resetAt })).toBe("Gói hiện tại không có lượt AI.");
  });
});

describe("isGenerateQuotaExhausted", () => {
  const usage = (generateUsed, generateLimit, at = resetAt) => ({ usage: { generateUsed, generateLimit, resetAt: at } });
  it("matches the backend rule: used >= limit, null limit is unlimited", () => {
    expect(isGenerateQuotaExhausted(usage(1, 1), now)).toBe(true);
    expect(isGenerateQuotaExhausted(usage(0, 1), now)).toBe(false);
    expect(isGenerateQuotaExhausted(usage(0, 0), now)).toBe(true);
    expect(isGenerateQuotaExhausted(usage(42, null), now)).toBe(false);
  });
  it("is false when the counter is missing or its reset time has passed", () => {
    expect(isGenerateQuotaExhausted(null, now)).toBe(false);
    expect(isGenerateQuotaExhausted({ usage: { generateUsed: 1 } }, now)).toBe(false);
    expect(isGenerateQuotaExhausted(usage(1, 1, "2026-10-01T00:00:00Z"), now)).toBe(false);
  });
});
