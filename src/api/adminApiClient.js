import { apiClient, isSessionEndingError } from "./apiClient";
import { STORAGE_KEYS } from "../constants";

export const ADMIN_API_EVENTS = {
  UNAUTHORIZED: "localmate:admin-api-unauthorized",
  FORBIDDEN: "localmate:admin-api-forbidden",
};

function emitAdminApiEvent(name, detail) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  }
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEYS.TOKEN);
  localStorage.removeItem(STORAGE_KEYS.IS_DEMO);
}

// 403 nghiệp vụ: trang tự hiện lỗi theo code, không phải bị thu hồi quyền
const BUSINESS_FORBIDDEN_CODES = new Set(["cannot_manage_role_manager"]);

async function handleAdminRequest(request) {
  try {
    return await request();
  } catch (error) {
    // account_locked / account_not_found: apiClient đã phát sự kiện đăng xuất chung
    if (isSessionEndingError(error)) throw error;
    if (error?.status === 401) {
      clearSession();
      emitAdminApiEvent(ADMIN_API_EVENTS.UNAUTHORIZED, {
        message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
      });
    } else if (error?.status === 403 && !BUSINESS_FORBIDDEN_CODES.has(error.code)) {
      emitAdminApiEvent(ADMIN_API_EVENTS.FORBIDDEN, {
        message: "Bạn không có quyền thực hiện thao tác quản trị này.",
      });
    }
    throw error;
  }
}

export const adminApiClient = {
  get: (path, options) => handleAdminRequest(() => apiClient.get(path, options)),
  post: (path, body, options) => handleAdminRequest(() => apiClient.post(path, body, options)),
  put: (path, body, options) => handleAdminRequest(() => apiClient.put(path, body, options)),
  patch: (path, body, options) => handleAdminRequest(() => apiClient.patch(path, body, options)),
  delete: (path, options) => handleAdminRequest(() => apiClient.delete(path, options)),
  getBlob: (path, options) => handleAdminRequest(() => apiClient.getBlob(path, options)),
};
