import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useEffect, useState } from "react";
import logo from "../../assets/logo.jpg";

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
    desc: "Nhận lịch trình từng phút kèm hướng dẫn lối ra cửa ga (Exit), quãng đường đi bộ thực tế, dễ dàng chỉnh sửa và lưu vào điện thoại.",
  },
];

const STATIONS = [
  {
    name: "Ga Bến Thành",
    walk: "Đi bộ 3p",
    rating: "4.8",
    emoji: "🏛️",
    tagline: "Nhà ga trung tâm biểu tượng",
    gradient: "from-amber-900/60 to-slate-900",
    title: "Khu Phố Cổ, Chợ Bến Thành & Phố Đi Bộ",
    desc: "Lối ra số 1 & 2 kết nối trực tiếp chợ trung tâm, Bảo tàng Mỹ thuật, các tiệm cafe cổ điển đường Pasteur.",
    tags: ["Chợ Bến Thành (150m)", "Nguyễn Huệ (400m)"],
    highlight: "Cửa hầm thông ngầm",
    highlightColor: "bg-blue-50 text-primary",
    time: "Thời gian lý tưởng: 3-4 giờ",
  },
  {
    name: "Ga Ba Son",
    walk: "Đi bộ 2p (150m)",
    rating: "4.9",
    emoji: "🏙️",
    tagline: "Công viên ven sông & Landmark",
    gradient: "from-sky-900/60 to-slate-900",
    title: "Công Viên Bạch Đằng, Cà Phê Bờ Sông & Cầu Ba Son",
    desc: "Bước lên từ lối lên mặt đất là bờ sông Sài Gòn lộng gió, view ngắm trọn bán đảo Thủ Thiêm và cầu Ba Son biểu tượng.",
    tags: ["Bến Bạch Đằng (150m)", "Waterbus Ga Tàu Thủy"],
    highlight: "Ngắm hoàng hôn cực đẹp",
    highlightColor: "bg-emerald-50 text-emerald-700",
    time: "Thời gian lý tưởng: 2 tiếng",
  },
  {
    name: "Ga Thảo Điền",
    walk: "5p xe / Đi dạo",
    rating: "4.7",
    emoji: "☕",
    tagline: "Khu nghệ thuật & Brunch Quốc Tế",
    gradient: "from-emerald-900/60 to-slate-900",
    title: "Khu Tổ Hợp Sáng Tạo, Artisan Bakery & Bistro",
    desc: "Thiên đường ẩm thực fusion, các xưởng gốm thủ công, nhà hàng ven sông lãng mạn tại trái tim Thủ Đức.",
    tags: ["Tổ hợp BLOQ (350m)", "Boutique Cafe"],
    highlight: "Ẩm thực đa quốc gia",
    highlightColor: "bg-purple-50 text-purple-700",
    time: "Thời gian lý tưởng: Nửa ngày",
  },
];

const ROUTE_STOPS = [
  {
    label: "Ga 01: Bến Thành",
    active: true,
    dotSize: "w-4 h-4",
    color: "bg-primary",
  },
  { label: "Ga 02: Nhà hát TP", dotSize: "w-3 h-3", color: "bg-blue-500" },
  { label: "Ga 03: Ba Son", dotSize: "w-3 h-3", color: "bg-blue-500" },
  { label: "Ga 04: Văn Thánh", dotSize: "w-3 h-3", color: "bg-emerald-500" },
  { label: "Ga 05: Tân Cảng", dotSize: "w-3 h-3", color: "bg-emerald-500" },
  {
    label: "Ga 06: Thảo Điền",
    active: true,
    dotSize: "w-4 h-4",
    color: "bg-primary",
  },
  { label: "Ga 07: An Phú", dotSize: "w-3 h-3", color: "bg-slate-300" },
  { label: "Ga 08: Rạch Chiếc", dotSize: "w-3 h-3", color: "bg-slate-300" },
  {
    label: "Ga 14: Bến xe MĐ Mới",
    dotSize: "w-3.5 h-3.5",
    color: "bg-slate-400",
  },
];

