const AUTH_ERROR_MESSAGES = {
  invalid_otp: "Mã xác thực không đúng.",
  otp_expired: 'Mã xác thực đã hết hạn. Hãy bấm "Gửi lại mã".',
  otp_attempts_exceeded: "Bạn đã nhập sai quá nhiều lần. Hãy yêu cầu mã mới.",
  duplicate_email: 'Email này đã có tài khoản. Hãy đăng nhập hoặc dùng "Quên mật khẩu".',
  otp_resend_cooldown: "Mã vừa được gửi, vui lòng đợi rồi gửi lại.",
  otp_rate_limited: "Bạn đã yêu cầu quá nhiều mã.",
  too_many_requests: "Bạn thao tác quá nhanh.",
};

// 45 -> "45 giây", 1500 -> "25 phút"
export const formatWait = (seconds) =>
  seconds < 60 ? `${seconds} giây` : `${Math.ceil(seconds / 60)} phút`;

// 429 luôn có retryAfterSeconds (BE trả cả header Retry-After)
export const getRetryAfterSeconds = (err) =>
  err.status === 429 ? (err.data?.retryAfterSeconds ?? 60) : 0;

export function getAuthErrorMessage(err, fallback) {
  const base = AUTH_ERROR_MESSAGES[err.code];
  if (err.code === "invalid_otp" && err.data?.remainingAttempts != null) {
    return `${base} Còn ${err.data.remainingAttempts} lần thử.`;
  }
  if (err.status === 429) {
    return `${base ?? err.message} Thử lại sau ${formatWait(getRetryAfterSeconds(err))}.`;
  }
  // Lỗi validation theo field (email, code, newPassword...) đã được apiClient ghép vào err.message
  return base ?? err.message ?? fallback;
}
