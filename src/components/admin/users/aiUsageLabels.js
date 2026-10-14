export const AI_KIND_LABELS = {
  ParseRequest: "Phân tích yêu cầu",
  Explain: "Giải thích lịch trình",
};

export const AI_STATUS_BADGES = {
  Succeeded: { status: "success", label: "Thành công" },
  ProviderFailed: { status: "failed", label: "Lỗi nhà cung cấp" },
  InvalidOutput: { status: "failed", label: "Kết quả không hợp lệ" },
  Abandoned: { status: "warning", label: "Bị gián đoạn" },
  InProgress: { status: "info", label: "Đang xử lý" },
};
