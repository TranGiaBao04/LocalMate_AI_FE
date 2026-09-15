import { createContext, useContext, useState, useEffect } from "react";
import { STORAGE_KEYS } from "../constants";
import { authService } from "../services/authService";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(
    () => !!localStorage.getItem(STORAGE_KEYS.TOKEN),
  );

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEYS.TOKEN)) return;
    authService
      .getProfile()
      .then(setUser)
      .catch(() => localStorage.removeItem(STORAGE_KEYS.TOKEN))
      .finally(() => setInitializing(false));
  }, []);

  const applySession = ({ token, user: profile }) => {
    localStorage.setItem(STORAGE_KEYS.TOKEN, token);
    setUser(profile);
  };

  const login = async (email, password) => {
    const session = await authService.login(email, password);
    applySession(session);
  };

  const register = async (fullName, email, password) => {
    const session = await authService.register(fullName, email, password);
    applySession(session);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggedIn: !!user,
        initializing,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
