import { useState } from "react";
import { formatClock } from "../../hooks/useCountdown";

const CODE_LENGTH = 6;

// Ô nhập mã OTP 6 số + nút "Gửi lại mã" có đếm ngược (dùng ở Đăng ký và Quên mật khẩu)
export default function OtpCodeField({
  email,
  value,
  onChange,
  disabled,
  expiresIn,
  resendIn,
  resending,
  onResend,
}) {
  const [focused, setFocused] = useState(false);

  return (
    <div className="space-y-2">
      <p className="text-body-md text-on-surface-variant">
        Mã 6 số đã được gửi tới <strong className="text-on-surface">{email}</strong>.
        Kiểm tra cả thư mục Spam nếu chưa thấy.
      </p>
      <label className="block text-label-md text-on-surface-variant ml-1" htmlFor="otp-code">
        Mã xác thực
      </label>
      {/* 1 input thật (trong suốt) phủ lên 6 khung hiển thị: vẫn dán được mã và
          điện thoại tự điền được (autoComplete="one-time-code") */}
      <div className={`relative ${disabled ? "opacity-60" : ""}`}>
        <div className="flex justify-center gap-2" aria-hidden="true">
          {Array.from({ length: CODE_LENGTH }, (_, i) => {
            const digit = value[i];
            const isActive = focused && i === Math.min(value.length, CODE_LENGTH - 1);
            return (
              <div
                key={i}
                className={`flex aspect-square min-w-0 max-w-14 flex-1 items-center justify-center rounded-[10px] border-2 text-2xl font-bold text-on-surface transition-colors ${
                  isActive
                    ? "border-primary bg-white"
                    : digit
                      ? "border-primary/40 bg-white"
                      : "border-outline-variant/60 bg-surface-container-low"
                }`}
              >
                {digit ?? (isActive && <span className="h-6 w-0.5 animate-pulse bg-primary" />)}
              </div>
            );
          })}
        </div>
        <input
          id="otp-code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={CODE_LENGTH}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          disabled={disabled}
          autoFocus
          className="absolute inset-0 h-full w-full cursor-text bg-transparent text-transparent caret-transparent opacity-0"
        />
      </div>
      <div className="flex items-center justify-between text-label-md">
        <span className={expiresIn > 0 ? "text-on-surface-variant" : "text-error"}>
          {expiresIn > 0 ? `Mã hết hạn sau ${formatClock(expiresIn)}` : "Mã có thể đã hết hạn"}
        </span>
        <button
          type="button"
          onClick={onResend}
          disabled={resendIn > 0 || resending}
          className="font-semibold text-primary hover:underline disabled:text-outline disabled:no-underline"
        >
          {resending
            ? "Đang gửi..."
            : resendIn > 0
              ? `Gửi lại mã (${formatClock(resendIn)})`
              : "Gửi lại mã"}
        </button>
      </div>
    </div>
  );
}
