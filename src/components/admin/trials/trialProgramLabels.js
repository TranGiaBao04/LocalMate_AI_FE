// Nhãn, giới hạn và câu lỗi cho màn Dùng thử khi đăng ký
export const TRIAL_NAME_MAX_LENGTH = 100;
export const TRIAL_DAYS_MIN = 1;
export const TRIAL_DAYS_MAX = 30;
export const TRIAL_MAX_RECIPIENTS_MAX = 100000;

// status do BE tính theo ngày hôm nay (giờ VN)
export const TRIAL_STATUS_BADGE = {
  Disabled: { status: "inactive", label: "Đã tắt" },
  Ended: { status: "inactive", label: "Đã kết thúc" },
  Upcoming: { status: "info", label: "Sắp diễn ra" },
  Full: { status: "warning", label: "Hết suất" },
  Running: { status: "active", label: "Đang chạy" },
};

// 404/409 có câu tiếng Việt trong `detail` nhưng apiClient không đọc ⇒ map theo code
export const TRIAL_ERROR_MESSAGES = {
  trial_program_not_found: "Chương trình không còn tồn tại. Danh sách đã được tải lại.",
  trial_program_overlap: "Khoảng ngày trùng với một chương trình dùng thử đang bật khác.",
};

// "2026-10-14" -> "14/10/2026" (ngày theo lịch VN, không đổi múi giờ)
export const formatIsoDate = (isoDate) => (isoDate ? isoDate.split("-").reverse().join("/") : "—");

// Lỗi 400 theo field (Name → name, EndsOn → endsOn), câu của BE là tiếng Việt, hiện thẳng được
export function getTrialFieldErrors(err) {
  if (err?.code !== "invalid_trial_program" || !err.errors) return null;
  return Object.fromEntries(Object.entries(err.errors).map(([field, messages]) => [
    field[0].toLowerCase() + field.slice(1),
    String(messages?.[0] ?? "Giá trị không hợp lệ."),
  ]));
}

export function getTrialErrorMessage(err, fallback) {
  const fieldErrors = getTrialFieldErrors(err);
  if (fieldErrors) return Object.values(fieldErrors)[0];
  return TRIAL_ERROR_MESSAGES[err?.code] ?? err?.message ?? fallback;
}

// PUT phải gửi đủ mọi field ⇒ dựng body từ chương trình đang có
export const toTrialPayload = (program) => ({
  name: program.name,
  startsOn: program.startsOn,
  endsOn: program.endsOn,
  trialDays: program.trialDays,
  maxRecipients: program.maxRecipients ?? null,
  isEnabled: program.isEnabled,
});
