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
  return AI_ERROR_MESSAGES[err.code] ?? err.message;
}
