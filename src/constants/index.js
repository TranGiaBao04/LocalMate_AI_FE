export const DURATION_OPTIONS = [
  { value: 2, label: "2 giờ" },
  { value: 4, label: "4 giờ" },
  { value: 6, label: "Một buổi" },
  { value: 8, label: "Cả ngày" },
];

// value = budgetMax gửi BE, tính cho MỘT người (VNĐ). BE không có "không giới hạn" nên "Linh hoạt" có mức trần.
export const BUDGET_OPTIONS = [
  { id: "low", label: "Dưới 150k/người", value: 150000 },
  { id: "mid", label: "150k – 300k/người", value: 300000 },
  { id: "high", label: "300k – 500k/người", value: 500000 },
  { id: "flex", label: "Linh hoạt (tối đa 1 triệu/người)", value: 1000000 },
];

export const PEOPLE_OPTIONS = [
  { id: "1", label: "1 người", value: 1 },
  { id: "2", label: "2 người", value: 2 },
  { id: "3-5", label: "3–5 người", value: 4 },
  { id: "group", label: "Nhóm lớn", value: 10 },
];

export const REVIEW_MAX_TAGS = 3;

export const STORAGE_KEYS = {
  TOKEN: "localmate_token",
  IS_DEMO: "localmate_is_demo",
  TRIP_DRAFT: "localmate_trip_draft",
  TRIP_REQUEST: "localmate_trip_request",
  GUEST_TOUR_DISMISSED: "localmate_guest_tour_dismissed",
};
