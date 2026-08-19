import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import MobileLayout from "../../components/layout/MobileLayout";
import { mockPlaces } from "../../data/places.mock";

const SAMPLE_TRIPS = [
  {
    title: "4 tiếng quanh Bến Thành",
    duration: "Nửa ngày",
    rating: "4.8",
    img: "https://lh3.googleusercontent.com/aida-public/AB6AXuBRtnlYERsiPV2nVuiJ5E6qchPsnkR9-CzQSn1gqSPbZCrB1uPUmF4X2qtzE4YWyOxu2LZlzwBYzK6206YSS2Mgr6ZAn7cEqoIH7GuxUIjpToX_UpRce_3VPmNI7VU1zGz03c3Exk6ISc0jk3bDGSBZAOSDnR-HUDuwvD4arivYthybueGcU2hObmXpDpF8yycN8JBqutWBQ1KDJHKCGYzPt0J2s5zXmT3jRa4F84e8vKOvrcC_yApEUlPr8cNVMOCORBa4f-uO6qU",
  },
  {
    title: "Buổi chiều chill ở Ba Son",
    duration: "3 tiếng",
    rating: "4.9",
    img: "https://lh3.googleusercontent.com/aida-public/AB6AXuDf8BnaVP76QrdhJLUGlVNke5-kl-JLRCIRy0-Bg1scdqQJ_2ySBqXQfV9F9eXmaEcWzV4f7zrDHO3HJuc7bn5TjWhwL4C5bl7srd6tAia3zgL4bpj3QLRkDEnijCibhsPFbMjpPGsfbjSSHKr_sV1-4sn93BnG34K_8WsqiMB1eU_IjOpnZb74TrkMNLw3Jj9iOO17Mrb9z7lCqHq0K3BYgk7MnchHGKslN2Cj3JH6dHcWmvcwzV-xWGf5uJX89-PXOmt1YWzx9-M",
  },
  {
    title: "Cafe hopping Thảo Điền",
    duration: "Cả ngày",
    rating: "4.7",
    img: "https://lh3.googleusercontent.com/aida-public/AB6AXuDgrl-MvipTyXzb60TI0FBmC7xzLfTd76N8084KY7keCFzG65bUejESI19XphoDGljAorgItl36rFC9IYGPXU_ROpXvvHgPhQMPvjX3Zw-n0QOtmc9Q8UChAx8kR5lsfhK6JX8ZPWRF0zwtCk-iwSxPkfI1d_egl4AW0FsJG5zmzWmixocX6S8MZWgrfToWP0II1id1t6Z0621CJ_VNFl5KSwpJvdbqefk-msTJ1aXmisA2vYFDgcTScSeXB1jEnjKpicHhoAfPKF8",
  },
];

