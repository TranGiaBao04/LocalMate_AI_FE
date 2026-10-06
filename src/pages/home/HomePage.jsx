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
            onClick={() => navigate("/profile")}
            className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full bg-navy text-sm font-bold text-white active:scale-95"
          >
            {initial}
          </button>
        </div>
      </PageHeader>

      <main className="content-shell flex flex-1 flex-col gap-6 px-container-margin pb-28 pt-20 lg:gap-7 lg:px-8 lg:pb-12">
        <div className="sm:hidden">
          <HomeSearch />
        </div>

        {/* Guest Tour banner / quick guide */}
        {showGuestTour && <GuestTourCard onDismiss={handleDismissTour} />}

        {/* Hero — AI trip planner */}
        <section className="relative flex flex-col gap-4 overflow-hidden rounded-3xl border border-slate-700/50 bg-navy-darkest p-6 shadow-2xl sm:p-8">
          <div className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-blue-500/20 blur-3xl" />

          <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide text-amber-300 backdrop-blur-md">
              ★ AI Metro Trip Planner
            </div>
          </div>

          <div className="relative z-10">
            <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Xin chào, {firstName} <span className="text-2xl">👋</span>
            </h2>
            <p className="mt-1 max-w-[520px] text-sm text-slate-300 sm:text-base">
              Hôm nay bạn muốn khám phá đâu quanh tuyến Metro Bến Thành – Suối
              Tiên?
            </p>
          </div>

          <div className="relative z-10 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            {HERO_FIELDS.map((field) => (
              <div
                key={field.label}
                className="rounded-2xl border border-white/15 bg-white/10 p-3.5 transition-all hover:bg-white/15"
              >
                <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-blue-200">
                  <span className="material-symbols-outlined text-[16px] text-blue-300">
                    {field.icon}
                  </span>
                  {field.label}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-white">
                    {field.value}
                  </span>
                  <span className="material-symbols-outlined flex-none text-[16px] text-slate-400">
                    expand_more
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="relative z-10 flex flex-col gap-4 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-xs text-emerald-300">
              <span className="h-2 w-2 flex-none rounded-full bg-emerald-400" />
              Tối ưu hoá khoảng cách đi bộ &lt;500m từ ga Metro
            </div>
            <div className="flex items-center gap-3.5">
              <a
                href="#sample-itineraries"
                className="text-[13px] font-semibold text-slate-300 underline-offset-4 hover:text-white hover:underline"
              >
                Lịch trình mẫu
              </a>
              <button
                onClick={() => navigate("/create")}
                className="group flex items-center gap-[7px] whitespace-nowrap rounded-xl bg-white px-5 py-3 text-[13.5px] font-bold text-navy-darkest shadow-lg transition-all hover:bg-slate-100 hover:shadow-xl active:scale-95"
              >
                Thiết kế lịch trình với AI
                <span className="material-symbols-outlined text-sm transition-transform group-hover:translate-x-1">
                  arrow_forward
                </span>
              </button>
            </div>
          </div>
        </section>

        {/* Featured experiences */}
        <section id="sample-itineraries" className="flex scroll-mt-6 flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-extrabold text-[#111726]">
                  Trải nghiệm Metro-friendly nổi bật
                </h3>
                <span className="rounded-full bg-chip-bg-alt px-2.5 py-1 text-[11px] font-bold text-navy">
                  Tuyển chọn
                </span>
              </div>
              <p className="mt-1 text-[13px] text-text-muted">
                Chọn một lịch trình mẫu để tạo bản nháp bắt đầu từ bây giờ
              </p>
            </div>
            <button
              onClick={() => navigate("/create")}
              className="whitespace-nowrap text-[13px] font-bold"
            >
              Tự thiết kế lịch trình ›
            </button>
          </div>

          {curatedLoading ? (
            <p role="status" className="py-6 text-[13px] text-text-muted">Đang tải lịch trình mẫu...</p>
          ) : curatedError ? (
            <div role="alert" className="flex items-center gap-3 py-6 text-[13px] text-text-muted">
              <span>Không thể tải lịch trình mẫu.</span>
              <button type="button" onClick={retryCurated} className="font-bold text-navy underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy">Thử lại</button>
            </div>
          ) : curated.length === 0 ? (
            <p className="py-6 text-[13px] text-text-muted">Chưa có lịch trình mẫu.</p>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
            <h3 className="text-lg font-extrabold text-[#111726]">
              Gợi ý gần tuyến Metro số 1
            </h3>
            <p className="mt-1 text-[13px] text-text-muted">
              Địa điểm biểu tượng nằm trong bán kính đi bộ thuận tiện từ cửa
              thoát hiểm ga
            </p>
          </div>

          <div role="group" aria-label="Lọc theo ga Metro" className="hide-scrollbar flex gap-2 overflow-x-auto pb-0.5">
            {[{ stationId: null, stationName: "Tất cả ga" }, ...stations].map((station) => (
              <button
                key={station.stationId ?? "all"}
                type="button"
                aria-pressed={station.stationId === activeStationId}
                onClick={() => setActiveStationId(station.stationId)}
                className={`flex-none whitespace-nowrap rounded-full px-3.5 py-2 text-[12.5px] font-bold transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy motion-reduce:transition-none ${
                  station.stationId === activeStationId
                    ? "bg-navy-dark text-white"
                    : "bg-chip-bg text-[#3A4256]"
                }`}
              >
                {station.stationId === null ? station.stationName : `Ga ${String(station.stationOrder).padStart(2, "0")} ${station.stationName}`}
              </button>
            ))}
          </div>

          {clustersLoading ? (
            <p role="status" className="py-6 text-[13px] text-text-muted">Đang tải địa điểm gần ga...</p>
          ) : clustersError ? (
            <div role="alert" className="flex items-center gap-3 py-6 text-[13px] text-text-muted">
              <span>Không thể tải địa điểm gần ga.</span>
              <button type="button" onClick={retryClusters} className="font-bold text-navy underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy">Thử lại</button>
            </div>
          ) : nearby.length === 0 ? (
            <p className="py-6 text-[13px] text-text-muted">Chưa có địa điểm ở cụm ga này.</p>
          ) : (
            <div key={activeStationId ?? "all"} className="home-station-panel grid grid-cols-2 gap-4 lg:grid-cols-4">
              {nearby.map((place) => (
                <button
                  key={place.id}
                  type="button"
                  onClick={() => navigate(`/place/${place.id}`)}
                  className="flex min-w-0 flex-col gap-2.5 text-left transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
                >
                  <div className="relative h-[150px] w-full overflow-hidden rounded-xl bg-surface-variant">
                    {place.imageUrl ? (
                      <img src={place.imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span aria-hidden="true" className="material-symbols-outlined flex h-full items-center justify-center text-4xl text-navy/30">location_on</span>
                    )}
                    <span className="absolute left-2 top-2 rounded-full bg-navy-dark px-2 py-[3px] text-[10.5px] font-bold text-white">
                      Ga {place.stationName}
                    </span>
                  </div>
                  <span className="w-full truncate text-[13.5px] font-bold text-[#111726]">{place.name}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      </main>

      <button
        onClick={() => navigate("/create")}
        className="fixed bottom-24 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-navy text-white shadow-2xl transition-transform duration-300 active:scale-90 lg:hidden"
      >
        <span className="material-symbols-outlined text-[28px]">add</span>
      </button>
    </MobileLayout>
  );
}
