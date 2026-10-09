import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTrip } from "../../context/TripContext";
import { useAuth } from "../../context/AuthContext";
import MobileLayout from "../../components/layout/MobileLayout";
import PageHeader from "../../components/layout/PageHeader";
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
      <PageHeader title="Lịch trình cá nhân">
        <button
          onClick={() => navigate("/create")}
          className="flex min-h-11 shrink-0 items-center gap-1 rounded-[8px] bg-primary px-3 py-2 text-label-md font-bold text-on-primary hover:bg-navy-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:px-4"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[18px]">add</span>
          Tạo mới
        </button>
      </PageHeader>

      <main className="content-shell !max-w-none min-w-0 flex-1 space-y-6 px-container-margin pb-28 pt-24 lg:px-8 lg:pb-12">
        {isDemo ? (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <h2 className="text-title-lg font-bold text-on-surface">Đăng nhập để xem lịch trình</h2>
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
              aria-hidden="true"
              className="material-symbols-outlined text-primary"
              style={{ fontSize: 48 }}
            >
              luggage
            </span>
            <h2 className="text-title-lg font-bold text-on-surface text-center">Chưa có lịch trình đã lưu</h2>
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
            <p className="border-b border-border-soft pb-4 text-body-md font-semibold text-on-surface-variant">
              {savedTrips.length} lịch trình
            </p>

            <ul className="grid min-w-0 gap-4 xl:grid-cols-2" aria-label="Lịch trình đã lưu">
              {savedTrips.map((trip) => {
                const statusCfg = STATUS_CONFIG[trip.status] ?? UNKNOWN_STATUS;

                return (
                  <li
                    key={trip.id}
                    className="relative isolate flex min-w-0 flex-col rounded-[8px] border border-border-soft bg-white p-5 transition-colors hover:border-primary/40 motion-reduce:transition-none sm:p-6"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h2 className="break-words [overflow-wrap:anywhere] text-title-md font-bold leading-7 text-on-surface">
                          <Link to={`/trips/${trip.id}`} className="after:absolute after:inset-0 after:z-10 after:cursor-pointer after:rounded-[8px] hover:text-primary focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-primary">{trip.title}</Link>
                        </h2>
                        <p className="break-words text-label-md text-on-surface-variant mt-2">
                          {trip.mainArea}
                        </p>
                      </div>

                      <span
                        className={`rounded-[6px] px-3 py-1 text-label-md font-bold ${statusCfg.color}`}
                      >
                        {statusCfg.label}
                      </span>
                    </div>

                    <div className="my-5 flex flex-wrap items-center gap-x-4 gap-y-3">
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
                        ~{formatCurrencyShort(trip.estimatedBudget)}/người
                      </span>

                      <span className="flex items-center gap-1 text-label-md text-on-surface-variant">
                        <span className="material-symbols-outlined text-[14px]">
                          place
                        </span>
                        {trip.itemCount ?? trip.items.length} địa điểm
                      </span>

                    </div>

                    <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-border-soft pt-4">
                      <span className="text-label-md text-on-surface-variant">
                        {formatRelativeTime(trip.createdAt)}
                      </span>

                      <div
                        className="flex gap-2"
                      >
                        <button
                          type="button"
                          aria-label={`Xóa lịch trình ${trip.title}`}
                          onClick={() => {
                            setDeleteError("");
                            setTripToDelete(trip);
                          }}
                          className="relative z-20 flex min-h-11 items-center gap-2 rounded-[8px] border border-error/25 px-3 py-2 text-label-md font-semibold text-error hover:bg-error-container/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error"
                        >
                          <span aria-hidden="true" className="material-symbols-outlined text-[18px]">delete</span>
                          Xóa
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
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
          <div className="max-h-[calc(100dvh-32px)] w-full max-w-md overflow-y-auto space-y-stack-md rounded-lg border border-border-soft bg-white p-6 shadow-xl [&_button]:min-h-11 [&_button]:focus-visible:outline [&_button]:focus-visible:outline-2 [&_button]:focus-visible:outline-offset-2 [&_button]:focus-visible:outline-primary">
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
