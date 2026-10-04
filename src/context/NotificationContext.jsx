import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { notificationService } from "../services/notificationService";
import { useAuth } from "./AuthContext";

const NotificationContext = createContext(null);

const POLL_INTERVAL_MS = 60_000;

export function NotificationProvider({ children }) {
  const { user, isLoggedIn, isDemo, initializing } = useAuth();
  const { pathname } = useLocation();
  const userId = user?.id ?? null;
  // Phiên demo không có hộp thư nên không gọi
  const enabled = !initializing && isLoggedIn && !isDemo && Boolean(userId);
  const [unread, setUnread] = useState(null); // { userId, count }

  const refreshUnreadCount = useCallback(async () => {
    if (!enabled) return;
    try {
      const { count } = await notificationService.getUnreadCount();
      setUnread({ userId, count });
    } catch {
      // Giữ số cũ, lần gọi sau thử lại
    }
  }, [enabled, userId]);

  // Thanh toán xong BE tạo thông báo, nên gọi lại ngay khi về trang này
  const onPaymentSuccess = pathname === "/payment/success";

  useEffect(() => {
    if (!enabled) return undefined;
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") refreshUnreadCount();
    };
    refreshIfVisible();
    const timer = setInterval(refreshIfVisible, POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", refreshIfVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [enabled, refreshUnreadCount, onPaymentSuccess]);

  // Số của tài khoản trước không hiện sang tài khoản sau
  const unreadCount = enabled && unread?.userId === userId ? unread.count : 0;

  return (
    <NotificationContext.Provider value={{ enabled, unreadCount, refreshUnreadCount }}>
      {children}
    </NotificationContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}
