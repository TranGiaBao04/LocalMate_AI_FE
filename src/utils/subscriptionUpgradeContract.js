/**
 * Subscription Upgrade Frontend Contract Boundary
 * Backend contract version: 1.0 (SUBSCRIPTION_UPGRADE_BE_CONTRACT_VERSION = 1.0)
 *
 * This module defines authoritative DTO contracts, enums, stable error codes,
 * and safe shape-validation/extraction helpers.
 *
 * STRICT CONSTRAINTS:
 * - NO financial calculations (no credit calculator, no price math, no day-ratio formulas).
 * - NO calendar-day calculation or touched-day policy logic.
 * - NO plan rank hierarchy or hard-coded plan priority.
 * - NO status synthesis from error text, timers, or navigation redirects.
 * - Server-provided values are authoritative and must be preserved verbatim.
 */

export const SUBSCRIPTION_UPGRADE_BE_CONTRACT_VERSION = "1.0";

// ============================================================================
// 1. EXACT STRING ENUMS
// ============================================================================

/**
 * Exact payment order statuses from Backend contract freeze v1.0.
 * @readonly
 * @enum {string}
 */
export const PAYMENT_ORDER_STATUS = Object.freeze({
  PENDING: "Pending",
  PAID: "Paid",
  FAILED: "Failed",
  EXPIRED: "Expired",
  REVIEW_REQUIRED: "ReviewRequired",
});

/**
 * Array of all known valid payment order statuses.
 */
export const KNOWN_PAYMENT_ORDER_STATUSES = Object.freeze([
  PAYMENT_ORDER_STATUS.PENDING,
  PAYMENT_ORDER_STATUS.PAID,
  PAYMENT_ORDER_STATUS.FAILED,
  PAYMENT_ORDER_STATUS.EXPIRED,
  PAYMENT_ORDER_STATUS.REVIEW_REQUIRED,
]);

/**
 * Exact payment order types from Backend contract freeze v1.0.
 * @readonly
 * @enum {string}
 */
export const PAYMENT_ORDER_TYPE = Object.freeze({
  PURCHASE: "Purchase",
  RENEWAL: "Renewal",
  UPGRADE: "Upgrade",
});

/**
 * Array of all known valid payment order types.
 */
export const KNOWN_PAYMENT_ORDER_TYPES = Object.freeze([
  PAYMENT_ORDER_TYPE.PURCHASE,
  PAYMENT_ORDER_TYPE.RENEWAL,
  PAYMENT_ORDER_TYPE.UPGRADE,
]);

/**
 * Exact checkout quote types from Backend contract freeze v1.0.
 * Note: Quote type is NEVER "Renewal". Same-plan renew is offered via separate POST /renew.
 * @readonly
 * @enum {string}
 */
export const CHECKOUT_QUOTE_TYPE = Object.freeze({
  PURCHASE: "Purchase",
  UPGRADE: "Upgrade",
});

/**
 * Array of all known valid checkout quote types.
 */
export const KNOWN_CHECKOUT_QUOTE_TYPES = Object.freeze([
  CHECKOUT_QUOTE_TYPE.PURCHASE,
  CHECKOUT_QUOTE_TYPE.UPGRADE,
]);

// ============================================================================
// 2. EXACT STABLE ERROR CODES
// ============================================================================

/**
 * Stable customer subscription error codes defined by Backend contract freeze v1.0.
 * Business decisions must be made against these codes, NOT human titles or messages.
 * @readonly
 */
export const CUSTOMER_SUBSCRIPTION_ERROR_CODES = Object.freeze({
  INVALID_PLAN_CODE: "invalid_plan_code",
  PLAN_ALREADY_ACTIVE: "plan_already_active",
  ALREADY_COVERED_BY_HIGHER_PLAN: "already_covered_by_higher_plan",
  TARGET_PLAN_ALREADY_SCHEDULED: "target_plan_already_scheduled",
  PENDING_ORDER_EXISTS: "pending_order_exists",
  ANOTHER_PENDING_ORDER: "another_pending_order",
  PAYMENT_REVIEW_REQUIRED: "payment_review_required",
  PAYMENT_GATEWAY_UNAVAILABLE: "payment_gateway_unavailable",
  NO_ACTIVE_SUBSCRIPTION: "no_active_subscription",
  UPGRADE_CHECKOUT_NOT_READY: "upgrade_checkout_not_ready",
  PERSISTED_ACCOUNT_REQUIRED: "persisted_account_required",
  INVALID_IDENTITY: "invalid_identity",
  ACCOUNT_NOT_FOUND: "account_not_found",
  ACCOUNT_LOCKED: "account_locked",
  INVALID_ID: "invalid_id",
  PAYMENT_ORDER_NOT_FOUND: "payment_order_not_found",
});

