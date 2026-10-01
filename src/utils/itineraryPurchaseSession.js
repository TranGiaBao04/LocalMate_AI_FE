export const ACTIVE_SINGLE_PAYMENT_SESSION_KEY =
  "localmate_active_single_itinerary_payment_intent";

/**
 * Lấy session thanh toán Single Itinerary hiện tại (nếu có)
 * @returns {object|null}
 */
export function getSinglePaymentIntent() {
  try {
    const raw = sessionStorage.getItem(ACTIVE_SINGLE_PAYMENT_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Lưu hoặc cập nhật session thanh toán Single Itinerary
 * @param {object} intent
 */
export function saveSinglePaymentIntent(intent) {
  try {
    if (!intent) {
      sessionStorage.removeItem(ACTIVE_SINGLE_PAYMENT_SESSION_KEY);
      return;
    }
    sessionStorage.setItem(
      ACTIVE_SINGLE_PAYMENT_SESSION_KEY,
      JSON.stringify(intent),
    );
  } catch {
    // SessionStorage may fail in private mode or quota exceeded
  }
}

/**
 * Xóa session thanh toán Single Itinerary
 */
export function clearSinglePaymentIntent() {
  try {
    sessionStorage.removeItem(ACTIVE_SINGLE_PAYMENT_SESSION_KEY);
  } catch {
    // Ignore
  }
}
