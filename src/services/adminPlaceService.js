import { adminApiClient } from "../api/adminApiClient";

function toQueryString(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.append(key, value);
    }
  });
  const str = query.toString();
  return str ? `?${str}` : "";
}

export const adminPlaceService = {
  // GET /api/admin/places (Returns PagedResult: { items, page, pageSize, totalCount, totalPages })
  getPlaces: (queryParams = {}) =>
    adminApiClient.get(`/admin/places${toQueryString(queryParams)}`),

  // GET /api/admin/places/{id}
  getPlaceById: (id) =>
    adminApiClient.get(`/admin/places/${id}`),

  // POST /api/admin/places
  createPlace: (data) =>
    adminApiClient.post("/admin/places", data),

  // PUT /api/admin/places/{id}
  updatePlace: (id, data) =>
    adminApiClient.put(`/admin/places/${id}`, data),

  // PUT /api/admin/places/{id}/status
  updatePlaceStatus: (id, status) =>
    adminApiClient.put(`/admin/places/${id}/status`, { status }),

  // DELETE /api/admin/places/{id} (Soft Delete)
  deletePlace: (id) =>
    adminApiClient.delete(`/admin/places/${id}`),

  // POST /api/admin/places/upload-image
  uploadImage: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return adminApiClient.upload("/admin/places/upload-image", formData);
  },

  // POST /api/admin/places/validate-distance
  validateDistance: (data) =>
    adminApiClient.post("/admin/places/validate-distance", data),

  // POST /api/admin/places/detect-duplicates
  detectDuplicates: (data) =>
    adminApiClient.post("/admin/places/detect-duplicates", data),

  // POST /api/admin/places/{id}/tags
  assignTag: (placeId, tagId) =>
    adminApiClient.post(`/admin/places/${placeId}/tags`, { tagId }),

  // DELETE /api/admin/places/{id}/tags/{tagId}
  removeTag: (placeId, tagId) =>
    adminApiClient.delete(`/admin/places/${placeId}/tags/${tagId}`),

  // GET /api/admin/places/import-template?format=xlsx|csv
  getImportTemplate: (format = "xlsx") =>
    adminApiClient.getBlob(`/admin/places/import-template?format=${format}`),

  // POST /api/admin/places/import/preview
  previewImport: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return adminApiClient.upload("/admin/places/import/preview", formData);
  },

  // POST /api/admin/places/import/commit
  commitImport: ({ importId, mode }) =>
    adminApiClient.post("/admin/places/import/commit", { importId, mode }),

  // Download error report URL helper
  getImportErrorReportUrl: (importId) =>
    `/api/admin/places/import/error-report/${importId}`,
};
