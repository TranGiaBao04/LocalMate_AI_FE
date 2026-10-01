import { adminApiClient } from "../api/adminApiClient";

/**
 * Chuyển đổi ngày YYYY-MM-DD sang mốc bắt đầu ngày theo giờ Việt Nam (+07:00)
 * Ví dụ: "2026-10-01" -> "2026-10-01T00:00:00+07:00"
 */
export function formatVnDayStartIso(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) return null;
  return `${dateStr.trim()}T00:00:00+07:00`;
}

/**
 * Chuyển đổi ngày YYYY-MM-DD sang mốc bắt đầu của NGÀY TIẾP THEO theo giờ Việt Nam (+07:00)
 * Dùng cho mốc chặn trên nửa mở [from, to)
 * Ví dụ: "2026-10-01" -> "2026-10-02T00:00:00+07:00"
 */
export function formatVnNextDayStartIso(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) return null;
  const [y, m, d] = dateStr.trim().split("-").map(Number);
  // Dùng UTC Date math để không phụ thuộc múi giờ máy tính của trình duyệt
  const nextDate = new Date(Date.UTC(y, m - 1, d + 1));
  const nextY = nextDate.getUTCFullYear();
  const nextM = String(nextDate.getUTCMonth() + 1).padStart(2, "0");
  const nextD = String(nextDate.getUTCDate()).padStart(2, "0");
  return `${nextY}-${nextM}-${nextD}T00:00:00+07:00`;
}

/**
 * Serialize canonical filters dùng chung cho list, summary và export.csv
 * @param {Object} filters
 * @param {string} [filters.search]
 * @param {string} [filters.status] "Pending" | "Paid" | "Failed" | "Expired"
 * @param {string} [filters.operationType] "Purchase" | "Renewal"
 * @param {string} [filters.fromDate] YYYY-MM-DD
 * @param {string} [filters.toDate] YYYY-MM-DD
 * @param {string} [filters.createdFrom] explicit ISO timestamp
 * @param {string} [filters.createdTo] explicit ISO timestamp
 * @returns {URLSearchParams}
 */
export function serializeTransactionFilters(filters = {}) {
  const searchParams = new URLSearchParams();

  if (filters.search && filters.search.trim()) {
    searchParams.append("search", filters.search.trim().slice(0, 100));
  }

  if (filters.status) {
    searchParams.append("status", filters.status);
  }

  if (filters.operationType) {
    searchParams.append("operationType", filters.operationType);
  }

  const createdFrom = filters.createdFrom || formatVnDayStartIso(filters.fromDate);
  if (createdFrom) {
    searchParams.append("createdFrom", createdFrom);
  }

  const createdTo = filters.createdTo || formatVnNextDayStartIso(filters.toDate);
  if (createdTo) {
    searchParams.append("createdTo", createdTo);
  }

  return searchParams;
}

export const adminTransactionService = {
  /**
   * Lấy danh sách giao dịch có phân trang và sắp xếp
   * @param {Object} params
   * @param {number} [params.page=1]
   * @param {number} [params.pageSize=20]
   * @param {string} [params.sortBy]
   * @param {string} [params.sortDirection] "asc" | "desc"
   * @param {boolean} [params.sortDescending]
   */
  getTransactions: (params = {}) => {
    const searchParams = serializeTransactionFilters(params);

    if (params.page != null) searchParams.append("page", params.page);
    if (params.pageSize != null) searchParams.append("pageSize", params.pageSize);

    if (params.sortBy) {
      searchParams.append("sortBy", params.sortBy);
    }

    if (params.sortDirection) {
      searchParams.append("sortDirection", params.sortDirection);
    } else if (params.sortDescending !== undefined) {
      searchParams.append("sortDirection", params.sortDescending ? "desc" : "asc");
    }

    const queryString = searchParams.toString();
    return adminApiClient.get(`/admin/transactions${queryString ? `?${queryString}` : ""}`);
  },

  /**
   * Lấy dữ liệu tổng hợp (summary cards) theo các bộ lọc chuẩn tắc
   * @param {Object} filters
   */
  getSummary: (filters = {}) => {
    const searchParams = serializeTransactionFilters(filters);
    const queryString = searchParams.toString();
    return adminApiClient.get(`/admin/transactions/summary${queryString ? `?${queryString}` : ""}`);
  },

  /**
   * Xuất danh sách giao dịch sang tệp CSV
   * @param {Object} filters
   * @returns {Promise<Blob>}
   */
  exportTransactions: (filters = {}) => {
    const searchParams = serializeTransactionFilters(filters);
    const queryString = searchParams.toString();
    return adminApiClient.getBlob(`/admin/transactions/export.csv${queryString ? `?${queryString}` : ""}`);
  },

  /**
   * Lấy chi tiết giao dịch theo ID (bao gồm thông tin đơn hàng, lịch sử trạng thái, biên nhận webhook)
   * @param {string} id
   */
  getTransactionDetail: (id) => {
    return adminApiClient.get(`/admin/transactions/${id}`);
  },

  /**
   * Thực hiện đối soát giao dịch với PayOS
   * @param {string} id
   */
  reconcileTransaction: (id) => {
    return adminApiClient.post(`/admin/transactions/${id}/reconcile`);
  },
};
