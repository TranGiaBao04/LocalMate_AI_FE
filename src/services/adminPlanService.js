import { adminApiClient } from "../api/adminApiClient";

export const adminPlanService = {
  /**
   * Lấy danh sách gói dịch vụ có phân trang, tìm kiếm, lọc và sắp xếp
   * @param {Object} params
   * @param {number} [params.page=1]
   * @param {number} [params.pageSize=10]
   * @param {string} [params.search]
   * @param {boolean} [params.isActive]
   * @param {boolean} [params.isSystem]
   * @param {string} [params.sortBy]
   * @param {string} [params.sortDirection] "asc" | "desc"
   * @param {boolean} [params.sortDescending]
   */
  getPlans: (params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.page != null) searchParams.append("page", params.page);
    if (params.pageSize != null) searchParams.append("pageSize", params.pageSize);

    if (params.search && params.search.trim()) {
      searchParams.append("search", params.search.trim());
    }

    if (params.isActive !== undefined && params.isActive !== null && params.isActive !== "") {
      searchParams.append("isActive", String(params.isActive));
    }

    if (params.isSystem !== undefined && params.isSystem !== null && params.isSystem !== "") {
      searchParams.append("isSystem", String(params.isSystem));
    }

    if (params.sortBy) {
      searchParams.append("sortBy", params.sortBy);
    }

    if (params.sortDirection) {
      searchParams.append("sortDirection", params.sortDirection);
    } else if (params.sortDescending !== undefined) {
      searchParams.append("sortDirection", params.sortDescending ? "desc" : "asc");
    }

    const queryString = searchParams.toString();
    return adminApiClient.get(`/admin/plans${queryString ? `?${queryString}` : ""}`);
  },

  /**
   * Lấy danh mục quyền lợi (features) động của hệ thống
   * @returns {Promise<Array<{ id: string, code: string, name: string, description: string | null }>>}
   */
  getFeatures: () => adminApiClient.get("/admin/plans/features"),

  /**
   * Lấy chi tiết gói dịch vụ theo ID
   * @param {string} id GUID mã gói
   */
  getPlanById: (id) => adminApiClient.get(`/admin/plans/${id}`),

  /**
   * Tạo gói dịch vụ mới
   * @param {Object} data CreateAdminPlanRequest { code, name, entitlementPriority, price, durationDays, generateLimit, savedTripLimit, featureIds }
   */
  createPlan: (data) => adminApiClient.post("/admin/plans", data),

  /**
   * Cập nhật điều khoản gói dịch vụ
   * @param {string} id GUID mã gói
   * @param {Object} data UpdateAdminPlanRequest { name, price, durationDays, generateLimit, savedTripLimit, featureIds }
   */
  updatePlan: (id, data) => adminApiClient.put(`/admin/plans/${id}`, data),

  /**
   * Cập nhật trạng thái kích hoạt / tạm dừng gói
   * @param {string} id GUID mã gói
   * @param {boolean} isActive
   */
  updatePlanStatus: (id, isActive) =>
    adminApiClient.put(`/admin/plans/${id}/status`, { isActive }),

  /**
   * Xóa gói dịch vụ tùy chỉnh chưa có người dùng
   * @param {string} id GUID mã gói
   */
  deletePlan: (id) => adminApiClient.delete(`/admin/plans/${id}`),

  /**
   * Lấy lịch sử phiên bản của gói dịch vụ
   * @param {string} id GUID mã gói
   * @param {Object} [params]
   * @param {number} [params.page=1]
   * @param {number} [params.pageSize=10]
   */
  getPlanVersions: (id, params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.page != null) searchParams.append("page", params.page);
    if (params.pageSize != null) searchParams.append("pageSize", params.pageSize);

    const queryString = searchParams.toString();
    return adminApiClient.get(`/admin/plans/${id}/versions${queryString ? `?${queryString}` : ""}`);
  },
};
