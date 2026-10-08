import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useEffect, useRef, useState } from "react";
import logo from "../../assets/logo.jpg";
import CuratedItineraryCard from "../../components/trip/CuratedItineraryCard";
import { masterDataService } from "../../services/masterDataService";
import { placeService } from "../../services/placeService";
import { itineraryService } from "../../services/itineraryService";
import { subscriptionService } from "../../services/subscriptionService";
import { publicStatsService } from "../../services/publicStatsService";
import { publicReviewService } from "../../services/publicReviewService";
import RatingStars from "../../components/ui/RatingStars";
import {
  FALLBACK_PLANS,
  PLAN_CODES,
  formatPlanPrice,
  getPlanDisplayName,
} from "../../utils/subscriptionUtils";
import { formatDistance } from "../../utils/formatCurrency";
import { scrollToTop } from "../../utils/scrollToTop";

const STEPS = [
  {
    icon: "near_me",
    title: "Chọn điểm xuất phát",
    desc: "Ga Metro gần bạn hoặc vị trí hiện tại.",
  },
  {
    icon: "tune",
    title: "Chọn gu và ngân sách",
    desc: "Thời gian rảnh, chi phí mỗi người và sở thích của bạn.",
  },
  {
    icon: "auto_awesome",
    title: "Nhận lịch trình nháp",
    desc: "Lịch theo giờ, xem trước từng địa điểm rồi mới chốt.",
  },
];

// Ảnh chụp sản phẩm đặt trong public/landing/. Thiếu file nào thì hiện ô giữ chỗ.
const FEATURES = [
  {
    image: "/landing/feature-timeline.jpg",
    placeholder: "Ảnh chụp màn hình lịch trình nháp",
    title: "Cả lịch trình trong một màn hình",
    desc: "Giờ đến từng điểm, thời gian di chuyển giữa các chặng và chi phí ước tính cho mỗi người.",
  },
  {
    image: "/landing/feature-replace.jpg",
    placeholder: "Ảnh chụp màn hình thay địa điểm",
    title: "Chưa ưng điểm nào thì đổi điểm đó",
    desc: "Gợi ý thay thế quanh cùng cụm ga. Lịch trình luôn là bản nháp cho tới khi bạn chốt.",
  },
  {
    image: "/landing/feature-directions.jpg",
    placeholder: "Ảnh chụp màn hình một chặng có nút chỉ đường",
    title: "Biết rõ chặng nào đi bằng gì",
    desc: "Mỗi chặng ghi cách đi và thời gian, bấm một lần là mở chỉ đường trên Google Maps.",
  },
];

// Video nền của phần mở đầu, đặt trong public/landing/
const HERO_VIDEO = "/landing/hero.mp4";

const NAV_LINKS = [
  { id: "tinh-nang", label: "Tính năng AI" },
  { id: "14-ga-metro", label: "14 Ga Tuyến 1" },
  { id: "lich-trinh-mau", label: "Lịch trình mẫu" },
  { id: "bang-gia", label: "Gói dịch vụ" },
];

// Số thẻ đánh giá ở trang đích. API trả ít hơn thì các ô còn lại hiện ô giữ chỗ
const REVIEW_LIMIT = 3;

const CAROUSEL_INTERVAL_MS = 5000;
const CURATED_LIMIT = 6;

const CONTAINER = "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8";
// Rộng bằng header, dùng cho mục cần trải hết bề ngang (hàng thẻ ga)
const WIDE_CONTAINER = "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 2xl:max-w-[1600px]";
const PRIMARY_BUTTON =
  "inline-flex items-center justify-center rounded-full bg-accent px-7 py-3.5 text-sm font-bold text-navy-darkest transition hover:bg-accent-dark active:scale-95";

