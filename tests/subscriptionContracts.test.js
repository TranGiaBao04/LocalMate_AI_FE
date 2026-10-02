import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { apiClient, ApiError, AUTH_EVENTS } from "../src/api/apiClient";
import { STORAGE_KEYS } from "../src/constants";
import { subscriptionService } from "../src/services/subscriptionService";
import {
  SUBSCRIPTION_UPGRADE_BE_CONTRACT_VERSION,
  PAYMENT_ORDER_STATUS,
  KNOWN_PAYMENT_ORDER_STATUSES,
  PAYMENT_ORDER_TYPE,
  KNOWN_PAYMENT_ORDER_TYPES,
  CHECKOUT_QUOTE_TYPE,
  KNOWN_CHECKOUT_QUOTE_TYPES,
  CUSTOMER_SUBSCRIPTION_ERROR_CODES,
  ADMIN_SUBSCRIPTION_ERROR_CODES,
  isKnownPaymentStatus,
  isKnownPaymentOrderType,
  isKnownCheckoutQuoteType,
  isKnownCustomerErrorCode,
  isKnownAdminErrorCode,
  extractErrorCode,
  extractPendingPaymentMetadata,
  isCheckoutQuote,
  safeNormalizeCheckoutQuote,
  isPaymentIntent,
  safeNormalizePaymentIntent,
  isOwnedSubscriptionOrder,
  safeNormalizeOwnedSubscriptionOrder,
  isMySubscription,
  safeNormalizeMySubscription,
  isUnlimitedQuota,
} from "../src/utils/subscriptionUpgradeContract";

