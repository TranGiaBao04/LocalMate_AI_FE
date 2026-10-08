import { useState, useSyncExternalStore } from "react";

const VIDEO_QUERY = "(min-width: 1024px) and (prefers-reduced-motion: no-preference)";

function subscribe(onChange) {
  if (!window.matchMedia) return () => {};
  const media = window.matchMedia(VIDEO_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function shouldPlayVideo() {
  return window.matchMedia?.(VIDEO_QUERY).matches ?? false;
}

export default function LoginTravelPanel() {
  const playVideo = useSyncExternalStore(subscribe, shouldPlayVideo, () => false);
  const [failed, setFailed] = useState(false);

  return (
    <aside
      aria-label="Khám phá TP.HCM cùng LocalMate"
      className="relative isolate flex min-h-[200px] flex-col justify-between overflow-hidden rounded-[22px] bg-navy-dark p-6 text-white md:min-h-[220px] lg:min-h-[650px] lg:p-10"
    >
      {playVideo && !failed && (
        <video
          src="/landing/hero.mp4"
          autoPlay
          muted
          playsInline
          loop
          preload="metadata"
          aria-hidden="true"
          onError={() => setFailed(true)}
          className="absolute inset-0 -z-20 h-full w-full object-cover"
        />
      )}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-t from-navy-darkest/95 via-navy-dark/35 to-navy-dark/20"
      />
      <div className="flex items-center justify-between gap-3 text-xs font-medium">
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="material-symbols-outlined text-[20px]">train</span>
          TP. HỒ CHÍ MINH
        </span>
        <span className="rounded-md border border-white/30 bg-white/10 px-2.5 py-1.5">
          Metro Line 1
        </span>
      </div>

      <div className="mt-6 lg:mt-36">
        <p className="mb-3 hidden text-sm font-medium text-primary-fixed lg:block">
          Một thành phố. Vô vàn hành trình.
        </p>
        <h2 className="max-w-[390px] text-[24px] font-semibold leading-[1.3] lg:text-[36px]">
          Khám phá thành phố theo nhịp Metro.
        </h2>
        <div aria-hidden="true" className="mt-4 flex items-center gap-3 text-[11px] text-primary-fixed lg:hidden">
          <span>Bến Thành</span>
          <span className="flex flex-1 items-center">
            <span className="h-2 w-2 rounded-full border-2 border-accent" />
            <span className="h-px flex-1 bg-primary-fixed-dim/60" />
            <span className="h-2 w-2 rounded-full border-2 border-primary-fixed-dim" />
          </span>
          <span>Thảo Điền</span>
        </div>
        <p className="mt-4 hidden max-w-[350px] text-sm leading-7 text-white/85 lg:block">
          AI giúp bạn biến vài giờ rảnh thành một hành trình đáng nhớ quanh TP.HCM.
        </p>

        <div aria-hidden="true" className="mt-6 hidden lg:block">
          <div className="relative flex items-center justify-between">
            <div className="absolute inset-x-2 top-1/2 h-0.5 bg-primary-fixed-dim" />
            {["Bến Thành", "Nhà hát TP", "Ba Son", "Thảo Điền"].map((station, index) => (
              <div key={station} className="relative flex w-1/4 flex-col items-center">
                <span className={`h-3 w-3 rounded-full border-[3px] border-white ${index === 0 ? "bg-accent" : "bg-navy-dark"}`} />
                <span className="absolute top-5 whitespace-nowrap text-[10px] text-white/85 lg:text-[11px]">
                  {station}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-14 flex items-center gap-2 text-[11px] text-white/65">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Đi gần hơn. Trải nghiệm nhiều hơn.
          </p>
        </div>
      </div>
    </aside>
  );
}
