import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import logo from "../../assets/logo.jpg";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loginDemo } = useAuth();

  const [email, setEmail] = useState(
    () => location.state?.registeredEmail || "",
  );
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(
    () => location.state?.message || "",
  );

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
      await login(trimmedEmail, password);
      navigate("/home");
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

  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center overflow-hidden bg-background px-container-margin py-10">
      {/* Brand */}
      <div className="mb-10 flex flex-col items-center">
        <div className="w-16 h-16 rounded-lg overflow-hidden mb-6 soft-shadow bg-white">
          <img
            src={logo}
            alt="LocalMate AI"
            className="w-full h-full object-cover object-top"
          />
        </div>
        <h1 className="text-headline-xl font-bold text-primary mb-2">
          Đăng nhập
        </h1>
        <p className="px-4 text-center text-body-lg text-on-surface-variant">
          Lưu lịch trình và xem lại chuyến đi của bạn.
        </p>
      </div>

      {/* Form */}
      <div className="w-full rounded-lg border border-white/40 bg-surface-container-lowest/80 p-8 soft-shadow blur-bg">
        {success && (
          <div className="mb-6 rounded-lg bg-primary-container/20 border border-primary/30 p-3.5 text-center text-body-md text-primary font-medium">
            {success}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-stack-md">
          <div>
            <label className="block text-label-md text-on-surface-variant mb-2 ml-1">
              Email
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">
                mail
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="input-field pl-12"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2 ml-1">
              <label className="text-label-md text-on-surface-variant">
                Mật khẩu
              </label>
              <button
                type="button"
                className="text-label-md text-primary hover:underline"
              >
                Quên mật khẩu?
              </button>
            </div>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">
                lock
              </span>
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mật khẩu"
                className="input-field pl-12 pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-outline hover:text-primary transition-colors"
              >
                <span className="material-symbols-outlined">
                  {showPass ? "visibility_off" : "visibility"}
                </span>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || loadingDemo}
            className="btn-primary mt-stack-lg"
          >
            {loading ? "Đang đăng nhập..." : "Đăng nhập"}
            <span className="material-symbols-outlined text-[20px]">
              arrow_forward
            </span>
          </button>

          {error && (
            <p className="text-center text-body-md text-error">{error}</p>
          )}

          <div className="relative my-4 flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-outline-variant/30" />
            </div>
            <div className="relative bg-surface-container-lowest px-3 text-label-md text-on-surface-variant">
              hoặc
            </div>
          </div>

          <button
            type="button"
            onClick={handleDemoLogin}
            disabled={loading || loadingDemo}
            className="btn-secondary flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[20px]">explore</span>
            {loadingDemo ? "Đang vào demo..." : "Trải nghiệm nhanh (Demo)"}
          </button>
        </form>
      </div>

      <div className="mt-8 text-center">
        <p className="text-body-md text-on-surface-variant">
          Chưa có tài khoản?{" "}
          <button
            onClick={() => navigate("/register")}
            className="text-primary font-bold hover:underline ml-1"
          >
            Đăng ký
          </button>
        </p>
      </div>

      <div className="mt-12 text-center opacity-50">
        <p className="text-label-md tracking-widest text-on-surface-variant uppercase">
          LocalMate AI
        </p>
      </div>

      {/* Bg blobs */}
      <div className="fixed bottom-0 left-0 w-full h-1/3 z-0 pointer-events-none opacity-20 overflow-hidden">
        <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-primary-container rounded-full blur-[100px]" />
        <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-secondary-container rounded-full blur-[100px]" />
      </div>
    </div>
  );
}
