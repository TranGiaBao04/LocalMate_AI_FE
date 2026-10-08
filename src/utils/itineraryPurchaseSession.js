export const LEGACY_SINGLE_PAYMENT_SESSION_KEY =
  "localmate_active_single_itinerary_payment_intent";
export const SINGLE_PAYMENT_SESSION_PREFIX =
  "localmate_single_itinerary_payment_session_";
export const SINGLE_RETURN_CONTEXT_PREFIX = "localmate_single_return_context_";
const RETURN_CONTEXT_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_RETURN_CONTEXTS = 10;

function returnContexts(ownerId) {
  const key = getSinglePaymentSessionKey(ownerId);
  if (!key) return [];
  try {
    const records = JSON.parse(localStorage.getItem(`${SINGLE_RETURN_CONTEXT_PREFIX}${ownerId}`));
    if (!Array.isArray(records)) return [];
    return records.filter((record) => record?.ownerId === String(ownerId) &&
      record.productKind === "SingleItinerary" && typeof record.orderId === "string" &&
      record.orderId && typeof record.clientAttemptId === "string" && record.clientAttemptId &&
      Number.isFinite(record.savedAt) && record.savedAt <= Date.now() &&
      Date.now() - record.savedAt < RETURN_CONTEXT_TTL_MS);
  } catch {
    return [];
  }
}

export function prepareSinglePaymentReturn(ownerId, intent) {
  if (!getSinglePaymentSessionKey(ownerId) || !intent?.orderId || !intent.clientAttemptId ||
    intent.productKind !== "SingleItinerary") return false;
  try {
    const records = returnContexts(ownerId).filter((record) => record.orderId !== intent.orderId);
    // Cross-tab hints contain correlation only, never cached financial/provider state.
    records.push({ ownerId: String(ownerId), productKind: "SingleItinerary",
      orderId: intent.orderId, clientAttemptId: intent.clientAttemptId,
      draftTripId: intent.draftTripId ?? null, savedAt: Date.now() });
    const key = `${SINGLE_RETURN_CONTEXT_PREFIX}${ownerId}`;
    const serialized = JSON.stringify(records.slice(-MAX_RETURN_CONTEXTS));
    localStorage.setItem(key, serialized);
    return localStorage.getItem(key) === serialized;
  } catch {
    return false;
  }
}

export function getSinglePaymentReturnIntent(ownerId, orderId) {
  const session = getSinglePaymentIntent(ownerId);
  if (session?.orderId && (!orderId || session.orderId === orderId) &&
    (!session.productKind || session.productKind === "SingleItinerary")) return session;
  // Shared history is exact-order only. Never infer a queryless return from the latest Single.
  if (!orderId) return null;
  return returnContexts(ownerId).find((record) => record.orderId === orderId) ?? null;
}

export function openSinglePaymentCheckout(checkoutUrl) {
  const url = new URL(checkoutUrl);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Invalid checkout URL");
  window.location.replace(url.href);
}

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
    localStorage.removeItem(`${SINGLE_RETURN_CONTEXT_PREFIX}${ownerId}`);
  } catch {
    // Storage is a resume hint, never payment cancellation.
  }
}
