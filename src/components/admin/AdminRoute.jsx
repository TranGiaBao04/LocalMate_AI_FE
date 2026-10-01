import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getStoredTokenRole, isStoredTokenExpired } from "../../utils/jwt";

export default function AdminRoute({ children }) {
  const location = useLocation();
  const { user, isLoggedIn, initializing, logout } = useAuth();
  const tokenExpired = isLoggedIn && isStoredTokenExpired();
  const tokenRole = isLoggedIn ? getStoredTokenRole() : null;
  const isAdmin = user?.role === "Admin" && tokenRole === "Admin";

  useEffect(() => {
    if (tokenExpired) logout();
  }, [logout, tokenExpired]);

  if (initializing) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f4f6fa]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-200 border-t-[#1d3e82]" aria-label="Đang kiểm tra quyền quản trị" />
      </div>
    );
  }

  if (!isLoggedIn || tokenExpired) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: location.pathname,
          message: tokenExpired
            ? "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
            : undefined,
        }}
      />
    );
  }

  if (!isAdmin) {
    return <Navigate to="/home" replace state={{ adminAccessDenied: true }} />;
  }

  return children;
}
