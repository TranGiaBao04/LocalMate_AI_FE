import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { canAccessAdmin, hasAnyPermission } from "../../utils/adminAccess";
import { isStoredTokenExpired } from "../../utils/jwt";

// permissions: quyền cần cho 1 mục (có 1 trong số đó là vào được). Bỏ trống = chỉ cần vào được portal.
export default function AdminRoute({ children, permissions }) {
  const location = useLocation();
  const { user, isLoggedIn, initializing, logout } = useAuth();
  const tokenExpired = isLoggedIn && isStoredTokenExpired();

  useEffect(() => {
    if (tokenExpired) logout();
  }, [logout, tokenExpired]);

  if (initializing) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
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
            : "Vui lòng đăng nhập bằng tài khoản quản trị.",
        }}
      />
    );
  }

  if (!canAccessAdmin(user)) {
    return <Navigate to="/home" replace state={{ adminAccessDenied: true }} />;
  }

  if (permissions && !hasAnyPermission(user, permissions)) {
    return <Navigate to="/admin" replace />;
  }

  return children;
}
