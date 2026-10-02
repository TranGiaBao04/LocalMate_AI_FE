import { adminApiClient } from "../api/adminApiClient";

// Cần quyền ManageSettings. Đổi thông số có hiệu lực ngay (generate, feasibility, alternatives, nearby...).
// Phần tử: { key, group, name, description, valueType: "Integer"|"Decimal", unit, value, defaultValue,
//   minValue, maxValue, isDefault, updatedAt, updatedBy: { userId, fullName, email } | null }
export const adminSettingService = {
  getSettings: () => adminApiClient.get("/admin/settings"),
  // value phải là số. 400 invalid_setting_value (câu lỗi ở errors.Value[0]), 404 setting_not_found
  updateSetting: (key, value) =>
    adminApiClient.put(`/admin/settings/${encodeURIComponent(key)}`, { value }),
  // Khôi phục mặc định, gọi nhiều lần vẫn 200
  resetSetting: (key) => adminApiClient.delete(`/admin/settings/${encodeURIComponent(key)}`),
};
