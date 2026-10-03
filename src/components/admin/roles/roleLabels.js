// Giới hạn và câu lỗi dùng chung cho màn Phân quyền (giống AdminRoleService của BE)
export const ROLE_NAME_MAX_LENGTH = 50;
export const ROLE_DESCRIPTION_MAX_LENGTH = 200;

// BE để câu tiếng Việt trong `detail`, apiClient không đọc ⇒ FE tự map theo code.
// invalid_role_data: apiClient đã ghép câu lỗi theo field vào err.message.
const ROLE_ERROR_MESSAGES = {
  role_name_exists: "Tên role đã tồn tại.",
  system_role_locked: "Không thể sửa hoặc xoá role hệ thống.",
  role_in_use: "Role đang có người dùng, hãy chuyển họ sang role khác trước.",
  last_role_manager: "Phải còn ít nhất một người đang hoạt động có quyền quản lý phân quyền.",
  cannot_remove_own_role_manager: "Không thể bỏ quyền quản lý phân quyền khỏi role bạn đang giữ.",
  cannot_change_own_role: "Không thể tự đổi role của chính mình.",
  role_not_found: "Role không còn tồn tại. Vui lòng tải lại danh sách.",
  invalid_role: "Role không tồn tại.",
  user_not_found: "Không tìm thấy người dùng.",
};

export const getRoleErrorMessage = (err, fallback) =>
  ROLE_ERROR_MESSAGES[err?.code] ?? err?.message ?? fallback;
