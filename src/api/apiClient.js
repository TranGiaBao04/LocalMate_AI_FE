import { STORAGE_KEYS } from "../constants";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

export class ApiError extends Error {
  constructor(message, status, code = null, errors = null, data = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.errors = errors;
    this.data = data;
  }
}

// title của ProblemDetails BE là tiếng Anh, nên không hiển thị. Trang tự map `code` quen thuộc,
// còn lại dùng thông báo chung theo HTTP status.
const STATUS_MESSAGES = {
  400: "Dữ liệu chưa hợp lệ. Vui lòng kiểm tra lại.",
  401: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
  403: "Bạn cần đăng nhập bằng tài khoản đã đăng ký để dùng chức năng này.",
  404: "Không tìm thấy dữ liệu.",
  409: "Thao tác không thực hiện được ở trạng thái hiện tại.",
};

function buildErrorMessage(status, data) {
  // ValidationProblem theo field (vd PlannedDate, StartTime). Bỏ qua lỗi parse JSON ("$.startTime"),
  // vì nội dung là thông báo mặc định tiếng Anh của .NET.
  const fieldErrors = Object.entries(data?.errors ?? {})
    .filter(([field]) => !field.startsWith("$"))
    .flatMap(([, messages]) => messages);
  if (fieldErrors.length > 0) return fieldErrors.join(" ");
  if (data?.message) return data.message;
  if (STATUS_MESSAGES[status]) return STATUS_MESSAGES[status];
  return status >= 500
    ? "Máy chủ đang gặp sự cố. Vui lòng thử lại sau."
    : `Yêu cầu thất bại (${status}).`;
}

function getToken() {
  return localStorage.getItem(STORAGE_KEYS.TOKEN);
}

async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = auth ? getToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;

  const isJson = res.headers.get("content-type")?.includes("json");
  const data = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const code = data?.code || data?.extensions?.code || null;
    const errors = data?.errors || null;
    throw new ApiError(buildErrorMessage(res.status, data), res.status, code, errors, data);
  }

  return data;
}

export const apiClient = {
  get: (path, options) => request(path, { ...options, method: "GET" }),
  post: (path, body, options) =>
    request(path, { ...options, method: "POST", body }),
  put: (path, body, options) =>
    request(path, { ...options, method: "PUT", body }),
  patch: (path, body, options) =>
    request(path, { ...options, method: "PATCH", body }),
  delete: (path, options) => request(path, { ...options, method: "DELETE" }),
};
