import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useEffect, useState } from "react";
import logo from "../../assets/logo.jpg";
import { masterDataService } from "../../services/masterDataService";
import { placeService } from "../../services/placeService";
import { itineraryService } from "../../services/itineraryService";
import { subscriptionService } from "../../services/subscriptionService";
import { FALLBACK_PLANS, formatPlanPrice } from "../../utils/subscriptionUtils";
import {
  formatCurrencyShort,
  formatDistance,
  formatDuration,
} from "../../utils/formatCurrency";

const STEPS = [
  {
    icon: "near_me",
    iconBg: "bg-blue-50 text-blue-600",
    title: "1. Điểm xuất phát gần nhất",
    desc: "Chọn ga metro gần bạn nhất hoặc khu vực bạn dự định khởi hành để AI tối ưu hóa lộ trình tàu và thời gian chuyển tuyến.",
  },
  {
    icon: "tune",
    iconBg: "bg-indigo-50 text-indigo-600",
    title: "2. Gu & Ngân sách chi tiêu",
    desc: "Tùy biến theo thời gian rảnh của bạn, chi phí mong muốn và sở thích: cà phê sống ảo, đặc sản địa phương hay văn hóa lịch sử.",
  },
  {
    icon: "auto_awesome",
    iconBg: "bg-amber-50 text-amber-600",
    title: "3. Nhận lịch trình AI",
    desc: "Nhận lịch trình theo giờ kèm thời gian di chuyển giữa các điểm, xem trước từng địa điểm, thay thế nếu chưa ưng rồi mới chốt.",
  },
];

// Số ga hiển thị ở phần giới thiệu cụm ga
const SHOWCASE_STATION_COUNT = 3;
const FOOTER_STATION_COUNT = 5;
const SHOWCASE_GRADIENTS = [
  "from-amber-900/60 to-slate-900",
  "from-sky-900/60 to-slate-900",
  "from-emerald-900/60 to-slate-900",
];

