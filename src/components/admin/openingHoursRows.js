import { DAYS_OF_WEEK } from "../../utils/openingHours";

// Dòng của OpenHoursEditor: { dayOfWeek, state: "unset" | "open" | "allDay" | "closed", openTime, closeTime }
// "allDay" gửi BE là 00:00–00:00 (mở cả ngày, nối liền với ngày kế tiếp nếu ngày đó cũng mở từ 00:00)
const ALL_DAY_TIME = "00:00";

export const emptyHours = () =>
  DAYS_OF_WEEK.map(({ key }) => ({ dayOfWeek: key, state: "unset", openTime: "", closeTime: "" }));

// GET opening-hours (đủ 7 thứ) -> dòng của editor. isClosed false mà không có giờ = chưa nhập
export function fromOpeningHours(response) {
  const byDay = Object.fromEntries((response?.days ?? []).map((d) => [d.dayOfWeek, d]));
  return emptyHours().map((row) => {
    const day = byDay[row.dayOfWeek];
    if (!day) return row;
    if (day.isClosed) return { ...row, state: "closed" };
    if (day.openTime && day.closeTime) {
      const openTime = day.openTime.slice(0, 5);
      const closeTime = day.closeTime.slice(0, 5);
      if (openTime === ALL_DAY_TIME && closeTime === ALL_DAY_TIME) return { ...row, state: "allDay" };
      return { ...row, state: "open", openTime, closeTime };
    }
    return row;
  });
}

// Dòng của editor -> body PUT: chỉ gửi thứ đã nhập (BE từ chối dòng "mở" mà thiếu giờ)
export function toSaveDays(rows) {
  return rows
    .filter((r) => r.state !== "unset")
    .map((r) => {
      if (r.state === "closed") return { dayOfWeek: r.dayOfWeek, isClosed: true };
      if (r.state === "allDay") {
        return { dayOfWeek: r.dayOfWeek, isClosed: false, openTime: ALL_DAY_TIME, closeTime: ALL_DAY_TIME };
      }
      return { dayOfWeek: r.dayOfWeek, isClosed: false, openTime: r.openTime, closeTime: r.closeTime };
    });
}

// Kiểm tra trước theo luật BE; trả { [dayOfWeek]: câu lỗi }. 00:00–00:00 hợp lệ (BE hiểu là mở cả ngày).
export function validateHours(rows) {
  const errors = {};
  for (const r of rows) {
    if (r.state !== "open") continue;
    if (!r.openTime || !r.closeTime) errors[r.dayOfWeek] = "Nhập đủ giờ mở và giờ đóng.";
    else if (r.openTime === r.closeTime && r.openTime !== ALL_DAY_TIME) {
      errors[r.dayOfWeek] = "Giờ mở và giờ đóng không được trùng nhau. Quán mở 24 giờ thì chọn “Mở cả ngày”.";
    }
  }
  return errors;
}

// Dữ liệu cũ nhập 00:00–23:59 để giả "mở cả ngày": hở 1 phút mỗi đêm, cần đổi sang "Mở cả ngày"
export const looksLikeOldAllDay = (r) => r.state === "open" && r.openTime === "00:00" && r.closeTime === "23:59";

// 400 invalid_opening_hours: errors theo "Days[i]…", i là vị trí trong mảng đã gửi -> lỗi theo thứ
export function mapServerHoursErrors(errors, sentDays) {
  const result = {};
  for (const [key, messages] of Object.entries(errors ?? {})) {
    const match = /^Days\[(\d+)\]/i.exec(key);
    const day = match && sentDays[Number(match[1])]?.dayOfWeek;
    if (day) result[day] = [].concat(messages).join(" ");
  }
  return result;
}