export const CUSTOMER_ERROR_CODES = CUSTOMER_SUBSCRIPTION_ERROR_CODES;

/**
 * Stable admin payment & entitlement error codes defined by Backend contract freeze v1.0.
 * @readonly
 */
export const ADMIN_SUBSCRIPTION_ERROR_CODES = Object.freeze({
  INVALID_TRANSACTION_QUERY: "invalid_transaction_query",
  TRANSACTION_EXPORT_LIMIT_EXCEEDED: "transaction_export_limit_exceeded",
  TRANSACTION_NOT_FOUND: "transaction_not_found",
  PAYMENT_PROVIDER_UNAVAILABLE: "payment_provider_unavailable",
  PAYMENT_PROVIDER_MISMATCH: "payment_provider_mismatch",
  INVALID_ENTITLEMENT_REPAIR_REQUEST: "invalid_entitlement_repair_request",
  ENTITLEMENT_REPAIR_NOT_ELIGIBLE: "entitlement_repair_not_eligible",
  ENTITLEMENT_REPAIR_CONFLICT: "entitlement_repair_conflict",
});

export const ADMIN_ERROR_CODES = ADMIN_SUBSCRIPTION_ERROR_CODES;

// ============================================================================
// 3. JSDOC TYPEDEFS (AUTHORITATIVE DTO CONTRACTS)
// ============================================================================

/**
 * @typedef {Object} CheckoutQuoteCredit
 * @property {string} planCode Customer/public source plan code
 * @property {string} planName Display name of source plan
 * @property {number} remainingDays Calculated remaining days preview (Vietnam date policy)
 * @property {number} creditAmount Calculated raw credit amount preview in VND
 */

/**
 * Authoritative response from GET /api/subscription/checkout-quote?planCode=...
 * @typedef {Object} CheckoutQuote
 * @property {string} planCode Customer/public target code
 * @property {"Purchase" | "Upgrade"} type Quote classification (NEVER "Renewal")
 * @property {number} listPrice Target plan gross catalog price in VND
 * @property {number} creditAmount Applied aggregate credit preview in VND (authoritative top-level)
 * @property {number} amount Cash payable preview in VND
 * @property {number} durationDays Target plan purchased duration in days
 * @property {CheckoutQuoteCredit[]} credits Explanatory source credit rows (may be empty)
 */

/**
 * Authoritative request for POST /api/subscription/checkout
 * Strictly planCode only. No client financial or user fields allowed.
 * @typedef {Object} SubscriptionCheckoutRequest
 * @property {string} planCode Target plan code
 */

/**
 * Authoritative response from POST /api/subscription/checkout and POST /api/subscription/renew
 * @typedef {Object} PaymentIntent
 * @property {string} orderId Backend payment order GUID string
 * @property {string|null} qrCode PayOS QR code payload (may be empty if paid or under review)
 * @property {string|null} checkoutUrl PayOS hosted checkout URL (may be empty)
 * @property {number} amount Settled/payable cash amount in VND
 * @property {string|null} expiresAt Order expiration UTC timestamp
 * @property {string} status Payment order status (PaymentOrderStatus)
 * @property {"Purchase" | "Renewal" | "Upgrade" | string} type Payment order type
 * @property {number} listPrice Gross target price in VND
 * @property {number} creditAmount Applied unused-value credit in VND
 */

