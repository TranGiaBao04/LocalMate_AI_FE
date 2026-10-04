import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "../../context/NotificationContext";
import { notificationService } from "../../services/notificationService";
import { formatRelativeTime } from "../../utils/formatCurrency";

const PAGE_SIZE = 10;

const TYPE_ICONS = {
  welcome: "waving_hand",
  trip_finalized: "task_alt",
  subscription_payment_succeeded: "workspace_premium",
};

// Nơi mở khi bấm vào thông báo, theo targetType của BE
const targetPath = ({ targetType, targetId }) => {
  if (targetType === "Trip" && targetId) return `/trips/${targetId}`;
  if (targetType === "Subscription") return "/subscription";
  if (targetType === "CreateTrip") return "/create";
  return null;
};

export default function NotificationBell() {
  const navigate = useNavigate();
  const { enabled, unreadCount, refreshUnreadCount } = useNotifications();
  const containerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(0); // trang đã tải, 0 = chưa tải
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const loadPage = async (nextPage) => {
    setLoading(true);
    setError("");
    try {
      const data = await notificationService.getNotifications({ page: nextPage, pageSize: PAGE_SIZE });
      setItems((current) => (nextPage === 1 ? data.items : [...current, ...data.items]));
      setPage(data.page);
      setTotalPages(data.totalPages);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggle = () => {
    if (!open) {
      // Mỗi lần mở tải lại từ trang 1 để thấy thông báo mới
      loadPage(1);
      refreshUnreadCount();
    }
    setOpen(!open);
  };

  const handleSelect = (item) => {
    if (!item.isRead) {
      setItems((current) => current.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)));
      notificationService
        .markRead(item.id)
        .catch(() => {
          // Lần mở sau thông báo này hiện lại là chưa đọc
        })
        .finally(refreshUnreadCount);
    }
    const path = targetPath(item);
    if (path) {
      setOpen(false);
      navigate(path);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllRead();
      setItems((current) => current.map((n) => ({ ...n, isRead: true })));
      refreshUnreadCount();
    } catch (err) {
      setError(err.message);
    }
  };

  if (!enabled) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={unreadCount > 0 ? `Thông báo, ${unreadCount} chưa đọc` : "Thông báo"}
        className="soft-shadow relative flex h-[38px] w-[38px] items-center justify-center rounded-full bg-white active:scale-95"
      >
        <span className="material-symbols-outlined text-[17px] text-[#3A4256]">notifications</span>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-error px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Thông báo"
          className="fixed inset-x-5 top-16 z-30 overflow-hidden rounded-2xl border border-border-soft bg-white shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[360px]"
        >
          <div className="flex items-center justify-between gap-3 border-b border-border-soft px-4 py-3">
            <h2 className="text-title-md text-on-surface">Thông báo</h2>
            {unreadCount > 0 && (
              <button type="button" onClick={handleMarkAllRead} className="text-label-md font-bold text-primary hover:underline">
                Đánh dấu đã đọc hết
              </button>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {error && (
              <div role="alert" className="flex items-center justify-between gap-3 px-4 py-3 text-body-md text-error">
                <span>{error}</span>
                <button type="button" onClick={() => loadPage(page || 1)} className="flex-none font-bold underline">
                  Thử lại
                </button>
              </div>
            )}
            {items.length === 0 && !error && (
              <p role="status" className="px-4 py-8 text-center text-body-md text-text-muted">
                {loading ? "Đang tải thông báo..." : "Chưa có thông báo nào."}
              </p>
            )}
            <ul>
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(item)}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-container-low ${
                      item.isRead ? "" : "bg-primary-container/10"
                    }`}
                  >
                    <span className="material-symbols-outlined mt-0.5 flex-none text-[20px] text-primary">
                      {TYPE_ICONS[item.type] ?? "notifications"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-body-md text-on-surface ${item.isRead ? "font-medium" : "font-bold"}`}>
                        {item.title}
                      </span>
                      <span className="mt-0.5 block text-label-md text-text-muted line-clamp-2">{item.body}</span>
                      <span className="mt-1 block text-label-sm text-text-faint">{formatRelativeTime(item.createdAt)}</span>
                    </span>
                    {!item.isRead && <span aria-hidden="true" className="mt-2 h-2 w-2 flex-none rounded-full bg-error" />}
                  </button>
                </li>
              ))}
            </ul>
            {page > 0 && page < totalPages && (
              <button
                type="button"
                onClick={() => loadPage(page + 1)}
                disabled={loading}
                className="w-full px-4 py-3 text-label-md font-bold text-primary hover:bg-surface-container-low disabled:opacity-50"
              >
                {loading ? "Đang tải..." : "Xem thêm"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
