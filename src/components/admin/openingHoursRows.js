import { DAYS_OF_WEEK } from "../../utils/openingHours";

// Dòng của OpenHoursEditor: { dayOfWeek, state: "unset" | "open" | "closed", openTime, closeTime }
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
      return { ...row, state: "open", openTime: day.openTime.slice(0, 5), closeTime: day.closeTime.slice(0, 5) };
    }
    return row;
  });
}

// Dòng của editor -> body PUT: chỉ gửi thứ đã nhập (BE từ chối dòng "mở" mà thiếu giờ)
export function toSaveDays(rows) {
  return rows
    .filter((r) => r.state !== "unset")
    .map((r) =>
      r.state === "closed"
        ? { dayOfWeek: r.dayOfWeek, isClosed: true }
        : { dayOfWeek: r.dayOfWeek, isClosed: false, openTime: r.openTime, closeTime: r.closeTime },
    );
}

// Kiểm tra trước theo luật BE; trả { [dayOfWeek]: câu lỗi }
export function validateHours(rows) {
  const errors = {};
  for (const r of rows) {
    if (r.state !== "open") continue;
    if (!r.openTime || !r.closeTime) errors[r.dayOfWeek] = "Nhập đủ giờ mở và giờ đóng.";
    else if (r.openTime === r.closeTime) errors[r.dayOfWeek] = "Giờ mở và giờ đóng không được trùng nhau.";
  }
  return errors;
}

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