/**
 * Authoritative response from GET /api/subscription/orders/{orderId}
 * Note: Does NOT include qrCode, checkoutUrl, durationDays, credits, or currency.
 * @typedef {Object} OwnedSubscriptionOrder
 * @property {string} orderId Backend payment order GUID string
 * @property {string} status Payment order status (PaymentOrderStatus)
 * @property {string} planCode Public plan code
 * @property {number} amount Payable cash amount in VND
 * @property {string|null} expiresAt Expiration UTC timestamp
 * @property {string|null} [paidAt] Settlement UTC timestamp if paid
 * @property {"Purchase" | "Renewal" | "Upgrade" | string} type Payment order type
 * @property {number} listPrice Gross target price in VND
 * @property {number} creditAmount Applied credit in VND
 */

/**
 * Usage counters within MySubscription DTO.
 * @typedef {Object} SubscriptionUsage
 * @property {number} generateUsed AI generate requests used in current period
 * @property {number|null} generateLimit Quota limit (null means unlimited; 0 means zero)
 * @property {string} resetAt Reset UTC timestamp
 */

/**
 * Saved trips counters within MySubscription DTO.
 * @typedef {Object} SubscriptionSavedTrips
 * @property {number} used Normal finalized capacity count
 * @property {number|null} limit Normal limit (null means unlimited)
 */

/**
 * Authoritative response from GET /api/subscription/me
 * @typedef {Object} MySubscription
 * @property {string} plan Effective plan code
 * @property {string|null} endsAt Backend PaidThrough horizon UTC timestamp
 * @property {SubscriptionUsage|null} usage Usage statistics
 * @property {SubscriptionSavedTrips|null} savedTrips Saved trips quota
 * @property {string|null} effectiveUntil Current period effective boundary UTC timestamp
 */

/**
 * Safe 409 Conflict metadata extracted from ProblemDetails extensions or root.
 * Represents an unexpired pending order or review blocker snapshot.
 * Note: Does NOT contain payment status or planCode.
 * @typedef {Object} PendingPaymentMetadata
 * @property {string} orderId Payment order GUID string
 * @property {string|null} qrCode PayOS QR code data if present
 * @property {string|null} checkoutUrl Hosted checkout URL if present
 * @property {number|undefined} amount Payable cash amount in VND
 * @property {string|null} expiresAt Expiration UTC timestamp
 * @property {string|undefined} type Payment order type (e.g. "Upgrade", "Purchase")
 * @property {number|undefined} listPrice Gross target price in VND
 * @property {number|undefined} creditAmount Applied credit in VND
 */

// ============================================================================
// 4. RECOGNITION AND ERROR HELPERS
// ============================================================================

/**
 * Checks whether a given status string is a known PaymentOrderStatus.
 * Preserves unknown statuses without coercing them.
 * @param {any} status
 * @returns {boolean}
 */
export function isKnownPaymentStatus(status) {
  return typeof status === "string" && KNOWN_PAYMENT_ORDER_STATUSES.includes(status);
}

/**
 * Checks whether a given type string is a known PaymentOrderType.
 * @param {any} type
 * @returns {boolean}
 */
export function isKnownPaymentOrderType(type) {
  return typeof type === "string" && KNOWN_PAYMENT_ORDER_TYPES.includes(type);
}

/**
 * Checks whether a given type string is a known CheckoutQuoteType.
 * Note: Returns false for "Renewal", which is never a quote type.
 * @param {any} type
 * @returns {boolean}
 */
export function isKnownCheckoutQuoteType(type) {
  return typeof type === "string" && KNOWN_CHECKOUT_QUOTE_TYPES.includes(type);
}

/**
 * Checks whether a code is in the frozen customer error code list.
 * @param {any} code
 * @returns {boolean}
 */
export function isKnownCustomerErrorCode(code) {
  return (
    typeof code === "string" &&
    Object.values(CUSTOMER_SUBSCRIPTION_ERROR_CODES).includes(code)
  );
}

/**
 * Checks whether a code is in the frozen admin error code list.
 * @param {any} code
 * @returns {boolean}
 */
export function isKnownAdminErrorCode(code) {
  return (
    typeof code === "string" &&
    Object.values(ADMIN_SUBSCRIPTION_ERROR_CODES).includes(code)
  );
}