export default function WelcomePage() {
  const navigate = useNavigate();
  const { isLoggedIn, loginDemo } = useAuth();
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [error, setError] = useState("");
  const [plans, setPlans] = useState(FALLBACK_PLANS);

  const [startStation, setStartStation] = useState("");
  const [stations, setStations] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [curated, setCurated] = useState([]);
  const [publicDataLoaded, setPublicDataLoaded] = useState(false);
  const [tripDuration, setTripDuration] = useState("halfday");
  const [userPreference, setUserPreference] = useState("cafe");

  // Backend /api/subscriptions/plans là nguồn chân lý (authoritative) cho giao dịch thực tế.
  // WelcomePage giữ FALLBACK_PLANS làm marketing copy tĩnh để trang đích không bị crash khi chưa có mạng.
  useEffect(() => {
    subscriptionService
      .getPlans()
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setPlans(data);
        }
      })
      .catch(() => {
        // Giữ lại FALLBACK_PLANS cho trang đích marketing (không thực hiện giao dịch ở đây)
      });
  }, []);

  useEffect(() => {
    if (isLoggedIn) navigate("/home");
  }, [isLoggedIn, navigate]);

  // Dữ liệu công khai (không cần đăng nhập). Phần nào lỗi thì ẩn phần đó.
  useEffect(() => {
    let active = true;
    Promise.allSettled([
      masterDataService.getMasterData(),
      placeService.getMetroClusters(),
      itineraryService.getCuratedItineraries(),
    ]).then(([masterData, clusterData, curatedData]) => {
      if (!active) return;
      if (masterData.status === "fulfilled") {
        setStations([...masterData.value.metroStations].sort((a, b) => a.order - b.order));
      }
      if (clusterData.status === "fulfilled" && Array.isArray(clusterData.value)) {
        setClusters(clusterData.value);
      }
      if (curatedData.status === "fulfilled" && Array.isArray(curatedData.value)) {
        setCurated(curatedData.value);
      }
      setPublicDataLoaded(true);
    });
    return () => {
      active = false;
    };
  }, []);

  // metro-clusters chỉ trả ga có địa điểm; ga không có trong đó tức là 0 địa điểm
  const placeCountByStation = new Map(
    clusters.map((c) => [c.stationId, c.placeCount ?? c.places.length]),
  );
  const stationsWithPlaces = stations.filter((st) => placeCountByStation.get(st.id) > 0);
  const totalPlaces = clusters.reduce((sum, c) => sum + (c.placeCount ?? c.places.length), 0);
  const showcaseClusters = [...clusters]
    .filter((c) => c.places.length > 0)
    .sort((a, b) => a.stationOrder - b.stationOrder)
    .slice(0, SHOWCASE_STATION_COUNT);
  const sampleItinerary = curated[0];
  const stat = (value) => (publicDataLoaded ? value : "–");

  const handleDemo = async () => {
    setError("");
    setLoadingDemo(true);
    try {
      await loginDemo();
      navigate("/home");
    } catch (err) {
      setError(
        err.message || "Không thể khởi tạo phiên demo. Vui lòng thử lại.",
      );
    } finally {
      setLoadingDemo(false);
    }
  };

  const freePlan = plans.find((p) => p.code === "Free") || FALLBACK_PLANS[0];
  const tripPassPlan = plans.find((p) => p.code === "TripPass") || FALLBACK_PLANS[1];
  const membershipPlan = plans.find((p) => p.code === "Membership") || FALLBACK_PLANS[2];

  return (
    <div className="min-h-screen w-full bg-background text-on-surface">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-outline-variant/30">
        <div className="max-w-7xl 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex shrink-0 items-center gap-3">
            <img
              src={logo}
              alt="LocalMate AI"
              className="w-11 h-11 rounded-2xl object-cover shadow-md"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-extrabold tracking-tight text-on-surface">
                  LocalMate
                </span>
                <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-navy-darkest text-white tracking-wider">
                  AI
                </span>
              </div>
              <p className="text-[11px] font-medium text-on-surface-variant tracking-tight">
                Metro-friendly planner
              </p>
            </div>
          </div>

          <nav className="hidden lg:flex items-center gap-3 whitespace-nowrap text-sm font-semibold text-on-surface-variant">
            <a
              className="hover:text-primary transition-colors"
              href="#tinh-nang"
            >
              Tính năng AI
            </a>
            <a
              className="hover:text-primary transition-colors"
              href="#14-ga-metro"
            >
              14 Ga Tuyến 1
            </a>
            <a
              className="hover:text-primary transition-colors"
              href="#lich-trinh-mau"
            >
              Lịch trình mẫu
            </a>
            <a
              className="hover:text-primary transition-colors"
              href="#bang-gia"
            >
              Gói dịch vụ
            </a>
          </nav>

          <div className="flex shrink-0 items-center gap-3 sm:gap-4">
            <button
              onClick={() => navigate("/login")}
              className="hidden sm:inline-flex text-sm font-semibold text-on-surface-variant hover:text-primary px-3 py-2 transition-colors"
            >
              Đăng nhập
            </button>
            <button
              onClick={() => navigate("/login")}
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-navy-darkest hover:bg-slate-900 text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all active:scale-95"
            >
              <span>Tạo lịch trình</span>
              <span className="material-symbols-outlined text-[18px] ml-1.5">
                arrow_forward
              </span>
            </button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative pt-10 pb-20 lg:pt-14 lg:pb-28 overflow-hidden bg-gradient-to-b from-blue-50/60 via-slate-50 to-white">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-200/40 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-1/2 -left-36 w-80 h-80 bg-indigo-100/50 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-7xl 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="flex justify-center mb-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-100/80 border border-blue-200 text-blue-900 text-xs sm:text-sm font-medium shadow-sm">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600" />
                </span>
                <span>
                  Khám phá Sài Gòn với trải nghiệm đường sắt đô thị hiện đại
                  nhất
                </span>
              </div>
            </div>

            <div className="text-center max-w-4xl mx-auto mb-10">
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-on-surface tracking-tight leading-[1.18]">
                Khám Phá Sài Gòn Thông Minh Dọc Tuyến Metro Số 1 Cùng{" "}
                <span className="bg-gradient-to-r from-blue-700 via-indigo-600 to-sky-600 bg-clip-text text-transparent">
                  LocalMate AI
                </span>
              </h1>
              <p className="mt-5 text-base sm:text-lg text-on-surface-variant max-w-2xl mx-auto leading-relaxed">
                Lên lịch trình khám phá ẩm thực, check-in cà phê và điểm du lịch
                quanh 14 ga Bến Thành – Suối Tiên chỉ trong 30 giây. Tự động hóa
                trải nghiệm theo phong cách{" "}
                <span className="text-on-surface font-semibold underline decoration-emerald-500 decoration-2">
                  cá nhân
                </span>{" "}
                .
              </p>
            </div>

            {/* Interactive planner card */}
            <div
              className="max-w-5xl mx-auto bg-navy-darkest rounded-3xl p-6 sm:p-8 lg:p-10 shadow-2xl text-white relative overflow-hidden border border-slate-700/50"
              id="demo-planner"
            >
              <div className="absolute -right-24 -bottom-24 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />

              <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-amber-300 text-xs font-semibold tracking-wide border border-white/10">
                  <span>★ AI Metro Trip Planner</span>
                </div>
              </div>

              <div className="mb-7">
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2">
                  Xin chào, bạn thân mến <span className="text-2xl">👋</span>
                </h2>
                <p className="text-slate-300 text-sm sm:text-base mt-1">
                  Hôm nay bạn muốn khám phá đâu quanh tuyến Metro Bến Thành –
                  Suối Tiên?
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mb-6">
                <div className="bg-white/10 hover:bg-white/15 focus-within:bg-white/15 transition-all p-3.5 rounded-2xl border border-white/15">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-blue-200 mb-1.5 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-blue-300">
                      train
                    </span>
                    1. Điểm xuất phát (Ga Metro)
                  </label>
                  <div className="relative">
                    <select
                      value={startStation || stations[0]?.id || ""}
                      onChange={(e) => setStartStation(e.target.value)}
                      className="w-full bg-transparent text-white font-medium text-sm border-none p-0 pr-6 focus:ring-0 cursor-pointer appearance-none"
                    >
                      {stations.map((st) => (
                        <option key={st.id} className="text-slate-900" value={st.id}>
                          Ga {st.name}
                        </option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined text-[16px] absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      expand_more
                    </span>
                  </div>
                </div>

                <div className="bg-white/10 hover:bg-white/15 focus-within:bg-white/15 transition-all p-3.5 rounded-2xl border border-white/15">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-blue-200 mb-1.5 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-blue-300">
                      schedule
                    </span>
                    2. Thời lượng khám phá
                  </label>
                  <div className="relative">
                    <select
                      value={tripDuration}
                      onChange={(e) => setTripDuration(e.target.value)}
                      className="w-full bg-transparent text-white font-medium text-sm border-none p-0 pr-6 focus:ring-0 cursor-pointer appearance-none"
                    >
                      <option className="text-slate-900" value="halfday">
                        Nửa ngày (4 – 5 tiếng)
                      </option>
                      <option className="text-slate-900" value="short">
                        Cà phê nhanh (2 – 3 tiếng)
                      </option>
                      <option className="text-slate-900" value="fullday">
                        Trọn ngày vi vu (8 tiếng)
                      </option>
                      <option className="text-slate-900" value="night">
                        Tour Hoàng hôn &amp; Đêm Sài Gòn
                      </option>
                    </select>
                    <span className="material-symbols-outlined text-[16px] absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      expand_more
                    </span>
                  </div>
                </div>

                <div className="bg-white/10 hover:bg-white/15 focus-within:bg-white/15 transition-all p-3.5 rounded-2xl border border-white/15">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-blue-200 mb-1.5 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-blue-300">
                      favorite
                    </span>
                    3. Gu &amp; Trải nghiệm
                  </label>
                  <div className="relative">
                    <select
                      value={userPreference}
                      onChange={(e) => setUserPreference(e.target.value)}
                      className="w-full bg-transparent text-white font-medium text-sm border-none p-0 pr-6 focus:ring-0 cursor-pointer appearance-none"
                    >
                      <option className="text-slate-900" value="cafe">
                        Cà phê view đẹp &amp; Chill thư giãn
                      </option>
                      <option className="text-slate-900" value="food">
                        Thiên đường ẩm thực đường phố
                      </option>
                      <option className="text-slate-900" value="culture">
                        Văn hóa, Bảo tàng &amp; Kiến trúc
                      </option>
                      <option className="text-slate-900" value="photo">
                        Chụp ảnh sống ảo nghệ thuật
                      </option>
                    </select>
                    <span className="material-symbols-outlined text-[16px] absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      expand_more
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between pt-3 border-t border-white/10 gap-4">
                <div className="flex items-center gap-2 text-xs text-emerald-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>
                    Tự động tính toán khoảng cách{" "}
                    <strong>giữa các địa điểm</strong>
                  </span>
                </div>
                <div className="flex items-center gap-4 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={handleDemo}
                    disabled={loadingDemo}
                    className="text-xs font-semibold text-slate-300 hover:text-white underline underline-offset-4 disabled:opacity-60"
                  >
                    {loadingDemo
                      ? "Đang chuẩn bị..."
                      : "Trải nghiệm nhanh phiên Demo"}
                  </button>
                  <button
                    onClick={() => navigate("/login")}
                    className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 rounded-xl bg-white hover:bg-slate-100 text-navy-darkest font-bold text-sm shadow-lg hover:shadow-xl transition-all active:scale-95 group"
                  >
                    <span>Thiết kế lịch trình với AI</span>
                    <span className="material-symbols-outlined text-[18px] ml-2 group-hover:translate-x-1 transition-transform">
                      arrow_forward
                    </span>
                  </button>
                </div>
              </div>
              {error && (
                <p className="mt-3 text-center text-xs text-error bg-white/10 rounded-lg py-2">
                  {error}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto mt-12 pt-8 border-t border-outline-variant/40 text-center">
              {[
                { value: stat(stations.length), label: "Ga Metro Tuyến 1", color: "text-on-surface" },
                {
                  value: stat(`${stationsWithPlaces.length} / ${stations.length}`),
                  label: "Ga đã có địa điểm gợi ý",
                  color: "text-primary",
                },
                { value: stat(totalPlaces), label: "Địa điểm quanh ga", color: "text-emerald-600" },
                { value: stat(curated.length), label: "Lịch trình mẫu", color: "text-amber-500" },
              ].map((item) => (
                <div key={item.label} className="p-3">
                  <div className={`text-2xl sm:text-3xl font-black ${item.color}`}>
                    {item.value}
                  </div>
                  <div className="text-xs text-on-surface-variant font-medium mt-1">
                    {item.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 3-step guide */}
        <section
          className="py-16 bg-white border-y border-outline-variant/40"
          id="tinh-nang"
        >
          <div className="max-w-7xl 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-gradient-to-r from-blue-50/70 to-slate-50 rounded-3xl p-6 sm:p-10 border border-blue-100/80 shadow-[0_10px_30px_-10px_rgba(15,32,66,0.08)]">
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-bold uppercase tracking-wider">
                  <span className="material-symbols-outlined text-[14px] text-blue-600">
                    bolt
                  </span>
                  Dành cho bạn mới đi Metro lần đầu
                </span>
              </div>
              <div className="max-w-3xl mb-8">
                <h2 className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">
                  Khám phá TP.HCM cùng LocalMate AI chỉ với 3 bước đơn giản
                </h2>
                <p className="text-on-surface-variant text-sm sm:text-base mt-2">
                  Không cần chuẩn bị trước lịch trình phức tạp, mọi thứ được
                  tính toán vừa vặn theo lộ trình từng ga tàu Metro số 1.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {STEPS.map((step) => (
                  <div
                    key={step.title}
                    className="bg-white p-6 rounded-2xl border border-outline-variant/40 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${step.iconBg}`}
                    >
                      <span className="material-symbols-outlined text-[24px]">
                        {step.icon}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-on-surface mb-2">
                      {step.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                      {step.desc}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-8 pt-5 border-t border-outline-variant/40 flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-xs sm:text-sm text-on-surface-variant flex items-center gap-2">
                  <span>💡</span> Lịch trình luôn ở dạng nháp để bạn xem và
                  thay thế từng địa điểm trước khi chốt.
                </p>
                <button
                  onClick={() => navigate("/login")}
                  className="px-5 py-2.5 rounded-xl bg-navy-darkest hover:bg-slate-900 text-white font-semibold text-xs sm:text-sm transition-colors"
                >
                  Bắt đầu tạo lịch trình →
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Metro stations showcase */}
        <section className="py-20 bg-slate-50" id="14-ga-metro">
          <div className="max-w-7xl 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
              <div>
                <div className="inline-flex items-center gap-2 text-primary text-xs font-bold uppercase tracking-wider mb-2">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  Bản đồ trạm dừng Metro Tuyến số 1
                </div>
                <h2 className="text-2xl sm:text-4xl font-extrabold text-on-surface tracking-tight">
                  Trải nghiệm Metro-friendly nổi bật
                </h2>
                <p className="text-on-surface-variant text-sm sm:text-base mt-1">
                  Các địa điểm đã được kiểm duyệt quanh từng nhà ga, kèm khoảng
                  cách tới ga.
                </p>
              </div>
            </div>

            {showcaseClusters.length === 0 ? (
              <p className="text-sm text-on-surface-variant">
                {publicDataLoaded ? "Chưa có dữ liệu địa điểm quanh ga." : "Đang tải địa điểm quanh ga..."}
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {showcaseClusters.map((cluster, index) => {
                  const cover = cluster.places.find((pl) => pl.imageUrl)?.imageUrl;
                  return (
                    <div
                      key={cluster.stationId}
                      className="bg-white rounded-2xl overflow-hidden border border-outline-variant/40 shadow-[0_10px_30px_-10px_rgba(15,32,66,0.08)] hover:shadow-[0_20px_35px_-8px_rgba(15,32,66,0.15)] transition-all group"
                    >
                      <div className="relative h-48 bg-slate-800 overflow-hidden">
                        {cover ? (
                          <img src={cover} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div
                            className={`w-full h-full bg-gradient-to-tr ${SHOWCASE_GRADIENTS[index % SHOWCASE_GRADIENTS.length]}`}
                          />
                        )}
                        <div className="absolute top-3 left-3 flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded-lg bg-navy-darkest/90 backdrop-blur-md text-white text-xs font-bold">
                            Ga {String(cluster.stationOrder).padStart(2, "0")} · {cluster.stationName}
                          </span>
                        </div>
                      </div>
                      <div className="p-5">
                        <h3 className="text-lg font-bold text-on-surface group-hover:text-primary transition-colors">
                          Quanh ga {cluster.stationName}
                        </h3>
                        <p className="text-xs text-on-surface-variant mt-1">
                          {cluster.placeCount ?? cluster.places.length} địa điểm gợi ý
                        </p>
                        <div className="mt-4 flex flex-wrap gap-1.5">
                          {cluster.places.slice(0, 3).map((place) => (
                            <span
                              key={place.id}
                              className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700"
                            >
                              {place.name} ({formatDistance(place.distanceFromStationMeters)})
                            </span>
                          ))}
                        </div>
                        <div className="mt-5 pt-3 border-t border-outline-variant/30 flex items-center justify-end text-xs font-medium">
                          <button
                            onClick={() => navigate("/login")}
                            className="text-primary font-bold hover:underline inline-flex items-center"
                          >
                            Lên lịch trình quanh ga →
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-12 p-6 bg-white rounded-2xl border border-outline-variant/40 shadow-sm overflow-x-auto">
              <div className="min-w-[900px]">
                <div className="flex items-start justify-between gap-1 text-[11px] font-semibold text-on-surface-variant mb-2">
                  {stations.map((st) => (
                    <span
                      key={st.id}
                      className={`flex-1 text-center ${placeCountByStation.get(st.id) > 0 ? "text-primary font-bold" : ""}`}
                    >
                      {String(st.order).padStart(2, "0")}
                      <br />
                      {st.name}
                    </span>
                  ))}
                </div>
                <div className="relative h-2.5 bg-slate-200 rounded-full flex items-center justify-around">
                  {stations.map((st) => (
                    <span
                      key={st.id}
                      className={`${placeCountByStation.get(st.id) > 0 ? "w-4 h-4 bg-primary" : "w-3 h-3 bg-slate-300"} rounded-full border-2 border-white relative z-10 shadow`}
                    />
                  ))}
                </div>
                <div className="flex justify-between items-center text-[11px] text-slate-400 mt-2 font-medium">
                  <span>Hầm ngầm (2.6km)</span>
                  <span>Đoạn trên cao chuyển tiếp</span>
                  <span>Tuyến trên cao ra cửa ngõ phía Đông (17.1km)</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Live itinerary simulation */}
        <section className="py-20 bg-white" id="lich-trinh-mau">
          <div className="max-w-7xl 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-14">
              <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold uppercase tracking-wider">
                Lịch trình mẫu
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-on-surface tracking-tight mt-3">
                Lịch trình mẫu do LocalMate AI tạo ra trông như thế nào?
              </h2>
              <p className="text-on-surface-variant mt-2 text-sm sm:text-base">
                Một lịch trình mẫu đang có trên LocalMate AI. Lịch trình của bạn
                sẽ được xếp theo giờ và thời gian di chuyển thực tế.
              </p>
            </div>

            {sampleItinerary ? (
              <div className="max-w-4xl mx-auto bg-slate-900 text-white rounded-3xl p-6 sm:p-10 shadow-2xl border border-slate-800 relative">
                <div className="flex flex-wrap items-center justify-between pb-6 border-b border-slate-800 gap-4">
                  <div>
                    {sampleItinerary.stationName && (
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                        <span className="text-xs uppercase tracking-wider text-slate-400 font-bold">
                          Quanh ga {sampleItinerary.stationName}
                        </span>
                      </div>
                    )}
                    <h3 className="text-xl sm:text-2xl font-bold mt-1">
                      {sampleItinerary.title}
                    </h3>
                    {sampleItinerary.description && (
                      <p className="text-xs text-slate-400 mt-1">{sampleItinerary.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 rounded-lg bg-blue-500/20 text-blue-300 text-xs font-semibold border border-blue-500/30">
                      Khoảng {formatDuration(sampleItinerary.estimatedDurationMinutes)}
                    </span>
                    <span className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-500/30">
                      ~{formatCurrencyShort(sampleItinerary.estimatedCostMin)} – {formatCurrencyShort(sampleItinerary.estimatedCostMax)}/người
                    </span>
                  </div>
                </div>

                <ol className="relative mt-8 pl-6 sm:pl-8 border-l-2 border-blue-500/40 space-y-6">
                  {[...sampleItinerary.items]
                    .sort((a, b) => a.orderIndex - b.orderIndex)
                    .map((item, index) => (
                      <li key={item.placeId} className="relative">
                        <span className="absolute -left-[31px] sm:-left-[39px] top-1 w-5 h-5 rounded-full border-4 border-slate-900 ring-2 bg-blue-500 ring-blue-500" />
                        <span className="text-xs font-mono font-bold text-blue-400">
                          Điểm {index + 1}
                        </span>
                        <h4 className="text-base font-bold text-white">{item.placeName}</h4>
                      </li>
                    ))}
                </ol>

                <div className="mt-8 pt-6 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
                  <div className="text-xs text-slate-400">
                    Muốn cá nhân hóa lịch trình theo gu riêng của bạn?
                  </div>
                  <button
                    onClick={() => navigate("/login")}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white transition-colors"
                  >
                    Tạo lịch trình của bạn ngay →
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-center text-sm text-on-surface-variant">
                {publicDataLoaded ? "Chưa có lịch trình mẫu." : "Đang tải lịch trình mẫu..."}
              </p>
            )}
          </div>
        </section>

        {/* Pricing */}
        <section
          className="py-20 bg-slate-50 border-t border-outline-variant/40"
          id="bang-gia"
        >
          <div className="max-w-7xl 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-bold uppercase tracking-wider">
                Gói dịch vụ minh bạch
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-on-surface tracking-tight mt-3">
                Bắt đầu miễn phí, nâng cấp khi cần trải nghiệm đỉnh cao
              </h2>
              <p className="text-on-surface-variant mt-2 text-sm sm:text-base">
                Phù hợp cho cả cư dân thành phố muốn đi chill cuối tuần và du
                khách lần đầu đặt chân tới TP.HCM.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto items-stretch">
              {/* Free plan */}
              <div className="bg-white rounded-3xl p-7 border border-outline-variant/40 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-xl font-bold text-on-surface">Free</h3>
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">
                      Miễn phí
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant mb-5">
                    Trải nghiệm lập kế hoạch chuyến đi thông minh quanh tuyến Metro số 1.
                  </p>
                  <div className="mb-5 pb-5 border-b border-outline-variant/30">
                    <span className="text-3xl sm:text-4xl font-black text-on-surface">
                      {formatPlanPrice(freePlan.price)}
                    </span>
                    <span className="text-xs text-on-surface-variant"> / Không thời hạn</span>
                  </div>
                  <ul className="space-y-3 text-xs sm:text-sm text-on-surface-variant">
                    <li className="flex items-center gap-2.5">
                      <span
                        className="material-symbols-outlined text-[18px] text-emerald-500 flex-shrink-0"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        check_circle
                      </span>
                      <span>1 lượt tạo lịch trình AI / tháng</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <span
                        className="material-symbols-outlined text-[18px] text-emerald-500 flex-shrink-0"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        check_circle
                      </span>
                      <span>Tối đa 1 lịch trình đã chốt</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <span
                        className="material-symbols-outlined text-[18px] text-emerald-500 flex-shrink-0"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        check_circle
                      </span>
                      <span>Bản đồ Metro & chỉ đường Google Maps</span>
                    </li>
                  </ul>
                </div>
                <div className="mt-8">
                  <button
                    onClick={() => navigate("/register")}
                    className="w-full block text-center py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs sm:text-sm transition-colors"
                  >
                    Đăng ký để sử dụng
                  </button>
                </div>
              </div>

              {/* Trip Pass */}
              <div className="bg-white rounded-3xl p-7 border border-outline-variant/60 shadow-sm hover:shadow-md flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-xl font-bold text-on-surface">Trip Pass</h3>
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">
                      7 ngày
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant mb-5">
                    Lựa chọn tối ưu cho tuần du lịch hoặc trải nghiệm dày đặc.
                  </p>
                  <div className="mb-5 pb-5 border-b border-outline-variant/30">
                    <span className="text-3xl sm:text-4xl font-black text-on-surface">
                      {formatPlanPrice(tripPassPlan.price)}
                    </span>
                    <span className="text-xs text-on-surface-variant"> / 7 ngày</span>
                  </div>
                  <ul className="space-y-3 text-xs sm:text-sm text-on-surface-variant">
                    <li className="flex items-center gap-2.5">
                      <span
                        className="material-symbols-outlined text-[18px] text-emerald-500 flex-shrink-0"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        check_circle
                      </span>
                      <span>Tạo lịch trình AI không giới hạn</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <span
                        className="material-symbols-outlined text-[18px] text-emerald-500 flex-shrink-0"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        check_circle
                      </span>
                      <span>Tối đa 3 lịch trình đã chốt</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <span
                        className="material-symbols-outlined text-[18px] text-emerald-500 flex-shrink-0"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        check_circle
                      </span>
                      <span>Bản đồ Metro & chỉ đường Google Maps</span>
                    </li>
                  </ul>
                </div>
                <div className="mt-8">
                  <button
                    onClick={() => navigate("/login")}
                    className="w-full block text-center py-3 rounded-xl bg-navy-dark hover:bg-navy-darkest text-white font-bold text-xs sm:text-sm transition-colors"
                  >
                    Đăng nhập để chọn gói
                  </button>
                </div>
              </div>

              {/* Membership */}
              <div className="bg-navy-darkest text-white rounded-3xl p-7 border-2 border-primary shadow-2xl relative flex flex-col justify-between overflow-hidden">
                <div className="absolute top-0 right-0 translate-x-6 -translate-y-6 w-32 h-32 bg-blue-500/20 rounded-full blur-xl pointer-events-none" />
                <div className="absolute top-3.5 right-4 px-2.5 py-0.5 rounded-full bg-primary text-white text-xs font-bold">
                  Phổ biến nhất
                </div>
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-xl font-bold text-white">Membership</h3>
                  </div>
                  <p className="text-xs text-blue-200 mb-5">
                    Trải nghiệm không giới hạn mọi lịch trình và số lượng lưu trữ.
                  </p>
                  <div className="mb-5 pb-5 border-b border-white/10 flex items-baseline gap-1.5">
                    <span className="text-3xl sm:text-4xl font-black text-white">
                      {formatPlanPrice(membershipPlan.price)}
                    </span>
                    <span className="text-xs text-blue-200"> / 30 ngày</span>
                  </div>
                  <ul className="space-y-3 text-xs sm:text-sm text-slate-200">
                    <li className="flex items-center gap-2.5">
                      <span
                        className="material-symbols-outlined text-[18px] text-emerald-400 flex-shrink-0"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        check_circle
                      </span>
                      <span>Tạo lịch trình AI không giới hạn</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <span
                        className="material-symbols-outlined text-[18px] text-emerald-400 flex-shrink-0"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        check_circle
                      </span>
                      <span>Lịch trình đã chốt không giới hạn</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <span
                        className="material-symbols-outlined text-[18px] text-emerald-400 flex-shrink-0"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        check_circle
                      </span>
                      <span>Bản đồ Metro & chỉ đường Google Maps</span>
                    </li>
                  </ul>
                </div>
                <div className="mt-8">
                  <button
                    onClick={() => navigate("/login")}
                    className="w-full block text-center py-3 rounded-xl bg-primary hover:bg-primary/90 text-on-primary font-bold text-xs sm:text-sm shadow-lg shadow-primary/30 transition-all"
                  >
                    Đăng nhập để chọn gói
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* High-conversion CTA */}
        <section className="py-16 bg-navy-darkest relative overflow-hidden">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
              Sẵn sàng vi vu Sài Gòn bằng tàu Metro ngay hôm nay?
            </h2>
            <p className="mt-4 text-blue-200 text-sm sm:text-base max-w-2xl mx-auto font-light">
              Chỉ cần chọn điểm xuất phát, LocalMate AI sẽ chuẩn bị từng bước
              chân cho bạn. Trải nghiệm tuyến Metro văn minh, hiện đại và tràn
              đầy cảm hứng.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => navigate("/register")}
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-[0_0_25px_-5px_rgba(37,99,235,0.4)] transition-all active:scale-95"
              >
                Tạo chuyến đi miễn phí ngay (30 giây)
              </button>
              <a
                href="#14-ga-metro"
                className="w-full sm:w-auto px-6 py-4 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-sm border border-white/20 transition-all text-center"
              >
                Xem bản đồ 14 nhà ga →
              </a>
            </div>
            <p className="mt-4 text-xs text-slate-400">
              Không yêu cầu thẻ tín dụng • Hoạt động tốt trên mọi trình duyệt
              điện thoại và máy tính
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-[#0B1527] text-slate-400 text-xs py-14 border-t border-slate-800">
        <div className="max-w-7xl 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
            <div className="md:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
                  L
                </div>
                <span className="text-base font-bold text-white tracking-tight">
                  LocalMate AI
                </span>
              </div>
              <p className="leading-relaxed text-slate-400">
                Nền tảng trợ lý du lịch và phong cách sống đô thị dọc theo các
                tuyến đường sắt Metro TP. Hồ Chí Minh.
              </p>
              <div className="mt-4 flex items-center gap-2 text-emerald-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Tuyến số 1: Bến Thành – Suối Tiên
              </div>
            </div>

            <div>
              <h4 className="font-bold text-slate-200 uppercase tracking-wider mb-3">
                Nhà ga
              </h4>
              <ul className="space-y-2">
                {stations.slice(0, FOOTER_STATION_COUNT).map((st) => (
                  <li key={st.id}>
                    <a
                      className="hover:text-white transition-colors"
                      href="#14-ga-metro"
                    >
                      Ga {st.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-slate-200 uppercase tracking-wider mb-3">
                Tính năng AI
              </h4>
              <ul className="space-y-2">
                <li>
                  <button
                    onClick={() => navigate("/register")}
                    className="hover:text-white transition-colors text-left"
                  >
                    Tạo lịch trình 30 giây
                  </button>
                </li>
                <li>
                  <a
                    className="hover:text-white transition-colors"
                    href="#lich-trinh-mau"
                  >
                    Lịch trình mẫu
                  </a>
                </li>
                <li>
                  <a className="hover:text-white transition-colors" href="#">
                    Gửi đề xuất quán mới
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-slate-200 uppercase tracking-wider mb-3">
                Liên hệ &amp; Hỗ trợ
              </h4>
              <p className="leading-relaxed mb-3">
                Hợp tác quảng bá điểm đến, thương hiệu ẩm thực hoặc báo lỗi dữ
                liệu lịch trình:
              </p>
              <a
                className="text-blue-400 hover:underline font-medium block mb-2"
                href="mailto:contact@localmate.vn"
              >
                localmateai@gmail.com
              </a>
              <span className="inline-block px-2.5 py-1 rounded bg-slate-800 text-slate-300 text-[11px]">
                TP. Hồ Chí Minh, Việt Nam
              </span>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-[11px] text-slate-500">© 2026 LocalMate AI.</p>
            <div className="flex items-center gap-6 text-[11px]">
              <a className="hover:text-slate-300" href="#">
                Điều khoản sử dụng
              </a>
              <a className="hover:text-slate-300" href="#">
                Chính sách bảo mật
              </a>
              <a className="hover:text-slate-300" href="#">
                Sơ đồ nhà ga
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
