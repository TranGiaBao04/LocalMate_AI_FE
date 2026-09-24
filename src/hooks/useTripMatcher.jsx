import { useState, useCallback } from "react";
import { matcherService } from "../services/matcherService";

/**
 * Custom React Hook quản lý trạng thái AI Matching & Heuristic Fallback (FE-37)
 */
export function useTripMatcher() {
  const [isLoading, setIsLoading] = useState(false);
  const [isFallback, setIsFallback] = useState(false);
  const [error, setError] = useState(null);
  const [emptyStateReason, setEmptyStateReason] = useState(null); // 'OutOfServiceArea' | 'InsufficientCandidates' | 'NetworkError' | null
  const [matchedResult, setMatchedResult] = useState(null);

  const resetMatch = useCallback(() => {
    setIsLoading(false);
    setIsFallback(false);
    setError(null);
    setEmptyStateReason(null);
    setMatchedResult(null);
  }, []);

  const executeMatch = useCallback(async (criteria) => {
    setIsLoading(true);
    setIsFallback(false);
    setError(null);
    setEmptyStateReason(null);
    setMatchedResult(null);

    try {
      // 1. Thử gọi AI Matching chính (BE-31 -> BE-33)
      const res = await matcherService.matchTrip(criteria);
      const data = res?.data || res;

      // Kiểm tra dữ liệu kết quả trả về
      const places = data?.places || data?.itinerary || data?.matchedPlaces || [];
      const statusReason = data?.emptyStateReason || data?.reason;

      if (statusReason === "OutOfServiceArea" || data?.outOfServiceArea) {
        setEmptyStateReason("OutOfServiceArea");
        setIsLoading(false);
        return { success: false, emptyStateReason: "OutOfServiceArea" };
      }

      if (places.length === 0) {
        setEmptyStateReason("InsufficientCandidates");
        setIsLoading(false);
        return { success: false, emptyStateReason: "InsufficientCandidates" };
      }

      setMatchedResult(data);
      setIsFallback(Boolean(data?.isFallback));
      setIsLoading(false);
      return { success: true, data, isFallback: Boolean(data?.isFallback) };
    } catch (err) {
      console.warn("[useTripMatcher] Primary AI Match failed/timed out, triggering Fallback Engine...", err);

      // Xử lý lỗi cụ thể từ API backend
      const errResponse = err?.response?.data;
      const status = err?.response?.status;

      if (status === 400 && (errResponse?.code === "OUT_OF_SERVICE_AREA" || errResponse?.message?.includes("service area"))) {
        setEmptyStateReason("OutOfServiceArea");
        setError(errResponse?.message || "Vị trí xuất phát ngoài vùng phục vụ (chỉ hỗ trợ TP.HCM).");
        setIsLoading(false);
        return { success: false, emptyStateReason: "OutOfServiceArea" };
      }

      // 2. Thử kích hoạt Heuristic Fallback Engine (BE-38)
      try {
        const fallbackRes = await matcherService.fallbackItinerary(criteria, "llm_timeout");
        const fallbackData = fallbackRes?.data || fallbackRes;
        const fallbackPlaces = fallbackData?.places || fallbackData?.itinerary || fallbackData?.matchedPlaces || [];

        if (fallbackPlaces.length === 0) {
          setEmptyStateReason("InsufficientCandidates");
          setIsLoading(false);
          return { success: false, emptyStateReason: "InsufficientCandidates" };
        }

        setMatchedResult(fallbackData);
        setIsFallback(true);
        setIsLoading(false);
        return { success: true, data: fallbackData, isFallback: true };
      } catch (fallbackErr) {
        console.error("[useTripMatcher] Fallback Engine also failed:", fallbackErr);
        const failMessage = fallbackErr?.response?.data?.message || "Hệ thống gặp sự cố kết nối. Vui lòng thử lại sau.";
        setError(failMessage);
        setEmptyStateReason("NetworkError");
        setIsLoading(false);
        return { success: false, error: failMessage, emptyStateReason: "NetworkError" };
      }
    }
  }, []);

  return {
    isLoading,
    isFallback,
    error,
    emptyStateReason,
    matchedResult,
    executeMatch,
    resetMatch,
  };
}

export default useTripMatcher;
