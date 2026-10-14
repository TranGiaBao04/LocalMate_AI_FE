import { formatVnDateTime } from "../../../utils/subscriptionUtils";

// Nhãn và câu lỗi dùng chung cho màn Quản lý người dùng (F8)
export const LOCK_REASON_MAX_LENGTH = 500;

export const USER_STATUS_BADGE = {
  Active: { status: "active", label: "Hoạt động" },
  Locked: { status: "locked", label: "Đã khoá" },
};

// BE để câu tiếng Việt trong `detail`, apiClient không đọc ⇒ FE tự map theo code
export const LOCK_ERROR_MESSAGES = {
  invalid_lock_reason: `Lý do khoá là bắt buộc, tối đa ${LOCK_REASON_MAX_LENGTH} ký tự.`,
  cannot_lock_self: "Không thể tự khoá tài khoản của chính mình.",
  cannot_manage_role_manager: "Chỉ người có quyền quản lý phân quyền mới được khoá/mở khoá tài khoản này.",
  last_role_manager: "Phải còn ít nhất một người đang hoạt động có quyền quản lý phân quyền.",
  user_not_found: "Không tìm thấy người dùng.",
};

export function describeLockResult(result, mode, actorId) {
  if (mode === "unlock") return { type: "success", message: "Đã mở khoá tài khoản." };
  // Người khác khoá trước (BE vẫn trả 200, giữ lý do cũ)
  if (result?.lockedBy && result.lockedBy.userId !== actorId) {
    return { type: "info", message: `Tài khoản đã bị ${result.lockedBy.fullName} khoá trước đó.` };
  }
  return { type: "success", message: "Đã khoá tài khoản. Người dùng bị đăng xuất ở lần thao tác tiếp theo." };
}

export const GRANT_DAYS_MIN = 1;
export const GRANT_DAYS_MAX = 90;
export const GRANT_REASON_MAX_LENGTH = 500;

// 409 có câu tiếng Việt trong `detail` nhưng apiClient không đọc ⇒ map theo code
export const GRANT_ERROR_MESSAGES = {
  user_not_found: "Không tìm thấy người dùng.",
  user_locked: "Không thể tặng gói cho tài khoản đang bị khoá.",
  grant_exceeds_max_horizon: "Gói tặng không được kết thúc sau 365 ngày kể từ hôm nay.",
};

export const GRANT_SOURCE_LABELS = {
  Admin: "Admin tặng",
  SignupTrial: "Dùng thử khi đăng ký",
};

// Gói tặng có thể xếp nối sau gói đang có nên có cả trạng thái "chưa bắt đầu"
export function getGrantState(grant, now = Date.now()) {
  if (now < new Date(grant.startsAt).getTime()) return { status: "pending", label: "Chưa bắt đầu" };
  if (now < new Date(grant.endsAt).getTime()) return { status: "active", label: "Đang hiệu lực" };
  return { status: "inactive", label: "Đã hết" };
}

export function describeGrantResult(result) {
  return {
    type: "success",
    message: `Đã tặng ${result?.plan?.name ?? "gói"}, có hiệu lực từ ${formatVnDateTime(result?.startsAt)} đến ${formatVnDateTime(result?.endsAt)}.`,
  };
}
