import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTrip } from "../../context/TripContext";
import { tagService } from "../../services/tagService";
import { masterDataService } from "../../services/masterDataService";
import { tripService, toTripRequestDto } from "../../services/tripService";
import { formatDistance } from "../../utils/formatCurrency";
import {
  DURATION_OPTIONS,
  TIME_OF_DAY_OPTIONS,
  BUDGET_OPTIONS,
  PEOPLE_OPTIONS,
} from "../../constants";

const STEPS = ["Vị trí", "Thời gian", "Sở thích", "Phong cách"];
const GEOLOCATION_TIMEOUT_MS = 10000;

const FEASIBILITY_MESSAGES = {
  OutOfServiceArea: "Vị trí xuất phát quá xa tuyến Metro số 1.",
  InsufficientCandidates:
    "Chưa đủ địa điểm quanh ga này. Hãy thử tăng thời lượng hoặc bỏ bớt sở thích.",
};

export default function CreateTripPage() {
  const navigate = useNavigate();
  const { request, setRequest, generateTrip, setCurrentTrip } = useTrip();
  const [step, setStep] = useState(0);
  const stepHeadingRef = useRef(null);
  const previousStepRef = useRef(step);

  const [startArea, setStartArea] = useState(() => request?.startArea ?? "");
  const [selectedStationId, setSelectedStationId] = useState(
    () => request?.startStationId ?? null,
  );
  const [startCoords, setStartCoords] = useState(() =>
    request?.startLatitude != null
      ? { latitude: request.startLatitude, longitude: request.startLongitude }
      : null,
  );
  const [stations, setStations] = useState([]);
  const [locating, setLocating] = useState(false);
  const [feasibility, setFeasibility] = useState(null);
  const [feasibilityError, setFeasibilityError] = useState("");
  const [checking, setChecking] = useState(false);
  const [metroFriendly, setMetroFriendly] = useState(() => request?.metroFriendly ?? true);
  const [startAreaError, setStartAreaError] = useState("");
  const [durationHours, setDurationHours] = useState(4);
  const [timeOfDay, setTimeOfDay] = useState("afternoon");
  const [budgetPerPerson, setBudgetPerPerson] = useState(300000);
  const [peopleCount, setPeopleCount] = useState(2);
  const [tags, setTags] = useState([]);
  const [interests, setInterests] = useState([]);
  const [travelStyles, setTravelStyles] = useState([]);

  useEffect(() => {
    tagService.getTags().then(setTags).catch(() => setTags([]));
  }, []);

  useEffect(() => {
    masterDataService
      .getMasterData()
      .then((data) =>
        setStations([...data.metroStations].sort((a, b) => a.order - b.order)),
      )
      .catch(() => setStations([]));
  }, []);

  useEffect(() => {
    if (previousStepRef.current === step) return;
    previousStepRef.current = step;
    window.scrollTo(0, 0);
    stepHeadingRef.current?.focus({ preventScroll: true });
  }, [step]);

  const interestTags = tags.filter((t) => t.type === "Interest");
  const styleTags = tags.filter((t) => t.type === "TravelStyle");
  const canContinue = step !== 2 || interests.length > 0;

  const toggleInterest = (id) =>
    setInterests((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );

  const toggleStyle = (id) =>
    setTravelStyles((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setStartAreaError("Trình duyệt không hỗ trợ định vị. Hãy chọn một ga bên dưới.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setStartCoords({ latitude: coords.latitude, longitude: coords.longitude });
        setStartArea("Vị trí hiện tại");
        setSelectedStationId(null);
        setStartAreaError("");
        setLocating(false);
      },
      () => {
        setStartAreaError(
          "Không lấy được vị trí. Hãy cho phép truy cập vị trí hoặc chọn một ga bên dưới.",
        );
        setLocating(false);
      },
      { timeout: GEOLOCATION_TIMEOUT_MS },
    );
  };

  const handlePickStation = (station) => {
    setStartCoords({ latitude: station.latitude, longitude: station.longitude });
    setStartArea(station.name);
    setSelectedStationId(station.id);
    setStartAreaError("");
  };

  const checkFeasibility = async () => {
    setFeasibilityError("");
    setFeasibility(null);
    setChecking(true);
    const budget = BUDGET_OPTIONS.find((b) => b.value === budgetPerPerson);
    try {
      const result = await tripService.checkFeasibility(
        toTripRequestDto({
          startLatitude: startCoords.latitude,
          startLongitude: startCoords.longitude,
          durationHours,
          budgetMinPerPerson: budget?.min ?? 0,
          budgetMaxPerPerson: budgetPerPerson,
          peopleCount,
          tagIds: [...interests, ...travelStyles],
        }),
      );
      setFeasibility(result);
      if (!result.isFeasible) {
        setFeasibilityError(
          FEASIBILITY_MESSAGES[result.reason] ??
            "Yêu cầu hiện chưa khả thi, hãy thử điều chỉnh.",
        );
        return false;
      }
      return true;
    } catch (err) {
      setFeasibilityError(err.message);
      return false;
    } finally {
      setChecking(false);
    }
  };

  const handleNextStep = async () => {
    if (step === 0) {
      if (!startCoords) {
        setStartAreaError("Vui lòng dùng vị trí hiện tại hoặc chọn một ga Metro.");
        return;
      }
      setStartAreaError("");
      setRequest({
        ...(request || {}),
        startArea,
        startStationId: selectedStationId,
        startLatitude: startCoords.latitude,
        startLongitude: startCoords.longitude,
        metroFriendly,
      });
    }
    if (step === 2) {
      if (interests.length === 0) return;
      if (!(await checkFeasibility())) return;
    }
    setStep((s) => s + 1);
  };

  const handleGenerate = async () => {
    const trimmed = startArea.trim();
    const req = {
      ...(request || {}),
      startArea: trimmed || startArea,
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
    try {
      const trip = await generateTrip(req);
      setCurrentTrip(trip);
      navigate("/draft");
    } catch {
      navigate("/create");
    }
  };

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="app-shell flex flex-col">
      <header className="app-header flex h-16 items-center gap-3 border-b border-outline-variant/20 px-container-margin py-stack-sm lg:px-8">
        <button
          type="button"
          aria-label={step > 0 ? "Quay lại bước trước" : "Thoát tạo lịch trình"}
          onClick={() => (step > 0 ? setStep((s) => s - 1) : navigate(-1))}
          className="w-11 h-11 rounded-full hover:bg-surface-container-high flex items-center justify-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
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
          <div role="progressbar" aria-label="Tiến độ tạo lịch trình" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1} className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
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
            <h2 ref={stepHeadingRef} tabIndex={-1} className="text-headline-lg-mobile font-bold text-on-surface mt-stack-lg focus:outline-none">
              Bạn đang ở đâu?
            </h2>

            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={locating}
              className="w-full flex items-center justify-center gap-2 rounded-full border border-primary px-6 py-3 font-semibold text-primary active:scale-95 transition-all disabled:opacity-60"
            >
              <span className="material-symbols-outlined">my_location</span>
              {locating ? "Đang định vị..." : "Dùng vị trí hiện tại"}
            </button>

            <div className="space-y-stack-sm">
              <label className="text-label-md text-on-surface-variant font-medium">
                Hoặc chọn ga Metro gần bạn
              </label>
              <div role="group" aria-label="Chọn ga Metro gần bạn" aria-describedby={startAreaError ? "start-area-error" : undefined} className="flex flex-wrap gap-2">
                {stations.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={selectedStationId === s.id}
                    onClick={() => handlePickStation(s)}
                    className={`min-h-11 px-4 py-2 rounded-full text-body-md transition-all active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                      selectedStationId === s.id
                        ? "bg-primary text-on-primary shadow-sm"
                        : "border border-outline-variant text-on-surface-variant hover:border-primary"
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
              {startAreaError && (
                <p
                  id="start-area-error"
                  role="alert"
                  className="text-label-md text-error flex items-center gap-1 mt-1 font-medium"
                >
                  <span className="material-symbols-outlined text-[16px]">error</span>
                  {startAreaError}
                </p>
              )}
              {startCoords && (
                <p className="text-label-md text-on-surface-variant">
                  📍 Xuất phát: {startArea}
                </p>
              )}
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={metroFriendly}
              aria-label="Ưu tiên Metro-friendly: Địa điểm gần trục Metro số 1"
              onClick={() => setMetroFriendly((prev) => !prev)}
              className={`w-full text-left flex items-center justify-between p-stack-md rounded-lg border-2 cursor-pointer transition-all ${
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
                className={`w-12 h-6 rounded-full transition-all flex items-center px-1 ${
                  metroFriendly ? "bg-primary justify-end" : "bg-surface-container-highest justify-start"
                }`}
                aria-hidden="true"
              >
                <div className="w-4 h-4 rounded-full bg-white shadow" />
              </div>
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-stack-lg">
            <h2 ref={stepHeadingRef} tabIndex={-1} className="text-headline-lg-mobile font-bold text-on-surface mt-stack-lg focus:outline-none">
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
                    type="button"
                    aria-pressed={durationHours === opt.value}
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
                    type="button"
                    aria-pressed={timeOfDay === opt.id}
                    onClick={() => setTimeOfDay(opt.id)}
                    className={`min-h-11 px-6 py-2 rounded-full font-semibold text-button active:scale-95 transition-all ${
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
                  <button
                    key={opt.id}
                    type="button"
                    aria-pressed={budgetPerPerson === opt.value}
                    onClick={() => setBudgetPerPerson(opt.value)}
                    className={`w-full p-stack-md rounded-lg border-2 flex items-center justify-between text-left active:scale-[0.98] transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
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
                  </button>
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
                    type="button"
                    aria-pressed={peopleCount === opt.value}
                    onClick={() => setPeopleCount(opt.value)}
                    className={`min-h-11 px-6 py-2 rounded-full font-semibold text-button active:scale-95 transition-all ${
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
              <h2 ref={stepHeadingRef} tabIndex={-1} className="text-headline-lg-mobile font-bold text-on-surface focus:outline-none">
                Bạn thích gì?
              </h2>
              <p className="text-body-md text-on-surface-variant mt-1">
                Chọn ít nhất 1 sở thích
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {interestTags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  aria-pressed={interests.includes(tag.id)}
                  onClick={() => toggleInterest(tag.id)}
                  className={`min-h-11 px-4 py-2 rounded-full flex items-center gap-1.5 transition-all active:scale-95 text-body-md ${
                    interests.includes(tag.id)
                      ? "bg-primary text-on-primary shadow-md"
                      : "bg-primary-container/10 border border-primary-container/20 text-on-primary-container hover:bg-primary-container/20"
                  }`}
                >
                  {tag.name}
                </button>
              ))}
            </div>

            {feasibilityError && (
              <p
                role="alert"
                className="text-label-md text-error flex items-center gap-1 font-medium"
              >
                <span className="material-symbols-outlined text-[16px]">error</span>
                {feasibilityError}
              </p>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-stack-lg">
            <div className="mt-stack-lg">
              <h2 ref={stepHeadingRef} tabIndex={-1} className="text-headline-lg-mobile font-bold text-on-surface focus:outline-none">
                Phong cách chuyến đi?
              </h2>
              <p className="text-body-md text-on-surface-variant mt-1">
                Có thể chọn nhiều phong cách
              </p>
            </div>

            <div className="grid grid-cols-2 gap-gutter lg:grid-cols-4">
              {styleTags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  aria-pressed={travelStyles.includes(tag.id)}
                  onClick={() => toggleStyle(tag.id)}
                  className={`p-stack-md rounded-lg border-2 flex flex-col items-start gap-1 transition-all active:scale-95 ${
                    travelStyles.includes(tag.id)
                      ? "border-primary bg-primary-container/10"
                      : "border-surface-container-highest bg-white hover:border-primary-container"
                  }`}
                >
                  <span
                    className={`font-semibold text-body-md ${travelStyles.includes(tag.id) ? "text-primary" : "text-on-surface"}`}
                  >
                    {tag.name}
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
                {feasibility?.nearestStation && (
                  <p>
                    🚇 Ga gần bạn: {feasibility.nearestStation.stationName}, cách{" "}
                    {formatDistance(feasibility.nearestStation.distanceMeters)}
                  </p>
                )}
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

      <nav aria-label="Điều hướng các bước" className="app-footer flex items-center justify-between gap-2 border-t border-outline-variant/30 px-container-margin py-stack-md shadow-lg lg:px-8">
        {step > 0 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            className="flex min-h-12 shrink-0 items-center whitespace-nowrap text-primary border border-primary rounded-full px-4 py-3 font-semibold text-button active:scale-95 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary sm:px-8"
          >
            <span className="material-symbols-outlined mr-2 hidden min-[360px]:inline">chevron_left</span>
            Quay lại
          </button>
        ) : (
          <div />
        )}

        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={handleNextStep}
            disabled={!canContinue || checking}
            className="flex min-h-12 shrink-0 items-center whitespace-nowrap bg-primary text-on-primary rounded-full px-4 py-3 font-semibold text-button active:scale-95 transition-all shadow-lg shadow-primary/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary sm:px-8"
          >
            {checking ? "Đang kiểm tra..." : "Tiếp tục"}
            <span className="material-symbols-outlined ml-2 hidden min-[360px]:inline">
              chevron_right
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleGenerate}
            className="flex min-h-12 shrink-0 items-center whitespace-nowrap bg-primary text-on-primary rounded-full px-4 py-3 font-semibold text-button active:scale-95 transition-all shadow-lg shadow-primary/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary sm:px-8"
          >
            Tạo lịch trình
            <span className="material-symbols-outlined ml-2 hidden min-[360px]:inline">auto_awesome</span>
          </button>
        )}
      </nav>
    </div>
  );
}
