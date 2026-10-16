// Đường về danh sách địa điểm, giữ nguyên trang + bộ lọc admin đang xem (?page=3&category=Cafe…).
// Danh sách gửi kèm khi mở chi tiết/sửa/tạo: navigate(path, { state: { returnTo } }).
export const PLACE_LIST_PATH = "/admin/places";

export function placeListReturnTo(location) {
  const returnTo = location.state?.returnTo;
  // Chỉ nhận đường dẫn của chính danh sách địa điểm; mở thẳng link (không có state) thì về trang 1
  return typeof returnTo === "string" &&
    (returnTo === PLACE_LIST_PATH || returnTo.startsWith(`${PLACE_LIST_PATH}?`))
    ? returnTo
    : PLACE_LIST_PATH;
}
