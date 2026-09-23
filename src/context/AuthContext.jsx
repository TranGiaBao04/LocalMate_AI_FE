import { createContext, useContext, useState, useEffect } from "react";
import { STORAGE_KEYS } from "../constants";
import { authService } from "../services/authService";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
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
    const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
    const isDemoStored = localStorage.getItem(STORAGE_KEYS.IS_DEMO) === "true";
    return !!token && isDemoStored;
  });

  const [initializing, setInitializing] = useState(() => {
    const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
    const isDemoStored = localStorage.getItem(STORAGE_KEYS.IS_DEMO) === "true";
    return !!token && !isDemoStored;
  });

  useEffect(() => {
    const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
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
        localStorage.removeItem(STORAGE_KEYS.TOKEN);
        localStorage.removeItem(STORAGE_KEYS.IS_DEMO);
        setUser(null);
        setIsDemo(false);
      })
      .finally(() => setInitializing(false));
  }, []);

  const login = async (email, password) => {
    const session = await authService.login(email, password);
    const token = session?.accessToken || session?.token;
    if (!token) {
      throw new Error("Không nhận được access token từ máy chủ.");
    }
    localStorage.setItem(STORAGE_KEYS.TOKEN, token);
    localStorage.removeItem(STORAGE_KEYS.IS_DEMO);
    setIsDemo(false);

    try {
      const profile = await authService.getProfile();
      setUser(profile);
      return { session, user: profile };
    } catch (profileErr) {
      localStorage.removeItem(STORAGE_KEYS.TOKEN);
      setUser(null);
      throw profileErr;
    }
  };

  const loginDemo = async () => {
    const session = await authService.demo();
    const token = session?.accessToken || session?.token;
    if (!token) {
      throw new Error("Không nhận được token demo từ máy chủ.");
    }
    localStorage.setItem(STORAGE_KEYS.TOKEN, token);
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
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.IS_DEMO);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isDemo,
        isLoggedIn: !!user,
        initializing,
        login,
        loginDemo,
        register,
        logout,
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
