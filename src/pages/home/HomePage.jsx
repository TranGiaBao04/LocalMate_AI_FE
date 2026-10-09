import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import MobileLayout from "../../components/layout/MobileLayout";
import PageHeader from "../../components/layout/PageHeader";
import GuestTourCard from "../../components/home/GuestTourCard";
import HomeSearch from "../../components/home/HomeSearch";
import NotificationBell from "../../components/notifications/NotificationBell";
import CuratedItineraryCard from "../../components/trip/CuratedItineraryCard";
import { useCuratedItineraries } from "../../hooks/useCuratedItineraries";
import { placeService } from "../../services/placeService";
import { STORAGE_KEYS } from "../../constants";

const HERO_FIELDS = [
  {
    label: "1. ĐIỂM XUẤT PHÁT (GA METRO)",
    icon: "flag",
    value: "Ga Bến Thành (Trung tâm Quận 1)",
  },
  {
    label: "2. THỜI LƯỢNG CHUYẾN ĐI",
    icon: "schedule",
    value: "Nửa ngày (4 – 5 tiếng)",
  },
  {
    label: "3. TRẢI NGHIỆM MONG MUỐN",
    icon: "favorite",
    value: "Cà phê view đẹp & Chill",
  },
];

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeStationId, setActiveStationId] = useState(null);
  const [clusters, setClusters] = useState([]);
  const [clustersLoading, setClustersLoading] = useState(true);
  const [clustersError, setClustersError] = useState(false);
  const [clustersRetryKey, setClustersRetryKey] = useState(0);
  const {
    curated,
    loading: curatedLoading,
    error: curatedError,
    retry: retryCurated,
    applyingId,
    applyError,
    apply: handleApplyCurated,
  } = useCuratedItineraries();

  const [showGuestTour, setShowGuestTour] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.GUEST_TOUR_DISMISSED) !== "true";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    let active = true;
    placeService
      .getMetroClusters()
      .then((data) => {
        if (active) setClusters(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (active) setClustersError(true);
      })
      .finally(() => {
        if (active) setClustersLoading(false);
      });
    return () => { active = false; };
  }, [clustersRetryKey]);

  const handleDismissTour = () => {
    setShowGuestTour(false);
    try {
      localStorage.setItem(STORAGE_KEYS.GUEST_TOUR_DISMISSED, "true");
    } catch {
      // ignore
    }
  };

  const firstName = user?.fullName?.split(" ").pop() || "bạn";
  const initial = (user?.fullName || "K").charAt(0).toUpperCase();
  const stations = clusters.filter((cluster) => cluster.places.length > 0);
  const activeCluster = stations.find((cluster) => cluster.stationId === activeStationId);
  const nearby = activeCluster
    ? activeCluster.places.slice(0, 4).map((place) => ({ ...place, stationName: activeCluster.stationName }))
    : stations.slice(0, 4).map((cluster) => ({ ...cluster.places[0], stationName: cluster.stationName }));

  const retryClusters = () => {
    setClustersLoading(true);
    setClustersError(false);
    setClustersRetryKey((key) => key + 1);
  };

  return (
    <MobileLayout>
      <PageHeader title="Trang chủ">
        {/* Từ sm trở lên ô tìm nằm trong thanh tiêu đề; mobile xuống hàng riêng bên dưới */}
        <div className="hidden min-w-0 flex-1 justify-center sm:flex">
          <HomeSearch />
        </div>
        <div className="flex flex-none items-center gap-2.5">
          <NotificationBell />
          <button
            type="button"
            aria-label="Xem hồ sơ"
            onClick={() => navigate("/profile")}
            className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-navy text-sm font-bold text-white hover:bg-navy-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
          >
            {initial}
          </button>
        </div>
      </PageHeader>

      <main className="content-shell flex min-w-0 max-w-none flex-1 flex-col gap-8 px-container-margin pb-28 pt-20 lg:px-8 lg:pb-12 2xl:max-w-[1680px]">
        <div className="sm:hidden">
          <HomeSearch />
        </div>

        {/* Guest Tour banner / quick guide */}
        {showGuestTour && <GuestTourCard onDismiss={handleDismissTour} />}

        {/* Hero — AI trip planner */}
        <section aria-labelledby="home-planner-title" className="flex min-w-0 flex-col gap-6 border-b border-border-soft pb-8">
          <div>
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-navy">
              <span aria-hidden="true" className="material-symbols-outlined text-xl text-accent-dark">auto_awesome</span>
              AI Metro Trip Planner
            </p>
            <h2 id="home-planner-title" className="break-words text-2xl font-bold leading-8 text-navy-dark sm:text-3xl sm:leading-10">
              Xin chào, {firstName}
            </h2>
            <p className="mt-3 max-w-[620px] text-sm leading-6 text-text-muted sm:text-base">
              Hôm nay bạn muốn khám phá đâu quanh tuyến Metro Bến Thành – Suối
              Tiên?
            </p>
          </div>

          <div>
            <p className="mb-3 text-xs font-semibold text-text-muted">Ví dụ hành trình</p>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5">
            {HERO_FIELDS.map((field) => (
              <div
                key={field.label}
                className="min-w-0 border-l-2 border-primary-container pl-3"
              >
                <dt className="mb-2 flex items-start gap-2 text-xs font-medium leading-5 text-text-muted">
                  <span aria-hidden="true" className="material-symbols-outlined flex-none text-lg text-navy">
                    {field.icon}
                  </span>
                  {field.label}
                </dt>
                <dd className="break-words text-sm font-semibold leading-6 text-navy-dark">{field.value}</dd>
              </div>
            ))}
            </dl>
          </div>

          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-2 text-xs leading-5 text-text-muted">
              <span aria-hidden="true" className="material-symbols-outlined flex-none text-lg text-navy">directions_walk</span>
              Tối ưu hoá khoảng cách đi bộ &lt;500m từ ga Metro
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <a
                href="#sample-itineraries"
                className="inline-flex min-h-11 items-center rounded-[8px] px-2 text-sm font-semibold text-navy underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
              >
                Lịch trình mẫu
              </a>
              <button
                type="button"
                onClick={() => navigate("/create")}
                className="flex min-h-11 items-center justify-center gap-2 rounded-[8px] bg-navy px-4 py-3 text-sm font-semibold text-white hover:bg-navy-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
              >
                Thiết kế lịch trình với AI
                <span aria-hidden="true" className="material-symbols-outlined flex-none text-lg">
                  arrow_forward
                </span>
              </button>
            </div>
          </div>
        </section>

        {/* Featured experiences */}
        <section id="sample-itineraries" className="flex scroll-mt-20 flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-bold leading-7 text-navy-dark">
                  Trải nghiệm Metro-friendly nổi bật
                </h3>
                <span className="rounded-full bg-chip-bg-alt px-2.5 py-1 text-xs font-medium text-navy">
                  Tuyển chọn
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-text-muted">
                Chọn một lịch trình mẫu để tạo bản nháp bắt đầu từ bây giờ
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/create")}
              className="min-h-11 rounded-[8px] px-2 text-left text-sm font-semibold text-navy hover:bg-chip-bg-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
            >
              Tự thiết kế lịch trình ›
            </button>
          </div>

          {curatedLoading ? (
            <p role="status" className="border-y border-border-soft py-8 text-sm text-text-muted">Đang tải lịch trình mẫu...</p>
          ) : curatedError ? (
            <div role="alert" className="flex flex-wrap items-center gap-3 border-y border-border-soft py-6 text-sm text-text-muted">
              <span>Không thể tải lịch trình mẫu.</span>
              <button type="button" onClick={retryCurated} className="min-h-11 rounded-[8px] px-3 font-semibold text-navy underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy">Thử lại</button>
            </div>
          ) : curated.length === 0 ? (
            <p className="border-y border-border-soft py-8 text-sm text-text-muted">Chưa có lịch trình mẫu.</p>
          ) : (
            <div className="grid grid-cols-1 items-stretch gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {curated.map((itinerary) => (
                <CuratedItineraryCard
                  key={itinerary.id}
                  itinerary={itinerary}
                  applyingId={applyingId}
                  applyError={applyError}
                  onApply={handleApplyCurated}
                />
              ))}
            </div>
          )}
        </section>

        {/* Near Metro Line 1 */}
        <section className="flex flex-col gap-4">
          <div>
            <h3 className="text-lg font-bold leading-7 text-navy-dark">
              Gợi ý gần tuyến Metro số 1
            </h3>
            <p className="mt-2 text-sm leading-6 text-text-muted">
              Địa điểm biểu tượng nằm trong bán kính đi bộ thuận tiện từ cửa
              thoát hiểm ga
            </p>
          </div>

          <div role="group" aria-label="Lọc theo ga Metro" className="flex min-w-0 gap-2 overflow-x-auto px-1 pb-3 pt-1">
            {[{ stationId: null, stationName: "Tất cả ga" }, ...stations].map((station) => (
              <button
                key={station.stationId ?? "all"}
                type="button"
                aria-pressed={station.stationId === activeStationId}
                onClick={() => setActiveStationId(station.stationId)}
                className={`min-h-11 flex-none whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy motion-reduce:transition-none ${
                  station.stationId === activeStationId
                    ? "border-navy bg-navy text-white"
                    : "border-border-soft bg-white text-text-muted hover:bg-chip-bg-alt"
                }`}
              >
                {station.stationId === null ? station.stationName : `Ga ${String(station.stationOrder).padStart(2, "0")} ${station.stationName}`}
              </button>
            ))}
          </div>

          {clustersLoading ? (
            <p role="status" className="border-y border-border-soft py-8 text-sm text-text-muted">Đang tải địa điểm gần ga...</p>
          ) : clustersError ? (
            <div role="alert" className="flex flex-wrap items-center gap-3 border-y border-border-soft py-6 text-sm text-text-muted">
              <span>Không thể tải địa điểm gần ga.</span>
              <button type="button" onClick={retryClusters} className="min-h-11 rounded-[8px] px-3 font-semibold text-navy underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy">Thử lại</button>
            </div>
          ) : nearby.length === 0 ? (
            <p className="border-y border-border-soft py-8 text-sm text-text-muted">Chưa có địa điểm ở cụm ga này.</p>
          ) : (
            <div key={activeStationId ?? "all"} className="home-station-panel grid grid-cols-2 items-start gap-4 xl:grid-cols-4">
              {nearby.map((place) => (
                <button
                  key={place.id}
                  type="button"
                  onClick={() => navigate(`/place/${place.id}`)}
                  className="group flex min-w-0 flex-col gap-2.5 rounded-[8px] text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
                >
                  <div className="aspect-[4/3] w-full overflow-hidden rounded-[8px] bg-surface-variant">
                    {place.imageUrl ? (
                      <img src={place.imageUrl} alt="" className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105 motion-reduce:transform-none motion-reduce:transition-none" />
                    ) : (
                      <span aria-hidden="true" className="material-symbols-outlined flex h-full items-center justify-center text-4xl text-navy/30">location_on</span>
                    )}
                  </div>
                  <span title={place.name} className="line-clamp-2 w-full break-words text-sm font-semibold leading-6 text-navy-dark">{place.name}</span>
                  <span className="w-full break-words text-xs leading-5 text-text-muted">Ga {place.stationName}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      </main>

      <button
        type="button"
        aria-label="Tạo lịch trình"
        onClick={() => navigate("/create")}
        className="fixed bottom-24 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-navy text-white shadow-lg hover:bg-navy-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy lg:hidden"
      >
        <span aria-hidden="true" className="material-symbols-outlined text-[28px]">add</span>
      </button>
    </MobileLayout>
  );
}
