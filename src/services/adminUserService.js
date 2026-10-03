import { adminApiClient } from "../api/adminApiClient";
import { serializeTransactionFilters } from "./adminTransactionService";

// F8 Quản lý người dùng (BE-132→134), cần quyền ManageUsers.
// Mã lỗi: 400 invalid_admin_user_query | invalid_lock_reason, 403 cannot_manage_role_manager,
// 404 user_not_found, 409 cannot_lock_self | last_role_manager.

function appendPaging(searchParams, params) {
  if (params.page != null) searchParams.append("page", params.page);
  if (params.pageSize != null) searchParams.append("pageSize", params.pageSize);
  if (params.sortBy) searchParams.append("sortBy", params.sortBy);
  if (params.sortDirection) searchParams.append("sortDirection", params.sortDirection);
  return searchParams;
}

const withQuery = (path, searchParams) => {
  const query = searchParams.toString();
  return query ? `${path}?${query}` : path;
};

export const adminUserService = {
  // { roles: [{ id, name }], plans: [{ code, name, isActive }] }, gồm cả gói đã tắt
  getFilterOptions: () => adminApiClient.get("/admin/users/filter-options"),

  /**
   * Danh sách user (PagedResult). Dòng: { id, fullName, email, role: { id, name }, status, lockedAt,
   *   plan: { code, name }, planEffectiveUntil, createdAt, managesRoles, canLock, canUnlock }
   * @param {Object} params page, pageSize, sortBy (createdAt|fullName|email|status), sortDirection,
   *   search (tìm không dấu theo tên/email), roleId, status (Active|Locked), plan (code từ filter-options)
   */
  getUsers: (params = {}) => {
    const searchParams = appendPaging(new URLSearchParams(), params);
    if (params.search?.trim()) searchParams.append("search", params.search.trim().slice(0, 100));
    if (params.roleId) searchParams.append("roleId", params.roleId);
    if (params.status) searchParams.append("status", params.status);
    if (params.plan) searchParams.append("plan", params.plan);
    return adminApiClient.get(withQuery("/admin/users", searchParams));
  },

  // Thêm lockReason, lockedBy, hasPassword, loginProviders, subscription (như /subscription/me), stats, updatedAt
  getUser: (userId) => adminApiClient.get(`/admin/users/${userId}`),

  // Cùng query và dòng với GET /admin/transactions
  getUserPayments: (userId, params = {}) =>
    adminApiClient.get(withQuery(
      `/admin/users/${userId}/payments`,
      appendPaging(serializeTransactionFilters(params), params),
    )),

  /**
   * Dòng: { id, status, plannedDate, startTime, durationHours, budgetMax, travelMode, itemCount,
   *   estimatedBudget, createdAt, finalizedAt, deletedAt }
   * @param {Object} params page, pageSize, sortBy (createdAt|plannedStartAt|finalizedAt), sortDirection,
   *   status (Draft|Finalized), includeDeleted
   */
  getUserTrips: (userId, params = {}) => {
    const searchParams = appendPaging(new URLSearchParams(), params);
    if (params.status) searchParams.append("status", params.status);
    if (params.includeDeleted) searchParams.append("includeDeleted", "true");
    return adminApiClient.get(withQuery(`/admin/users/${userId}/trips`, searchParams));
  },

  // Trả { userId, status, lockedAt, lockReason, lockedBy }. Đã khoá sẵn ⇒ 200, giữ lý do và người khoá cũ.
  lockUser: (userId, reason) => adminApiClient.post(`/admin/users/${userId}/lock`, { reason }),
  unlockUser: (userId) => adminApiClient.post(`/admin/users/${userId}/unlock`),
};
