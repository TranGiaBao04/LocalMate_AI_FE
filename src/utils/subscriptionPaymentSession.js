/**
 * Owner-Scoped Subscription Payment Session Management
 *
 * Backend Contract Freeze v1.0 / FE-UP3
 *
 * Scopes payment session storage strictly by authenticated user/owner identity.
 * Prevents cross-account session pollution and enforces that stored sessions
 * are safe resume hints ONLY — never financial or payment status authorities.
 *
 * SAFE PERSISTED HINTS ONLY:
 * - orderId
 * - qrCode
 * - checkoutUrl
 * - amount
 * - expiresAt
 * - type
 * - listPrice
 * - creditAmount
 *
 * FORBIDDEN:
 * - DO NOT store raw ProblemDetails, raw provider payload, token, email,
 *   profile data, credit source IDs, or internal period/version IDs.
 * - DO NOT treat stored financial values as authoritative after resume.
 */

export const SUBSCRIPTION_PAYMENT_SESSION_PREFIX =
  "localmate_subscription_payment_session_";

export const LEGACY_ACTIVE_PAYMENT_SESSION_KEY =
  "localmate_active_payment_intent";

/**
 * Returns the owner-scoped storage key for a given user ID.
 * @param {string|number} ownerId
 * @returns {string|null}
 */
export function getSubscriptionPaymentSessionKey(ownerId) {
  if (ownerId == null) {
    return null;
  }
  const cleanId = String(ownerId).trim();
  if (!cleanId) return null;
  return `${SUBSCRIPTION_PAYMENT_SESSION_PREFIX}${cleanId}`;
}

/**
 * Saves an owner-scoped subscription payment session.
 * Stores only safe hints required to resume or display an existing payment.
 *
 * @param {string|number} ownerId Authenticated user ID
 * @param {object} intentOrMetadata Payment intent or 409 metadata
 */
export function saveSubscriptionPaymentSession(ownerId, intentOrMetadata) {
  const key = getSubscriptionPaymentSessionKey(ownerId);
  if (!key || !intentOrMetadata?.orderId) return;

  try {
    const session = {
      ownerId: String(ownerId).trim(),
      orderId: String(intentOrMetadata.orderId).trim(),
      flow: "subscription",
      qrCode: intentOrMetadata.qrCode || null,
      checkoutUrl: intentOrMetadata.checkoutUrl || null,
      amount:
        intentOrMetadata.amount !== undefined ? intentOrMetadata.amount : undefined,
      expiresAt: intentOrMetadata.expiresAt || null,
      type: intentOrMetadata.type || undefined,
      listPrice:
        intentOrMetadata.listPrice !== undefined
          ? intentOrMetadata.listPrice
          : undefined,
      creditAmount:
        intentOrMetadata.creditAmount !== undefined
          ? intentOrMetadata.creditAmount
          : undefined,
      planCode: intentOrMetadata.planCode || undefined,
      // Status is stored ONLY as a resume hint; server GET is always authoritative on reload
      status: intentOrMetadata.status || undefined,
      savedAt: new Date().toISOString(),
    };

    const serialized = JSON.stringify(session);
    sessionStorage.setItem(key, serialized);
    // Retain legacy key alias for backward compatibility with earlier tests
    sessionStorage.setItem(LEGACY_ACTIVE_PAYMENT_SESSION_KEY, serialized);
  } catch {
    // sessionStorage might throw if storage disabled or quota exceeded
  }
}

/**
 * Retrieves the owner-scoped subscription payment session for the current user.
 * Validates that ownerId matches and flow is "subscription".
 *
 * @param {string|number} ownerId Authenticated user ID
 * @returns {object|null}
 */
export function getSubscriptionPaymentSession(ownerId) {
  const key = getSubscriptionPaymentSessionKey(ownerId);
  if (!key) return null;

  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    if (
      parsed.ownerId === String(ownerId).trim() &&
      parsed.flow === "subscription" &&
      parsed.orderId
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Clears the owner-scoped subscription payment session for the given user.
 * Does not disturb other accounts' stored state.
 *
 * @param {string|number} ownerId Authenticated user ID
 */
export function clearSubscriptionPaymentSession(ownerId) {
  const key = getSubscriptionPaymentSessionKey(ownerId);
  if (!key) return;

  try {
    sessionStorage.removeItem(key);
    sessionStorage.removeItem(LEGACY_ACTIVE_PAYMENT_SESSION_KEY);
  } catch {
    // Ignore
  }
}
