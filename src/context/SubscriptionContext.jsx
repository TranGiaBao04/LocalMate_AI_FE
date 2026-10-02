import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useAuth } from "./AuthContext";
import { subscriptionService } from "../services/subscriptionService";

const SubscriptionContext = createContext(null);

export function SubscriptionProvider({ children }) {
  const { user, isDemo, isLoggedIn, initializing } = useAuth();
  const currentUserId = user?.id;
  const isPersistedUser = !initializing && isLoggedIn && !isDemo && Boolean(currentUserId);

  // Nguồn chân lý cho giao diện giao dịch là API Backend (bắt đầu rỗng thay vì fallback)
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState(null);

  const [persistedSubscription, setPersistedSubscription] = useState(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(
    () => initializing || isPersistedUser
  );
  const [subscriptionError, setSubscriptionError] = useState(null);

  const [prevUserId, setPrevUserId] = useState(currentUserId);
  const [prevIsLoggedIn, setPrevIsLoggedIn] = useState(isLoggedIn);
  const [prevIsDemo, setPrevIsDemo] = useState(isDemo);
  const [prevInitializing, setPrevInitializing] = useState(initializing);

  const activeOwnerRef = useRef(currentUserId);
  const requestIdRef = useRef(0);

  // Điều chỉnh state đồng bộ trong render khi chuyển đổi tài khoản/logout/demo để tránh lộ state cũ
  if (
    isLoggedIn !== prevIsLoggedIn ||
    isDemo !== prevIsDemo ||
    currentUserId !== prevUserId ||
    initializing !== prevInitializing
  ) {
    setPrevIsLoggedIn(isLoggedIn);
    setPrevIsDemo(isDemo);
    setPrevUserId(currentUserId);
    setPrevInitializing(initializing);

    setPersistedSubscription(null);
    setSubscriptionError(null);

    const shouldLoad = !initializing && isLoggedIn && !isDemo && Boolean(currentUserId);
    setSubscriptionLoading(shouldLoad || initializing);
  }

  // Ref updates must happen in an effect (react-hooks/refs rule)
  useEffect(() => {
    requestIdRef.current += 1;
    activeOwnerRef.current = currentUserId;
  }, [isLoggedIn, isDemo, currentUserId, initializing]);

  const subscriptionUnavailableReason = isDemo ? "demo" : null;

  // Nếu là Demo hoặc chưa đăng nhập thì subscription luôn là null
  const subscription = useMemo(() => {
    if (!isLoggedIn || isDemo || !currentUserId) return null;
    return persistedSubscription;
  }, [isLoggedIn, isDemo, currentUserId, persistedSubscription]);

  // Lấy danh sách gói cước (Public) - Backend là nguồn chân lý
  const refreshPlans = useCallback(async () => {
    setPlansLoading(true);
    setPlansError(null);
    try {
      const data = await subscriptionService.getPlans();
      if (Array.isArray(data) && data.length > 0) {
        setPlans(data);
      }
      return data;
    } catch (err) {
      setPlansError(err.message || "Không thể tải danh sách gói cước từ máy chủ.");
      return null;
    } finally {
      setPlansLoading(false);
    }
  }, []);

  // Lấy thông tin gói cước của người dùng hiện tại (Persisted user only)
  const refreshSubscription = useCallback(async () => {
    const ownerId = user?.id;
    if (initializing || !isLoggedIn || isDemo || !ownerId) {
      setPersistedSubscription(null);
      setSubscriptionLoading(false);
      return null;
    }

    const currentRequestId = ++requestIdRef.current;
    activeOwnerRef.current = ownerId;
    setSubscriptionLoading(true);
    setSubscriptionError(null);

    try {
      const data = await subscriptionService.getMySubscription();
      if (currentRequestId !== requestIdRef.current || ownerId !== activeOwnerRef.current) {
        return null;
      }
      if (!data || typeof data !== "object" || typeof data.plan !== "string") {
        setPersistedSubscription(null);
        setSubscriptionError("Dữ liệu gói cước không hợp lệ từ máy chủ.");
        return null;
      }
      setPersistedSubscription(data);
      setSubscriptionError(null);
      return data;
    } catch (err) {
      if (currentRequestId !== requestIdRef.current || ownerId !== activeOwnerRef.current) {
        return null;
      }
      setPersistedSubscription(null);
      setSubscriptionError(err?.message || "Không thể tải thông tin gói của bạn.");
      return null;
    } finally {
      if (currentRequestId === requestIdRef.current && ownerId === activeOwnerRef.current) {
        setSubscriptionLoading(false);
      }
    }
  }, [initializing, isLoggedIn, isDemo, user?.id]);

  const refreshAll = useCallback(async () => {
    await Promise.allSettled([refreshPlans(), refreshSubscription()]);
  }, [refreshPlans, refreshSubscription]);

  const clearSubscriptionState = useCallback(() => {
    requestIdRef.current += 1;
    activeOwnerRef.current = undefined;
    setPersistedSubscription(null);
    setSubscriptionError(null);
    setSubscriptionLoading(false);
  }, []);

  // Tải plans khi provider mount
  useEffect(() => {
    let active = true;
    subscriptionService
      .getPlans()
      .then((data) => {
        if (active && Array.isArray(data) && data.length > 0) {
          setPlans(data);
        }
      })
      .catch((err) => {
        if (active) {
          setPlansError(err.message || "Không thể tải danh sách gói cước từ máy chủ.");
        }
      })
      .finally(() => {
        if (active) setPlansLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  // Cập nhật activeOwnerRef khi user thay đổi
  useEffect(() => {
    activeOwnerRef.current = currentUserId;
  }, [currentUserId]);

  // Đồng bộ subscription khi đăng nhập với tài khoản thật
  useEffect(() => {
    if (initializing || !isLoggedIn || isDemo || !user?.id) {
      return undefined;
    }

    let active = true;
    const currentRequestId = ++requestIdRef.current;
    const ownerId = user.id;
    activeOwnerRef.current = ownerId;

    subscriptionService
      .getMySubscription()
      .then((data) => {
        if (!active || currentRequestId !== requestIdRef.current || ownerId !== activeOwnerRef.current) {
          return;
        }
        if (!data || typeof data !== "object" || typeof data.plan !== "string") {
          setPersistedSubscription(null);
          setSubscriptionError("Dữ liệu gói cước không hợp lệ từ máy chủ.");
          return;
        }
        setPersistedSubscription(data);
        setSubscriptionError(null);
      })
      .catch((err) => {
        if (!active || currentRequestId !== requestIdRef.current || ownerId !== activeOwnerRef.current) {
          return;
        }
        setPersistedSubscription(null);
        setSubscriptionError(err?.message || "Không thể tải thông tin gói của bạn.");
      })
      .finally(() => {
        if (active && currentRequestId === requestIdRef.current && ownerId === activeOwnerRef.current) {
          setSubscriptionLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [initializing, isLoggedIn, isDemo, user?.id]);

  return (
    <SubscriptionContext.Provider
      value={{
        plans,
        subscription,
        plansLoading,
        subscriptionLoading,
        plansError,
        subscriptionError,
        subscriptionUnavailableReason,
        refreshPlans,
        refreshSubscription,
        refreshAll,
        clearSubscriptionState,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    throw new Error("useSubscription must be used within SubscriptionProvider");
  }
  return ctx;
}
