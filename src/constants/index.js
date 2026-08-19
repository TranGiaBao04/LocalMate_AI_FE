export const INTERESTS = [
  { id: "cafe", label: "Cafe", icon: "local_cafe" },
  { id: "local-food", label: "Ăn uống địa phương", icon: "restaurant" },
  { id: "check-in", label: "Check-in", icon: "photo_camera" },
  { id: "culture", label: "Văn hóa", icon: "museum" },
  { id: "walking", label: "Đi bộ", icon: "directions_walk" },
  { id: "hidden-gem", label: "Hidden gems", icon: "diamond" },
  { id: "quiet", label: "Không gian yên tĩnh", icon: "spa" },
  { id: "workshop", label: "Workshop", icon: "palette" },
  { id: "view", label: "View đẹp", icon: "landscape" },
  { id: "near-metro", label: "Gần metro", icon: "train" },
  { id: "photo", label: "Chụp hình", icon: "camera_alt" },
  { id: "group", label: "Phù hợp nhóm bạn", icon: "group" },
];

export const TRAVEL_STYLES = [
  {
    id: "chill",
    label: "Chill",
    icon: "beach_access",
    desc: "Thư giãn, không vội",
  },
  { id: "budget", label: "Tiết kiệm", icon: "savings", desc: "Tối ưu chi phí" },
  {
    id: "low-movement",
    label: "Ít di chuyển",
    icon: "directions_walk",
    desc: "Gần nhau, đỡ mệt",
  },
  {
    id: "multi-stop",
    label: "Đi nhiều điểm",
    icon: "map",
    desc: "Khám phá nhiều nơi",
  },
  { id: "date", label: "Hẹn hò", icon: "favorite", desc: "Lãng mạn, ấm cúng" },
  {
    id: "friends",
    label: "Nhóm bạn",
    icon: "group",
    desc: "Vui vẻ, năng động",
  },
  {
    id: "local",
    label: "Khám phá local",
    icon: "explore",
    desc: "Trải nghiệm bản địa",
  },
  {
    id: "weekend",
    label: "Buổi chiều nhẹ",
    icon: "wb_sunny",
    desc: "Nhẹ nhàng cuối tuần",
  },
];

export const DURATION_OPTIONS = [
  { value: 2, label: "2 giờ" },
  { value: 4, label: "4 giờ" },
  { value: 6, label: "Một buổi" },
  { value: 8, label: "Cả ngày" },
];

export const TIME_OF_DAY_OPTIONS = [
  { id: "morning", label: "Sáng", icon: "wb_twilight" },
  { id: "afternoon", label: "Chiều", icon: "wb_sunny" },
  { id: "evening", label: "Tối", icon: "nights_stay" },
  { id: "weekend", label: "Cuối tuần", icon: "event" },
];

export const BUDGET_OPTIONS = [
  { id: "low", label: "Dưới 150k/người", value: 150000 },
  { id: "mid", label: "150k – 300k/người", value: 300000 },
  { id: "high", label: "300k – 500k/người", value: 500000 },
  { id: "flex", label: "Linh hoạt", value: 999999 },
];

export const PEOPLE_OPTIONS = [
  { id: "1", label: "1 người", value: 1 },
  { id: "2", label: "2 người", value: 2 },
  { id: "3-5", label: "3–5 người", value: 4 },
  { id: "group", label: "Nhóm lớn", value: 10 },
];

export const AREAS = [
  "Quận 1",
  "Quận 3",
  "Bình Thạnh",
  "TP. Thủ Đức",
  "Tân Bình",
  "Phú Nhuận",
  "Quận 4",
  "Quận 7",
];

export const METRO_STATIONS = [
  "Bến Thành",
  "Nhà hát Thành phố",
  "Ba Son",
  "Văn Thánh",
  "Tân Cảng",
  "Thảo Điền",
  "An Phú",
];

export const REVIEW_TAGS = [
  "Đáng đi",
  "Gần metro",
  "Dễ di chuyển",
  "Giá hợp lý",
  "Không gian đẹp",
  "Phù hợp nhóm bạn",
  "Quá đông",
  "Khó tìm",
  "Giá cao hơn dự kiến",
  "Không đúng kỳ vọng",
  "Không giống mô tả",
];

export const REPLACE_REASONS = [
  { id: "cheaper", label: "Rẻ hơn", icon: "savings" },
  { id: "chill", label: "Chill hơn", icon: "beach_access" },
  { id: "closer", label: "Ít di chuyển hơn", icon: "near_me" },
  { id: "more-cafe", label: "Nhiều cafe hơn", icon: "local_cafe" },
  { id: "hidden-gems", label: "Hidden gems", icon: "diamond" },
  { id: "group", label: "Phù hợp nhóm hơn", icon: "group" },
];

export const STORAGE_KEYS = {
  USER: "localmate_user",
  TRIP_DRAFT: "localmate_trip_draft",
  TRIP_REQUEST: "localmate_trip_request",
  SAVED_TRIPS: "localmate_saved_trips",
  PLACE_REVIEWS: "localmate_place_reviews",
  PREFERENCES: "localmate_preferences",
};
