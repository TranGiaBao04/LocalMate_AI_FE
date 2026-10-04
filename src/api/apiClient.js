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
  429: "Bạn thao tác quá nhanh. Vui lòng thử lại sau.",
};

export const AUTH_EVENTS = { SESSION_ENDED: "localmate:session-ended" };

// BE-83: API cần đăng nhập (và cả login) trả các mã này ⇒ token hiện tại không còn dùng được.
const SESSION_ENDING_MESSAGES = {
  account_locked: "Tài khoản đã bị khoá, vui lòng liên hệ hỗ trợ.",
  account_not_found: "Tài khoản không còn tồn tại. Vui lòng đăng nhập lại.",
};

export const isSessionEndingError = (err) => Boolean(SESSION_ENDING_MESSAGES[err?.code]);

function buildErrorMessage(status, data, code) {
  if (SESSION_ENDING_MESSAGES[code]) return SESSION_ENDING_MESSAGES[code];
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

function dispatchSessionEndedIfApplicable(token, code) {
  // Chỉ khi request có gửi token: AuthContext nghe sự kiện để đăng xuất.
  if (token && SESSION_ENDING_MESSAGES[code] && typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(AUTH_EVENTS.SESSION_ENDED, {
        detail: { message: SESSION_ENDING_MESSAGES[code] },
      })
    );
  }
}

async function request(path, { method = "GET", body, auth = true, withMeta = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = auth ? getToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return withMeta ? { status: 204, data: null } : null;

  const isJson = res.headers.get("content-type")?.includes("json");
  const data = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const code = data?.code || data?.extensions?.code || null;
    const errors = data?.errors || null;
    dispatchSessionEndedIfApplicable(token, code);
    throw new ApiError(buildErrorMessage(res.status, data, code), res.status, code, errors, data);
  }

  if (withMeta) {
    return { status: res.status, data };
  }

  return data;
}

async function requestBlob(path, { method = "GET", auth = true } = {}) {
  const headers = {};
  const token = auth ? getToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
  });

  if (!res.ok) {
    const isJson = res.headers.get("content-type")?.includes("json");
    const data = isJson ? await res.json().catch(() => null) : null;
    const code = data?.code || data?.extensions?.code || null;
    const errors = data?.errors || null;
    dispatchSessionEndedIfApplicable(token, code);
    throw new ApiError(buildErrorMessage(res.status, data, code), res.status, code, errors, data);
  }

  const blob = await res.blob();

  const disposition = res.headers.get("content-disposition");
  let fileName = null;
  if (disposition) {
    const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match) {
      try {
        fileName = decodeURIComponent(utf8Match[1]);
      } catch {
        fileName = utf8Match[1];
      }
    } else {
      const match = disposition.match(/filename="?([^";]+)"?/i);
      if (match) fileName = match[1];
    }
  }

  if (fileName) {
    blob.fileName = fileName;
  }

  return blob;
}

async function upload(path, formData, { auth = true } = {}) {
  const headers = {};
  const token = auth ? getToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers,
    body: formData,
  });

  const isJson = res.headers.get("content-type")?.includes("json");
  const data = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const code = data?.code || data?.extensions?.code || null;
    const errors = data?.errors || null;
    dispatchSessionEndedIfApplicable(token, code);
    throw new ApiError(buildErrorMessage(res.status, data, code), res.status, code, errors, data);
  }

  return data;
}

export const apiClient = {
  get: (path, options) => request(path, { ...options, method: "GET" }),
  post: (path, body, options) =>
    request(path, { ...options, method: "POST", body }),
  postWithMeta: (path, body, options) =>
    request(path, { ...options, method: "POST", body, withMeta: true }),
  put: (path, body, options) =>
    request(path, { ...options, method: "PUT", body }),
  patch: (path, body, options) =>
    request(path, { ...options, method: "PATCH", body }),
  delete: (path, options) => request(path, { ...options, method: "DELETE" }),
  getBlob: (path, options) => requestBlob(path, { ...options, method: "GET" }),
  upload: (path, formData, options) => upload(path, formData, options),
};
