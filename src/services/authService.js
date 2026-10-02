import { apiClient } from "../api/apiClient";

export const authService = {
  login: (email, password) =>
    apiClient.post("/auth/login", { email, password }, { auth: false }),
  googleLogin: (idToken) =>
    apiClient.post("/auth/google", { idToken }, { auth: false }),
  // 202 { email, codeExpiresInSeconds, resendAfterSeconds }: chỉ gửi mã, chưa tạo tài khoản
  register: (fullName, email, password) =>
    apiClient.post(
      "/auth/register",
      { fullName, email, password },
      { auth: false },
    ),
  // 201 thông tin user, không trả token: FE chuyển về trang đăng nhập
  verifyRegistration: (email, code) =>
    apiClient.post("/auth/register/verify", { email, code }, { auth: false }),
  resendRegistrationOtp: (email) =>
    apiClient.post("/auth/register/resend", { email }, { auth: false }),
  // Email chưa đăng ký vẫn trả 202 (BE không cho biết email nào có tài khoản)
  requestPasswordReset: (email) =>
    apiClient.post("/auth/password-reset/request", { email }, { auth: false }),
  // 204
  confirmPasswordReset: (email, code, newPassword) =>
    apiClient.post(
      "/auth/password-reset/confirm",
      { email, code, newPassword },
      { auth: false },
    ),
  demo: () => apiClient.post("/auth/demo", {}, { auth: false }),
  getProfile: () => apiClient.get("/users/me"),
};
