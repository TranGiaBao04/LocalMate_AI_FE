import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const ok = await login(email, password);
    if (ok) navigate("/home");
    else setError("Email hoặc mật khẩu không đúng.");
    setLoading(false);
  };

  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center overflow-hidden bg-background px-container-margin py-10">
      {/* Brand */}
      <div className="mb-10 flex flex-col items-center">
        <div className="w-16 h-16 bg-primary-container rounded-lg flex items-center justify-center mb-6 soft-shadow">
          <span
            className="material-symbols-outlined text-on-primary-container"
            style={{ fontSize: 36, fontVariationSettings: "'FILL' 1" }}
          >
            explore
          </span>
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
            disabled={loading}
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
