import { useNavigate } from "react-router-dom";
import MobileLayout from "../../components/layout/MobileLayout";
import CuratedItineraryCard from "../../components/trip/CuratedItineraryCard";
import { useCuratedItineraries } from "../../hooks/useCuratedItineraries";

export default function CuratedItinerariesPage() {
  const navigate = useNavigate();
  const { curated, loading, error, retry, applyingId, applyError, apply } =
    useCuratedItineraries();

  return (
    <MobileLayout>
      <header className="app-header flex h-16 items-center justify-between border-b border-outline-variant/20 px-container-margin py-stack-sm lg:px-8">
        <h1 className="text-headline-lg-mobile font-extrabold text-primary">
          Khám phá
        </h1>
      </header>

      <main className="content-shell flex-1 space-y-stack-lg px-container-margin pb-28 pt-20 lg:px-8 lg:pb-12">
        <section className="space-y-stack-md">
          <div>
            <h2 className="text-title-md text-on-surface">Lịch trình mẫu</h2>
            <p className="text-body-md text-on-surface-variant">
              Chọn một lịch trình để tạo bản nháp bắt đầu từ bây giờ. Bạn vẫn
              xem và thay từng địa điểm trước khi chốt.
            </p>
          </div>

          {loading ? (
            <p
              role="status"
              className="py-10 text-center text-body-lg text-on-surface-variant"
            >
              Đang tải lịch trình mẫu...
            </p>
          ) : error ? (
            <div
              role="alert"
              className="flex flex-col items-center gap-4 py-10 text-center"
            >
              <p className="text-body-lg text-on-surface-variant">
                Không thể tải lịch trình mẫu.
              </p>
              <button
                type="button"
                onClick={retry}
                className="btn-primary w-auto px-8"
              >
                Thử lại
              </button>
            </div>
          ) : curated.length === 0 ? (
            <p className="py-10 text-center text-body-lg text-on-surface-variant">
              Chưa có lịch trình mẫu.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {curated.map((itinerary) => (
                <CuratedItineraryCard
                  key={itinerary.id}
                  itinerary={itinerary}
                  applyingId={applyingId}
                  applyError={applyError}
                  onApply={apply}
                />
              ))}
            </div>
          )}
        </section>

        <section className="card flex flex-col gap-stack-md sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-title-md text-on-surface">
              Tạo lịch trình theo phong cách cá nhân
            </h2>
            <p className="text-body-md text-on-surface-variant">
              Tự tạo lịch trình theo vị trí, thời gian, ngân sách và sở thích
              của bạn.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/create")}
            className="btn-primary w-auto flex-none px-8"
          >
            <span className="material-symbols-outlined">auto_awesome</span>
            Tự tạo lịch trình
          </button>
        </section>
      </main>
    </MobileLayout>
  );
}
