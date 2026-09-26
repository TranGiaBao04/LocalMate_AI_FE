import { apiClient } from "../api/apiClient";

export const subscriptionService = {
  /**
   * Lấy danh sách gói dịch vụ công khai (Free, TripPass, Membership)
   * Public endpoint, không bắt buộc đăng nhập
   */
  getPlans: () => apiClient.get("/subscription/plans", { auth: false }),

  /**
   * Lấy thông tin gói cước và hạn mức sử dụng hiện tại của người dùng
   * Yêu cầu tài khoản thực (persisted User/Admin)
   */
  getMySubscription: () => apiClient.get("/subscription/me"),

  /**
   * Tạo yêu cầu thanh toán mua gói cước mới (TripPass hoặc Membership)
   * @param {string} planCode "TripPass" | "Membership"
   */
  checkout: (planCode) =>
    apiClient.post("/subscription/checkout", { planCode }),

  /**
   * Tạo yêu cầu thanh toán gia hạn gói cước trả phí đang hoạt động
   * Không truyền planCode (Backend tự xác định gói hiệu lực)
   */
  renew: () => apiClient.post("/subscription/renew"),

  /**
   * Tra cứu chi tiết và trạng thái đơn hàng thanh toán
   * @param {string} orderId GUID mã đơn hàng
   */
  getOrder: (orderId) => apiClient.get(`/subscription/orders/${orderId}`),
};
