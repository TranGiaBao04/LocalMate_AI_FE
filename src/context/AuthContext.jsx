import { createContext, useContext, useState, useEffect } from "react";
import { STORAGE_KEYS } from "../constants";
import { AUTH_EVENTS } from "../api/apiClient";
import { authService } from "../services/authService";
import { getToken, setToken, removeToken } from "../utils/authStorage";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const token = getToken();
    const isDemoStored = localStorage.getItem(STORAGE_KEYS.IS_DEMO) === "true";
    if (token && isDemoStored) {
      return {
        id: "demo",
        fullName: "Khách Demo",
        email: "demo@localmate.ai",
        role: "User",
      };
    }
    return null;
  });

  const [isDemo, setIsDemo] = useState(() => {
    const token = getToken();
    const isDemoStored = localStorage.getItem(STORAGE_KEYS.IS_DEMO) === "true";
    return !!token && isDemoStored;
  });

  const [initializing, setInitializing] = useState(() => {
    const token = getToken();
    const isDemoStored = localStorage.getItem(STORAGE_KEYS.IS_DEMO) === "true";
    return !!token && !isDemoStored;
  });

  useEffect(() => {
    const token = getToken();
    const isDemoStored = localStorage.getItem(STORAGE_KEYS.IS_DEMO) === "true";
    if (!token || isDemoStored) {
      return;
    }

    authService
      .getProfile()
      .then((profile) => {
        setUser(profile);
        setIsDemo(false);
      })
      .catch(() => {
        removeToken();
        localStorage.removeItem(STORAGE_KEYS.IS_DEMO);
        setUser(null);
        setIsDemo(false);
      })
      .finally(() => setInitializing(false));
  }, []);

  const [sessionNotice, setSessionNotice] = useState("");

  // BE-83: tài khoản bị khoá/không còn tồn tại ⇒ đăng xuất, giữ lời nhắn cho trang đăng nhập.
  useEffect(() => {
    const handleSessionEnded = (event) => {
      removeToken();
      localStorage.removeItem(STORAGE_KEYS.IS_DEMO);
      setUser(null);
      setIsDemo(false);
      setSessionNotice(event.detail?.message || "");
    };
    window.addEventListener(AUTH_EVENTS.SESSION_ENDED, handleSessionEnded);
    return () => window.removeEventListener(AUTH_EVENTS.SESSION_ENDED, handleSessionEnded);
  }, []);

  const completePersistedLogin = async (session, rememberMe = false) => {
    const token = session?.accessToken || session?.token;
    if (!token) {
      throw new Error("Không nhận được access token từ máy chủ.");
    }
    setToken(token, rememberMe);
    localStorage.removeItem(STORAGE_KEYS.IS_DEMO);
    setIsDemo(false);

    try {
      const profile = await authService.getProfile();
      setUser(profile);
      return { session, user: profile };
    } catch (profileErr) {
      removeToken();
      setUser(null);
      throw profileErr;
    }
  };

  const login = async (email, password, rememberMe = false) =>
    completePersistedLogin(await authService.login(email, password), rememberMe);

  const loginWithGoogle = async (idToken, rememberMe = false) =>
    completePersistedLogin(await authService.googleLogin(idToken), rememberMe);

  const loginDemo = async () => {
    const session = await authService.demo();
    const token = session?.accessToken || session?.token;
    if (!token) {
      throw new Error("Không nhận được token demo từ máy chủ.");
    }
    setToken(token, true);
    localStorage.setItem(STORAGE_KEYS.IS_DEMO, "true");
    const demoUser = {
      id: "demo",
      fullName: "Khách Demo",
      email: "demo@localmate.ai",
      role: "User",
    };
    setUser(demoUser);
    setIsDemo(true);
    return { session, user: demoUser };
  };

  const register = async (fullName, email, password) => {
    return await authService.register(fullName, email, password);
  };

  const logout = () => {
    setUser(null);
    setIsDemo(false);
    removeToken();
    localStorage.removeItem(STORAGE_KEYS.IS_DEMO);
  };

  const applyUserProfile = (profile) => {
    if (!isDemo) setUser(profile);
  };

  // Quyền đổi có hiệu lực ngay ở BE (BE-82) ⇒ nạp lại profile để cập nhật menu admin
  const refreshProfile = async () => {
    const profile = await authService.getProfile();
    if (!isDemo) setUser(profile);
    return profile;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isDemo,
        isLoggedIn: !!user,
        initializing,
        login,
        loginWithGoogle,
        loginDemo,
        register,
        logout,
        applyUserProfile,
        refreshProfile,
        sessionNotice,
        clearSessionNotice: () => setSessionNotice(""),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