const NEARBY_PLACE_IDS = ["place-001", "place-003", "place-004", "place-013"];
const NEARBY = NEARBY_PLACE_IDS.map((id) =>
  mockPlaces.find((place) => place.id === id),
).filter(Boolean);

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <MobileLayout>
      <header className="app-header flex h-16 items-center justify-between border-b border-outline-variant/10 px-container-margin py-stack-sm lg:px-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-surface-container-high border-2 border-primary-container/20 flex items-center justify-center">
            <span
              className="material-symbols-outlined text-primary"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              person
            </span>
          </div>
          <h1 className="text-headline-lg-mobile font-bold text-primary">
            LocalMate AI
          </h1>
        </div>
        <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-high transition-colors text-primary active:scale-95">
          <span className="material-symbols-outlined">notifications</span>
        </button>
      </header>

      <main className="content-shell flex-1 space-y-stack-lg px-container-margin pb-28 pt-20 lg:px-8 lg:pb-12">
        <section>
          <h2 className="text-headline-lg-mobile font-bold text-on-surface">
            Xin chào, {user?.fullName?.split(" ").pop()} 👋
          </h2>
          <p className="text-body-lg text-on-surface-variant opacity-80">
            Hôm nay bạn muốn khám phá đâu?
          </p>
        </section>

        <section
          onClick={() => navigate("/create")}
          className="relative overflow-hidden rounded-lg soft-shadow active:scale-[0.98] transition-transform duration-300 cursor-pointer"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary-container opacity-90 z-0" />
          <div className="relative z-10 p-stack-lg flex flex-col gap-stack-md text-on-primary">
            <div className="space-y-stack-sm">
              <h3 className="text-headline-lg font-bold leading-tight">
                Tạo lịch trình mới
              </h3>
              <p className="text-body-md opacity-90 max-w-[80%]">
                Chọn vị trí, thời gian, ngân sách và sở thích để AI thiết kế
                chuyến đi riêng.
              </p>
            </div>
            <button className="w-fit bg-surface-container-lowest text-primary px-8 py-3 rounded-full font-semibold text-button flex items-center gap-2 shadow-lg">
              Bắt đầu
              <span className="material-symbols-outlined text-[20px]">
                auto_awesome
              </span>
            </button>
          </div>
        </section>

        <section className="space-y-stack-md">
          <div className="flex justify-between items-end">
            <h3 className="text-title-md font-semibold text-on-surface">
              Trải nghiệm Metro-friendly
            </h3>
            <button className="text-label-md text-primary">Xem tất cả</button>
          </div>
          <div className="-mx-container-margin flex gap-stack-md overflow-x-auto px-container-margin pb-1 hide-scrollbar md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 lg:grid-cols-3">
            {SAMPLE_TRIPS.map((trip) => (
              <div
                key={trip.title}
                onClick={() => navigate("/create")}
                className="min-w-[260px] cursor-pointer overflow-hidden rounded-lg bg-surface-container-lowest soft-shadow transition-transform active:scale-[0.98] md:min-w-0"
              >
                <div className="h-32 bg-surface-variant relative">
                  <img
                    src={trip.img}
                    alt={trip.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 right-2 bg-black/30 backdrop-blur-md text-white text-[10px] px-2 py-1 rounded-full font-bold">
                    {trip.rating} ★
                  </div>
                </div>
                <div className="p-stack-md">
                  <h4 className="text-title-md font-semibold text-on-surface mb-1">
                    {trip.title}
                  </h4>
                  <div className="flex items-center gap-2 text-on-surface-variant opacity-70">
                    <span className="material-symbols-outlined text-[16px]">
                      schedule
                    </span>
                    <span className="text-label-md">{trip.duration}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-stack-md">
          <div className="flex justify-between items-end">
            <h3 className="text-title-md font-semibold text-on-surface">
              Gợi ý gần tuyến Metro số 1
            </h3>
            <button
              onClick={() => navigate("/create")}
              className="text-label-md text-primary"
            >
              Khám phá
            </button>
          </div>
          <div className="grid grid-cols-2 gap-stack-md lg:grid-cols-4">
            {NEARBY.map((place) => (
              <div
                key={place.id}
                onClick={() => navigate(`/place/${place.id}`)}
                className="bg-surface-container-lowest p-stack-sm rounded-lg soft-shadow space-y-stack-sm active:scale-[0.98] transition-transform cursor-pointer"
              >
                <div className="aspect-square rounded-[18px] overflow-hidden bg-surface-container-high flex items-center justify-center">
                  <img
                    src={place.imageUrl}
                    alt={place.name}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="px-1">
                  <h5 className="text-label-md text-on-surface font-bold truncate">
                    {place.name}
                  </h5>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {["Gần metro", place.category].map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 bg-primary-container/10 text-primary-container text-[9px] rounded-full font-bold uppercase"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <button
        onClick={() => navigate("/create")}
        className="fixed bottom-24 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-on-primary shadow-2xl transition-transform duration-300 active:scale-90 lg:hidden"
      >
        <span className="material-symbols-outlined text-[28px]">add</span>
      </button>
    </MobileLayout>
  );
}
