import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { authService } from "../../services/authService";
import OtpCodeField from "../../components/auth/OtpCodeField";
import { useCountdown } from "../../hooks/useCountdown";
import { getAuthErrorMessage, getRetryAfterSeconds } from "../../utils/authErrors";
import logo from "../../assets/logo.jpg";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState("email"); // "email" | "reset"
  const [email, setEmail] = useState(() => location.state?.email ?? "");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [showGoogleNotice, setShowGoogleNotice] = useState(false);
  const [resendIn, startResend] = useCountdown();
  const [expiresIn, startExpire] = useCountdown();

  // Gửi mã (bước 1) và "Gửi lại mã" (bước 2) cùng gọi password-reset/request
  const requestCode = async () => {
    const dispatch = await authService.requestPasswordReset(email.trim());
    startResend(dispatch.resendAfterSeconds);
    startExpire(dispatch.codeExpiresInSeconds);
    setCode("");
    setStep("reset");
  };

  const handleRequestError = (err) => {
    if (err.code === "password_reset_google_account") {
      setShowGoogleNotice(true);
      return;
    }
    startResend(getRetryAfterSeconds(err));
    setError(getAuthErrorMessage(err, "Không gửi được mã. Vui lòng thử lại."));
  };

  const handleSendEmail = async (e) => {
    e.preventDefault();
    setError("");
    if (!EMAIL_REGEX.test(email.trim())) return setError("Định dạng email không hợp lệ.");
    setLoading(true);
    try {
      await requestCode();
    } catch (err) {
      if (err.code === "otp_resend_cooldown") {
        // Mã đã được gửi ở lần bấm trước, chỉ cần nhập mã
        setStep("reset");
        startResend(getRetryAfterSeconds(err));
      } else {
        handleRequestError(err);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    setInfo("");
    setResending(true);
    try {
      await requestCode();
      setInfo("Đã gửi mã mới. Mã cũ không còn dùng được.");
    } catch (err) {
      handleRequestError(err);
    } finally {
      setResending(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");
    if (code.length !== 6) return setError("Vui lòng nhập đủ 6 chữ số.");
    if (newPassword.length < 8 || newPassword.length > 128 || !newPassword.trim()) {
      return setError("Mật khẩu mới phải từ 8 đến 128 ký tự.");
    }
    if (newPassword !== confirm) return setError("Mật khẩu xác nhận không khớp.");
    setLoading(true);
    try {
      await authService.confirmPasswordReset(email.trim(), code, newPassword);
      navigate("/login", {
        state: {
          registeredEmail: email.trim(),
          message: "Đổi mật khẩu thành công! Vui lòng đăng nhập.",
        },
      });
    } catch (err) {
      if (err.code === "otp_attempts_exceeded" || err.code === "otp_expired") setCode("");
      setError(getAuthErrorMessage(err, "Không đổi được mật khẩu. Vui lòng thử lại."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center overflow-hidden bg-background px-container-margin py-10">
      <div className="mb-8 flex flex-col items-center">
        <div className="w-16 h-16 rounded-lg overflow-hidden mb-4 soft-shadow bg-white">
          <img src={logo} alt="LocalMate AI" className="w-full h-full object-cover object-top" />
        </div>
        <h1 className="text-headline-xl font-bold text-primary mb-1">Quên mật khẩu</h1>
        <p className="text-center text-body-md text-on-surface-variant">
          {step === "email"
            ? "Nhập email để nhận mã đặt lại mật khẩu."
            : "Nhập mã và mật khẩu mới."}
        </p>
      </div>

      <div className="w-full rounded-lg border border-white/40 bg-surface-container-lowest/80 p-8 soft-shadow blur-bg">
        {step === "email" ? (
          <form onSubmit={handleSendEmail} className="space-y-stack-md">
            <label className="block text-label-md text-on-surface-variant ml-1" htmlFor="reset-email">
              Email
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">
                mail
              </span>
              <input
                id="reset-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                className="input-field pl-12"
                required
              />
            </div>
            {error && <p className="text-error text-body-md text-center">{error}</p>}
            <button type="submit" disabled={loading || resendIn > 0} className="btn-primary mt-stack-lg">
              {loading ? "Đang gửi..." : "Gửi mã"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleReset} className="space-y-stack-md">
            <OtpCodeField
              email={email.trim()}
              value={code}
              onChange={setCode}
              disabled={loading}
              expiresIn={expiresIn}
              resendIn={resendIn}
              resending={resending}
              onResend={handleResend}
            />
            {[
              { id: "new-password", label: "Mật khẩu mới", value: newPassword, setter: setNewPassword },
              { id: "confirm-password", label: "Nhập lại mật khẩu mới", value: confirm, setter: setConfirm },
            ].map((field) => (
              <div key={field.id}>
                <label className="block text-label-md text-on-surface-variant mb-2 ml-1" htmlFor={field.id}>
                  {field.label}
                </label>
                <input
                  id={field.id}
                  type="password"
                  value={field.value}
                  onChange={(e) => field.setter(e.target.value)}
                  placeholder="Từ 8 đến 128 ký tự"
                  className="input-field"
                  required
                />
              </div>
            ))}
            {info && <p className="text-body-md text-primary text-center">{info}</p>}
            {error && <p className="text-error text-body-md text-center">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary mt-stack-lg">
              {loading ? "Đang lưu..." : "Đổi mật khẩu"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setError("");
                setInfo("");
              }}
              className="w-full text-label-md text-on-surface-variant hover:underline"
            >
              Dùng email khác
            </button>
          </form>
        )}
      </div>

      <button
        onClick={() => navigate("/login")}
        className="mt-8 text-body-md text-primary font-bold hover:underline"
      >
        Quay lại đăng nhập
      </button>

      {showGoogleNotice && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="google-account-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-container-margin"
        >
          <div className="w-full max-w-sm rounded-lg bg-surface p-stack-lg space-y-stack-md text-center">
            <h2 id="google-account-title" className="text-title-md font-bold text-on-surface">
              Tài khoản Google
            </h2>
            <p className="text-body-md text-on-surface-variant">
              Tài khoản này đăng nhập bằng Google nên không có mật khẩu. Vui lòng dùng nút
              Đăng nhập bằng Google.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowGoogleNotice(false)}
                className="flex-1 py-3 border border-outline-variant text-on-surface-variant rounded-full font-semibold"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => navigate("/login", { state: { registeredEmail: email.trim() } })}
                className="flex-1 py-3 bg-primary text-on-primary rounded-full font-semibold"
              >
                Đăng nhập Google
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
