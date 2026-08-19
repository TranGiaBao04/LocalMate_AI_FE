import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTrip } from "../../context/TripContext";
import MobileLayout from "../../components/layout/MobileLayout";
import { INTERESTS } from "../../constants";

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { savedTrips } = useTrip();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const completedTrips = savedTrips.filter(
    (t) => t.status === "completed",
  ).length;
  const favInterests = user?.preferences.favoriteTags ?? [];

  return (
    <MobileLayout>
      <header className="app-header flex h-16 items-center justify-between border-b border-outline-variant/20 px-container-margin py-stack-sm lg:px-8">
        <h1 className="text-headline-lg-mobile font-extrabold text-primary">
          Hồ sơ
        </h1>
        <div className="flex items-center gap-stack-md">
          <button className="material-symbols-outlined text-primary p-2">
            settings
          </button>
          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-primary-container bg-primary-container/20 flex items-center justify-center">
            <span
              className="material-symbols-outlined text-primary"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              person
            </span>
          </div>
        </div>
      </header>

      <main className="content-shell flex flex-col gap-stack-lg px-container-margin pb-28 pt-20 lg:px-8 lg:pb-12">
        <section className="flex flex-col items-center gap-stack-sm py-stack-lg text-center lg:items-start lg:text-left">
          <div className="w-24 h-24 rounded-full bg-primary-container/20 border-4 border-primary-container flex items-center justify-center mb-2">
            <span
              className="material-symbols-outlined text-primary"
              style={{ fontSize: 56, fontVariationSettings: "'FILL' 1" }}
            >
              person
            </span>
          </div>
          <h2 className="text-headline-lg-mobile font-bold text-on-surface">
            {user?.fullName ?? "Demo User"}
          </h2>
          <p className="text-body-md text-on-surface-variant">{user?.email}</p>

          <div className="mt-stack-sm flex flex-wrap justify-center gap-8 lg:justify-start">
            {[
              { label: "Lịch trình", value: savedTrips.length },
              { label: "Đã đi", value: completedTrips },
              {
                label: "Đang lên kế hoạch",
                value: savedTrips.filter((t) => t.status !== "completed")
                  .length,
              },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-headline-lg font-bold text-primary">
                  {stat.value}
                </p>
                <p className="text-label-md text-on-surface-variant">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="card space-y-stack-md">
          <h3 className="text-title-md font-semibold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">
              favorite
            </span>
            Sở thích của bạn
          </h3>
          <div className="flex flex-wrap gap-2">
            {favInterests.length > 0
              ? INTERESTS.filter((i) => favInterests.includes(i.id)).map(
                  (i) => (
                    <span key={i.id} className="chip-active text-label-md">
                      <span className="material-symbols-outlined text-[14px]">
                        {i.icon}
                      </span>
                      {i.label}
                    </span>
                  ),
                )
              : INTERESTS.slice(0, 4).map((i) => (
                  <span key={i.id} className="chip text-label-md">
                    <span className="material-symbols-outlined text-[14px]">
                      {i.icon}
                    </span>
                    {i.label}
                  </span>
                ))}
          </div>
        </section>

        <section className="space-y-stack-md">
          <div className="flex justify-between items-center">
            <h3 className="text-title-md font-semibold text-on-surface">
              Lịch trình gần đây
            </h3>
            <button
              onClick={() => navigate("/trips")}
              className="text-label-md text-primary"
            >
              Xem tất cả
            </button>
          </div>

          {savedTrips.slice(0, 3).map((trip) => (
            <div
              key={trip.id}
              onClick={() => navigate(`/trips/${trip.id}`)}
              className="card flex items-center gap-3 cursor-pointer active:scale-[0.98] transition-transform"
            >
              <div className="w-10 h-10 rounded-DEFAULT bg-primary-container/20 flex items-center justify-center flex-shrink-0">
                <span
                  className="material-symbols-outlined text-primary text-[20px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  map_search
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-body-md font-semibold text-on-surface truncate">
                  {trip.title}
                </p>
                <p className="text-label-md text-on-surface-variant">
                  {trip.durationHours} tiếng · {trip.items.length} địa điểm
                </p>
              </div>
              <span className="material-symbols-outlined text-outline-variant">
                chevron_right
              </span>
            </div>
          ))}
        </section>

        <section className="card divide-y divide-outline-variant/20">
          {[
            { icon: "notifications", label: "Thông báo" },
            { icon: "privacy_tip", label: "Quyền riêng tư" },
            { icon: "help", label: "Trợ giúp" },
            { icon: "info", label: "Về LocalMate AI" },
          ].map((item) => (
            <button
              key={item.label}
              className="w-full flex items-center gap-3 py-stack-md text-left hover:bg-surface-container-low transition-colors px-1"
            >
              <span className="material-symbols-outlined text-on-surface-variant">
                {item.icon}
              </span>
              <span className="flex-1 text-body-md text-on-surface">
                {item.label}
              </span>
              <span className="material-symbols-outlined text-outline-variant">
                chevron_right
              </span>
            </button>
          ))}
        </section>

        <button
          onClick={handleLogout}
          className="w-full py-4 bg-error-container text-on-error-container rounded-full font-semibold text-button active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined">logout</span>
          Đăng xuất
        </button>

        <p className="text-center text-label-md text-on-surface-variant opacity-50">
          LocalMate AI · v0.1.0
        </p>
      </main>
    </MobileLayout>
  );
}
