import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { authService } from "../../services/authService";
import OtpCodeField from "../../components/auth/OtpCodeField";
import { useCountdown } from "../../hooks/useCountdown";
import { getAuthErrorMessage, getRetryAfterSeconds } from "../../utils/authErrors";
import logo from "../../assets/logo.jpg";

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // Đăng ký 2 bước: gửi thông tin -> BE gửi mã OTP -> nhập mã mới tạo tài khoản
  const [step, setStep] = useState("form"); // "form" | "verify"
  const [pendingEmail, setPendingEmail] = useState("");
  const [code, setCode] = useState("");
  const [info, setInfo] = useState("");
  const [resending, setResending] = useState(false);
  const [resendIn, startResend] = useCountdown();
  const [expiresIn, startExpire] = useCountdown();

  // BE đã gửi mã: sang bước nhập mã và bắt đầu đếm ngược
  const openVerifyStep = (sentTo, dispatch) => {
    setPendingEmail(sentTo);
    setCode("");
    setStep("verify");
    startResend(dispatch.resendAfterSeconds);
    startExpire(dispatch.codeExpiresInSeconds);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) return setError("Vui lòng nhập họ và tên.");
    if (!trimmedEmail) return setError("Vui lòng nhập email.");

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return setError("Định dạng email không hợp lệ.");
    }

    if (password.length < 8 || password.length > 128) {
      return setError("Mật khẩu phải từ 8 đến 128 ký tự.");
    }
    if (password !== confirm) {
      return setError("Mật khẩu xác nhận không khớp.");
    }

    setLoading(true);
    try {
      const dispatch = await register(trimmedName, trimmedEmail, password);
      openVerifyStep(dispatch.email ?? trimmedEmail, dispatch);
    } catch (err) {
      if (err.code === "otp_resend_cooldown") {
        // Mã đã gửi ở lần bấm trước (vẫn còn hạn), chỉ cần nhập mã
        setPendingEmail(trimmedEmail);
        setCode("");
        setStep("verify");
        startResend(getRetryAfterSeconds(err));
      } else {
        setError(getAuthErrorMessage(err, "Không thể tạo tài khoản. Vui lòng thử lại."));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");
    if (code.length !== 6) return setError("Vui lòng nhập đủ 6 chữ số.");
    setLoading(true);
    try {
      await authService.verifyRegistration(pendingEmail, code);
      navigate("/login", {
        state: {
          registeredEmail: pendingEmail,
          message: "Đăng ký thành công! Vui lòng đăng nhập.",
        },
      });
    } catch (err) {
      if (err.code === "otp_attempts_exceeded" || err.code === "otp_expired") setCode("");
      setError(getAuthErrorMessage(err, "Không thể xác thực. Vui lòng thử lại."));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    setInfo("");
    setResending(true);
    try {
      const dispatch = await authService.resendRegistrationOtp(pendingEmail);
      openVerifyStep(pendingEmail, dispatch);
      setInfo("Đã gửi mã mới. Mã cũ không còn dùng được.");
    } catch (err) {
      startResend(getRetryAfterSeconds(err));
      setError(getAuthErrorMessage(err, "Không gửi lại được mã. Vui lòng thử lại."));
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center overflow-hidden bg-background px-container-margin py-10">
      <div className="mb-8 flex flex-col items-center">
        <div className="w-16 h-16 rounded-lg overflow-hidden mb-4 soft-shadow bg-white">
          <img
            src={logo}
            alt="LocalMate AI"
            className="w-full h-full object-cover object-top"
          />
        </div>
        <h1 className="text-headline-xl font-bold text-primary mb-1">
          {step === "form" ? "Tạo tài khoản" : "Xác thực email"}
        </h1>
        <p className="text-center text-body-md text-on-surface-variant">
          Bắt đầu hành trình khám phá TP.HCM.
        </p>
      </div>

      <div className="w-full rounded-lg border border-white/40 bg-surface-container-lowest/80 p-8 soft-shadow blur-bg">
        {step === "verify" ? (
          <form onSubmit={handleVerify} className="space-y-stack-md">
            <OtpCodeField
              email={pendingEmail}
              value={code}
              onChange={setCode}
              disabled={loading}
              expiresIn={expiresIn}
              resendIn={resendIn}
              resending={resending}
              onResend={handleResend}
            />
            {info && <p className="text-body-md text-primary text-center">{info}</p>}
            {error && <p className="text-error text-body-md text-center">{error}</p>}
            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="btn-primary mt-stack-lg"
            >
              {loading ? "Đang xác thực..." : "Xác nhận"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("form");
                setError("");
                setInfo("");
              }}
              className="w-full text-label-md text-on-surface-variant hover:underline"
            >
              Sửa email hoặc thông tin đăng ký
            </button>
          </form>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-stack-md">
          {[
            {
              label: "Họ và tên",
              icon: "person",
              value: fullName,
              setter: setFullName,
              type: "text",
              placeholder: "Nguyễn Văn A",
            },
            {
              label: "Email",
              icon: "mail",
              value: email,
              setter: setEmail,
              type: "email",
              placeholder: "email@example.com",
            },
            {
              label: "Mật khẩu",
              icon: "lock",
              value: password,
              setter: setPassword,
              type: "password",
              placeholder: "Từ 8 đến 128 ký tự",
            },
            {
              label: "Xác nhận mật khẩu",
              icon: "lock_reset",
              value: confirm,
              setter: setConfirm,
              type: "password",
              placeholder: "Nhập lại mật khẩu",
            },
          ].map((field) => (
            <div key={field.label}>
              <label className="block text-label-md text-on-surface-variant mb-2 ml-1">
                {field.label}
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">
                  {field.icon}
                </span>
                <input
                  type={field.type}
                  value={field.value}
                  onChange={(e) => field.setter(e.target.value)}
                  placeholder={field.placeholder}
                  className="input-field pl-12"
                  required
                />
              </div>
            </div>
          ))}

          {error && (
            <p className="text-error text-body-md text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary mt-stack-lg"
          >
            {loading ? "Đang gửi mã..." : "Tạo tài khoản"}
            <span className="material-symbols-outlined text-[20px]">
              arrow_forward
            </span>
          </button>
        </form>
        )}
      </div>

      <div className="mt-8 text-center">
        <p className="text-body-md text-on-surface-variant">
          Đã có tài khoản?{" "}
          <button
            onClick={() => navigate("/login")}
            className="text-primary font-bold hover:underline ml-1"
          >
            Đăng nhập
          </button>
        </p>
      </div>

      <div className="fixed bottom-0 left-0 w-full h-1/3 pointer-events-none opacity-20">
        <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-primary-container rounded-full blur-[100px]" />
        <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-secondary-container rounded-full blur-[100px]" />
      </div>
    </div>
  );
}
