import { addDays, todayInVietnam } from "../../../utils/vnTime";

// Giới hạn của BE (DashboardDateRules.MaxRangeDays, DashboardTopStationsQuery.MaxLimit)
export const MAX_RANGE_DAYS = 366;
export const STATION_LIMIT_OPTIONS = [5, 10, 14];
export const DEFAULT_STATION_LIMIT = 5;
export const DEFAULT_RANGE_PRESET = "30d";

export const RANGE_PRESETS = [
  { key: "7d", label: "7 ngày" },
  { key: "30d", label: "30 ngày" },
  { key: "month", label: "Tháng này" },
  { key: "custom", label: "Tùy chọn" },
];

export const vndFormatter = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
export const countFormatter = new Intl.NumberFormat("vi-VN");
export const percentFormatter = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });

// "2026-09-30" -> "30/09"
export const formatDayLabel = (isoDate) => `${isoDate.slice(8, 10)}/${isoDate.slice(5, 7)}`;

// "2026-10" -> "10/2026"
export const formatMonthLabel = (month) => `${month.slice(5, 7)}/${month.slice(0, 4)}`;

// Số ngày của khoảng, tính cả 2 đầu
export const countDays = ({ from, to }) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;

// Khoảng ngày theo giờ VN. "Tháng này" = ngày 1 tới hôm nay.
export function resolvePresetRange(key, today = todayInVietnam()) {
  if (key === "month") return { from: `${today.slice(0, 7)}-01`, to: today };
  const days = key === "7d" ? 7 : 30;
  return { from: addDays(today, -(days - 1)), to: today };
}

// Cùng luật với BE: to ≤ hôm nay, from ≤ to, tối đa 366 ngày. Trả lỗi theo ô { from?, to? }.
export function validateRange({ from, to }, today = todayInVietnam()) {
  const errors = {};
  if (!from) errors.from = "Chọn ngày bắt đầu.";
  if (!to) errors.to = "Chọn ngày kết thúc.";
  else if (to > today) errors.to = "Ngày kết thúc không được sau hôm nay.";

  if (from && to && from > to) {
    errors.from = "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.";
  } else if (from && to && countDays({ from, to }) > MAX_RANGE_DAYS) {
    errors.from = `Khoảng ngày tối đa ${MAX_RANGE_DAYS} ngày.`;
  }
  return errors;
}

// 12 tháng gần nhất, mới nhất trước ("yyyy-MM"). BE không nhận tháng tương lai.
export function recentMonths(count = 12, today = todayInVietnam()) {
  let year = Number(today.slice(0, 4));
  let month = Number(today.slice(5, 7));
  return Array.from({ length: count }, () => {
    const value = `${year}-${String(month).padStart(2, "0")}`;
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
    return value;
  });
}

const FIELD_LABELS = { From: "Ngày bắt đầu", To: "Ngày kết thúc", Limit: "Số ga", Month: "Tháng" };
const FIELD_NAME_PATTERN = /(^|\s)(From|To|Limit|Month)(?=[\s.,]|$)/g;

// 400 invalid_dashboard_query → { from, to, limit, month }. Câu lỗi BE dùng tên field tiếng Anh
// ("From phải trước hoặc bằng To.") nên thay bằng nhãn tiếng Việt. Lỗi khác ⇒ null.
// `code`: API thống kê phản hồi dùng chung luật ngày nhưng trả mã invalid_admin_feedback_query.
export function getDashboardFieldErrors(err, code = "invalid_dashboard_query") {
  if (err?.code !== code || !err.errors) return null;
  return Object.fromEntries(
    Object.entries(err.errors).map(([field, messages]) => {
      const message = String(messages?.[0] ?? "Giá trị không hợp lệ.").replace(
        FIELD_NAME_PATTERN,
        (_, space, name) => `${space}${space ? FIELD_LABELS[name].toLowerCase() : FIELD_LABELS[name]}`,
      );
      return [field.toLowerCase(), message];
    }),
  );
}
