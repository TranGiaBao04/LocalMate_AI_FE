import { apiClient } from "../api/apiClient";

export const notificationService = {
  // Hộp thư của tài khoản thật (phiên demo bị 403 notifications_requires_persisted_user).
  // { items: [{ id, type, title, body, targetType: "None" | "Trip" | "Subscription" | "CreateTrip",
  //             targetId, isRead, readAt, createdAt }], page, pageSize, totalCount, totalPages }
  getNotifications: ({ page = 1, pageSize = 10 } = {}) =>
    apiClient.get(`/notifications?page=${page}&pageSize=${pageSize}`),
  // { count }
  getUnreadCount: () => apiClient.get("/notifications/unread-count"),
  markRead: (id) => apiClient.post(`/notifications/${id}/read`),
  markAllRead: () => apiClient.post("/notifications/read-all"),
};
