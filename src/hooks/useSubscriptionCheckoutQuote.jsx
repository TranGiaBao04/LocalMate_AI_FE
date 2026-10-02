import { useState, useRef, useCallback, useEffect } from "react";
import { subscriptionService } from "../services/subscriptionService";
import { safeNormalizeCheckoutQuote } from "../utils/subscriptionUpgradeContract";

/**
 * Hook for managing subscription checkout quote requests and state.
 * Scope: Transient preview only.
 *
 * Guarantees:
 * - Scoped to request generation, target planCode, and owner identity
 * - Ignores stale responses if target or owner changes while in-flight
 * - Fails safe if response is invalid or unknown quote type
 * - Strictly zero financial calculations
 *
 * @param {Object} [options]
 * @param {string|null} [options.ownerId] Persisted account/owner identifier
 * @returns {{
 *   quote: import("../utils/subscriptionUpgradeContract").CheckoutQuote|null,
 *   loading: boolean,
 *   error: any,
 *   selectedPlanCode: string|null,
 *   requestQuote: (planCode: string) => Promise<any>,
 *   clearQuote: () => void,
 * }}
 */
export function useSubscriptionCheckoutQuote({ ownerId = null } = {}) {
  const [quoteState, setQuoteState] = useState({
    ownerId: null,
    targetPlanCode: null,
    quote: null,
    error: null,
    loading: false,
  });

  const generationRef = useRef(0);
  const currentTargetRef = useRef(null);
  const ownerRef = useRef(ownerId);

  // Invalidate in-flight requests and reset state immediately if owner changes
  useEffect(() => {
    if (ownerRef.current !== ownerId) {
      ownerRef.current = ownerId;
      generationRef.current += 1;
      currentTargetRef.current = null;
      setQuoteState({
        ownerId: null,
        targetPlanCode: null,
        quote: null,
        error: null,
        loading: false,
      });
    }
  }, [ownerId]);

  // Derive state based on matching owner: if owner changed, old quote is ignored automatically
  const isMatchingOwner = quoteState.ownerId === ownerId;
  const quote = isMatchingOwner ? quoteState.quote : null;
  const error = isMatchingOwner ? quoteState.error : null;
  const loading = isMatchingOwner ? quoteState.loading : false;
  const selectedPlanCode = isMatchingOwner ? quoteState.targetPlanCode : null;

  const clearQuote = useCallback(() => {
    generationRef.current += 1;
    currentTargetRef.current = null;
    setQuoteState({
      ownerId: null,
      targetPlanCode: null,
      quote: null,
      error: null,
      loading: false,
    });
  }, []);

  const requestQuote = useCallback(
    async (planCode) => {
      const generation = ++generationRef.current;
      currentTargetRef.current = planCode;
      const requestOwner = ownerId;
      ownerRef.current = ownerId;

      setQuoteState({
        ownerId: requestOwner,
        targetPlanCode: planCode,
        quote: null,
        error: null,
        loading: true,
      });

      try {
        const raw = await subscriptionService.getCheckoutQuote(planCode);

        // Stale-response guard: verify generation, target planCode, and owner identity
        if (
          generation !== generationRef.current ||
          currentTargetRef.current !== planCode ||
          ownerRef.current !== requestOwner
        ) {
          return null;
        }

        const normalized = safeNormalizeCheckoutQuote(raw);
        if (!normalized) {
          // Unknown quote type or malformed DTO: fail safe!
          const failSafeError = new Error(
            "Phản hồi báo giá từ máy chủ không hợp lệ hoặc chứa loại giao dịch chưa được hỗ trợ."
          );
          failSafeError.code = "unsupported_quote_type";
          setQuoteState({
            ownerId: requestOwner,
            targetPlanCode: planCode,
            quote: null,
            error: failSafeError,
            loading: false,
          });
          return null;
        }

        setQuoteState({
          ownerId: requestOwner,
          targetPlanCode: planCode,
          quote: normalized,
          error: null,
          loading: false,
        });
        return normalized;
      } catch (err) {
        if (
          generation !== generationRef.current ||
          currentTargetRef.current !== planCode ||
          ownerRef.current !== requestOwner
        ) {
          return null;
        }

        // On error, clear any quote and record error scoped to current request
        setQuoteState({
          ownerId: requestOwner,
          targetPlanCode: planCode,
          quote: null,
          error: err,
          loading: false,
        });
        return null;
      }
    },
    [ownerId],
  );

  return {
    quote,
    loading,
    error,
    selectedPlanCode,
    requestQuote,
    clearQuote,
  };
}

export default useSubscriptionCheckoutQuote;