// 63 -> "60+", 1234 -> "1.200+"; dưới 10 thì hiện đúng số
function formatRoundedCount(count) {
  if (count < 10) return String(count);
  const step = count < 1000 ? 10 : 100;
  return `${new Intl.NumberFormat("vi-VN").format(Math.floor(count / step) * step)}+`;
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function scrollToSection(id) {
  document
    .getElementById(id)
    ?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth" });
}

// Trượt hàng thẻ đi một đợt (bằng bề rộng khung); hết hàng thì quay vòng
function slideTrack(track, direction) {
  if (!track) return;
  const maxScroll = track.scrollWidth - track.clientWidth;
  let target = track.scrollLeft + direction * track.clientWidth;
  if (direction > 0 && track.scrollLeft >= maxScroll - 4) target = 0;
  if (direction < 0 && track.scrollLeft <= 4) target = maxScroll;
  track.scrollTo({ left: target, behavior: prefersReducedMotion() ? "auto" : "smooth" });
}

function getPlanBenefits(plan) {
  const benefits = [];
  if (plan.generateLimit === null) benefits.push("Tạo lịch trình AI không giới hạn");
  else if (typeof plan.generateLimit === "number")
    benefits.push(`${plan.generateLimit} lượt tạo lịch trình`);

  if (plan.savedTripLimit === null) benefits.push("Lịch trình đã chốt không giới hạn");
  else if (typeof plan.savedTripLimit === "number")
    benefits.push(`Tối đa ${plan.savedTripLimit} lịch trình đã chốt`);

  if (typeof plan.aiDailyCallLimit === "number")
    benefits.push(`${plan.aiDailyCallLimit} lượt trợ lý AI mỗi ngày`);

  benefits.push("Chỉ đường Google Maps cho từng chặng");
  return benefits;
}

// Hiện dần khi cuộn tới
function Reveal({ children, className = "" }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition duration-700 ease-out motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none ${
        shown ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      } ${className}`}
    >
      {children}
    </div>
  );
}

function SectionHeading({ title, desc }) {
  return (
    <div className="mx-auto mb-10 max-w-2xl text-center">
      <h2 className="text-2xl font-extrabold tracking-tight text-navy-darkest sm:text-4xl">
        {title}
      </h2>
      {desc && (
        <p className="mt-3 text-sm leading-relaxed text-text-muted sm:text-base">{desc}</p>
      )}
    </div>
  );
}

function MediaPlaceholder({ label, className }) {
  return (
    <div
      className={`flex items-center justify-center rounded-3xl border border-dashed border-border-soft px-6 text-center text-sm text-text-muted ${className}`}
    >
      {label}
    </div>
  );
}

function HeroVideo() {
  const [failed, setFailed] = useState(false);

  if (failed) return null;
  return (
    <video
      src={HERO_VIDEO}
      autoPlay={!prefersReducedMotion()}
      muted
      loop
      playsInline
      preload="auto"
      aria-hidden="true"
      onError={() => setFailed(true)}
      // Rộng hết màn hình, cao vừa một màn hình trừ header (5rem + viền 1px). Màn hình ngang hơn 16:9 thì
      // cắt bớt mép dưới (giữ mép trên vì chữ của video nằm ở đó); màn hình hẹp thì hiện nguyên khung 16:9.
      className="block h-[calc(100svh-5rem-1px)] max-h-[56.25vw] w-full object-cover object-top"
    />
  );
}

function Screenshot({ src, label }) {
  const [failed, setFailed] = useState(false);

  if (failed) return <MediaPlaceholder label={label} className="aspect-[4/3] bg-chip-bg" />;
  return (
    <img
      src={src}
      alt={label}
      loading="lazy"
      onError={() => setFailed(true)}
      className="aspect-[4/3] w-full rounded-3xl border border-border-soft object-cover"
    />
  );
}

const GLASS_ARROW =
  "absolute top-[30%] z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/60 bg-white/40 text-navy-darkest shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_8px_24px_rgba(15,33,72,0.2)] backdrop-blur-xl backdrop-saturate-150 transition hover:bg-white/60 active:scale-95 sm:top-1/2 sm:h-14 sm:w-14";

// Thẻ ga chiếm trọn khung, trượt ngang từng thẻ: tự chuyển, có 2 nút mũi tên kính ở hai mép
function StationCarousel({ clusters, onSelect }) {
  const trackRef = useRef(null);
  const pausedRef = useRef(false);

  useEffect(() => {
    if (prefersReducedMotion()) return undefined;
    const timer = setInterval(() => {
      if (!pausedRef.current && !document.hidden) slideTrack(trackRef.current, 1);
    }, CAROUSEL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  const pause = () => {
    pausedRef.current = true;
  };
  const resume = () => {
    pausedRef.current = false;
  };

  return (
    <div
      className="relative"
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={resume}
    >
      <button
        type="button"
        aria-label="Xem ga trước"
        onClick={() => slideTrack(trackRef.current, -1)}
        className={`${GLASS_ARROW} left-3 lg:-left-7`}
      >
        <span aria-hidden="true" className="material-symbols-outlined text-[28px]">
          chevron_left
        </span>
      </button>
      <button
        type="button"
        aria-label="Xem ga tiếp theo"
        onClick={() => slideTrack(trackRef.current, 1)}
        className={`${GLASS_ARROW} right-3 lg:-right-7`}
      >
        <span aria-hidden="true" className="material-symbols-outlined text-[28px]">
          chevron_right
        </span>
      </button>

      <div
        ref={trackRef}
        onTouchStart={pause}
        onTouchEnd={resume}
        className="hide-scrollbar flex snap-x snap-mandatory gap-5 overflow-x-auto rounded-3xl"
      >
        {clusters.map((cluster) => {
          const cover = cluster.places.find((pl) => pl.imageUrl)?.imageUrl;
          return (
            <button
              key={cluster.stationId}
              type="button"
              onClick={onSelect}
              className="hero-gradient group relative aspect-[4/5] shrink-0 basis-full snap-start overflow-hidden rounded-3xl text-left sm:aspect-[16/9] lg:aspect-[21/9] 2xl:aspect-auto 2xl:h-[600px]"
            >
              {cover ? (
                <img
                  src={cover}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="material-symbols-outlined absolute inset-0 flex items-center justify-center text-[120px] text-white/15"
                >
                  train
                </span>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-navy-darkest/70 via-navy-darkest/10 to-transparent" />

              <div className="absolute inset-x-4 bottom-4 rounded-3xl border border-white/30 bg-white/15 p-5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_12px_40px_rgba(0,0,0,0.25)] backdrop-blur-xl backdrop-saturate-150 sm:inset-x-auto sm:bottom-6 sm:left-20 sm:w-[380px] lg:left-10">
                <p className="text-xs font-semibold uppercase tracking-wider text-white/80">
                  Ga {String(cluster.stationOrder).padStart(2, "0")}
                </p>
                <h3 className="mt-1 text-2xl font-extrabold">Ga {cluster.stationName}</h3>
                <p className="mt-0.5 text-sm text-white/80">
                  {cluster.placeCount ?? cluster.places.length} địa điểm gợi ý
                </p>
                <ul className="mt-3 space-y-1 text-sm text-white/90">
                  {cluster.places.slice(0, 3).map((place) => (
                    <li key={place.id} className="truncate">
                      {place.name} · {formatDistance(place.distanceFromStationMeters)}
                    </li>
                  ))}
                </ul>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function WelcomePage() {
  const navigate = useNavigate();
  const { isLoggedIn, loginDemo } = useAuth();
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [error, setError] = useState("");
  const [plans, setPlans] = useState(FALLBACK_PLANS);

  const [stations, setStations] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [curated, setCurated] = useState([]);
  const [tripsFinalized, setTripsFinalized] = useState(0);
  const [reviews, setReviews] = useState([]);
  const [reviewTagLabels, setReviewTagLabels] = useState({});
  const [publicDataLoaded, setPublicDataLoaded] = useState(false);

  // Người đã đăng nhập xem landing (qua /about) thì các nút dẫn thẳng vào app
  const createPath = isLoggedIn ? "/create" : "/login";
  const signupPath = isLoggedIn ? "/create" : "/register";

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

  // Dữ liệu công khai (không cần đăng nhập). Phần nào lỗi thì ẩn phần đó.
  useEffect(() => {
    let active = true;
    Promise.allSettled([
      masterDataService.getMasterData(),
      placeService.getMetroClusters(),
      itineraryService.getCuratedItineraries(),
      publicStatsService.getPublicStats(),
      publicReviewService.getPublicReviews(REVIEW_LIMIT),
    ]).then(([masterData, clusterData, curatedData, publicStats, publicReviews]) => {
      if (!active) return;
      if (publicReviews.status === "fulfilled" && Array.isArray(publicReviews.value?.items)) {
        setReviews(publicReviews.value.items.slice(0, REVIEW_LIMIT));
      }
      if (publicStats.status === "fulfilled" && typeof publicStats.value?.tripsFinalized === "number") {
        setTripsFinalized(publicStats.value.tripsFinalized);
      }
      if (masterData.status === "fulfilled") {
        setStations([...masterData.value.metroStations].sort((a, b) => a.order - b.order));
        setReviewTagLabels(
          Object.fromEntries(
            (masterData.value.reviewQuickTags ?? []).map((tag) => [tag.code, tag.label]),
          ),
        );
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
  const stationCards = [...clusters]
    .filter((c) => c.places.length > 0)
    .sort((a, b) => a.stationOrder - b.stationOrder);
  // Đang tải hoặc API lỗi (đếm ra 0) thì hiện "–" thay vì số 0
  const stat = (count, format = String) => (count > 0 ? format(count) : "–");
  const stats = [
    { icon: "train", value: stat(stations.length), label: "Ga Metro tuyến số 1" },
    // Có số lịch trình đã chốt thì hiện; API lỗi hoặc bằng 0 thì hiện thẻ ga như cũ
    tripsFinalized > 0
      ? { icon: "task_alt", value: formatRoundedCount(tripsFinalized), label: "Lịch trình đã chốt" }
      : { icon: "pin_drop", value: stat(stationsWithPlaces.length), label: "Ga đã có địa điểm gợi ý" },
    {
      icon: "storefront",
      value: stat(totalPlaces, formatRoundedCount),
      label: "Địa điểm quanh ga",
      highlight: true,
    },
    {
      icon: "route",
      value: stat(curated.length, formatRoundedCount),
      label: "Lịch trình mẫu",
      highlight: true,
    },
  ];

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

  return (
    <div className="min-h-screen w-full bg-background text-on-surface">
      {/* Header: nền trắng cố định, nằm trên video chứ không đè lên */}
      <header className="sticky top-0 z-50 border-b border-outline-variant/30 bg-white/95 backdrop-blur-md">
        <div className={`${WIDE_CONTAINER} flex h-20 items-center justify-between`}>
          <button
            type="button"
            onClick={() => scrollToTop()}
            aria-label="LocalMate AI, lên đầu trang"
            className="flex shrink-0 items-center gap-3 text-left"
          >
            <img
              src={logo}
              alt="LocalMate AI"
              className="w-11 h-11 rounded-2xl object-cover shadow-md"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-extrabold tracking-tight text-navy-dark">
                  LocalMate
                </span>
                <span className="rounded-md bg-navy px-1.5 py-0.5 text-[11px] font-extrabold text-white">
                  AI
                </span>
              </div>
              <p className="mt-px text-[11px] text-text-muted">Metro-friendly planner</p>
            </div>
          </button>

          <nav className="hidden lg:flex items-center gap-5 xl:gap-8 whitespace-nowrap text-sm font-semibold text-text-muted">
            {NAV_LINKS.map((link) => (
              <button
                key={link.id}
                type="button"
                onClick={() => scrollToSection(link.id)}
                className="transition-colors hover:text-navy"
              >
                {link.label}
              </button>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-3 sm:gap-4">
            {!isLoggedIn && (
              <button
                onClick={() => navigate("/login")}
                className="hidden sm:inline-flex text-sm font-semibold text-text-muted hover:text-navy px-3 py-2 transition-colors"
              >
                Đăng nhập
              </button>
            )}
            <button
              onClick={() => navigate(isLoggedIn ? "/home" : "/login")}
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-navy-darkest hover:bg-slate-900 text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all active:scale-95"
            >
              <span>{isLoggedIn ? "Vào ứng dụng" : "Tạo lịch trình"}</span>
              <span className="material-symbols-outlined hidden text-[18px] ml-1.5 sm:inline-block">
                arrow_forward
              </span>
            </button>
          </div>
        </div>
      </header>

      <main>
        {/* Mở đầu: video hiện sạch (đã có chữ riêng), bấm vào là tới trang tạo lịch trình */}
        <section className="bg-navy-darkest">
          <button
            type="button"
            onClick={() => navigate(createPath)}
            aria-label="Tạo lịch trình với LocalMate AI"
            className="block w-full"
          >
            <HeroVideo />
          </button>
        </section>

        <section className="bg-white py-14 sm:py-16">
          <div className={`${CONTAINER} text-center`}>
            <div className="mb-6 flex justify-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-border-soft bg-chip-bg px-3.5 py-1.5 text-xs font-medium text-navy-dark sm:text-sm">
                <span className="h-2 w-2 shrink-0 rounded-full bg-accent" />
                <span>Khám phá Sài Gòn với trải nghiệm đường sắt đô thị hiện đại nhất</span>
              </div>
            </div>

            <h1 className="mx-auto max-w-4xl text-3xl font-extrabold leading-[1.25] tracking-tight text-navy-darkest sm:text-5xl sm:leading-[1.25] lg:text-6xl lg:leading-[1.25]">
              Khám Phá Sài Gòn Thông Minh Dọc Tuyến Metro Số 1 Cùng{" "}
              <span className="text-navy-mid">LocalMate AI</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-text-muted sm:text-lg">
              Lên lịch trình khám phá ẩm thực, check-in cà phê và điểm du lịch quanh 14 ga Bến
              Thành – Suối Tiên chỉ trong 30 giây. Tự động hóa trải nghiệm theo phong cách{" "}
              <span className="font-semibold text-navy-darkest underline decoration-accent decoration-2">
                cá nhân
              </span>
              .
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => navigate(createPath)}
                className={`${PRIMARY_BUTTON} group`}
              >
                <span>Thiết kế lịch trình với AI</span>
                <span className="material-symbols-outlined ml-2 text-[18px] transition-transform group-hover:translate-x-1">
                  arrow_forward
                </span>
              </button>
              {!isLoggedIn && (
                <button
                  type="button"
                  onClick={handleDemo}
                  disabled={loadingDemo}
                  className="rounded-full border border-border-soft px-6 py-3.5 text-sm font-semibold text-navy-darkest transition-colors hover:bg-chip-bg disabled:opacity-60"
                >
                  {loadingDemo ? "Đang chuẩn bị..." : "Trải nghiệm nhanh phiên Demo"}
                </button>
              )}
            </div>
            {error && (
              <p role="alert" className="mt-4 text-sm text-error">
                {error}
              </p>
            )}
          </div>
        </section>

        {/* Số liệu */}
        <section className="bg-navy-darkest">
          <div className={`${CONTAINER} grid grid-cols-2 gap-3 py-8 sm:gap-4 sm:py-10 md:grid-cols-4`}>
            {stats.map((item) => (
              <div
                key={item.label}
                className="rounded-3xl border border-white/10 bg-white/10 p-4 sm:p-5"
              >
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                    item.highlight ? "bg-accent/20 text-accent" : "bg-white/10 text-primary-fixed"
                  }`}
                >
                  <span aria-hidden="true" className="material-symbols-outlined text-[22px]">
                    {item.icon}
                  </span>
                </div>
                <div
                  className={`mt-4 text-3xl font-extrabold sm:text-4xl ${
                    item.highlight ? "text-accent" : "text-white"
                  }`}
                >
                  {item.value}
                </div>
                <div className="mt-1 text-xs font-medium text-primary-fixed sm:text-sm">
                  {item.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Ba bước + tính năng */}
        <section id="tinh-nang" className="scroll-mt-24 bg-white py-16 sm:py-20">
          <div className={CONTAINER}>
            <SectionHeading
              title="Ba bước là có lịch trình"
              desc="Không cần chuẩn bị trước, mọi thứ được xếp vừa theo từng ga của tuyến Metro số 1."
            />
            <Reveal className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {STEPS.map((step) => (
                <div key={step.title} className="rounded-3xl bg-background p-6">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-navy">
                    <span aria-hidden="true" className="material-symbols-outlined text-[24px]">
                      {step.icon}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-navy-darkest">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-text-muted">{step.desc}</p>
                </div>
              ))}
            </Reveal>

            <div className="mt-16 space-y-14 sm:mt-20 sm:space-y-20">
              {FEATURES.map((feature) => (
                <Reveal
                  key={feature.title}
                  className="grid grid-cols-1 items-center gap-8 md:grid-cols-2 md:gap-14"
                >
                  <Screenshot src={feature.image} label={feature.placeholder} />
                  <div>
                    <h3 className="text-2xl font-extrabold tracking-tight text-navy-darkest sm:text-3xl">
                      {feature.title}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-text-muted sm:text-base">
                      {feature.desc}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Ga Metro */}
        <section id="14-ga-metro" className="scroll-mt-24 bg-background py-16 sm:py-20">
          <div className={WIDE_CONTAINER}>
            <SectionHeading
              title="Quanh mỗi ga có gì?"
              desc="Các địa điểm đã được kiểm duyệt quanh từng nhà ga, kèm khoảng cách tới ga."
            />

            {stationCards.length === 0 ? (
              <p className="text-center text-sm text-text-muted">
                {publicDataLoaded
                  ? "Chưa có dữ liệu địa điểm quanh ga."
                  : "Đang tải địa điểm quanh ga..."}
              </p>
            ) : (
              <Reveal>
                <StationCarousel
                  clusters={stationCards}
                  onSelect={() => navigate(isLoggedIn ? "/metro" : "/login")}
                />
              </Reveal>
            )}

            {stations.length > 0 && (
              <div className="mt-10 overflow-x-auto rounded-3xl bg-white p-6">
                <div className="min-w-[900px]">
                  <div className="mb-2 flex items-start justify-between gap-1 text-[11px] font-semibold text-text-muted">
                    {stations.map((st) => (
                      <span
                        key={st.id}
                        className={`flex-1 text-center ${placeCountByStation.get(st.id) > 0 ? "font-bold text-navy" : ""}`}
                      >
                        {String(st.order).padStart(2, "0")}
                        <br />
                        {st.name}
                      </span>
                    ))}
                  </div>
                  <div className="relative flex h-2.5 items-center justify-around rounded-full bg-chip-bg">
                    {stations.map((st) => (
                      <span
                        key={st.id}
                        className={`${placeCountByStation.get(st.id) > 0 ? "h-4 w-4 bg-navy" : "h-3 w-3 bg-accent"} relative z-10 rounded-full border-2 border-white`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Lịch trình mẫu */}
        <section id="lich-trinh-mau" className="scroll-mt-24 bg-white py-16 sm:py-20">
          <div className={CONTAINER}>
            <SectionHeading
              title="Đi theo lịch có sẵn"
              desc="Các lịch trình mẫu đang có trên LocalMate AI. Đăng nhập để dùng một lịch làm bản nháp của bạn."
            />
            {curated.length === 0 ? (
              <p className="text-center text-sm text-text-muted">
                {publicDataLoaded ? "Chưa có lịch trình mẫu." : "Đang tải lịch trình mẫu..."}
              </p>
            ) : (
              <Reveal className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {curated.slice(0, CURATED_LIMIT).map((itinerary) => (
                  <CuratedItineraryCard
                    key={itinerary.id}
                    itinerary={itinerary}
                    applyingId={null}
                    applyError={null}
                    onApply={() => navigate(isLoggedIn ? "/explore" : "/login")}
                  />
                ))}
              </Reveal>
            )}
          </div>
        </section>

        {/* Đánh giá */}
        <section className="bg-background py-16 sm:py-20">
          <div className={CONTAINER}>
            <SectionHeading title="Người dùng nói gì về các điểm đến" />
            <Reveal className="grid grid-cols-1 gap-5 md:grid-cols-3">
              {reviews.map((review) => (
                <figure key={review.id} className="flex flex-col rounded-3xl bg-white p-6">
                  <RatingStars value={review.rating} size={18} />
                  <blockquote className="mt-3 line-clamp-5 break-words text-sm leading-relaxed text-on-surface">
                    {review.comment}
                  </blockquote>
                  {/* Chỉ hiện nhãn đã có tên tiếng Việt từ master-data */}
                  {review.quickTags?.some((code) => reviewTagLabels[code]) && (
                    <ul className="mt-3 flex flex-wrap gap-1.5">
                      {review.quickTags
                        .filter((code) => reviewTagLabels[code])
                        .map((code) => (
                          <li
                            key={code}
                            className="rounded-full bg-chip-bg px-2.5 py-1 text-xs font-medium text-navy-dark"
                          >
                            {reviewTagLabels[code]}
                          </li>
                        ))}
                    </ul>
                  )}
                  <figcaption className="mt-auto pt-4 text-sm font-bold text-navy-darkest">
                    {review.reviewerName}
                    <span className="block truncate text-xs font-medium text-text-muted">
                      Đánh giá {review.place.name}
                    </span>
                  </figcaption>
                </figure>
              ))}
              {Array.from({ length: Math.max(0, REVIEW_LIMIT - reviews.length) }, (_, i) => (
                <MediaPlaceholder
                  key={i}
                  label="Đánh giá của người dùng sẽ hiển thị ở đây"
                  className="min-h-[180px] bg-white"
                />
              ))}
            </Reveal>
          </div>
        </section>

        {/* Gói dịch vụ */}
        <section id="bang-gia" className="scroll-mt-24 bg-white py-16 sm:py-20">
          <div className={CONTAINER}>
            <SectionHeading
              title="Dùng miễn phí, nâng cấp khi cần"
              desc="Phù hợp cho cả người ở thành phố muốn đi chơi cuối tuần và du khách lần đầu tới TP.HCM."
            />
            <Reveal className="mx-auto grid max-w-5xl grid-cols-1 items-stretch gap-5 md:grid-cols-2 lg:grid-cols-3">
              {plans.map((plan) => {
                const isFree = plan.code === PLAN_CODES.FREE;
                const highlighted = plan.code === PLAN_CODES.MEMBERSHIP;
                return (
                  <div
                    key={plan.code}
                    className={`flex flex-col rounded-3xl bg-white p-7 ${
                      highlighted ? "border-2 border-accent" : "border border-border-soft"
                    }`}
                  >
                    <h3 className="text-lg font-bold text-navy-darkest">
                      {getPlanDisplayName(plan.code, plans)}
                    </h3>
                    <div className="mt-3 border-b border-border-soft pb-5">
                      <span className="text-3xl font-extrabold text-navy-darkest sm:text-4xl">
                        {formatPlanPrice(plan.price)}
                      </span>
                      <span className="text-xs text-text-muted">
                        {" "}
                        / {plan.durationDays ? `${plan.durationDays} ngày` : "Không thời hạn"}
                      </span>
                    </div>
                    <ul className="mt-5 flex-1 space-y-3 text-sm text-text-muted">
                      {getPlanBenefits(plan).map((benefit) => (
                        <li key={benefit} className="flex items-start gap-2.5">
                          <span
                            aria-hidden="true"
                            className="material-symbols-outlined material-symbols-filled mt-px text-[18px] text-navy"
                          >
                            check_circle
                          </span>
                          <span>{benefit}</span>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={() =>
                        navigate(isLoggedIn ? "/subscription" : isFree ? "/register" : "/login")
                      }
                      className={`mt-8 w-full rounded-full py-3 text-sm font-bold transition-colors ${
                        highlighted
                          ? "bg-accent text-navy-darkest hover:bg-accent-dark"
                          : "bg-chip-bg text-navy-darkest hover:bg-chip-bg-alt"
                      }`}
                    >
                      {isLoggedIn
                        ? "Xem trong Gói hội viên"
                        : isFree
                          ? "Đăng ký miễn phí"
                          : "Đăng nhập để chọn gói"}
                    </button>
                  </div>
                );
              })}
            </Reveal>
          </div>
        </section>

        {/* Lời kêu gọi */}
        <section className="bg-navy-darkest py-16 text-center">
          <div className={CONTAINER}>
            <h2 className="mx-auto max-w-2xl text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl">
              Lên lịch cho buổi đi Metro của bạn
            </h2>
            <button
              type="button"
              onClick={() => navigate(signupPath)}
              className={`${PRIMARY_BUTTON} mt-8`}
            >
              {isLoggedIn ? "Tạo lịch trình" : "Tạo lịch trình miễn phí"}
            </button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-[#0B1527] text-slate-400 text-xs py-14 border-t border-slate-800">
        <div className="max-w-7xl 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
            <div className="md:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <img src={logo} alt="" className="w-9 h-9 rounded-2xl object-cover" />
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
              <ul className="columns-2 gap-x-4 md:columns-1 2xl:columns-2">
                {stations.map((st) => (
                  <li key={st.id} className="mb-2 break-inside-avoid">
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
                    onClick={() => navigate(signupPath)}
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
                href="mailto:localmateai@gmail.com"
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
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
