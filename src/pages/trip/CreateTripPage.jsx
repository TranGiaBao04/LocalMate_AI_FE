import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTrip } from "../../context/TripContext";
import {
  INTERESTS,
  TRAVEL_STYLES,
  DURATION_OPTIONS,
  TIME_OF_DAY_OPTIONS,
  BUDGET_OPTIONS,
  PEOPLE_OPTIONS,
  AREAS,
} from "../../constants";

const STEPS = ["Vị trí", "Thời gian", "Sở thích", "Phong cách"];

export default function CreateTripPage() {
  const navigate = useNavigate();
  const { setRequest, generateTrip, setCurrentTrip } = useTrip();
  const [step, setStep] = useState(0);

  const [startArea, setStartArea] = useState("Tân Bình");
  const [metroFriendly, setMetroFriendly] = useState(true);
  const [durationHours, setDurationHours] = useState(4);
  const [timeOfDay, setTimeOfDay] = useState("afternoon");
  const [budgetPerPerson, setBudgetPerPerson] = useState(300000);
  const [peopleCount, setPeopleCount] = useState(2);
  const [interests, setInterests] = useState(["cafe", "check-in"]);
  const [travelStyles, setTravelStyles] = useState(["chill"]);

  const toggleInterest = (id) =>
    setInterests((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );

  const toggleStyle = (id) =>
    setTravelStyles((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );

  const handleGenerate = async () => {
    const req = {
      startArea,
      durationHours,
      timeOfDay,
      budgetPerPerson,
      peopleCount,
      interests,
      travelStyles,
      metroFriendly,
    };

    setRequest(req);
    navigate("/loading");
    const trip = await generateTrip(req);
    setCurrentTrip(trip);
    navigate("/draft");
  };

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="app-shell flex flex-col">
      <header className="app-header flex h-16 items-center gap-3 border-b border-outline-variant/20 px-container-margin py-stack-sm lg:px-8">
        <button
          onClick={() => (step > 0 ? setStep((s) => s - 1) : navigate(-1))}
          className="w-9 h-9 rounded-full hover:bg-surface-container-high flex items-center justify-center transition-colors"
        >
          <span className="material-symbols-outlined text-on-surface-variant">
            arrow_back
          </span>
        </button>

        <div className="flex-1">
          <div className="flex justify-between items-center mb-1">
            <span className="text-label-md text-primary uppercase tracking-widest">
              Bước {step + 1}/{STEPS.length}
            </span>
            <span className="text-label-md text-outline">{STEPS[step]}</span>
          </div>
          <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </header>

      <main className="content-shell flex-1 px-container-margin pb-28 pt-20 lg:px-8 lg:pb-32">
        {step === 0 && (
          <div className="space-y-stack-lg">
            <h2 className="text-headline-lg-mobile font-bold text-on-surface mt-stack-lg">
              Bạn đang ở đâu?
            </h2>

            <div className="space-y-stack-sm">
              <label className="text-label-md text-on-surface-variant">
                Khu vực xuất phát
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">
                  location_on
                </span>
                <input
                  value={startArea}
                  onChange={(e) => setStartArea(e.target.value)}
                  placeholder="Nhập khu vực..."
                  className="input-field pl-12"
                />
              </div>
            </div>

            <div className="space-y-stack-sm">
              <label className="text-label-md text-on-surface-variant">
                Gợi ý nhanh
              </label>
              <div className="flex flex-wrap gap-2">
                {AREAS.map((area) => (
                  <button
                    key={area}
                    onClick={() => setStartArea(area)}
                    className={`px-4 py-2 rounded-full text-body-md transition-all active:scale-95 ${
                      startArea === area
                        ? "bg-primary text-on-primary"
                        : "border border-outline-variant text-on-surface-variant hover:border-primary"
                    }`}
                  >
                    {area}
                  </button>
                ))}
              </div>
            </div>

            <div
              onClick={() => setMetroFriendly(!metroFriendly)}
              className={`flex items-center justify-between p-stack-md rounded-lg border-2 cursor-pointer transition-all ${
                metroFriendly
                  ? "border-primary bg-primary-container/10"
                  : "border-outline-variant bg-surface-container-lowest"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary">
                  train
                </span>
                <div>
                  <p className="text-body-md font-semibold text-on-surface">
                    Ưu tiên Metro-friendly
                  </p>
                  <p className="text-label-md text-on-surface-variant">
                    Địa điểm gần trục Metro số 1
                  </p>
                </div>
              </div>

              <div
                className={`w-12 h-6 rounded-full transition-all flex items-center px-1 ${metroFriendly ? "bg-primary justify-end" : "bg-surface-container-highest justify-start"}`}
              >
                <div className="w-4 h-4 rounded-full bg-white shadow" />
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-stack-lg">
            <h2 className="text-headline-lg-mobile font-bold text-on-surface mt-stack-lg">
              Bạn có bao nhiêu thời gian?
            </h2>

            <section>
              <h3 className="text-title-md font-semibold mb-stack-md flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">
                  schedule
                </span>
                Thời lượng
              </h3>
              <div className="grid grid-cols-2 gap-gutter lg:grid-cols-4">
                {DURATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setDurationHours(opt.value)}
                    className={`relative p-stack-md rounded-lg border-2 transition-all active:scale-95 ${
                      durationHours === opt.value
                        ? "border-primary bg-primary-container/10"
                        : "border-surface-container-highest bg-white hover:border-primary-container"
                    }`}
                  >
                    <span
                      className={`font-semibold text-button ${durationHours === opt.value ? "text-primary" : "text-on-surface-variant"}`}
                    >
                      {opt.label}
                    </span>
                    {durationHours === opt.value && (
                      <span
                        className="material-symbols-outlined absolute -top-2 -right-2 bg-primary text-white rounded-full text-[14px] p-0.5"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        check
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-title-md font-semibold mb-stack-md flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">
                  wb_twilight
                </span>
                Thời điểm
              </h3>
              <div className="flex flex-wrap gap-stack-sm">
                {TIME_OF_DAY_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setTimeOfDay(opt.id)}
                    className={`px-6 py-2 rounded-full font-semibold text-button active:scale-95 transition-all ${
                      timeOfDay === opt.id
                        ? "bg-primary text-on-primary shadow-md shadow-primary/20"
                        : "border border-outline-variant text-on-surface-variant"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-title-md font-semibold mb-stack-md flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">
                  payments
                </span>
                Ngân sách mỗi người
              </h3>
              <div className="grid gap-stack-sm lg:grid-cols-3">
                {BUDGET_OPTIONS.map((opt) => (
                  <div
                    key={opt.id}
                    onClick={() => setBudgetPerPerson(opt.value)}
                    className={`p-stack-md rounded-lg border-2 flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all ${
                      budgetPerPerson === opt.value
                        ? "border-primary bg-primary-container/5"
                        : "border-surface-container-highest bg-white"
                    }`}
                  >
                    <span
                      className={`font-semibold text-button ${budgetPerPerson === opt.value ? "text-primary" : "text-on-surface-variant"}`}
                    >
                      {opt.label}
                    </span>
                    <div
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${budgetPerPerson === opt.value ? "border-primary bg-primary" : "border-outline-variant"}`}
                    >
                      {budgetPerPerson === opt.value && (
                        <span
                          className="material-symbols-outlined text-white text-[14px]"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          done
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-title-md font-semibold mb-stack-md flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">
                  groups
                </span>
                Số người
              </h3>
              <div className="flex flex-wrap gap-stack-sm">
                {PEOPLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setPeopleCount(opt.value)}
                    className={`px-6 py-2 rounded-full font-semibold text-button active:scale-95 transition-all ${
                      peopleCount === opt.value
                        ? "bg-primary text-on-primary shadow-md shadow-primary/20"
                        : "border border-outline-variant text-on-surface-variant"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-stack-lg">
            <div className="mt-stack-lg">
              <h2 className="text-headline-lg-mobile font-bold text-on-surface">
                Bạn thích gì?
              </h2>
              <p className="text-body-md text-on-surface-variant mt-1">
                Chọn một hoặc nhiều sở thích
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {INTERESTS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => toggleInterest(item.id)}
                  className={`px-4 py-2 rounded-full flex items-center gap-1.5 transition-all active:scale-95 text-body-md ${
                    interests.includes(item.id)
                      ? "bg-primary text-on-primary shadow-md"
                      : "bg-primary-container/10 border border-primary-container/20 text-on-primary-container hover:bg-primary-container/20"
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {item.icon}
                  </span>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-stack-lg">
            <div className="mt-stack-lg">
              <h2 className="text-headline-lg-mobile font-bold text-on-surface">
                Phong cách chuyến đi?
              </h2>
              <p className="text-body-md text-on-surface-variant mt-1">
                Có thể chọn nhiều phong cách
              </p>
            </div>

            <div className="grid grid-cols-2 gap-gutter lg:grid-cols-4">
              {TRAVEL_STYLES.map((style) => (
                <button
                  key={style.id}
                  onClick={() => toggleStyle(style.id)}
                  className={`p-stack-md rounded-lg border-2 flex flex-col items-start gap-1 transition-all active:scale-95 ${
                    travelStyles.includes(style.id)
                      ? "border-primary bg-primary-container/10"
                      : "border-surface-container-highest bg-white hover:border-primary-container"
                  }`}
                >
                  <span
                    className={`material-symbols-outlined ${travelStyles.includes(style.id) ? "text-primary" : "text-outline"}`}
                  >
                    {style.icon}
                  </span>
                  <span
                    className={`font-semibold text-body-md ${travelStyles.includes(style.id) ? "text-primary" : "text-on-surface"}`}
                  >
                    {style.label}
                  </span>
                  <span className="text-label-md text-on-surface-variant">
                    {style.desc}
                  </span>
                </button>
              ))}
            </div>

            <div className="card space-y-2">
              <p className="text-label-md text-on-surface-variant uppercase tracking-wider">
                Tóm tắt
              </p>
              <div className="space-y-1 text-body-md text-on-surface">
                <p>
                  📍 {startArea} {metroFriendly && "· Metro-friendly"}
                </p>
                <p>
                  ⏱{" "}
                  {
                    DURATION_OPTIONS.find((d) => d.value === durationHours)
                      ?.label
                  }
                </p>
                <p>
                  💰{" "}
                  {
                    BUDGET_OPTIONS.find((b) => b.value === budgetPerPerson)
                      ?.label
                  }
                </p>
                <p>
                  👥{" "}
                  {PEOPLE_OPTIONS.find((p) => p.value === peopleCount)?.label}
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      <nav className="app-footer flex items-center justify-between border-t border-outline-variant/30 px-container-margin py-stack-md shadow-lg lg:px-8">
        {step > 0 ? (
          <button
            onClick={() => setStep((s) => s - 1)}
            className="flex items-center text-primary border border-primary rounded-full px-8 py-3 font-semibold text-button active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined mr-2">chevron_left</span>
            Quay lại
          </button>
        ) : (
          <div />
        )}

        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            className="flex items-center bg-primary text-on-primary rounded-full px-8 py-3 font-semibold text-button active:scale-95 transition-all shadow-lg shadow-primary/30"
          >
            Tiếp tục
            <span className="material-symbols-outlined ml-2">
              chevron_right
            </span>
          </button>
        ) : (
          <button
            onClick={handleGenerate}
            className="flex items-center bg-primary text-on-primary rounded-full px-8 py-3 font-semibold text-button active:scale-95 transition-all shadow-lg shadow-primary/30"
          >
            Tạo lịch trình
            <span className="material-symbols-outlined ml-2">auto_awesome</span>
          </button>
        )}
      </nav>
    </div>
  );
}
