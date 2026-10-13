import { adminApiClient } from "../api/adminApiClient";

const RANGE_FIELDS = ["from", "to"];
const CALL_FIELDS = [
  "page", "pageSize", "sortBy", "sortDirection", "from", "to", "kind", "status",
];

function withQuery(path, params, fields) {
  const query = new URLSearchParams();
  for (const field of fields) {
    const value = params[field];
    if (value != null && value !== "") query.set(field, value);
  }
  const suffix = query.toString();
  return suffix ? `${path}?${suffix}` : path;
}

// Defaults and validation belong to BE; responses and ApiError instances pass through unchanged.
export const adminAiUsageService = {
  getSystemSummary: (params = {}, options) =>
    adminApiClient.get(withQuery("/admin/ai-usage/summary", params, RANGE_FIELDS), options),

  getUserSummary: (userId, params = {}, options) =>
    adminApiClient.get(withQuery(
      `/admin/users/${encodeURIComponent(userId)}/ai-usage`, params, RANGE_FIELDS,
    ), options),

  getUserCalls: (userId, params = {}, options) =>
    adminApiClient.get(withQuery(
      `/admin/users/${encodeURIComponent(userId)}/ai-calls`, params, CALL_FIELDS,
    ), options),
};