describe("FE-UP1: Subscription Upgrade Contract Boundary", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    localStorage.clear();
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // 1. Quote endpoint uses encoded planCode query
  // --------------------------------------------------------------------------
  it("case 1: getCheckoutQuote uses encoded planCode query and URLSearchParams", async () => {
    globalThis.fetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ planCode: "Membership" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    await subscriptionService.getCheckoutQuote("Membership");
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = globalThis.fetch.mock.calls[0];
    expect(url).toContain("/api/subscription/checkout-quote?planCode=Membership");
    expect(options.method).toBe("GET");

    // Special characters requiring URL encoding
    globalThis.fetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ planCode: "Trip Pass & Special" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    await subscriptionService.getCheckoutQuote("Trip Pass & Special");
    const [specialUrl] = globalThis.fetch.mock.calls[1];
    expect(specialUrl).toContain("/api/subscription/checkout-quote?planCode=Trip+Pass+%26+Special");

    // Custom plan code
    globalThis.fetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ planCode: "custom-partner-tier" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    await subscriptionService.getCheckoutQuote("custom-partner-tier");
    const [customUrl] = globalThis.fetch.mock.calls[2];
    expect(customUrl).toContain("/api/subscription/checkout-quote?planCode=custom-partner-tier");

    // Omitted planCode sends base path without corrupted undefined string
    globalThis.fetch.mockResolvedValueOnce(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    await subscriptionService.getCheckoutQuote();
    const [omittedUrl] = globalThis.fetch.mock.calls[3];
    expect(omittedUrl).toMatch(/\/api\/subscription\/checkout-quote$/);
  });

  // --------------------------------------------------------------------------
  // 2. Checkout request exact { planCode }
  // --------------------------------------------------------------------------
  it("case 2: checkout request sends exact { planCode } body with no extra fields", async () => {
    globalThis.fetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          orderId: "e3d039b0-b9bf-4ddb-0d19-caa27763711d",
          amount: 59000,
          status: "Pending",
        }),
        {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }
      )
    );

    await subscriptionService.checkout("Membership");

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = globalThis.fetch.mock.calls[0];
    expect(url).toContain("/api/subscription/checkout");
    expect(options.method).toBe("POST");

    const parsedBody = JSON.parse(options.body);
    expect(parsedBody).toEqual({ planCode: "Membership" });
    expect(Object.keys(parsedBody)).toEqual(["planCode"]);
  });

  // --------------------------------------------------------------------------
  // 3. Renew sends no body
  // --------------------------------------------------------------------------
  it("case 3: renew request sends no body", async () => {
    globalThis.fetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          orderId: "e3d039b0-b9bf-4ddb-0d19-caa27763711d",
          amount: 59000,
          status: "Pending",
        }),
        {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }
      )
    );

    await subscriptionService.renew();

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = globalThis.fetch.mock.calls[0];
    expect(url).toContain("/api/subscription/renew");
    expect(options.method).toBe("POST");
    expect(options.body).toBeUndefined();
  });

  // --------------------------------------------------------------------------
  // 4. Owned-order path correct
  // --------------------------------------------------------------------------
  it("case 4: owned-order path matches /subscription/orders/{orderId}", async () => {
    const testOrderId = "d3b07384-d113-4c4b-b052-16a75f8f8b8e";
    globalThis.fetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          orderId: testOrderId,
          status: "Paid",
          amount: 49000,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    );

    await subscriptionService.getOrder(testOrderId);

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = globalThis.fetch.mock.calls[0];
    expect(url).toContain(`/api/subscription/orders/${testOrderId}`);
    expect(options.method).toBe("GET");
  });

  // --------------------------------------------------------------------------
  // 5. PaymentIntent fields preserved
  // --------------------------------------------------------------------------
  it("case 5: PaymentIntent fields preserved without mutating server values", () => {
    const serverIntent = {
      orderId: "550e8400-e29b-41d4-a716-446655440000",
      qrCode: "00020101021238540010A000000727...",
      checkoutUrl: "https://pay.payos.vn/web/test1234",
      amount: 49000,
      expiresAt: "2026-10-02T16:15:00Z",
      status: "Pending",
      type: "Upgrade",
      listPrice: 59000,
      creditAmount: 10000,
    };

    expect(isPaymentIntent(serverIntent)).toBe(true);

    const normalized = safeNormalizePaymentIntent(serverIntent);
    expect(normalized).toEqual({
      orderId: "550e8400-e29b-41d4-a716-446655440000",
      qrCode: "00020101021238540010A000000727...",
      checkoutUrl: "https://pay.payos.vn/web/test1234",
      amount: 49000,
      expiresAt: "2026-10-02T16:15:00Z",
      status: "Pending",
      type: "Upgrade",
      listPrice: 59000,
      creditAmount: 10000,
    });

    // Shape checks reject missing required fields or invalid amounts
    expect(isPaymentIntent({ orderId: "123", amount: 50000 })).toBe(false); // missing status
    expect(isPaymentIntent({ orderId: "123", status: "Pending" })).toBe(false); // missing amount
    expect(isPaymentIntent({ orderId: "", amount: 50000, status: "Pending" })).toBe(false); // empty orderId
    expect(isPaymentIntent({ orderId: "123", amount: NaN, status: "Pending" })).toBe(false); // NaN amount
    expect(isPaymentIntent({ orderId: "123", amount: -10, status: "Pending" })).toBe(false); // negative amount
  });

  // --------------------------------------------------------------------------
  // 6. OwnedOrder fields preserved
  // --------------------------------------------------------------------------
  it("case 6: OwnedSubscriptionOrder fields preserved and non-contract fields excluded", () => {
    const serverOwnedOrder = {
      orderId: "550e8400-e29b-41d4-a716-446655440000",
      status: "Paid",
      planCode: "Membership",
      amount: 49000,
      expiresAt: "2026-10-02T16:15:00Z",
      paidAt: "2026-10-02T16:05:00Z",
      type: "Upgrade",
      listPrice: 59000,
      creditAmount: 10000,
      // Extraneous fields that must NOT exist on OwnedSubscriptionOrder
      qrCode: "extra-qr",
      checkoutUrl: "https://extra-url",
      durationDays: 30,
      credits: [{ planCode: "TripPass" }],
      currency: "VND",
      productKind: "SubscriptionPlan",
      planVersionId: "guid",
      periodId: "guid",
    };

    expect(isOwnedSubscriptionOrder(serverOwnedOrder)).toBe(true);

    const normalized = safeNormalizeOwnedSubscriptionOrder(serverOwnedOrder);
    expect(normalized).toEqual({
      orderId: "550e8400-e29b-41d4-a716-446655440000",
      status: "Paid",
      planCode: "Membership",
      amount: 49000,
      expiresAt: "2026-10-02T16:15:00Z",
      paidAt: "2026-10-02T16:05:00Z",
      type: "Upgrade",
      listPrice: 59000,
      creditAmount: 10000,
    });

    expect(normalized).not.toHaveProperty("qrCode");
    expect(normalized).not.toHaveProperty("checkoutUrl");
    expect(normalized).not.toHaveProperty("durationDays");
    expect(normalized).not.toHaveProperty("credits");
    expect(normalized).not.toHaveProperty("currency");
    expect(normalized).not.toHaveProperty("productKind");
    expect(normalized).not.toHaveProperty("planVersionId");
    expect(normalized).not.toHaveProperty("periodId");

    // Shape checks reject missing required fields or invalid amounts
    expect(isOwnedSubscriptionOrder({ orderId: "123", amount: 50000 })).toBe(false); // missing status and planCode
    expect(isOwnedSubscriptionOrder({ orderId: "123", amount: 50000, status: "Paid" })).toBe(false); // missing planCode
    expect(isOwnedSubscriptionOrder({ orderId: "123", amount: 50000, planCode: "Membership" })).toBe(false); // missing status
    expect(isOwnedSubscriptionOrder({ orderId: "123", amount: -1, status: "Paid", planCode: "Membership" })).toBe(false); // negative amount
    expect(isOwnedSubscriptionOrder({ orderId: "123", amount: NaN, status: "Paid", planCode: "Membership" })).toBe(false); // NaN amount
  });

  // --------------------------------------------------------------------------
  // 7. Quote exact fields preserved
  // --------------------------------------------------------------------------
  it("case 7: CheckoutQuote exact fields preserved and row sum is NOT used to overwrite creditAmount", () => {
    // Illustrative case from contract freeze: raw row credit is 10857, aggregate rounded is 10000
    const serverQuote = {
      planCode: "Membership",
      type: "Upgrade",
      listPrice: 59000,
      creditAmount: 10000,
      amount: 49000,
      durationDays: 30,
      credits: [
        {
          planCode: "TripPass",
          planName: "Trip Pass",
          remainingDays: 11,
          creditAmount: 10857,
        },
      ],
    };

    expect(isCheckoutQuote(serverQuote)).toBe(true);

    const normalized = safeNormalizeCheckoutQuote(serverQuote);
    expect(normalized).toEqual(serverQuote);
    // Crucial: top-level creditAmount is 10000, NOT sum of rows (10857)
    expect(normalized.creditAmount).toBe(10000);
    expect(normalized.credits[0].creditAmount).toBe(10857);
  });

  // --------------------------------------------------------------------------
  // 8. Quote credits exact safe fields and empty credits[] valid
  // --------------------------------------------------------------------------
  it("case 8: quote credits has exact fields, empty credits[] is valid, and quote type Renewal is rejected", () => {
    const purchaseQuote = {
      planCode: "TripPass",
      type: "Purchase",
      listPrice: 29000,
      creditAmount: 0,
      amount: 29000,
      durationDays: 7,
      credits: [],
    };

    expect(isCheckoutQuote(purchaseQuote)).toBe(true);
    const normalized = safeNormalizeCheckoutQuote(purchaseQuote);
    expect(normalized.credits).toEqual([]);
    expect(normalized.type).toBe("Purchase");

    // Quote type is NEVER Renewal
    const invalidRenewalQuote = {
      ...purchaseQuote,
      type: "Renewal",
    };
    expect(isCheckoutQuote(invalidRenewalQuote)).toBe(false);
    expect(safeNormalizeCheckoutQuote(invalidRenewalQuote)).toBeNull();

    // Financial numbers must be finite and non-negative
    expect(isCheckoutQuote({ ...purchaseQuote, listPrice: NaN })).toBe(false);
    expect(isCheckoutQuote({ ...purchaseQuote, creditAmount: NaN })).toBe(false);
    expect(isCheckoutQuote({ ...purchaseQuote, amount: -1 })).toBe(false);
    expect(isCheckoutQuote({ ...purchaseQuote, durationDays: NaN })).toBe(false);
    expect(isCheckoutQuote({ ...purchaseQuote, durationDays: -5 })).toBe(false);

    // Malformed credits elements are rejected
    expect(
      isCheckoutQuote({
        ...purchaseQuote,
        credits: [{ planCode: "", planName: "Pass", remainingDays: 5, creditAmount: 1000 }],
      })
    ).toBe(false);
    expect(
      isCheckoutQuote({
        ...purchaseQuote,
        credits: [{ planCode: "Pass", planName: "Pass", remainingDays: -1, creditAmount: 1000 }],
      })
    ).toBe(false);
    expect(
      isCheckoutQuote({
        ...purchaseQuote,
        credits: [{ planCode: "Pass", planName: "Pass", remainingDays: NaN, creditAmount: 1000 }],
      })
    ).toBe(false);
    expect(
      isCheckoutQuote({
        ...purchaseQuote,
        credits: [{ planCode: "Pass", planName: "Pass", remainingDays: 5, creditAmount: -100 }],
      })
    ).toBe(false);
    expect(
      isCheckoutQuote({
        ...purchaseQuote,
        credits: [{ planCode: "Pass", planName: "Pass", remainingDays: 5, creditAmount: NaN }],
      })
    ).toBe(false);
  });

  // --------------------------------------------------------------------------
  // 9. Root ProblemDetails code preserved
  // --------------------------------------------------------------------------
  it("case 9: root ProblemDetails code preserved in ApiError", async () => {
    globalThis.fetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          type: "https://tools.ietf.org/html/rfc9110#section-15.5.10",
          title: "Conflict",
          status: 409,
          code: "pending_order_exists",
          orderId: "d3b07384-d113-4c4b-b052-16a75f8f8b8e",
        }),
        {
          status: 409,
          headers: { "Content-Type": "application/problem+json" },
        }
      )
    );

    let caughtError = null;
    try {
      await subscriptionService.checkout("Membership");
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(ApiError);
    expect(caughtError.status).toBe(409);
    expect(caughtError.code).toBe("pending_order_exists");
    expect(extractErrorCode(caughtError)).toBe("pending_order_exists");
  });

  // --------------------------------------------------------------------------
  // 10. Extensions.code preserved
  // --------------------------------------------------------------------------
  it("case 10: extensions.code preserved in ApiError", async () => {
    globalThis.fetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          type: "https://tools.ietf.org/html/rfc9110#section-15.5.10",
          title: "Conflict",
          status: 409,
          extensions: {
            code: "plan_already_active",
          },
        }),
        {
          status: 409,
          headers: { "Content-Type": "application/problem+json" },
        }
      )
    );

    let caughtError = null;
    try {
      await subscriptionService.checkout("Membership");
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(ApiError);
    expect(caughtError.status).toBe(409);
    expect(caughtError.code).toBe("plan_already_active");
    expect(extractErrorCode(caughtError)).toBe("plan_already_active");
  });

  // --------------------------------------------------------------------------
  // 11. Missing code handled safely
  // --------------------------------------------------------------------------
  it("case 11: missing error code handled safely as null without throwing or fabricating", async () => {
    globalThis.fetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          type: "https://tools.ietf.org/html/rfc9110#section-15.5.1",
          title: "Bad Request",
          status: 400,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/problem+json" },
        }
      )
    );

    let caughtError = null;
    try {
      await subscriptionService.checkout("Membership");
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(ApiError);
    expect(caughtError.status).toBe(400);
    expect(caughtError.code).toBeNull();
    expect(extractErrorCode(caughtError)).toBeNull();
    expect(isKnownCustomerErrorCode(caughtError.code)).toBe(false);
  });

  // --------------------------------------------------------------------------
  // 12. Validation errors preserved
  // --------------------------------------------------------------------------
  it("case 12: validation errors dictionary preserved in ApiError.errors", async () => {
    const validationErrors = {
      planCode: ["The planCode field is required."],
    };

    globalThis.fetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          type: "https://tools.ietf.org/html/rfc9110#section-15.5.1",
          title: "One or more validation errors occurred.",
          status: 400,
          errors: validationErrors,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/problem+json" },
        }
      )
    );

    let caughtError = null;
    try {
      await subscriptionService.checkout("");
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(ApiError);
    expect(caughtError.status).toBe(400);
    expect(caughtError.errors).toEqual(validationErrors);
  });

  // --------------------------------------------------------------------------
  // 13. HTTP 409 status not interpreted as payment status
  // --------------------------------------------------------------------------
  it("case 13: HTTP 409 status is kept distinct and NOT interpreted as PaymentOrderStatus", () => {
    const conflictError = new ApiError("Conflict", 409, "pending_order_exists", null, {
      status: 409,
      code: "pending_order_exists",
      orderId: "550e8400-e29b-41d4-a716-446655440000",
      amount: 49000,
    });

    // HTTP status is 409
    expect(conflictError.status).toBe(409);
    // 409 is NOT a PaymentOrderStatus
    expect(isKnownPaymentStatus(conflictError.status)).toBe(false);
    expect(isKnownPaymentStatus(409)).toBe(false);
    expect(isKnownPaymentStatus("409")).toBe(false);

    const extracted = extractPendingPaymentMetadata(conflictError);
    expect(extracted).not.toBeNull();
    // Extracted metadata must NOT contain a status field
    expect(extracted).not.toHaveProperty("status");
  });

  // --------------------------------------------------------------------------
  // 14. 409 metadata extraction: qr+url, url only, empty links, no fabrication
  // --------------------------------------------------------------------------
  it("case 14: 409 metadata extraction handles qr+url, url only, empty links, without fabricating planCode or status", () => {
    // 14a: qr + url
    const fullSource = {
      orderId: "ord-1",
      qrCode: "data:image/png;base64,mockqr",
      checkoutUrl: "https://pay.payos.vn/web/1",
      amount: 49000,
      expiresAt: "2026-10-02T16:15:00Z",
      type: "Upgrade",
      listPrice: 59000,
      creditAmount: 10000,
      // Potential extra fields that must NOT be exposed
      status: 409,
      planCode: "Membership",
    };

    const fullMeta = extractPendingPaymentMetadata(fullSource);
    expect(fullMeta).toEqual({
      orderId: "ord-1",
      qrCode: "data:image/png;base64,mockqr",
      checkoutUrl: "https://pay.payos.vn/web/1",
      amount: 49000,
      expiresAt: "2026-10-02T16:15:00Z",
      type: "Upgrade",
      listPrice: 59000,
      creditAmount: 10000,
    });
    expect(fullMeta).not.toHaveProperty("status");
    expect(fullMeta).not.toHaveProperty("planCode");

    // 14b: url only (valid)
    const urlOnlySource = {
      orderId: "ord-2",
      qrCode: null,
      checkoutUrl: "https://pay.payos.vn/web/2",
      amount: 29000,
      expiresAt: "2026-10-02T16:15:00Z",
      type: "Purchase",
      listPrice: 29000,
      creditAmount: 0,
    };
    const urlOnlyMeta = extractPendingPaymentMetadata(urlOnlySource);
    expect(urlOnlyMeta).not.toBeNull();
    expect(urlOnlyMeta.qrCode).toBeNull();
    expect(urlOnlyMeta.checkoutUrl).toBe("https://pay.payos.vn/web/2");

    // 14c: empty link fields (e.g. concurrent Paid or ReviewRequired before link creation)
    const emptyLinksSource = {
      orderId: "ord-3",
      qrCode: null,
      checkoutUrl: null,
      amount: 49000,
      expiresAt: "2026-10-02T16:15:00Z",
      type: "Upgrade",
      listPrice: 59000,
      creditAmount: 10000,
    };
    const emptyLinksMeta = extractPendingPaymentMetadata(emptyLinksSource);
    expect(emptyLinksMeta).not.toBeNull();
    expect(emptyLinksMeta.qrCode).toBeNull();
    expect(emptyLinksMeta.checkoutUrl).toBeNull();

    // 14d: missing orderId returns null
    const noOrderIdSource = {
      qrCode: "qr",
      checkoutUrl: "url",
      amount: 49000,
    };
    expect(extractPendingPaymentMetadata(noOrderIdSource)).toBeNull();

    // 14e: extracted from extensions container
    const extSource = {
      extensions: {
        orderId: "ord-ext",
        checkoutUrl: "https://pay.payos.vn/ext",
        amount: 49000,
        type: "Upgrade",
      },
    };
    const extMeta = extractPendingPaymentMetadata(extSource);
    expect(extMeta).not.toBeNull();
    expect(extMeta.orderId).toBe("ord-ext");
    expect(extMeta.checkoutUrl).toBe("https://pay.payos.vn/ext");
    expect(extMeta.type).toBe("Upgrade");
    expect(extMeta).not.toHaveProperty("status");
    expect(extMeta).not.toHaveProperty("planCode");

    // 14f: RFC ProblemDetails type URI at root does not pollute type when extensions.type exists
    const rfcProblemWithExtType = {
      type: "https://tools.ietf.org/html/rfc9110#section-15.5.10",
      title: "Conflict",
      status: 409,
      code: "pending_order_exists",
      orderId: "ord-rfc-1",
      amount: 49000,
      extensions: {
        type: "Upgrade",
        listPrice: 59000,
        creditAmount: 10000,
      },
    };
    const rfcMeta1 = extractPendingPaymentMetadata(rfcProblemWithExtType);
    expect(rfcMeta1).not.toBeNull();
    expect(rfcMeta1.orderId).toBe("ord-rfc-1");
    expect(rfcMeta1.type).toBe("Upgrade"); // NOT the RFC URI!
    expect(rfcMeta1).not.toHaveProperty("status");
    expect(rfcMeta1).not.toHaveProperty("planCode");

    // 14g: RFC ProblemDetails type URI at root without extensions.type produces undefined type
    const rfcProblemWithoutExtType = {
      type: "https://tools.ietf.org/html/rfc9110#section-15.5.10",
      title: "Conflict",
      status: 409,
      code: "pending_order_exists",
      orderId: "ord-rfc-2",
      amount: 49000,
    };
    const rfcMeta2 = extractPendingPaymentMetadata(rfcProblemWithoutExtType);
    expect(rfcMeta2).not.toBeNull();
    expect(rfcMeta2.orderId).toBe("ord-rfc-2");
    expect(rfcMeta2.type).toBeUndefined(); // NOT the RFC URI!
    expect(rfcMeta2).not.toHaveProperty("status");
    expect(rfcMeta2).not.toHaveProperty("planCode");
  });

  // --------------------------------------------------------------------------
  // 15. Known PaymentOrderStatus recognition
  // --------------------------------------------------------------------------
  it("case 15: known PaymentOrderStatus and type recognition", () => {
    expect(KNOWN_PAYMENT_ORDER_STATUSES).toEqual([
      "Pending",
      "Paid",
      "Failed",
      "Expired",
      "ReviewRequired",
    ]);

    expect(PAYMENT_ORDER_STATUS.PENDING).toBe("Pending");
    expect(PAYMENT_ORDER_STATUS.PAID).toBe("Paid");
    expect(PAYMENT_ORDER_STATUS.FAILED).toBe("Failed");
    expect(PAYMENT_ORDER_STATUS.EXPIRED).toBe("Expired");
    expect(PAYMENT_ORDER_STATUS.REVIEW_REQUIRED).toBe("ReviewRequired");

    expect(isKnownPaymentStatus("Pending")).toBe(true);
    expect(isKnownPaymentStatus("Paid")).toBe(true);
    expect(isKnownPaymentStatus("Failed")).toBe(true);
    expect(isKnownPaymentStatus("Expired")).toBe(true);
    expect(isKnownPaymentStatus("ReviewRequired")).toBe(true);

    expect(isKnownPaymentStatus("pending")).toBe(false); // Case-sensitive exact enum
    expect(isKnownPaymentStatus(null)).toBe(false);
    expect(isKnownPaymentStatus(undefined)).toBe(false);

    // Order types
    expect(KNOWN_PAYMENT_ORDER_TYPES).toEqual(["Purchase", "Renewal", "Upgrade"]);
    expect(PAYMENT_ORDER_TYPE.PURCHASE).toBe("Purchase");
    expect(PAYMENT_ORDER_TYPE.RENEWAL).toBe("Renewal");
    expect(PAYMENT_ORDER_TYPE.UPGRADE).toBe("Upgrade");
    expect(isKnownPaymentOrderType("Purchase")).toBe(true);
    expect(isKnownPaymentOrderType("Renewal")).toBe(true);
    expect(isKnownPaymentOrderType("Upgrade")).toBe(true);
    expect(isKnownPaymentOrderType("UnknownType")).toBe(false);

    // Quote types
    expect(KNOWN_CHECKOUT_QUOTE_TYPES).toEqual(["Purchase", "Upgrade"]);
    expect(CHECKOUT_QUOTE_TYPE.PURCHASE).toBe("Purchase");
    expect(CHECKOUT_QUOTE_TYPE.UPGRADE).toBe("Upgrade");
    expect(isKnownCheckoutQuoteType("Purchase")).toBe(true);
    expect(isKnownCheckoutQuoteType("Upgrade")).toBe(true);
    expect(isKnownCheckoutQuoteType("Renewal")).toBe(false); // NEVER Renewal
  });

  // --------------------------------------------------------------------------
  // 16. Unknown future status preserved/unsupported
  // --------------------------------------------------------------------------
  it("case 16: unknown future status is preserved and recognized as unknown/unsupported", () => {
    const unknownStatus = "PartiallyRefunded";
    expect(isKnownPaymentStatus(unknownStatus)).toBe(false);

    const intentWithFutureStatus = {
      orderId: "550e8400-e29b-41d4-a716-446655440000",
      amount: 49000,
      status: unknownStatus,
      type: "Upgrade",
      listPrice: 59000,
      creditAmount: 10000,
    };

    const normalized = safeNormalizePaymentIntent(intentWithFutureStatus);
    // Crucial: unknown status is preserved as-is, NOT coerced to "Pending" or "Failed"
    expect(normalized.status).toBe(unknownStatus);
    expect(isKnownPaymentStatus(normalized.status)).toBe(false);
  });

  // --------------------------------------------------------------------------
  // 17. No client financial fields sent
  // --------------------------------------------------------------------------
  it("case 17: subscription checkout request does not accept or send client financial fields", async () => {
    globalThis.fetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ orderId: "123", amount: 59000 }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      })
    );

    // Call checkout with only planCode
    await subscriptionService.checkout("Membership");

    const [, options] = globalThis.fetch.mock.calls[0];
    const sentBody = JSON.parse(options.body);

    expect(sentBody).not.toHaveProperty("amount");
    expect(sentBody).not.toHaveProperty("creditAmount");
    expect(sentBody).not.toHaveProperty("listPrice");
    expect(sentBody).not.toHaveProperty("credit");
    expect(sentBody).not.toHaveProperty("userId");
    expect(sentBody).not.toHaveProperty("planId");
    expect(sentBody).not.toHaveProperty("planVersionId");
    expect(sentBody).not.toHaveProperty("versionId");
    expect(sentBody).not.toHaveProperty("periodId");
    expect(sentBody).not.toHaveProperty("type");
    expect(sentBody).not.toHaveProperty("productKind");
    expect(sentBody).not.toHaveProperty("sourcePeriods");
  });

  // --------------------------------------------------------------------------
  // 18. No subscription clientAttemptId introduced
  // --------------------------------------------------------------------------
  it("case 18: no subscription clientAttemptId is sent or required", async () => {
    globalThis.fetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ orderId: "123", amount: 59000 }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      })
    );

    await subscriptionService.checkout("Membership");
    const [, options] = globalThis.fetch.mock.calls[0];
    const sentBody = JSON.parse(options.body);

    expect(sentBody).not.toHaveProperty("clientAttemptId");
  });

  // --------------------------------------------------------------------------
  // 19. MySubscription quota checks (null = unlimited, missing != unlimited)
  // --------------------------------------------------------------------------
  it("case 19: MySubscription DTO preserves null quota as unlimited and undefined as not unlimited", () => {
    const unlimitedSub = {
      plan: "Membership",
      endsAt: "2026-11-02T16:00:00Z",
      usage: {
        generateUsed: 42,
        generateLimit: null, // Unlimited
        resetAt: "2026-11-02T16:00:00Z",
      },
      savedTrips: {
        used: 5,
        limit: null, // Unlimited
      },
      effectiveUntil: "2026-11-02T16:00:00Z",
    };

    expect(isMySubscription(unlimitedSub)).toBe(true);
    const normalized = safeNormalizeMySubscription(unlimitedSub);
    expect(normalized.usage.generateLimit).toBeNull();
    expect(isUnlimitedQuota(normalized.usage.generateLimit)).toBe(true);
    expect(isUnlimitedQuota(0)).toBe(false); // 0 is zero, not unlimited
    expect(isUnlimitedQuota(10)).toBe(false);
    expect(isUnlimitedQuota(undefined)).toBe(false); // Missing is not unlimited

    // Missing / undefined quota must remain undefined and NOT be coerced to null (unlimited)
    const missingQuotaSub = {
      plan: "TripPass",
      usage: {
        generateUsed: 5,
        // generateLimit omitted / undefined
        resetAt: "2026-11-02T16:00:00Z",
      },
      savedTrips: {
        used: 1,
        // limit omitted / undefined
      },
    };
    expect(isMySubscription(missingQuotaSub)).toBe(true);
    const normalizedMissing = safeNormalizeMySubscription(missingQuotaSub);
    expect(normalizedMissing.usage.generateLimit).toBeUndefined();
    expect(isUnlimitedQuota(normalizedMissing.usage.generateLimit)).toBe(false);
    expect(normalizedMissing.savedTrips.limit).toBeUndefined();
    expect(isUnlimitedQuota(normalizedMissing.savedTrips.limit)).toBe(false);
  });

  // --------------------------------------------------------------------------
  // 20. Stable Error Codes Verification
  // --------------------------------------------------------------------------
  it("case 20: all required customer and admin error codes exist and match contract v1.0", () => {
    expect(SUBSCRIPTION_UPGRADE_BE_CONTRACT_VERSION).toBe("1.0");

    // All 16 required customer error codes
    const expectedCustomerCodes = [
      "invalid_plan_code",
      "plan_already_active",
      "already_covered_by_higher_plan",
      "target_plan_already_scheduled",
      "pending_order_exists",
      "another_pending_order",
      "payment_review_required",
      "payment_gateway_unavailable",
      "no_active_subscription",
      "upgrade_checkout_not_ready",
      "persisted_account_required",
      "invalid_identity",
      "account_not_found",
      "account_locked",
      "invalid_id",
      "payment_order_not_found",
    ];

    for (const code of expectedCustomerCodes) {
      expect(isKnownCustomerErrorCode(code)).toBe(true);
      expect(Object.values(CUSTOMER_SUBSCRIPTION_ERROR_CODES)).toContain(code);
    }

    // All 8 required admin error codes
    const expectedAdminCodes = [
      "invalid_transaction_query",
      "transaction_export_limit_exceeded",
      "transaction_not_found",
      "payment_provider_unavailable",
      "payment_provider_mismatch",
      "invalid_entitlement_repair_request",
      "entitlement_repair_not_eligible",
      "entitlement_repair_conflict",
    ];

    for (const code of expectedAdminCodes) {
      expect(isKnownAdminErrorCode(code)).toBe(true);
      expect(Object.values(ADMIN_SUBSCRIPTION_ERROR_CODES)).toContain(code);
    }
  });

  // --------------------------------------------------------------------------
  // 21. Blob Session Ending Transport Event
  // --------------------------------------------------------------------------
  it("case 21: requestBlob emits session-ended event on account_locked and account_not_found", async () => {
    localStorage.setItem(STORAGE_KEYS.TOKEN, "test-token");
    const sessionEndedEvents = [];

    const listener = (e) => {
      sessionEndedEvents.push(e.detail);
    };
    window.addEventListener(AUTH_EVENTS.SESSION_ENDED, listener);

    try {
      // 1. account_locked on getBlob
      globalThis.fetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 403,
            code: "account_locked",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/problem+json" },
          }
        )
      );

      let caughtLocked = null;
      try {
        await apiClient.getBlob("/admin/transactions/export.csv");
      } catch (err) {
        caughtLocked = err;
      }

      expect(caughtLocked).toBeInstanceOf(ApiError);
      expect(caughtLocked.status).toBe(403);
      expect(caughtLocked.code).toBe("account_locked");
      expect(sessionEndedEvents).toHaveLength(1);
      expect(sessionEndedEvents[0].message).toContain("khoá");

      // 2. account_not_found on getBlob
      globalThis.fetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 401,
            code: "account_not_found",
          }),
          {
            status: 401,
            headers: { "Content-Type": "application/problem+json" },
          }
        )
      );

      let caughtNotFound = null;
      try {
        await apiClient.getBlob("/admin/transactions/export.csv");
      } catch (err) {
        caughtNotFound = err;
      }

      expect(caughtNotFound).toBeInstanceOf(ApiError);
      expect(caughtNotFound.status).toBe(401);
      expect(caughtNotFound.code).toBe("account_not_found");
      expect(sessionEndedEvents).toHaveLength(2);
      expect(sessionEndedEvents[1].message).toContain("tồn tại");

      // 3. Ordinary 403 (without account_locked) does NOT dispatch session-ended
      globalThis.fetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 403,
            title: "Forbidden",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/problem+json" },
          }
        )
      );

      try {
        await apiClient.getBlob("/admin/transactions/export.csv");
      } catch {
        // Expected
      }

      // Still length 2, no extra session-ended event
      expect(sessionEndedEvents).toHaveLength(2);
    } finally {
      window.removeEventListener(AUTH_EVENTS.SESSION_ENDED, listener);
    }
  });
});
