import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTrip } from "../../context/TripContext";
import { useAuth } from "../../context/AuthContext";
import MobileLayout from "../../components/layout/MobileLayout";
import {
  formatCurrencyShort,
  formatRelativeTime,
} from "../../utils/formatCurrency";

const STATUS_CONFIG = {
  draft: { label: "Nháp", color: "bg-tertiary-container/30 text-tertiary" },
  finalized: { label: "Đã chốt", color: "bg-primary/10 text-primary" },
};
const UNKNOWN_STATUS = { label: "Không rõ", color: "bg-surface-container-high text-on-surface-variant" };

export default function MyTripsPage() {
  const navigate = useNavigate();
  const { isDemo } = useAuth();
  const { savedTrips, deleteTrip, tripsLoading, tripsLoaded, tripsError, retryTrips } = useTrip();
  const [tripToDelete, setTripToDelete] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const deletePending = useRef(false);

  const confirmDelete = async () => {
    if (!tripToDelete || deletePending.current) return;
    deletePending.current = true;
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteTrip(tripToDelete.id);
      setTripToDelete(null);
    } catch (err) {
      setDeleteError(err.status === 404
        ? "Lịch trình này không còn tồn tại. Hãy tải lại danh sách."
        : err.status === 401 || err.status === 403
          ? "Bạn không có quyền xoá lịch trình này. Vui lòng đăng nhập lại."
          : "Không thể xoá lịch trình lúc này. Vui lòng thử lại.");
    } finally {
      deletePending.current = false;
      setDeleting(false);
    }
  };

  return (
    <MobileLayout>
      <header className="app-header flex h-16 items-center justify-between border-b border-outline-variant/20 px-container-margin py-stack-sm lg:px-8">
        <h1 className="text-headline-lg-mobile font-extrabold text-primary">
          Lịch trình cá nhân
        </h1>

        <button
          onClick={() => navigate("/create")}
          className="flex items-center gap-1 px-4 py-2 bg-primary text-on-primary rounded-full text-label-md font-bold active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
          Tạo mới
        </button>
      </header>

      <main className="content-shell flex-1 space-y-stack-md px-container-margin pb-28 pt-20 lg:px-8 lg:pb-12">
        {isDemo ? (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <p className="text-body-lg text-on-surface-variant">Đăng nhập bằng tài khoản để xem các chuyến đi đã lưu.</p>
            <button type="button" onClick={() => navigate("/login")} className="btn-primary w-auto px-8">Đăng nhập</button>
          </div>
        ) : tripsLoading || !tripsLoaded ? (
          <p role="status" className="py-20 text-center text-body-lg text-on-surface-variant">Đang tải lịch trình...</p>
        ) : tripsError ? (
          <div role="alert" className="flex flex-col items-center gap-4 py-20 text-center">
            <p className="text-body-lg text-on-surface-variant">Không thể tải lịch trình. Vui lòng thử lại.</p>
            <button type="button" onClick={retryTrips} className="btn-primary w-auto px-8">Thử lại</button>
          </div>
        ) : savedTrips.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <span
              className="material-symbols-outlined text-outline-variant"
              style={{ fontSize: 72 }}
            >
              luggage
            </span>
            <p className="text-body-lg text-on-surface-variant text-center">
              Bạn chưa lưu lịch trình nào.
            </p>
            <button
              onClick={() => navigate("/create")}
              className="btn-primary w-auto px-8"
            >
              Tạo lịch trình
            </button>
          </div>
        ) : (
          <>
            <p className="text-body-md text-on-surface-variant">
              {savedTrips.length} lịch trình
            </p>

            <div className="grid gap-stack-md lg:grid-cols-2">
              {savedTrips.map((trip) => {
                const statusCfg = STATUS_CONFIG[trip.status] ?? UNKNOWN_STATUS;
                const coverImage = trip.items[0]?.placeImageUrl;

                return (
                  <div
                    key={trip.id}
                    className="card space-y-stack-sm active:scale-[0.98] transition-transform cursor-pointer"
                    onClick={() => navigate(`/trips/${trip.id}`)}
                  >
                    {coverImage && (
                      <img
                        src={coverImage}
                        alt={trip.title}
                        className="h-40 w-full rounded-lg object-cover"
                      />
                    )}

                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-body-md font-bold text-on-surface truncate">
                          {trip.title}
                        </h3>
                        <p className="text-label-md text-on-surface-variant mt-0.5">
                          {trip.mainArea}
                        </p>
                      </div>

                      <span
                        className={`px-3 py-1 rounded-full text-label-md font-bold ml-2 flex-shrink-0 ${statusCfg.color}`}
                      >
                        {statusCfg.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 flex-wrap">
                      <span className="flex items-center gap-1 text-label-md text-on-surface-variant">
                        <span className="material-symbols-outlined text-[14px]">
                          schedule
                        </span>
                        {trip.durationHours} tiếng
                      </span>

                      <span className="flex items-center gap-1 text-label-md text-on-surface-variant">
                        <span className="material-symbols-outlined text-[14px]">
                          payments
                        </span>
                        ~{formatCurrencyShort(trip.estimatedBudget)}
                      </span>

                      <span className="flex items-center gap-1 text-label-md text-on-surface-variant">
                        <span className="material-symbols-outlined text-[14px]">
                          place
                        </span>
                        {trip.itemCount ?? trip.items.length} địa điểm
                      </span>

                      {trip.metroFriendly && (
                        <span className="flex items-center gap-1 text-label-md text-secondary">
                          <span className="material-symbols-outlined text-[14px]">
                            train
                          </span>
                          Metro
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-outline-variant/20">
                      <span className="text-label-md text-on-surface-variant">
                        {formatRelativeTime(trip.createdAt)}
                      </span>

                      <div
                        className="flex gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => navigate(`/trips/${trip.id}`)}
                          className="px-3 py-1.5 bg-primary text-on-primary rounded-full text-label-md font-bold active:scale-95 transition-all"
                        >
                          Xem
                        </button>

                        <button
                          onClick={() => {
                            setDeleteError("");
                            setTripToDelete(trip);
                          }}
                          className="px-3 py-1.5 border border-error/30 text-error rounded-full text-label-md font-bold active:scale-95 transition-all hover:bg-error-container"
                        >
                          Xóa
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>
      {tripToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-trip-title"
          onKeyDown={(event) => {
            if (event.key === "Escape" && !deleting) setTripToDelete(null);
          }}
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 px-container-margin pb-4 sm:items-center"
        >
          <div className="w-full max-w-md space-y-stack-md rounded-lg bg-surface p-stack-lg shadow-xl">
            <h2 id="delete-trip-title" className="text-title-md font-bold text-on-surface">Xoá lịch trình?</h2>
            <p className="text-body-md text-on-surface-variant">Lịch trình sẽ bị xoá khỏi My Trips.</p>
            <p className="break-words text-body-md font-semibold text-on-surface">{tripToDelete.title}</p>
            {deleteError && <p role="alert" className="text-label-md text-error">{deleteError}</p>}
            <div className="flex gap-3">
              <button type="button" autoFocus disabled={deleting} onClick={() => setTripToDelete(null)} className="flex-1 rounded-full border border-outline-variant py-3 font-semibold text-on-surface-variant disabled:opacity-50">Huỷ</button>
              <button type="button" disabled={deleting} onClick={confirmDelete} className="flex-1 rounded-full bg-error py-3 font-semibold text-on-error disabled:opacity-50">{deleting ? "Đang xoá..." : "Xoá lịch trình"}</button>
            </div>
          </div>
        </div>
      )}
    </MobileLayout>
  );
}
