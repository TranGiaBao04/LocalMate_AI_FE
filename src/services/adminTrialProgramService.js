import { adminApiClient } from "../api/adminApiClient";

// Chương trình dùng thử khi đăng ký (quyền ManagePlans). Gói dùng thử luôn là gói mã TripPass (tên lấy từ danh sách gói).
// Dòng: { id, name, startsOn, endsOn (yyyy-MM-dd theo lịch VN), trialDays, maxRecipients (null = không giới hạn),
//   isEnabled, status: Disabled|Ended|Upcoming|Full|Running, grantedCount, remaining, createdAt, updatedAt }
// Lỗi: 400 invalid_trial_program (errors.Name/StartsOn/EndsOn/TrialDays/MaxRecipients/IsEnabled),
// 404 trial_program_not_found, 409 trial_program_overlap. Không có API xoá, muốn dừng thì tắt.
export const adminTrialProgramService = {
  // Mảng, mới nhất trước
  getPrograms: () => adminApiClient.get("/admin/trial-programs"),
  // 201, trả một chương trình
  createProgram: (data) => adminApiClient.post("/admin/trial-programs", data),
  // PUT thay toàn bộ field (gửi đủ cả field không đổi), 200 trả một chương trình
  updateProgram: (id, data) => adminApiClient.put(`/admin/trial-programs/${id}`, data),
};
