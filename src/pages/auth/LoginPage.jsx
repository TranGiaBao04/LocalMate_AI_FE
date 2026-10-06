import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { canAccessAdmin } from "../../utils/adminAccess";
import GoogleSignInButton from "../../components/auth/GoogleSignInButton";
import LoginTravelPanel from "../../components/auth/LoginTravelPanel";
import logo from "../../assets/logo.jpg";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loginWithGoogle, loginDemo, sessionNotice, clearSessionNotice } = useAuth();

  const [email, setEmail] = useState(
    () => location.state?.registeredEmail || "",
  );
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const googleLoginInFlight = useRef(false);
  const [error, setError] = useState(() => sessionNotice);
  const [success, setSuccess] = useState(
    () => (sessionNotice ? "" : location.state?.message || ""),
  );

  useEffect(() => {
    if (sessionNotice) clearSessionNotice();
  }, [sessionNotice, clearSessionNotice]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Vui lòng nhập địa chỉ email.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError("Định dạng email không hợp lệ.");
      return;
    }
    if (!password) {
      setError("Vui lòng nhập mật khẩu.");
      return;
    }

    setLoading(true);
    try {
      const { user } = await login(trimmedEmail, password, rememberMe);
      navigate(canAccessAdmin(user) ? "/admin" : "/home");
    } catch (err) {
      if (err.code === "invalid_credentials" || err.status === 401) {
        setError("Email hoặc mật khẩu không chính xác.");
      } else {
        setError(err.message || "Đăng nhập không thành công. Vui lòng thử lại.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setError("");
    setSuccess("");
    setLoadingDemo(true);
    try {
      await loginDemo();
      navigate("/home");
    } catch (err) {
      setError(
        err.message || "Không thể khởi tạo phiên demo. Vui lòng thử lại.",
      );
    } finally {
      setLoadingDemo(false);
    }
  };

  const handleGoogleCredential = async (idToken) => {
    if (googleLoginInFlight.current || loading || loadingDemo) return;
    googleLoginInFlight.current = true;
    setLoadingGoogle(true);
    setError("");
    setSuccess("");
    try {
      const { user } = await loginWithGoogle(idToken, rememberMe);
      navigate(canAccessAdmin(user) ? "/admin" : "/home");
    } catch (err) {
      if (err.code === "account_link_required") {
        setError("Email này đã có tài khoản LocalMate. Vui lòng đăng nhập bằng email và mật khẩu.");
      } else if (err.code === "account_conflict") {
        setError("Không thể liên kết tài khoản Google. Vui lòng thử lại sau.");
      } else if (err.code === "account_locked") {
        setError(err.message);
      } else if (err.code === "invalid_google_token" || err.status === 400 || err.status === 401) {
        setError("Xác thực Google không hợp lệ. Vui lòng thử lại.");
      } else if (!err.status) {
        setError("Không kết nối được máy chủ. Vui lòng thử lại.");
      } else {
        setError("Đăng nhập Google không thành công. Vui lòng thử lại.");
      }
    } finally {
      googleLoginInFlight.current = false;
      setLoadingGoogle(false);
    }
  };

  const busy = loading || loadingDemo || loadingGoogle;
  const fieldClass = "h-14 w-full rounded-[12px] border border-[#dce3e9] bg-[#fafcfd] pl-12 pr-4 text-sm text-[#172b3b] outline-none transition-colors placeholder:text-[#8b99a5] focus:border-[#2181a5] focus:bg-white focus:ring-2 focus:ring-[#2181a5]/15 disabled:opacity-60";
  const linkClass = "rounded-sm text-[#176883] outline-none hover:text-[#104a62] hover:underline focus-visible:ring-2 focus-visible:ring-[#2181a5] focus-visible:ring-offset-4";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#edf3f5] px-3 py-5 sm:px-6 md:px-8 md:py-10">
      <div className="grid w-full max-w-[1220px] grid-cols-1 gap-0 rounded-[30px] border border-white bg-white p-2.5 shadow-[0_24px_80px_-28px_rgba(23,58,75,0.28)] md:p-3 lg:grid-cols-[46%_54%]">
        <LoginTravelPanel />

        <section aria-labelledby="login-title" className="mx-auto flex w-full min-w-0 max-w-[520px] flex-col justify-center px-4 py-5 sm:px-9 md:px-8 lg:max-w-none lg:px-16">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="mb-3 inline-flex h-8 w-fit shrink-0 items-center gap-2 whitespace-nowrap rounded-[8px] px-2.5 text-xs font-medium text-[#176883] no-underline outline-none transition-colors hover:bg-[#edf5f7] hover:text-[#104a62] focus-visible:ring-2 focus-visible:ring-[#2181a5] focus-visible:ring-offset-2 motion-reduce:transition-none lg:mb-2"
          >
            <span aria-hidden="true" className="material-symbols-outlined shrink-0 text-[17px] leading-none">arrow_back</span>
            <span>Quay lại trang chủ</span>
          </button>

          <button
            type="button"
            aria-label="LocalMate AI - Trang chủ"
            onClick={() => navigate("/")}
            className="mb-4 flex w-fit items-center gap-3 rounded-[8px] outline-none focus-visible:ring-2 focus-visible:ring-[#2181a5] focus-visible:ring-offset-4"
          >
            <img src={logo} alt="LocalMate AI" className="h-12 w-12 rounded-[8px] object-cover object-top" />
            <span className="text-lg font-semibold text-[#173f57]">
              LocalMate <span className="text-[#24828d]">AI</span>
            </span>
          </button>

          <h1 id="login-title" className="text-[26px] font-bold leading-snug text-[#172b3b] lg:text-[30px]">
            Chào mừng bạn trở lại
          </h1>
          <p className="mb-5 mt-2 text-sm leading-6 text-[#657784] lg:mb-4">
            Đăng nhập để tiếp tục hành trình cùng LocalMate AI.
          </p>

          {success && (
            <div role="status" className="mb-5 rounded-[8px] border border-[#b8dfd7] bg-[#f0faf7] px-4 py-3 text-sm leading-6 text-[#256653]">
              {success}
            </div>
          )}
          {error && (
            <div role="alert" className="mb-5 flex items-start gap-2.5 rounded-[8px] border border-[#eed1cb] bg-[#fff5f2] px-4 py-3 text-sm leading-6 text-[#983d30]">
              <span aria-hidden="true" className="material-symbols-outlined mt-0.5 text-[20px]">error</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} noValidate aria-busy={busy} className="space-y-4 lg:space-y-3">
            <div>
              <label htmlFor="login-email" className="mb-2 block text-sm font-medium text-[#324b5a]">
                Email
              </label>
              <div className="relative">
                <span aria-hidden="true" className="material-symbols-outlined pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[20px] text-[#81949e]">mail</span>
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ban@example.com"
                  disabled={busy}
                  className={fieldClass}
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="mb-2 block text-sm font-medium text-[#324b5a]">
                Mật khẩu
              </label>
              <div className="relative">
                <span aria-hidden="true" className="material-symbols-outlined pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[20px] text-[#81949e]">lock</span>
                <input
                  id="login-password"
                  name="password"
                  type={showPass ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu của bạn"
                  disabled={busy}
                  className={`${fieldClass} pr-14`}
                />
                <button
                  type="button"
                  title={showPass ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  aria-label={showPass ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  aria-pressed={showPass}
                  onClick={() => setShowPass(!showPass)}
                  disabled={busy}
                  className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-[8px] text-[#81949e] outline-none hover:bg-[#edf3f5] hover:text-[#176883] focus-visible:ring-2 focus-visible:ring-[#2181a5]"
                >
                  <span aria-hidden="true" className="material-symbols-outlined text-[20px]">
                    {showPass ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs sm:text-sm">
              <label className="flex min-h-8 cursor-pointer items-center gap-2.5 text-[#506773]">
                <input
                  type="checkbox"
                  name="rememberMe"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={busy}
                  className="h-4 w-4 rounded border-[#c4d2d9] accent-[#176883] outline-none focus-visible:ring-2 focus-visible:ring-[#2181a5] focus-visible:ring-offset-2"
                />
                Ghi nhớ đăng nhập
              </label>
              <button
                type="button"
                onClick={() => navigate("/forgot-password", { state: { email: email.trim() } })}
                className={`min-h-8 font-medium ${linkClass}`}
              >
                Quên mật khẩu?
              </button>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="flex h-14 w-full items-center justify-center gap-3 rounded-[12px] bg-[#176883] text-sm font-semibold text-white shadow-[0_5px_14px_-5px_rgba(23,104,131,0.4)] outline-none transition-colors hover:bg-[#10556e] focus-visible:ring-2 focus-visible:ring-[#2181a5] focus-visible:ring-offset-4 disabled:cursor-wait disabled:opacity-60"
            >
              {loading ? "Đang đăng nhập..." : "Đăng nhập"}
              <span aria-hidden="true" className="material-symbols-outlined text-[20px]">arrow_forward</span>
            </button>

            <div className="flex items-center gap-4 text-xs text-[#8b99a5]">
              <span className="h-px flex-1 bg-[#e6ecef]" />
              hoặc
              <span className="h-px flex-1 bg-[#e6ecef]" />
            </div>

            <GoogleSignInButton
              disabled={busy}
              onCredential={handleGoogleCredential}
              onError={setError}
            />

            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={busy}
              className="mx-auto flex min-h-10 items-center justify-center gap-2 rounded-[8px] px-3 text-sm text-[#607680] outline-none hover:bg-[#f2f7f8] hover:text-[#176883] focus-visible:ring-2 focus-visible:ring-[#2181a5] disabled:opacity-60"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[19px]">explore</span>
              {loadingDemo ? "Đang vào demo..." : "Trải nghiệm nhanh (Demo)"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-[#657784]">
            Chưa có tài khoản?{" "}
            <button type="button" onClick={() => navigate("/register")} className={`ml-1 font-semibold ${linkClass}`}>
              Đăng ký
            </button>
          </p>
        </section>
      </div>
    </main>
  );
}