/**
 * Safely extracts error code from an error or data payload without guessing.
 * Checks error.code, payload.code, or payload.extensions.code.
 * @param {any} errorOrData
 * @returns {string|null}
 */
export function extractErrorCode(errorOrData) {
  if (!errorOrData) return null;
  if (typeof errorOrData === "string") return errorOrData;
  if (typeof errorOrData !== "object") return null;

  if (typeof errorOrData.code === "string" && errorOrData.code.trim()) {
    return errorOrData.code.trim();
  }

  const data =
    errorOrData.data && typeof errorOrData.data === "object"
      ? errorOrData.data
      : errorOrData;

  if (typeof data.code === "string" && data.code.trim()) {
    return data.code.trim();
  }

  if (
    data.extensions &&
    typeof data.extensions === "object" &&
    typeof data.extensions.code === "string" &&
    data.extensions.code.trim()
  ) {
    return data.extensions.code.trim();
  }

  return null;
}

/**
 * Checks whether a quota limit indicates unlimited.
 * Contract: null quota means unlimited. Undefined or missing is NOT unlimited. 0 is zero.
 * @param {any} limit
 * @returns {boolean}
 */
export function isUnlimitedQuota(limit) {
  return limit === null;
}

// ============================================================================
// 5. SAFE METADATA EXTRACTION (409 CONFLICT)
// ============================================================================

/**
 * Extracts safe 409 Conflict ProblemDetails financial metadata.
 *
 * ALLOWED FIELDS ONLY:
 * orderId, qrCode, checkoutUrl, amount, expiresAt, type, listPrice, creditAmount.
 *
 * CRITICAL SAFETY RULES:
 * - Does NOT fabricate status (HTTP 409 is NOT PaymentOrderStatus).
 * - Does NOT fabricate planCode.
 * - Does NOT require qrCode (URL-only cases are valid).
 * - Empty link fields are safely preserved as null.
 * - Returns null if orderId is missing.
 *
 * @param {any} source ApiError or ProblemDetails data object
 * @returns {PendingPaymentMetadata|null}
 */
export function extractPendingPaymentMetadata(source) {
  if (!source || typeof source !== "object") return null;

  const payload =
    source.data && typeof source.data === "object" ? source.data : source;
  const ext =
    payload.extensions && typeof payload.extensions === "object"
      ? payload.extensions
      : {};

  const orderId = payload.orderId ?? ext.orderId;
  if (!orderId || typeof orderId !== "string" || !orderId.trim()) {
    return null;
  }

  const getField = (field) => {
    if (payload[field] !== undefined) return payload[field];
    if (ext[field] !== undefined) return ext[field];
    return undefined;
  };

  const metadata = {
    orderId: orderId.trim(),
    qrCode: getField("qrCode") ?? null,
    checkoutUrl: getField("checkoutUrl") ?? null,
    amount: getField("amount"),
    expiresAt: getField("expiresAt") ?? null,
    type: getField("type"),
    listPrice: getField("listPrice"),
    creditAmount: getField("creditAmount"),
  };

  return metadata;
}

// ============================================================================
// 6. SAFE SHAPE CHECKS AND VERBATIM NORMALIZATION
// ============================================================================

/**
 * Validates whether data conforms to the CheckoutQuote DTO.
 * - quote type must be "Purchase" or "Upgrade" (never "Renewal").
 * - credits array is validated item by item.
 * @param {any} data
 * @returns {boolean}
 */
export function isCheckoutQuote(data) {
  if (!data || typeof data !== "object") return false;
  if (typeof data.planCode !== "string" || !data.planCode.trim()) return false;
  if (
    data.type !== CHECKOUT_QUOTE_TYPE.PURCHASE &&
    data.type !== CHECKOUT_QUOTE_TYPE.UPGRADE
  ) {
    return false;
  }
  if (
    typeof data.listPrice !== "number" ||
    typeof data.creditAmount !== "number" ||
    typeof data.amount !== "number" ||
    typeof data.durationDays !== "number"
  ) {
    return false;
  }
  if (!Array.isArray(data.credits)) return false;

  return data.credits.every(
    (c) =>
      c &&
      typeof c === "object" &&
      typeof c.planCode === "string" &&
      typeof c.planName === "string" &&
      typeof c.remainingDays === "number" &&
      typeof c.creditAmount === "number"
  );
}

