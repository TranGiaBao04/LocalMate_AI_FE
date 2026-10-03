// Nhãn và câu lỗi dùng chung cho màn Quản lý người dùng (F8)
export const LOCK_REASON_MAX_LENGTH = 500;

export const USER_STATUS_BADGE = {
  Active: { status: "active", label: "Hoạt động" },
  Locked: { status: "locked", label: "Đã khoá" },
};

// BE để câu tiếng Việt trong `detail`, apiClient không đọc ⇒ FE tự map theo code
export const LOCK_ERROR_MESSAGES = {
  invalid_lock_reason: `Lý do khoá là bắt buộc, tối đa ${LOCK_REASON_MAX_LENGTH} ký tự.`,
  cannot_lock_self: "Không thể tự khoá tài khoản của chính mình.",
  cannot_manage_role_manager: "Chỉ người có quyền quản lý phân quyền mới được khoá/mở khoá tài khoản này.",
  last_role_manager: "Phải còn ít nhất một người đang hoạt động có quyền quản lý phân quyền.",
  user_not_found: "Không tìm thấy người dùng.",
};

export function describeLockResult(result, mode, actorId) {
  if (mode === "unlock") return { type: "success", message: "Đã mở khoá tài khoản." };
  // Người khác khoá trước (BE vẫn trả 200, giữ lý do cũ)
  if (result?.lockedBy && result.lockedBy.userId !== actorId) {
    return { type: "info", message: `Tài khoản đã bị ${result.lockedBy.fullName} khoá trước đó.` };
  }
  return { type: "success", message: "Đã khoá tài khoản. Người dùng bị đăng xuất ở lần thao tác tiếp theo." };
}
