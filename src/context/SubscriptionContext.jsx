import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "./AuthContext";
import { subscriptionService } from "../services/subscriptionService";

const SubscriptionContext = createContext(null);

export function SubscriptionProvider({ children }) {
  const { user, isDemo, isLoggedIn, initializing } = useAuth();

  // Nguồn chân lý cho giao diện giao dịch là API Backend (bắt đầu rỗng thay vì fallback)
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState(null);

  const [persistedSubscription, setPersistedSubscription] = useState(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState(null);

  const [prevUserId, setPrevUserId] = useState(user?.id);
  const [prevIsLoggedIn, setPrevIsLoggedIn] = useState(isLoggedIn);
  const [prevIsDemo, setPrevIsDemo] = useState(isDemo);

  // Điều chỉnh state đồng bộ trong render khi chuyển đổi tài khoản/logout/demo để tránh lộ state cũ
  if (isLoggedIn !== prevIsLoggedIn || isDemo !== prevIsDemo || user?.id !== prevUserId) {
    setPrevIsLoggedIn(isLoggedIn);
    setPrevIsDemo(isDemo);
    setPrevUserId(user?.id);
    if (!isLoggedIn || isDemo || user?.id !== prevUserId) {
      setPersistedSubscription(null);
      setSubscriptionError(null);
      if (isLoggedIn && !isDemo) {
        setSubscriptionLoading(true);
      } else {
        setSubscriptionLoading(false);
      }
    }
  }

  const subscriptionUnavailableReason = isDemo ? "demo" : null;

  // Nếu là Demo hoặc chưa đăng nhập thì subscription luôn là null
  const subscription = useMemo(() => {
    if (!isLoggedIn || isDemo) return null;
    return persistedSubscription;
  }, [isLoggedIn, isDemo, persistedSubscription]);

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
    if (initializing || !isLoggedIn || isDemo) {
      setPersistedSubscription(null);
      setSubscriptionLoading(false);
      return null;
    }

    setSubscriptionLoading(true);
    setSubscriptionError(null);
    try {
      const data = await subscriptionService.getMySubscription();
      setPersistedSubscription(data);
      return data;
    } catch (err) {
      if (err.status === 403) {
        setPersistedSubscription(null);
      }
      setSubscriptionError(err.message || "Không thể tải thông tin gói của bạn.");
      return null;
    } finally {
      setSubscriptionLoading(false);
    }
  }, [initializing, isLoggedIn, isDemo]);

  const refreshAll = useCallback(async () => {
    await Promise.allSettled([refreshPlans(), refreshSubscription()]);
  }, [refreshPlans, refreshSubscription]);

  const clearSubscriptionState = useCallback(() => {
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

  // Đồng bộ subscription khi đăng nhập với tài khoản thật
  useEffect(() => {
    if (initializing || !isLoggedIn || isDemo) return undefined;

    let active = true;
    subscriptionService
      .getMySubscription()
      .then((data) => {
        if (active) {
          setPersistedSubscription(data);
          setSubscriptionError(null);
        }
      })
      .catch((err) => {
        if (active) {
          setPersistedSubscription(null);
          setSubscriptionError(err.message || "Không thể tải thông tin gói của bạn.");
        }
      })
      .finally(() => {
        if (active) setSubscriptionLoading(false);
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
