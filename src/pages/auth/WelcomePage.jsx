import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useEffect } from "react";

export default function WelcomePage() {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();

  useEffect(() => {
    if (isLoggedIn) navigate("/home");
  }, [isLoggedIn, navigate]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center overflow-x-hidden bg-background">
      <header className="mt-stack-md flex w-full justify-center py-stack-lg">
        <h1 className="text-headline-lg-mobile font-extrabold text-primary tracking-tight">
          LocalMate AI
        </h1>
      </header>

      <main className="flex w-full flex-1 flex-col items-center px-container-margin pb-10 lg:px-8">
        {/* Hero */}
        <div className="relative flex aspect-square w-full max-w-xl items-center justify-center animate-float">
          <img
            alt="LocalMate AI Hero Illustration"
            className="w-full h-full object-contain drop-shadow-xl relative z-10"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuB2200rytt0JPbpv_lneEkT84zChmfZmKwl_72tnc3sjV_N2n92nCDtTHMm56YX6Rs1lbGTMOK2vBCqy7ghwRnaZOQwMOWjRtZMkgWl7KBFZgApJZu7dEqnLYXUQDaNR3PXNPVWjQmHcmIwu6n9fywkUUwYr9JlVtiP4KD4gu01vu1d9bO6O2bPmyGaKRXWkCrZ03YfmJo3sSyY9-uoll9atxz-TycD0hNilT6PCOsYuDaSDSpWS5F_O-k8aw5wsva4TeKLM_r9cao"
          />
          <div className="absolute -z-10 w-64 h-64 bg-primary-container/20 rounded-full blur-3xl opacity-50" />
        </div>

        {/* Content */}
        <section className="mt-stack-lg max-w-2xl space-y-stack-sm text-center">
          <h2 className="text-headline-xl font-bold text-on-surface leading-tight px-2">
            Khám phá TP.HCM theo cách của bạn
          </h2>
          <p className="mx-auto max-w-[90%] text-body-md text-on-surface-variant">
            Tạo lịch trình cá nhân hóa theo vị trí, thời gian, ngân sách và sở
            thích.
          </p>
        </section>

        {/* Feature chips */}
        <section className="mt-stack-lg flex flex-wrap justify-center gap-gutter">
          {[
            { icon: "auto_awesome", label: "AI Planner" },
            { icon: "train", label: "Metro-friendly" },
            { icon: "explore", label: "Local experiences" },
          ].map((chip) => (
            <div
              key={chip.label}
              className="px-4 py-2 bg-primary-container/10 border border-primary-container/20 rounded-full flex items-center gap-1.5 hover:scale-105 transition-transform"
            >
              <span className="material-symbols-outlined text-[18px] text-primary">
                {chip.icon}
              </span>
              <span className="text-label-md text-on-primary-container">
                {chip.label}
              </span>
            </div>
          ))}
        </section>

        {/* CTAs */}
        <section className="mb-12 mt-stack-lg flex w-full max-w-md flex-col gap-4">
          <button onClick={() => navigate("/login")} className="btn-primary">
            Đăng nhập để bắt đầu
          </button>
          <div className="text-center mt-2">
            <button
              onClick={() => navigate("/login")}
              className="text-label-md text-on-surface-variant hover:text-primary transition-colors"
            >
              Đã có tài khoản?{" "}
              <span className="font-bold text-primary">Đăng nhập</span>
            </button>
          </div>
        </section>
      </main>

      {/* Ambient */}
      <div className="fixed -bottom-20 -left-20 w-64 h-64 bg-secondary-container/10 rounded-full blur-[80px] pointer-events-none" />
    </div>
  );
}
