import { createContext, useContext, useState, useEffect } from "react";
import { STORAGE_KEYS } from "../constants";
import { mockUsers } from "../data/users.mock";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.USER);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const isMockUser = mockUsers.some((u) => u.email === parsed.email);
        if (isMockUser) setUser(parsed);
        else localStorage.removeItem(STORAGE_KEYS.USER);
      } catch {
        localStorage.removeItem(STORAGE_KEYS.USER);
      }
    }
  }, []);

  const saveUser = (u) => {
    const { password: _password, ...safeUser } = u;
    setUser(safeUser);
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(safeUser));
  };

  const login = async (email, password) => {
    const found = mockUsers.find(
      (u) =>
        u.email.toLowerCase() === email.trim().toLowerCase() &&
        u.password === password,
    );
    if (found) {
      saveUser(found);
      return true;
    }
    return false;
  };

  const register = async () => {
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEYS.USER);
  };

  return (
    <AuthContext.Provider
      value={{ user, isLoggedIn: !!user, login, register, logout }}
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
