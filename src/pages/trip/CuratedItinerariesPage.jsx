import { useNavigate } from "react-router-dom";
import MobileLayout from "../../components/layout/MobileLayout";
import PageHeader from "../../components/layout/PageHeader";
import CuratedItineraryCard from "../../components/trip/CuratedItineraryCard";
import { useCuratedItineraries } from "../../hooks/useCuratedItineraries";

export default function CuratedItinerariesPage() {
  const navigate = useNavigate();
  const { curated, loading, error, retry, applyingId, applyError, apply } =
    useCuratedItineraries();

  return (
    <MobileLayout>
      <PageHeader title="Khám phá" />

      <main className="content-shell min-w-0 max-w-none flex-1 space-y-8 px-container-margin pb-28 pt-20 lg:px-8 lg:pb-12 2xl:max-w-[1680px]">
        <section className="space-y-5">
          <div>
            <h2 className="text-2xl font-bold leading-8 text-navy-dark">Lịch trình mẫu</h2>
            <p className="mt-3 max-w-[660px] text-sm leading-6 text-text-muted">
              Chọn một lịch trình để tạo bản nháp bắt đầu từ bây giờ. Bạn vẫn
              xem và thay từng địa điểm trước khi chốt.
            </p>
          </div>

          {loading ? (
            <p
              role="status"
              className="border-y border-border-soft py-10 text-sm text-text-muted"
            >
              Đang tải lịch trình mẫu...
            </p>
          ) : error ? (
            <div
              role="alert"
              className="flex flex-wrap items-center gap-4 border-y border-border-soft py-8"
            >
              <p className="text-sm text-text-muted">
                Không thể tải lịch trình mẫu.
              </p>
              <button
                type="button"
                onClick={retry}
                className="min-h-11 rounded-[8px] border border-border-soft bg-white px-4 py-3 text-sm font-semibold text-navy hover:bg-chip-bg-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
              >
                Thử lại
              </button>
            </div>
          ) : curated.length === 0 ? (
            <p className="border-y border-border-soft py-10 text-sm text-text-muted">
              Chưa có lịch trình mẫu.
            </p>
          ) : (
            <div className="grid grid-cols-1 items-stretch gap-5 sm:grid-cols-2 xl:grid-cols-3">
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

        <section className="flex flex-col gap-5 border-t border-border-soft py-6 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-lg font-bold leading-7 text-navy-dark">
              Tạo lịch trình theo phong cách cá nhân
            </h2>
            <p className="mt-2 max-w-[640px] text-sm leading-6 text-text-muted">
              Tự tạo lịch trình theo vị trí, thời gian, ngân sách và sở thích
              của bạn.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/create")}
            className="flex min-h-11 w-fit max-w-full flex-none items-center justify-center gap-2 rounded-[8px] bg-navy px-5 py-3 text-sm font-semibold text-white hover:bg-navy-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
          >
            <span aria-hidden="true" className="material-symbols-outlined flex-none text-xl">auto_awesome</span>
            Tự tạo lịch trình
          </button>
        </section>
      </main>
    </MobileLayout>
  );
}
