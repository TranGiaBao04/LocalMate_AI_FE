import { formatDateTimeInVietnam } from "./vnTime";

// Mã lỗi của các API AI (explanations, parse-request)
const AI_ERROR_MESSAGES = {
  ai_requires_persisted_user: "Vui lòng đăng ký tài khoản để dùng tính năng AI.",
  ai_trip_limit_reached: "AI đã viết lại lý do cho lịch trình này đủ số lần cho phép.",
  ai_unavailable: "AI đang bận, bạn thử lại sau nhé.",
  trip_finalized: "Lịch trình đã chốt nên không nhờ AI viết lại được.",
  trip_not_found: "Không tìm thấy lịch trình này.",
};

export function getAiErrorMessage(err) {
  if (err.code === "ai_daily_limit_reached") {
    // resetAt là giờ UTC, bằng 00:00 giờ Việt Nam hôm sau
    const resetAt = err.data?.resetAt;
    return `Bạn đã dùng hết lượt AI của hôm nay.${
      resetAt ? ` Lượt mới có từ ${formatDateTimeInVietnam(resetAt)}.` : ""
    }`;
  }
  if (err.code === "ai_unavailable") {
    // charged do BE trả: lần lỗi này có trừ lượt AI trong ngày không. Không tự suy từ số lần lỗi.
    // Có số giây = lỗi do nhà cung cấp, thử lại được sau thời gian chờ. Không có = AI bị tắt hoặc nội dung hỏng.
    const seconds = getAiCooldownSeconds(err);
    const retry = seconds > 0 ? ` Bạn thử lại sau ${seconds} giây nhé.` : "";
    if (err.data?.charged === false) {
      return `${seconds > 0 ? "AI đang bận" : "AI tạm thời chưa dùng được"}, lần này không tính lượt.${retry}`;
    }
    if (err.data?.charged === true) return `AI chưa xử lý được, lần này vẫn tính 1 lượt.${retry}`;
  }
  if (err.code === "ai_cooldown") {
    const seconds = getAiCooldownSeconds(err);
    return `AI vừa gặp lỗi. Bạn thử lại sau ${seconds > 0 ? `${seconds} giây` : "ít giây"} nhé.`;
  }
  return AI_ERROR_MESSAGES[err.code] ?? err.message;
}

// Số giây BE bắt chờ trước khi gọi AI lại (429 ai_cooldown; 503 nếu BE trả kèm). 0 = không có.
// Thời gian chờ do admin chỉnh nên chỉ đọc từ response, không gắn cứng.
export function getAiCooldownSeconds(err) {
  const seconds = Number(err?.data?.retryAfterSeconds);
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : 0;
}
