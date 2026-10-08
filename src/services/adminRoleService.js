import { adminApiClient } from "../api/adminApiClient";

// BE-82 Phân quyền, cần quyền ManageRoles.
// Role: { id, name, description, isSystem, permissions: string[], userCount }. Role hệ thống không sửa/xoá được.
// Mã lỗi: 400 invalid_role_data (errors: name | description | permissions) | invalid_role,
// 404 role_not_found | user_not_found, 409 role_name_exists | system_role_locked | role_in_use |
// last_role_manager | cannot_remove_own_role_manager | cannot_change_own_role.
export const adminRoleService = {
  // [{ code, name, description }], tên/mô tả tiếng Việt để hiện checkbox
  getPermissions: () => adminApiClient.get("/admin/permissions"),
  getRoles: () => adminApiClient.get("/admin/roles"),
  // payload: { name (≤ 50), description (≤ 200, có thể null), permissions: string[] }
  createRole: (payload) => adminApiClient.post("/admin/roles", payload),
  // Thay toàn bộ tên, mô tả và danh sách quyền
  updateRole: (roleId, payload) => adminApiClient.put(`/admin/roles/${roleId}`, payload),
  // 204. Role còn người dùng ⇒ 409 role_in_use
  deleteRole: (roleId) => adminApiClient.delete(`/admin/roles/${roleId}`),
  // Trả { userId, roleId, roleName }. Không tự đổi role của chính mình.
  assignUserRole: (userId, roleId) => adminApiClient.put(`/admin/users/${userId}/role`, { roleId }),
};
