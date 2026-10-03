export const LEGACY_SINGLE_PAYMENT_SESSION_KEY =
  "localmate_active_single_itinerary_payment_intent";
export const SINGLE_PAYMENT_SESSION_PREFIX =
  "localmate_single_itinerary_payment_session_";

export function getSinglePaymentSessionKey(ownerId) {
  if (ownerId == null || !String(ownerId).trim()) return null;
  return `${SINGLE_PAYMENT_SESSION_PREFIX}${String(ownerId).trim()}`;
}

export function getSinglePaymentIntent(ownerId) {
  try {
    // Unowned legacy hints must never become another account's payment intent.
    sessionStorage.removeItem(LEGACY_SINGLE_PAYMENT_SESSION_KEY);
    const key = getSinglePaymentSessionKey(ownerId);
    if (!key) return null;
    const parsed = JSON.parse(sessionStorage.getItem(key));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    if (!parsed.clientAttemptId && !parsed.orderId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveSinglePaymentIntent(ownerId, intent) {
  const key = getSinglePaymentSessionKey(ownerId);
  if (!key || (!intent?.clientAttemptId && !intent?.orderId)) return false;
  try {
    const hints = {};
    for (const field of [
      "clientAttemptId", "orderId", "productKind", "productCode",
      "contractVersionId", "amount", "currency", "expiresAt", "status",
      "paidAt", "qrCode", "checkoutUrl", "draftTripId",
    ]) {
      if (intent[field] !== undefined) hints[field] = intent[field];
    }
    const serialized = JSON.stringify(hints);
    sessionStorage.removeItem(LEGACY_SINGLE_PAYMENT_SESSION_KEY);
    sessionStorage.setItem(key, serialized);
    return sessionStorage.getItem(key) === serialized;
  } catch {
    return false;
  }
}

export function clearSinglePaymentIntent(ownerId) {
  const key = getSinglePaymentSessionKey(ownerId);
  if (!key) return;
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Storage is a resume hint, never payment cancellation.
  }
}
