import { ADMIN_PERMISSIONS } from "../constants";

// BE-82: users/me trả `permissions` (Admin = đủ mọi quyền, User/demo = []). Không so tên role.
// TẠM: dev chưa có BE-82 thì profile thiếu field này ⇒ suy từ role cũ. Xoá nhánh này khi BE merge.
function getPermissions(user) {
  if (Array.isArray(user?.permissions)) return user.permissions;
  return user?.role === "Admin" ? Object.values(ADMIN_PERMISSIONS) : [];
}

export const canAccessAdmin = (user) => getPermissions(user).length > 0;

// Có ít nhất 1 trong các quyền là đủ
export const hasAnyPermission = (user, permissions) =>
  permissions.some((permission) => getPermissions(user).includes(permission));
