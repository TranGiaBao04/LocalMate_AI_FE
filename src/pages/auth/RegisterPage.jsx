import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!fullName.trim()) return setError("Vui lòng nhập họ tên.");
    if (password.length < 6) return setError("Mật khẩu tối thiểu 6 ký tự.");
    if (password !== confirm) return setError("Mật khẩu xác nhận không khớp.");
    setLoading(true);
    const ok = await register(fullName, email, password);
    if (ok) navigate("/home");
    else setError("Hiện tại chỉ hỗ trợ đăng nhập bằng tài khoản mẫu.");
    setLoading(false);
  };

  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center overflow-hidden bg-background px-container-margin py-10">
      <div className="mb-8 flex flex-col items-center">
        <div className="w-16 h-16 bg-primary-container rounded-lg flex items-center justify-center mb-4 soft-shadow">
          <span
            className="material-symbols-outlined text-on-primary-container"
            style={{ fontSize: 36, fontVariationSettings: "'FILL' 1" }}
          >
            person_add
          </span>
        </div>
        <h1 className="text-headline-xl font-bold text-primary mb-1">
          Tạo tài khoản
        </h1>
        <p className="text-center text-body-md text-on-surface-variant">
          Bắt đầu hành trình khám phá TP.HCM.
        </p>
      </div>

      <div className="w-full rounded-lg border border-white/40 bg-surface-container-lowest/80 p-8 soft-shadow blur-bg">
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
              placeholder: "Tối thiểu 6 ký tự",
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
            {loading ? "Đang tạo..." : "Tạo tài khoản"}
            <span className="material-symbols-outlined text-[20px]">
              arrow_forward
            </span>
          </button>
        </form>
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
