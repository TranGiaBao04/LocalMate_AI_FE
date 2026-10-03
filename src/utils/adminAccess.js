// Only the current backend permission snapshot grants access.
function getPermissions(user) {
  return Array.isArray(user?.permissions) ? user.permissions : [];
}

export const canAccessAdmin = (user) => getPermissions(user).length > 0;

// Có ít nhất 1 trong các quyền là đủ
export const hasAnyPermission = (user, permissions) =>
  permissions.some((permission) => getPermissions(user).includes(permission));
