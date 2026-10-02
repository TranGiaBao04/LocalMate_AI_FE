import { apiClient } from "../api/apiClient";

export function canPurchaseSingle(availability) {
  return availability?.purchaseAllowed === true &&
    availability.productKind === "SingleItinerary" &&
    availability.currency === "VND" &&
    Number.isSafeInteger(availability.price) && availability.price > 0;
}

export function isAvailableSingleEntitlement(entitlement) {
  return entitlement?.available === true &&
    entitlement.consumedAt == null && entitlement.consumedTripId == null &&
    typeof entitlement.entitlementId === "string" &&
    entitlement.entitlementId.trim().length > 0;
}

export function singleOrderState(order) {
  if (order?.status === "Paid") {
    return order.entitlement != null ? "ENTITLEMENT_GRANTED" : "VERIFYING";
  }
  if (order?.status === "Pending") {
    return order.qrCode || order.checkoutUrl ? "PAYMENT_READY" : "PREPARING";
  }
  if (order?.status === "Failed") return "FAILED";
  if (order?.status === "Expired") return "EXPIRED";
  return "UNRESOLVED";
}

export const itineraryPurchaseService = {
  /**
   * Lấy thông tin khả dụng và báo giá mua lượt chốt lẻ
   * @returns {Promise<object>}
   */
  getAvailability: () => apiClient.get("/itinerary-purchases/availability"),

  /**
   * Khởi tạo hoặc tiếp tục giao dịch thanh toán mua lẻ
   * Gửi clientAttemptId duy nhất cho mỗi lượt mua có chủ đích của người dùng.
   * Sử dụng postWithMeta để phân biệt chính xác HTTP 200 (sẵn sàng) vs 202 (đã ghi nhận nhưng link chưa sẵn sàng).
   * @param {string} clientAttemptId UUID
   * @returns {Promise<{ status: number, data: object }>}
   */
  checkout: (clientAttemptId) =>
    apiClient.postWithMeta("/itinerary-purchases/checkout", {
      clientAttemptId,
    }),

  /**
   * Lấy thông tin chi tiết đơn hàng đã sở hữu (authoritative polling endpoint)
   * @param {string} orderId UUID
   * @returns {Promise<object>}
   */
  getOrder: (orderId) => apiClient.get(`/itinerary-purchases/orders/${orderId}`),

  /**
   * Lấy danh sách các quyền chốt lẻ của người dùng hiện tại
   * @returns {Promise<{ unusedEntitlementCount: number, entitlements: Array }>}
   */
  getMyEntitlements: () => apiClient.get("/itinerary-purchases/me"),
};