const TIMELINE = [
  {
    time: "08:00 - 08:30",
    station: "Ga Bến Thành",
    exit: "Lối ra Cổng 1 (Công viên 23/9)",
    dot: "bg-blue-500 ring-blue-500",
    timeColor: "text-blue-400",
    title: "Thưởng thức Cà phê vợt Bến Thành & Bánh mì chảo",
    desc: "Đi bộ 120m từ cửa ga ngầm. Quán mở từ 6h sáng, chỗ ngồi thoáng mát nhìn dòng người bắt đầu ngày mới.",
    chips: ["⚡ Tiết kiệm: 15% khi quét QR LocalMate", "⏱️ Đi bộ: 2 phút"],
  },
  {
    time: "09:00 - 10:45",
    station: "Ga Ba Son",
    exit: "Lối ra Cổng 3 (Bến Bạch Đằng)",
    dot: "bg-indigo-500 ring-indigo-500",
    timeColor: "text-indigo-400",
    title: "Dạo bước Cầu Ba Son & Trải nghiệm Trà Chiều ven sông",
    desc: "Tàu di chuyển từ Ga Bến Thành đến Ba Son chỉ mất 4 phút qua hầm ngầm. Lối ra số 3 dẫn thẳng bờ sông Sài Gòn tuyệt đẹp.",
    chips: ["📸 Điểm check-in hot nhất", "⏱️ Đi bộ: 150m"],
  },
  {
    time: "11:15 - 13:00",
    station: "Ga Thảo Điền",
    exit: "Lối ra Cầu bộ hành số 2",
    dot: "bg-emerald-500 ring-emerald-500",
    timeColor: "text-emerald-400",
    title: "Brunch kiểu Ý & Khám phá Xưởng nghệ thuật",
    desc: "Qua cầu Sài Gòn ngắm cảnh thành phố trên cao bằng tàu Metro. Khám phá khu phố Tây yên tĩnh và nhiều mảng xanh.",
    chips: [],
  },
];

const FREE_FEATURES = [
  "3 lượt tạo lịch trình AI mỗi ngày",
  "Thông tin 14 ga Metro cơ bản và bản đồ tuyến",
  "Tự động tối ưu bán kính đi bộ <500m",
];

const PRO_FEATURES = [
  "Không giới hạn lượt tạo lịch trình AI tùy biến sâu",
  "Chế độ ngoại tuyến (Offline Mode) dùng mượt mà dưới tầng hầm ga",
  "Cảnh báo giờ tàu sắp đến & hướng dẫn từng bước ra lối thoát (Exit 1-4)",
  "Giảm giá độc quyền 10% - 25% tại 50+ đối tác cà phê & ăn uống quanh ga",
];

const TESTIMONIALS = [
  {
    quote:
      "Cuối tuần mình rủ người yêu đi Metro mà không biết chơi đâu ngoài việc đi qua đi lại. Nhờ LocalMate AI gợi ý chặng Ga Ba Son ra bờ sông ngắm hoàng hôn rồi ghé quán cafe vintage chỉ cách 200m cực kỳ chill!",
    initials: "TH",
    initialsColor: "bg-blue-100 text-blue-700",
    name: "Trần Hoàng (23 tuổi)",
    role: "Gen Z mê xê dịch Sài Gòn",
  },
  {
    quote:
      "Rất thích tính năng chỉ dẫn lối ra Exit. Nhà ga ngầm Bến Thành rất rộng và dễ lạc, AI chỉ đúng cửa số 2 bước lên là thấy ngay quán phở ngon trứ danh. Đi bộ ít, không lo nắng gắt.",
    initials: "ML",
    initialsColor: "bg-emerald-100 text-emerald-700",
    name: "Mai Linh & Gia đình",
    role: "Du khách từ Hà Nội",
  },
  {
    quote:
      "Gói Pro 49k quá rẻ vì mình dùng voucher giảm giá ở hai quán cà phê tại Ga Thảo Điền là đã hoàn tiền rồi. Giao diện mượt mà và trực quan y như các app tàu điện tại Singapore, Nhật Bản.",
    initials: "NQ",
    initialsColor: "bg-indigo-100 text-indigo-700",
    name: "Nguyễn Quân",
    role: "Product Designer tại TP. Thủ Đức",
  },
];