/**
 * Safely normalizes a CheckoutQuote without modifying server values.
 * - Does NOT recalculate credit amount.
 * - Does NOT sum row credits.
 * - Returns verbatim fields.
 * @param {any} data
 * @returns {CheckoutQuote|null}
 */
export function safeNormalizeCheckoutQuote(data) {
  if (!isCheckoutQuote(data)) return null;

  return {
    planCode: data.planCode,
    type: data.type,
    listPrice: data.listPrice,
    creditAmount: data.creditAmount,
    amount: data.amount,
    durationDays: data.durationDays,
    credits: data.credits.map((c) => ({
      planCode: c.planCode,
      planName: c.planName,
      remainingDays: c.remainingDays,
      creditAmount: c.creditAmount,
    })),
  };
}

/**
 * Checks whether data conforms to basic PaymentIntent structure.
 * @param {any} data
 * @returns {boolean}
 */
export function isPaymentIntent(data) {
  if (!data || typeof data !== "object") return false;
  if (typeof data.orderId !== "string" || !data.orderId.trim()) return false;
  if (typeof data.amount !== "number") return false;
  return true;
}

/**
 * Safely normalizes a PaymentIntent without altering server values or normalizing unknown status.
 * @param {any} data
 * @returns {PaymentIntent|null}
 */
export function safeNormalizePaymentIntent(data) {
  if (!isPaymentIntent(data)) return null;

  return {
    orderId: data.orderId,
    qrCode: data.qrCode ?? null,
    checkoutUrl: data.checkoutUrl ?? null,
    amount: data.amount,
    expiresAt: data.expiresAt ?? null,
    status: data.status,
    type: data.type,
    listPrice: data.listPrice,
    creditAmount: data.creditAmount,
  };
}

/**
 * Checks whether data conforms to basic OwnedSubscriptionOrder structure.
 * @param {any} data
 * @returns {boolean}
 */
export function isOwnedSubscriptionOrder(data) {
  if (!data || typeof data !== "object") return false;
  if (typeof data.orderId !== "string" || !data.orderId.trim()) return false;
  if (typeof data.amount !== "number") return false;
  return true;
}

/**
 * Safely normalizes an OwnedSubscriptionOrder without adding non-contract fields.
 * Explicitly DOES NOT contain qrCode, checkoutUrl, durationDays, credits, or currency.
 * @param {any} data
 * @returns {OwnedSubscriptionOrder|null}
 */
export function safeNormalizeOwnedSubscriptionOrder(data) {
  if (!isOwnedSubscriptionOrder(data)) return null;

  return {
    orderId: data.orderId,
    status: data.status,
    planCode: data.planCode,
    amount: data.amount,
    expiresAt: data.expiresAt ?? null,
    paidAt: data.paidAt ?? null,
    type: data.type,
    listPrice: data.listPrice,
    creditAmount: data.creditAmount,
  };
}

/**
 * Checks whether data conforms to MySubscription structure.
 * @param {any} data
 * @returns {boolean}
 */
export function isMySubscription(data) {
  if (!data || typeof data !== "object") return false;
  if (typeof data.plan !== "string") return false;
  return true;
}

/**
 * Safely normalizes MySubscription data without synthesizing infinite quotas or active state.
 * @param {any} data
 * @returns {MySubscription|null}
 */
export function safeNormalizeMySubscription(data) {
  if (!isMySubscription(data)) return null;

  const usage =
    data.usage && typeof data.usage === "object"
      ? {
          generateUsed: data.usage.generateUsed,
          generateLimit: data.usage.generateLimit ?? null,
          resetAt: data.usage.resetAt ?? null,
        }
      : null;

  const savedTrips =
    data.savedTrips && typeof data.savedTrips === "object"
      ? {
          used: data.savedTrips.used,
          limit: data.savedTrips.limit ?? null,
        }
      : null;

  return {
    plan: data.plan,
    endsAt: data.endsAt ?? null,
    usage,
    savedTrips,
    effectiveUntil: data.effectiveUntil ?? null,
  };
}