export default function WelcomePage() {
  const navigate = useNavigate();
  const { isLoggedIn, loginDemo } = useAuth();
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [error, setError] = useState("");

  const [startStation, setStartStation] = useState("benthanh");
  const [tripDuration, setTripDuration] = useState("halfday");
  const [userPreference, setUserPreference] = useState("cafe");

  useEffect(() => {
    if (isLoggedIn) navigate("/home");
  }, [isLoggedIn, navigate]);

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
              Gói Pro
            </a>
            <a
              className="hover:text-primary transition-colors"
              href="#cong-dong"
            >
              Cộng đồng
            </a>
          </nav>

          <div className="flex shrink-0 items-center gap-3 sm:gap-4">
            <div className="hidden 2xl:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>
                <strong>Metro Tuyến 1:</strong> Đang chạy ổn định (6-8p/chuyến)
              </span>
            </div>
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
                  <span>★ AI Metro Trip Planner v2.4</span>
                </div>
                <div className="text-xs text-blue-200 flex items-center gap-1.5 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  Đồng bộ dữ liệu giờ tàu và điểm đến mới nhất hôm nay
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
                      value={startStation}
                      onChange={(e) => setStartStation(e.target.value)}
                      className="w-full bg-transparent text-white font-medium text-sm border-none p-0 pr-6 focus:ring-0 cursor-pointer appearance-none"
                    >
                      <option className="text-slate-900" value="benthanh">
                        Ga Bến Thành (Quận 1)
                      </option>
                      <option className="text-slate-900" value="bason">
                        Ga Ba Son (Quận 1 / Bờ Sông)
                      </option>
                      <option className="text-slate-900" value="thaodien">
                        Ga Thảo Điền (TP. Thủ Đức)
                      </option>
                      <option className="text-slate-900" value="anphu">
                        Ga An Phú (Khu mua sắm cao cấp)
                      </option>
                      <option className="text-slate-900" value="suoitien">
                        Ga Bến Xe Miền Đông Mới / Suối Tiên
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
                      : "Dùng thử ngay không cần đăng ký"}
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
              <div className="p-3">
                <div className="text-2xl sm:text-3xl font-black text-on-surface">
                  18,500+
                </div>
                <div className="text-xs text-on-surface-variant font-medium mt-1">
                  Lịch trình đã tạo tự động
                </div>
              </div>
              <div className="p-3">
                <div className="text-2xl sm:text-3xl font-black text-primary">
                  14 / 14
                </div>
                <div className="text-xs text-on-surface-variant font-medium mt-1">
                  Ga Metro được AI lập bản đồ
                </div>
              </div>
              <div className="p-3">
                <div className="text-2xl sm:text-3xl font-black text-emerald-600">
                  &lt; 500m
                </div>
                <div className="text-xs text-on-surface-variant font-medium mt-1">
                  Bán kính đi bộ trung bình
                </div>
              </div>
              <div className="p-3">
                <div className="text-2xl sm:text-3xl font-black text-amber-500">
                  4.9 ★
                </div>
                <div className="text-xs text-on-surface-variant font-medium mt-1">
                  Hơn 2,400 đánh giá người dùng
                </div>
              </div>
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
                  <span>💡</span> Bạn có thể lưu lịch trình ngoại tuyến
                  (offline) để dùng khi ở dưới ga ngầm không có sóng 4G.
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
                  Các điểm check-in tối ưu dựa trên thời gian di chuyển thực tế
                  từ lối ra các nhà ga ngầm &amp; trên cao.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button className="px-4 py-2 text-xs font-bold rounded-lg bg-blue-100 text-primary">
                  Tất cả (14 ga)
                </button>
                <button className="px-4 py-2 text-xs font-semibold rounded-lg bg-white text-on-surface-variant hover:bg-slate-100 border border-outline-variant/40">
                  Ga ngầm trung tâm
                </button>
                <button className="px-4 py-2 text-xs font-semibold rounded-lg bg-white text-on-surface-variant hover:bg-slate-100 border border-outline-variant/40">
                  Ga trên cao
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {STATIONS.map((station) => (
                <div
                  key={station.name}
                  className="bg-white rounded-2xl overflow-hidden border border-outline-variant/40 shadow-[0_10px_30px_-10px_rgba(15,32,66,0.08)] hover:shadow-[0_20px_35px_-8px_rgba(15,32,66,0.15)] transition-all group"
                >
                  <div className="relative h-48 bg-slate-800 overflow-hidden">
                    <div
                      className={`w-full h-full bg-gradient-to-tr ${station.gradient} relative flex items-center justify-center p-6 text-center`}
                    >
                      <div className="relative z-10">
                        <span className="text-4xl">{station.emoji}</span>
                        <p className="text-xs uppercase tracking-widest text-amber-100 font-bold mt-2">
                          {station.tagline}
                        </p>
                      </div>
                    </div>
                    <div className="absolute top-3 left-3 flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg bg-navy-darkest/90 backdrop-blur-md text-white text-xs font-bold">
                        {station.name}
                      </span>
                      <span className="px-2 py-1 rounded-lg bg-emerald-500/90 text-white text-xs font-semibold">
                        {station.walk}
                      </span>
                    </div>
                    <div className="absolute top-3 right-3">
                      <span className="px-2 py-1 rounded-lg bg-black/60 backdrop-blur-md text-amber-400 text-xs font-bold flex items-center gap-1">
                        ★ {station.rating}
                      </span>
                    </div>
                  </div>
                  <div className="p-5">
                    <h3 className="text-lg font-bold text-on-surface group-hover:text-primary transition-colors">
                      {station.title}
                    </h3>
                    <p className="text-xs text-on-surface-variant mt-1 line-clamp-2">
                      {station.desc}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {station.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700"
                        >
                          {tag}
                        </span>
                      ))}
                      <span
                        className={`text-[11px] font-medium px-2 py-0.5 rounded font-semibold ${station.highlightColor}`}
                      >
                        {station.highlight}
                      </span>
                    </div>
                    <div className="mt-5 pt-3 border-t border-outline-variant/30 flex items-center justify-between text-xs font-medium">
                      <span className="text-on-surface-variant">
                        {station.time}
                      </span>
                      <button
                        onClick={() => navigate("/login")}
                        className="text-primary font-bold hover:underline inline-flex items-center"
                      >
                        Lên tour này →
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-12 p-6 bg-white rounded-2xl border border-outline-variant/40 shadow-sm overflow-x-auto">
              <div className="min-w-[700px]">
                <div className="flex items-center justify-between text-xs font-semibold text-on-surface-variant mb-2">
                  {ROUTE_STOPS.map((stop) => (
                    <span
                      key={stop.label}
                      className={stop.active ? "text-primary font-bold" : ""}
                    >
                      {stop.label}
                    </span>
                  ))}
                </div>
                <div className="relative h-2.5 bg-slate-200 rounded-full flex items-center justify-between px-1">
                  <div className="absolute inset-y-0 left-0 w-2/3 bg-gradient-to-r from-emerald-500 via-primary to-indigo-500 rounded-full" />
                  {ROUTE_STOPS.map((stop) => (
                    <span
                      key={stop.label}
                      className={`${stop.dotSize} rounded-full ${stop.color} border-2 border-white relative z-10 shadow`}
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
                Mô phỏng trải nghiệm thực tế
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-on-surface tracking-tight mt-3">
                Lịch trình mẫu do LocalMate AI tạo ra trông như thế nào?
              </h2>
              <p className="text-on-surface-variant mt-2 text-sm sm:text-base">
                Mỗi điểm dừng đều kèm theo hướng dẫn lối thoát (Exit gate), số
                phút đi bộ chính xác và menu gợi ý chuẩn vị.
              </p>
            </div>

            <div className="max-w-4xl mx-auto bg-slate-900 text-white rounded-3xl p-6 sm:p-10 shadow-2xl border border-slate-800 relative">
              <div className="flex flex-wrap items-center justify-between pb-6 border-b border-slate-800 gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    <span className="text-xs uppercase tracking-wider text-slate-400 font-bold">
                      Lịch trình tự động #LM-9428
                    </span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold mt-1">
                    Tour: "Nắng Sài Gòn &amp; Cà phê bên sông qua 3 ga Metro"
                  </h3>
                </div>
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 rounded-lg bg-blue-500/20 text-blue-300 text-xs font-semibold border border-blue-500/30">
                    Thời lượng: 4.5 tiếng
                  </span>
                  <span className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-500/30">
                    Tổng đi bộ: 650m
                  </span>
                </div>
              </div>

              <div className="relative mt-8 pl-6 sm:pl-8 border-l-2 border-blue-500/40 space-y-8">
                {TIMELINE.map((item) => (
                  <div key={item.time} className="relative">
                    <span
                      className={`absolute -left-[31px] sm:-left-[39px] top-1 w-5 h-5 rounded-full border-4 border-slate-900 ring-2 ${item.dot}`}
                    />
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-mono font-bold ${item.timeColor}`}
                        >
                          {item.time}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-slate-200">
                          {item.station}
                        </span>
                      </div>
                      <span className="text-xs text-emerald-400 font-medium">
                        {item.exit}
                      </span>
                    </div>
                    <h4 className="text-base font-bold text-white">
                      {item.title}
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">{item.desc}</p>
                    {item.chips.length > 0 && (
                      <div className="mt-2.5 flex items-center gap-2 text-[11px] text-slate-300">
                        {item.chips.map((chip) => (
                          <span
                            key={chip}
                            className="px-2 py-0.5 rounded bg-slate-800"
                          >
                            {chip}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-8 pt-6 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
                <div className="text-xs text-slate-400">
                  Muốn cá nhân hóa lịch trình theo gu riêng của bạn?
                </div>
                <div className="flex items-center gap-3">
                  <button className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors">
                    Lưu vào điện thoại (.PDF)
                  </button>
                  <button
                    onClick={() => navigate("/login")}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white transition-colors"
                  >
                    Tạo lịch trình của bạn ngay →
                  </button>
                </div>
              </div>
            </div>
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto items-stretch">
              {/* Free plan */}
              <div className="bg-white rounded-3xl p-8 border border-outline-variant/40 shadow-[0_10px_30px_-10px_rgba(15,32,66,0.08)] flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-on-surface">
                      Bản Free Cơ Bản
                    </h3>
                    <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">
                      Miễn phí trọn đời
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant mb-6">
                    Trải nghiệm tiện lợi nhanh chóng không cần đăng ký tài khoản
                    rườm rà.
                  </p>
                  <div className="mb-6 pb-6 border-b border-outline-variant/30">
                    <span className="text-4xl font-black text-on-surface">
                      0đ
                    </span>
                    <span className="text-xs text-on-surface-variant">
                      {" "}
                      / vĩnh viễn
                    </span>
                  </div>
                  <ul className="space-y-3.5 text-xs sm:text-sm text-on-surface-variant">
                    {FREE_FEATURES.map((feature) => (
                      <li key={feature} className="flex items-center gap-2.5">
                        <span
                          className="material-symbols-outlined text-[18px] text-emerald-500 flex-shrink-0"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          check_circle
                        </span>
                        <span>{feature}</span>
                      </li>
                    ))}
                    <li className="flex items-center gap-2.5 text-slate-400">
                      <span className="material-symbols-outlined text-[18px] text-slate-300 flex-shrink-0">
                        close
                      </span>
                      <span>Không bao gồm voucher ưu đãi đối tác</span>
                    </li>
                  </ul>
                </div>
                <div className="mt-8">
                  <button
                    onClick={() => navigate("/register")}
                    className="w-full block text-center py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs sm:text-sm transition-colors"
                  >
                    Bắt đầu miễn phí
                  </button>
                </div>
              </div>

              {/* Pro plan */}
              <div className="bg-navy-darkest text-white rounded-3xl p-8 border-2 border-blue-500 shadow-2xl relative flex flex-col justify-between overflow-hidden">
                <div className="absolute top-0 right-0 translate-x-6 -translate-y-6 w-32 h-32 bg-blue-500/20 rounded-full blur-xl pointer-events-none" />
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-white">
                      Gói Metro Explorer Pro
                    </h3>
                    <span className="px-2.5 py-1 rounded-full bg-blue-500 text-white text-xs font-bold">
                      Khuyên dùng
                    </span>
                  </div>
                  <p className="text-xs text-blue-200 mb-6">
                    Mở khóa toàn bộ sức mạnh AI, bản đồ offline và ưu đãi ẩm
                    thực.
                  </p>
                  <div className="mb-6 pb-6 border-b border-white/10 flex items-baseline gap-2">
                    <span className="text-4xl font-black text-white">
                      49.000đ
                    </span>
                    <span className="text-xs text-blue-300">
                      / tháng (hoặc 19k/ngày du lịch)
                    </span>
                  </div>
                  <ul className="space-y-3.5 text-xs sm:text-sm text-slate-200">
                    {PRO_FEATURES.map((feature) => (
                      <li key={feature} className="flex items-center gap-2.5">
                        <span
                          className="material-symbols-outlined text-[18px] text-emerald-400 flex-shrink-0"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          check_circle
                        </span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mt-8">
                  <button
                    onClick={() => navigate("/login")}
                    className="w-full block text-center py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm shadow-[0_0_25px_-5px_rgba(37,99,235,0.4)] transition-all"
                  >
                    Nâng cấp Pro ngay →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-20 bg-white" id="cong-dong">
          <div className="max-w-7xl 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-bold uppercase tracking-wider">
                Đánh giá từ cộng đồng
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-on-surface tracking-tight mt-3">
                Người Sài Gòn &amp; Khách du lịch nói gì?
              </h2>
              <p className="text-on-surface-variant mt-2 text-sm sm:text-base">
                Cảm nhận thực tế từ những người đã dùng LocalMate AI để dạo chơi
                tuyến Metro 1 Bến Thành - Suối Tiên.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {TESTIMONIALS.map((t) => (
                <div
                  key={t.name}
                  className="p-6 rounded-2xl bg-slate-50 border border-outline-variant/40"
                >
                  <div className="flex items-center gap-1 text-amber-400 mb-3">
                    ★★★★★
                  </div>
                  <p className="text-slate-700 text-xs sm:text-sm leading-relaxed italic">
                    "{t.quote}"
                  </p>
                  <div className="mt-4 pt-4 border-t border-outline-variant/30 flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-full font-bold text-xs flex items-center justify-center ${t.initialsColor}`}
                    >
                      {t.initials}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-on-surface">
                        {t.name}
                      </h4>
                      <p className="text-[11px] text-on-surface-variant">
                        {t.role}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
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
                Trạm dừng hot
              </h4>
              <ul className="space-y-2">
                <li>
                  <a
                    className="hover:text-white transition-colors"
                    href="#14-ga-metro"
                  >
                    Ga Bến Thành (Quận 1)
                  </a>
                </li>
                <li>
                  <a
                    className="hover:text-white transition-colors"
                    href="#14-ga-metro"
                  >
                    Ga Ba Son (Bờ Sông)
                  </a>
                </li>
                <li>
                  <a
                    className="hover:text-white transition-colors"
                    href="#14-ga-metro"
                  >
                    Ga Thảo Điền (Khu Tây)
                  </a>
                </li>
                <li>
                  <a
                    className="hover:text-white transition-colors"
                    href="#14-ga-metro"
                  >
                    Ga Landmark Tân Cảng
                  </a>
                </li>
                <li>
                  <a
                    className="hover:text-white transition-colors"
                    href="#14-ga-metro"
                  >
                    Ga Khu Công Nghệ Cao
                  </a>
                </li>
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
                    href="#tinh-nang"
                  >
                    Định vị cửa ra (Exit Guide)
                  </a>
                </li>
                <li>
                  <a
                    className="hover:text-white transition-colors"
                    href="#bang-gia"
                  >
                    Chế độ Offline dưới hầm
                  </a>
                </li>
                <li>
                  <a
                    className="hover:text-white transition-colors"
                    href="#bang-gia"
                  >
                    Voucher ưu đãi quán cafe
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
