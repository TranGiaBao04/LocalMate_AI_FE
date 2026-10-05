import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTrip } from "../../context/TripContext";
import { tagService } from "../../services/tagService";
import { masterDataService } from "../../services/masterDataService";
import { placeService } from "../../services/placeService";
import { tripService, toTripRequestDto } from "../../services/tripService";
import TripRequestAssistant from "../../components/trip/TripRequestAssistant";
// Đồng hồ cập nhật định kỳ để chip buổi/thời lượng tự khoá khi đã qua giờ
import { useClock } from "../../hooks/useClock";
import { formatCurrency, formatDistance } from "../../utils/formatCurrency";
import { formatVnDateTime } from "../../utils/subscriptionUtils";
import {
  DAY_MINUTES,
  addDays,
  formatPlannedDate,
  minutesNowInVietnam,
  minutesToTime,
  roundUpMinutes,
  timeToMinutes,
  todayInVietnam,
} from "../../utils/vnTime";
import {
  DURATION_OPTIONS,
  BUDGET_OPTIONS,
  PEOPLE_OPTIONS,
} from "../../constants";

const STEPS = ["Vị trí", "Thời gian", "Sở thích", "Phong cách"];
const GEOLOCATION_TIMEOUT_MS = 10000;
const CLOCK_TICK_MS = 30000;
const START_TIME_STEP_MINUTES = 15;
const MAX_DAYS_AHEAD = 90;
const DEFAULT_START_MINUTES = 8 * 60;
const DEFAULT_TRIP_LIMITS = { minDurationHours: 1, maxDurationHours: 24 };
const NOTE_MAX_LENGTH = 300; // khớp TripNoteRules của BE

// Buổi kết thúc khi buổi sau bắt đầu (buổi cuối tới 24:00). Với hôm nay, giờ bắt đầu thực tế là
// max(giờ của buổi, giờ hiện tại làm tròn); buổi bị khoá khi đã qua hoặc không còn đủ thời lượng tối thiểu.
function buildTimeSlots(timeSlots, { isToday, nowMinutes, limits }) {
  const earliest = isToday ? roundUpMinutes(nowMinutes, START_TIME_STEP_MINUTES) : 0;
  const sorted = [...timeSlots].sort(
    (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime),
  );
  return sorted.map((slot, index) => {
    const slotStart = timeToMinutes(slot.startTime);
    const slotEnd =
      index + 1 < sorted.length ? timeToMinutes(sorted[index + 1].startTime) : DAY_MINUTES;
    const startMinutes = Math.max(slotStart, earliest);
    const maxHours = Math.min(
      Math.floor((DAY_MINUTES - startMinutes) / 60),
      slot.maxDurationHours,
      limits.maxDurationHours,
    );
    return {
      ...slot,
      startMinutes,
      maxHours,
      disabled: startMinutes >= slotEnd || maxHours < limits.minDurationHours,
    };
  });
}

// Thứ tự hiển thị + nhãn. Chỉ hiện mã có trong master-data.travelModes.
const TRAVEL_MODES = [
  { value: "Metro", label: "Metro", icon: "train" },
  { value: "Auto", label: "Tự động", icon: "auto_awesome" },
  { value: "Walking", label: "Đi bộ", icon: "directions_walk" },
  { value: "Motorbike", label: "Xe máy", icon: "two_wheeler" },
];
const DEFAULT_TRAVEL_MODE = "Auto";

// Tên trường của parse-request (trùng body của generate) -> nhãn hiển thị
const FIELD_LABELS = {
  durationHours: "Thời lượng",
  budgetMax: "Ngân sách",
  tagIds: "Sở thích",
  travelMode: "Di chuyển",
  startStationOrder: "Ga xuất phát",
  destinationStationOrder: "Chơi quanh ga",
  plannedDate: "Ngày đi",
  startTime: "Giờ xuất phát",
  note: "Ghi chú",
};
const MISSING_LABELS = {
  durationHours: "thời lượng",
  budgetMax: "ngân sách",
  startLocation: "điểm xuất phát",
};

const formatBudget = (value) => (value === 0 ? "Miễn phí" : `${formatCurrency(value)}/người`);

// Giá trị một tiêu chí của parse-request thành chữ để hiển thị; null/rỗng trả ""
function formatField(name, value, { tags, stations }) {
  if (value == null || value.length === 0) return "";
  switch (name) {
    case "durationHours":
      return `${value} giờ`;
    case "budgetMax":
      return formatBudget(value);
    case "tagIds":
      return value
        .map((id) => tags.find((t) => t.id === id)?.name)
        .filter(Boolean)
        .join(", ");
    case "travelMode":
      return TRAVEL_MODES.find((m) => m.value === value)?.label ?? value;
    case "startStationOrder":
    case "destinationStationOrder":
      return stations.find((s) => s.order === value)?.name ?? `ga số ${value}`;
    case "plannedDate":
      return formatPlannedDate(value);
    case "startTime":
      return value.slice(0, 5);
    default:
      return value;
  }
}

// Bộ tiêu chí đầy đủ AI ghép từ lịch cũ (parse-request kèm base) -> cùng shape với request trong TripContext.
// origin: toạ độ xuất phát của lịch cũ, dùng khi lịch đó không xuất phát từ ga.
function prefillToRequest({ fields, origin }) {
  const fromStation = fields.startStationOrder != null;
  return {
    startArea: fromStation ? "" : "Điểm xuất phát của lịch cũ",
    startStationOrder: fields.startStationOrder,
    startLatitude: fromStation ? null : origin.latitude,
    startLongitude: fromStation ? null : origin.longitude,
    destinationStationOrder: fields.destinationStationOrder,
    travelMode: fields.travelMode,
    durationHours: fields.durationHours,
    plannedDate: fields.plannedDate,
    customStartTime: fields.startTime?.slice(0, 5) ?? null,
    budgetPerPerson: fields.budgetMax,
    tagIds: fields.tagIds,
    note: fields.note ?? "",
  };
}

// reason của feasibility-check -> code 409 của generate, để dùng chung một bảng thông báo
const REASON_CODES = {
  OutOfServiceArea: "out_of_service_area",
  TooFarFromStationForMetro: "too_far_from_station_for_metro",
  InsufficientCandidates: "insufficient_candidates",
  DurationTooShort: "duration_too_short",
};

const TRIP_ISSUE_MESSAGES = {
  out_of_service_area: "Vị trí xuất phát nằm ngoài TP.HCM.",
  too_far_from_station_for_metro:
    "Bạn đang ở quá xa ga để đi Metro. Hãy đổi sang Xe máy hoặc Tự động.",
  insufficient_candidates: "Khu này chưa có địa điểm nào trong ngân sách của bạn.",
  duration_too_short:
    "Số giờ chưa đủ để tới và tham quan địa điểm nào. Hãy tăng thời lượng hoặc chọn khu gần hơn.",
};

const GENERATE_ERROR_MESSAGES = {
  ...TRIP_ISSUE_MESSAGES,
  generate_requires_persisted_user: "Vui lòng đăng ký tài khoản để tạo lịch trình.",
  invalid_tag_ids: "Một số sở thích không còn khả dụng. Hãy chọn lại.",
  generate_quota_exceeded:
    "Bạn đã dùng hết lượt tạo lịch trình miễn phí trong tháng này.",
};

const chipClass = (selected) =>
  `min-h-11 px-4 py-2 rounded-full text-body-md transition-all active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
    selected
      ? "bg-primary text-on-primary shadow-sm"
      : "border border-outline-variant text-on-surface-variant hover:border-primary"
  }`;

// Lý do không tạo được lịch + cách sửa nhanh. onFix nhận phần request cần đổi rồi thử lại ngay;
// BE không tự đổi ga/phương tiện thay người dùng.
function TripIssue({ issue, busy, onFix, onGoToStep }) {
  const actionClass =
    "min-h-11 px-4 py-2 rounded-full border border-primary text-primary text-label-md font-semibold active:scale-95 transition-all disabled:opacity-60";
  return (
    <div
      role="alert"
      className="rounded-xl border border-error/20 bg-error-container/10 p-stack-md space-y-3"
    >
      <p className="text-label-md text-error flex items-start gap-1 font-medium">
        <span className="material-symbols-outlined text-[16px]">error</span>
        {issue.message}
      </p>
      {issue.code === "insufficient_candidates" && issue.suggestedStations.length > 0 && (
        <div className="space-y-2">
          <p className="text-label-md text-on-surface-variant">Thử chơi quanh ga gần bạn:</p>
          <div className="flex flex-wrap gap-2">
            {issue.suggestedStations.map((s) => (
              <button
                key={s.order}
                type="button"
                disabled={busy}
                onClick={() => onFix({ destinationStationOrder: s.order })}
                className={actionClass}
              >
                {s.name}
                <span className="ml-1 font-normal opacity-80">
                  · khoảng {s.placeCount} địa điểm
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      {issue.code === "too_far_from_station_for_metro" && (
        <div className="flex flex-wrap gap-2">
          {TRAVEL_MODES.filter((m) => m.value === "Auto" || m.value === "Motorbike").map((m) => (
            <button
              key={m.value}
              type="button"
              disabled={busy}
              onClick={() => onFix({ travelMode: m.value })}
              className={actionClass}
            >
              Đổi sang {m.label}
            </button>
          ))}
        </div>
      )}
      {issue.code === "duration_too_short" && (
        <button type="button" onClick={() => onGoToStep(1)} className={actionClass}>
          Chỉnh thời lượng
        </button>
      )}
      {issue.code === "out_of_service_area" && (
        <button type="button" onClick={() => onGoToStep(0)} className={actionClass}>
          Chọn lại điểm xuất phát
        </button>
      )}
    </div>
  );
}

export default function CreateTripPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { request, setRequest, generateTrip, setCurrentTrip } = useTrip();
  const { isDemo } = useAuth();
  const now = useClock(CLOCK_TICK_MS);
  // Mở từ "Muốn đổi gì?" ở trang Nháp: { fields, changed, missing, base, origin }
  const prefill = location.state?.prefill ?? null;
  // Giá trị ban đầu của form: tiêu chí AI vừa ghép từ lịch cũ, hoặc lần nhập trước
  const initial = prefill ? prefillToRequest(prefill) : request;
  // Lỗi từ lần tạo trước (trang bị mount lại sau /loading nên truyền qua location.state)
  const [generateError, setGenerateError] = useState(
    () => location.state?.error ?? "",
  );
  const [generateErrorCode, setGenerateErrorCode] = useState(
    () => location.state?.errorCode ?? "",
  );
  const [quotaMetadata, setQuotaMetadata] = useState(
    () => location.state?.quotaMetadata ?? null,
  );
  const [generateSuggestedStations] = useState(
    () => location.state?.suggestedStations ?? [],
  );
  const [step, setStep] = useState(() => (location.state?.error || prefill ? 3 : 0));
  const stepHeadingRef = useRef(null);
  const previousStepRef = useRef(step);

  const [startArea, setStartArea] = useState(() => initial?.startArea ?? "");
  // Điểm xuất phát: ga (startStationOrder) HOẶC toạ độ GPS (startCoords), không bao giờ cả hai
  const [startStationOrder, setStartStationOrder] = useState(
    () => initial?.startStationOrder ?? null,
  );
  const [startCoords, setStartCoords] = useState(() =>
    initial?.startStationOrder == null && initial?.startLatitude != null
      ? { latitude: initial.startLatitude, longitude: initial.startLongitude }
      : null,
  );
  // null = "Gần tôi"
  const [destinationStationOrder, setDestinationStationOrder] = useState(
    () => initial?.destinationStationOrder ?? null,
  );
  const [travelMode, setTravelMode] = useState(() => initial?.travelMode ?? DEFAULT_TRAVEL_MODE);
  const [travelModes, setTravelModes] = useState([]);
  // stationId -> số địa điểm; null khi chưa tải được (không làm mờ ga nào)
  const [placeCounts, setPlaceCounts] = useState(null);
  const [stations, setStations] = useState([]);
  const [locating, setLocating] = useState(false);
  const [feasibility, setFeasibility] = useState(null);
  const [feasibilityIssue, setFeasibilityIssue] = useState(null); // { code, message, suggestedStations }
  const [checking, setChecking] = useState(false);
  const [startAreaError, setStartAreaError] = useState("");
  const [durationHours, setDurationHours] = useState(() => initial?.durationHours ?? 4);
  const [plannedDate, setPlannedDate] = useState(() => initial?.plannedDate ?? todayInVietnam());
  // null = tự chọn buổi đang diễn ra hoặc buổi sớm nhất còn dùng được
  const [timeSlotCode, setTimeSlotCode] = useState(() => initial?.timeSlotCode ?? null);
  // Giờ xuất phát lẻ "HH:mm" do AI điền; null = chọn theo buổi
  const [customStartTime, setCustomStartTime] = useState(() => initial?.customStartTime ?? null);
  const [timeSlots, setTimeSlots] = useState([]);
  const [tripLimits, setTripLimits] = useState(DEFAULT_TRIP_LIMITS);
  const [budgetPerPerson, setBudgetPerPerson] = useState(() => initial?.budgetPerPerson ?? 300000);
  const [peopleCount, setPeopleCount] = useState(() => request?.peopleCount ?? 2);
  const [tags, setTags] = useState([]);
  // Một danh sách tag đã chọn (sở thích + phong cách), chia theo type khi hiển thị.
  // interests/travelStyles: request lưu từ bản cũ.
  const [selectedTagIds, setSelectedTagIds] = useState(
    () => initial?.tagIds ?? [...(initial?.interests ?? []), ...(initial?.travelStyles ?? [])],
  );
  const [note, setNote] = useState(() => initial?.note ?? "");
  // fields của lần AI đọc câu nhập gần nhất, để hiện lại những gì đã điền
  const [aiFields, setAiFields] = useState(null);

  useEffect(() => {
    tagService.getTags().then(setTags).catch(() => setTags([]));
  }, []);

  useEffect(() => {
    masterDataService
      .getMasterData()
      .then((data) => {
        setStations([...data.metroStations].sort((a, b) => a.order - b.order));
        setTimeSlots(data.timeSlots ?? []);
        setTravelModes(data.travelModes ?? []);
        if (data.tripLimits) setTripLimits(data.tripLimits);
      })
      .catch(() => setStations([]));
  }, []);

  useEffect(() => {
    placeService
      .getMetroClusters()
      .then((clusters) =>
        setPlaceCounts(new Map(clusters.map((c) => [c.stationId, c.placeCount]))),
      )
      .catch(() => setPlaceCounts(null));
  }, []);

  useEffect(() => {
    if (previousStepRef.current === step) return;
    previousStepRef.current = step;
    window.scrollTo(0, 0);
    stepHeadingRef.current?.focus({ preventScroll: true });
  }, [step]);

  // Ngày/giờ tính lại mỗi lần đồng hồ chạy. Ngày đã qua (lưu từ hôm trước) tự thành hôm nay.
  const today = todayInVietnam(now);
  const lastDate = addDays(today, MAX_DAYS_AHEAD);
  const effectiveDate = plannedDate < today || plannedDate > lastDate ? today : plannedDate;
  const isToday = effectiveDate === today;
  const nowMinutes = minutesNowInVietnam(now);
  const slots = buildTimeSlots(timeSlots, { isToday, nowMinutes, limits: tripLimits });
  // Giờ lẻ trùng giờ bắt đầu một buổi thì coi như chọn buổi đó; hôm nay mà giờ đã qua thì bỏ, chọn theo buổi
  const customMinutes = customStartTime ? timeToMinutes(customStartTime) : null;
  const customSlot =
    customMinutes != null
      ? slots.find((s) => !s.disabled && timeToMinutes(s.startTime) === customMinutes)
      : null;
  const useCustomStart =
    customMinutes != null && !customSlot && (!isToday || customMinutes >= nowMinutes);
  const selectedSlot =
    customSlot ??
    slots.find((s) => s.code === timeSlotCode && !s.disabled) ??
    slots.find((s) => !s.disabled) ??
    null;
  const slotAutoChanged =
    !useCustomStart && timeSlotCode != null && selectedSlot?.code !== timeSlotCode;
  // Chưa có timeSlots (master-data lỗi): hôm nay dùng giờ hiện tại làm tròn, ngày khác 08:00
  const startMinutes = useCustomStart
    ? customMinutes
    : selectedSlot
      ? selectedSlot.startMinutes
      : isToday
        ? roundUpMinutes(nowMinutes, START_TIME_STEP_MINUTES)
        : DEFAULT_START_MINUTES;
  const maxHours =
    selectedSlot && !useCustomStart
      ? selectedSlot.maxHours
      : Math.min(Math.floor((DAY_MINUTES - startMinutes) / 60), tripLimits.maxDurationHours);
  const noTimeLeft =
    slots.length > 0 && !useCustomStart ? !selectedSlot : maxHours < tripLimits.minDurationHours;
  // Giá trị AI điền có thể không trùng mức có sẵn (vd 5 giờ, 350.000đ): thêm một lựa chọn riêng
  const allDurations = DURATION_OPTIONS.some((o) => o.value === durationHours)
    ? DURATION_OPTIONS
    : [...DURATION_OPTIONS, { value: durationHours, label: `${durationHours} giờ` }].sort(
        (a, b) => a.value - b.value,
      );
  // Lựa chọn quá dài thì dùng mức dài nhất còn vừa. Không mức nào vừa thì thêm đúng số giờ còn lại.
  const fittingOptions = allDurations.filter((o) => o.value <= maxHours);
  const durationOptions =
    fittingOptions.length > 0 || noTimeLeft
      ? allDurations
      : [{ value: maxHours, label: `${maxHours} giờ` }, ...allDurations];
  const effectiveDuration =
    durationHours <= maxHours ? durationHours : (fittingOptions.at(-1)?.value ?? maxHours);
  const startTime = minutesToTime(startMinutes);
  const endTime = minutesToTime(startMinutes + effectiveDuration * 60);
  const budgetOptions = BUDGET_OPTIONS.some((b) => b.value === budgetPerPerson)
    ? BUDGET_OPTIONS
    : [
        {
          id: "custom",
          label:
            budgetPerPerson === 0
              ? "Chỉ địa điểm miễn phí"
              : `Tối đa ${formatBudget(budgetPerPerson)}`,
          value: budgetPerPerson,
        },
        ...BUDGET_OPTIONS,
      ];
  const budgetOption = budgetOptions.find((b) => b.value === budgetPerPerson);
  const peopleOption = PEOPLE_OPTIONS.find((p) => p.value === peopleCount);

  const hasOrigin = startStationOrder != null || startCoords != null;
  // Tên ga xuất phát lấy theo order (AI/lịch cũ chỉ cho order), không có thì dùng nhãn đã lưu
  const startLabel = stations.find((s) => s.order === startStationOrder)?.name ?? startArea;
  const modeOptions = TRAVEL_MODES.filter((m) => travelModes.includes(m.value));
  const effectiveTravelMode = modeOptions.some((m) => m.value === travelMode)
    ? travelMode
    : DEFAULT_TRAVEL_MODE;
  const hasNoPlaces = (station) => placeCounts != null && !(placeCounts.get(station.id) > 0);
  const destinationStation = stations.find((s) => s.order === destinationStationOrder);

  // overrides: lựa chọn vừa đổi qua TripIssue, state chưa kịp cập nhật
  const buildTripDto = (overrides = {}) =>
    toTripRequestDto({
      startLatitude: startCoords?.latitude,
      startLongitude: startCoords?.longitude,
      startStationOrder,
      destinationStationOrder,
      travelMode: effectiveTravelMode,
      durationHours: effectiveDuration,
      budgetMaxPerPerson: budgetPerPerson,
      tagIds: selectedTagIds,
      plannedDate: effectiveDate,
      startTime,
      note,
      ...overrides,
    });

  const interestTags = tags.filter((t) => t.type === "Interest");
  const styleTags = tags.filter((t) => t.type === "TravelStyle");
  const hasInterest = interestTags.some((t) => selectedTagIds.includes(t.id));
  const canContinue =
    (step !== 1 || !noTimeLeft) && (step !== 2 || hasInterest);

  const toggleTag = (id) =>
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
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
        setStartStationOrder(null);
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
    setStartStationOrder(station.order);
    setStartCoords(null);
    setStartArea(station.name);
    setStartAreaError("");
  };

  // Chỉ ghi đè trường AI đọc được; trường null (hoặc tagIds rỗng) giữ giá trị đang có trên form
  const handleParsed = (result) => {
    if (!result.isTripRequest) return; // ô nhập đã hiện message của BE
    const { fields } = result;
    if (fields.durationHours != null) setDurationHours(fields.durationHours);
    if (fields.budgetMax != null) setBudgetPerPerson(fields.budgetMax);
    if (fields.tagIds.length > 0) setSelectedTagIds(fields.tagIds);
    if (fields.travelMode != null) setTravelMode(fields.travelMode);
    if (fields.startStationOrder != null) {
      setStartStationOrder(fields.startStationOrder);
      setStartCoords(null);
      setStartAreaError("");
    }
    if (fields.destinationStationOrder != null)
      setDestinationStationOrder(fields.destinationStationOrder);
    if (fields.plannedDate != null) setPlannedDate(fields.plannedDate);
    if (fields.startTime != null) {
      setCustomStartTime(fields.startTime.slice(0, 5));
      setTimeSlotCode(null);
    }
    if (fields.note != null) setNote(fields.note);
    setAiFields(fields);
  };

  const lookups = { tags, stations };
  const aiFilled = aiFields
    ? Object.keys(FIELD_LABELS)
        .map((name) => [name, formatField(name, aiFields[name], lookups)])
        .filter(([, text]) => text)
    : [];
  // AI không đọc được thời lượng/ngân sách thì form vẫn có giá trị mặc định, chỉ nhắc người dùng xem lại
  const aiUnread = aiFields
    ? ["durationHours", "budgetMax"].filter((name) => aiFields[name] == null)
    : [];

  const checkFeasibility = async (overrides) => {
    setFeasibilityIssue(null);
    setFeasibility(null);
    setChecking(true);
    try {
      // feasibility-check không dùng ghi chú
      const result = await tripService.checkFeasibility(buildTripDto({ ...overrides, note: "" }));
      setFeasibility(result);
      if (!result.isFeasible) {
        const code = REASON_CODES[result.reason];
        setFeasibilityIssue({
          code,
          message: TRIP_ISSUE_MESSAGES[code] ?? "Yêu cầu hiện chưa khả thi, hãy thử điều chỉnh.",
          suggestedStations: result.suggestedStations ?? [],
        });
        return false;
      }
      return true;
    } catch (err) {
      setFeasibilityIssue({ message: err.message, suggestedStations: [] });
      return false;
    } finally {
      setChecking(false);
    }
  };

  const handleNextStep = async () => {
    if (step === 0) {
      if (!hasOrigin) {
        setStartAreaError("Vui lòng dùng vị trí hiện tại hoặc chọn một ga Metro.");
        return;
      }
      setStartAreaError("");
      setRequest({
        ...(request || {}),
        startArea: startLabel,
        startStationOrder,
        startLatitude: startCoords?.latitude ?? null,
        startLongitude: startCoords?.longitude ?? null,
        destinationStationOrder,
        travelMode: effectiveTravelMode,
      });
    }
    if (step === 2) {
      if (!hasInterest) return;
      if (!(await checkFeasibility())) return;
    }
    setStep((s) => s + 1);
  };

  const handleGenerate = async (overrides = {}) => {
    if (isDemo) return;
    const req = {
      ...(request || {}),
      // Lưu cả điểm xuất phát: mở thẳng bước cuối từ "Muốn đổi gì?" thì bước 1 không chạy
      startArea: startLabel,
      startStationOrder,
      startLatitude: startCoords?.latitude ?? null,
      startLongitude: startCoords?.longitude ?? null,
      destinationStationOrder,
      travelMode: effectiveTravelMode,
      durationHours: effectiveDuration,
      plannedDate: effectiveDate,
      timeSlotCode: useCustomStart ? null : (selectedSlot?.code ?? null),
      customStartTime: useCustomStart ? customStartTime : null,
      budgetPerPerson,
      peopleCount,
      tagIds: selectedTagIds,
      note,
      ...overrides,
    };

    setRequest(req);
    setGenerateError("");
    setGenerateErrorCode("");
    setQuotaMetadata(null);
    navigate("/loading");
    try {
      const trip = await generateTrip(buildTripDto(overrides));
      setCurrentTrip(trip);
      // Thay /loading trong lịch sử, để nút back ở trang Nháp về wizard chứ không kẹt ở màn hình chờ
      navigate("/draft", { replace: true });
    } catch (err) {
      navigate("/create", {
        replace: true,
        state: {
          error: GENERATE_ERROR_MESSAGES[err.code] ?? err.message,
          errorCode: err.code || "",
          quotaMetadata: err.data?.extensions || err.data || null,
          // 409 insufficient_candidates: tối đa 3 ga gần nhất có địa điểm, nằm cạnh code trong body lỗi
          suggestedStations: err.data?.suggestedStations ?? [],
        },
      });
    }
  };

  // Bấm một cách sửa trong TripIssue: lưu lựa chọn mới rồi thử lại ngay với giá trị đó
  const applyFix = (overrides) => {
    if ("destinationStationOrder" in overrides)
      setDestinationStationOrder(overrides.destinationStationOrder);
    if ("travelMode" in overrides) setTravelMode(overrides.travelMode);
  };
  const retryFeasibility = async (overrides) => {
    applyFix(overrides);
    if (await checkFeasibility(overrides)) setStep(3);
  };
  const retryGenerate = (overrides) => {
    applyFix(overrides);
    handleGenerate(overrides);
  };
  const goToStep = (target) => {
    setFeasibilityIssue(null);
    setGenerateError("");
    setGenerateErrorCode("");
    setStep(target);
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
            {!isDemo && (
              <div className="mt-stack-lg space-y-stack-sm">
                <TripRequestAssistant
                  title="Kể cho LocalMate bạn muốn đi chơi thế nào"
                  placeholder="Ví dụ: chiều mai rảnh khoảng 4 tiếng, có 300k, muốn đi cà phê chụp ảnh quanh Bến Thành"
                  submitLabel="Điền giúp tôi"
                  onParsed={handleParsed}
                />
                {aiFilled.length > 0 && (
                  <div
                    role="status"
                    className="space-y-1 rounded-xl border border-primary/20 bg-primary/5 p-stack-md text-label-md"
                  >
                    <p className="font-semibold text-primary">
                      AI đã điền giúp bạn, hãy xem lại ở từng bước:
                    </p>
                    <ul className="space-y-0.5 text-on-surface">
                      {aiFilled.map(([name, text]) => (
                        <li key={name}>
                          {FIELD_LABELS[name]}: {text}
                        </li>
                      ))}
                    </ul>
                    {(aiUnread.length > 0 || !hasOrigin) && (
                      <p className="text-on-surface-variant">
                        Chưa đọc được:{" "}
                        {[...(hasOrigin ? [] : ["startLocation"]), ...aiUnread]
                          .map((name) => MISSING_LABELS[name])
                          .join(", ")}
                        . Bạn tự chọn giúp nhé.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

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
                Hoặc xuất phát từ một ga Metro
              </label>
              <div role="group" aria-label="Chọn ga xuất phát" aria-describedby={startAreaError ? "start-area-error" : undefined} className="flex flex-wrap gap-2">
                {stations.map((s) => (
                  <button
                    key={s.order}
                    type="button"
                    aria-pressed={startStationOrder === s.order}
                    onClick={() => handlePickStation(s)}
                    className={chipClass(startStationOrder === s.order)}
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
              {hasOrigin && (
                <p className="text-label-md text-on-surface-variant">
                  📍 Xuất phát: {startLabel}
                </p>
              )}
            </div>

            <section className="space-y-stack-sm">
              <h3 className="text-title-md font-semibold text-on-surface">
                Muốn chơi quanh ga nào?
              </h3>
              <div role="group" aria-label="Chọn ga muốn chơi" className="flex flex-wrap gap-2">
                <button
                  type="button"
                  aria-pressed={destinationStationOrder == null}
                  onClick={() => setDestinationStationOrder(null)}
                  className={chipClass(destinationStationOrder == null)}
                >
                  Gần tôi
                </button>
                {stations.map((s) => (
                  <button
                    key={s.order}
                    type="button"
                    aria-pressed={destinationStationOrder === s.order}
                    onClick={() => setDestinationStationOrder(s.order)}
                    className={`${chipClass(destinationStationOrder === s.order)} ${hasNoPlaces(s) ? "opacity-50" : ""}`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
              {stations.some(hasNoPlaces) && (
                <p className="text-label-md text-on-surface-variant">
                  Ga mờ là ga chưa có địa điểm gợi ý.
                </p>
              )}
            </section>

            {modeOptions.length > 0 && (
              <section className="space-y-stack-sm">
                <h3 className="text-title-md font-semibold text-on-surface">Đi bằng gì?</h3>
                <div role="group" aria-label="Chọn phương tiện" className="flex flex-wrap gap-2">
                  {modeOptions.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      aria-pressed={effectiveTravelMode === m.value}
                      onClick={() => setTravelMode(m.value)}
                      className={`${chipClass(effectiveTravelMode === m.value)} flex items-center gap-1.5`}
                    >
                      <span className="material-symbols-outlined text-[18px]">{m.icon}</span>
                      {m.label}
                    </button>
                  ))}
                </div>
                {effectiveTravelMode === "Metro" && (
                  <p className="text-label-md text-on-surface-variant">
                    Giờ tàu là lịch dự kiến. Thời gian ra ga, chờ tàu và ngồi tàu đều tính vào số giờ bạn có.
                  </p>
                )}
              </section>
            )}
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
                  event
                </span>
                Ngày đi
              </h3>
              <div className="flex flex-wrap items-center gap-stack-sm">
                {[
                  { value: today, label: "Hôm nay" },
                  { value: addDays(today, 1), label: "Ngày mai" },
                ].map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    aria-pressed={effectiveDate === opt.value}
                    onClick={() => setPlannedDate(opt.value)}
                    className={`min-h-11 px-6 py-2 rounded-full font-semibold text-button active:scale-95 transition-all ${
                      effectiveDate === opt.value
                        ? "bg-primary text-on-primary shadow-md shadow-primary/20"
                        : "border border-outline-variant text-on-surface-variant"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
                <label className="flex min-h-11 items-center gap-2 rounded-full border border-outline-variant px-4 text-body-md text-on-surface-variant">
                  <span className="sr-only">Chọn ngày khác</span>
                  <input
                    type="date"
                    value={effectiveDate}
                    min={today}
                    max={lastDate}
                    onChange={(e) => e.target.value && setPlannedDate(e.target.value)}
                    className="bg-transparent border-none p-0 focus:ring-0"
                  />
                </label>
              </div>
              <p className="mt-1 text-label-md text-on-surface-variant">
                {formatPlannedDate(effectiveDate)} · tối đa {MAX_DAYS_AHEAD} ngày tới
              </p>
            </section>

            {slots.length > 0 && (
              <section>
                <h3 className="text-title-md font-semibold mb-stack-md flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">
                    wb_twilight
                  </span>
                  Thời điểm
                </h3>
                <div className="flex flex-wrap gap-stack-sm">
                  {slots.map((slot) => (
                    <button
                      key={slot.code}
                      type="button"
                      disabled={slot.disabled}
                      aria-pressed={!useCustomStart && selectedSlot?.code === slot.code}
                      onClick={() => {
                        setTimeSlotCode(slot.code);
                        setCustomStartTime(null);
                      }}
                      className={`min-h-11 px-6 py-2 rounded-full font-semibold text-button active:scale-95 transition-all disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 ${
                        !useCustomStart && selectedSlot?.code === slot.code
                          ? "bg-primary text-on-primary shadow-md shadow-primary/20"
                          : "border border-outline-variant text-on-surface-variant"
                      }`}
                    >
                      {slot.label}
                      <span className="ml-1 font-normal opacity-80">
                        {slot.disabled ? "· đã qua" : `· từ ${minutesToTime(slot.startMinutes)}`}
                      </span>
                    </button>
                  ))}
                  {/* Giờ lẻ do AI điền; bấm một buổi để bỏ */}
                  {useCustomStart && (
                    <span className="flex min-h-11 items-center rounded-full bg-primary px-6 py-2 text-button font-semibold text-on-primary shadow-md shadow-primary/20">
                      Giờ riêng
                      <span className="ml-1 font-normal opacity-80">· từ {customStartTime}</span>
                    </span>
                  )}
                </div>
                {slotAutoChanged && selectedSlot && (
                  <p className="mt-1 text-label-md text-on-surface-variant">
                    Buổi bạn chọn đã qua, đã chuyển sang {selectedSlot.label.toLowerCase()}.
                  </p>
                )}
              </section>
            )}

            {noTimeLeft ? (
              <p
                role="alert"
                className="text-label-md text-error flex items-center gap-1 font-medium"
              >
                <span className="material-symbols-outlined text-[16px]">error</span>
                Hôm nay không còn đủ thời gian cho chuyến đi. Hãy chọn ngày khác.
              </p>
            ) : (
              <section>
                <h3 className="text-title-md font-semibold mb-stack-md flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">
                    schedule
                  </span>
                  Thời lượng
                </h3>
                <div className="grid grid-cols-2 gap-gutter lg:grid-cols-4">
                  {durationOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={opt.value > maxHours}
                      aria-pressed={effectiveDuration === opt.value}
                      onClick={() => setDurationHours(opt.value)}
                      className={`relative p-stack-md rounded-lg border-2 transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 ${
                        effectiveDuration === opt.value
                          ? "border-primary bg-primary-container/10"
                          : "border-surface-container-highest bg-white hover:border-primary-container"
                      }`}
                    >
                      <span
                        className={`font-semibold text-button ${effectiveDuration === opt.value ? "text-primary" : "text-on-surface-variant"}`}
                      >
                        {opt.label}
                      </span>
                      {effectiveDuration === opt.value && (
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
                <p className="mt-1 text-label-md text-on-surface-variant">
                  Xuất phát {startTime}, dự kiến xong trước {endTime}
                  {maxHours < tripLimits.maxDurationHours && ` · tối đa ${maxHours} giờ (phải kết thúc trong ngày)`}
                </p>
              </section>
            )}

            <section>
              <h3 className="text-title-md font-semibold mb-stack-md flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">
                  payments
                </span>
                Ngân sách mỗi người
              </h3>
              <div className="grid gap-stack-sm lg:grid-cols-3">
                {budgetOptions.map((opt) => (
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
                  aria-pressed={selectedTagIds.includes(tag.id)}
                  onClick={() => toggleTag(tag.id)}
                  className={`min-h-11 px-4 py-2 rounded-full flex items-center gap-1.5 transition-all active:scale-95 text-body-md ${
                    selectedTagIds.includes(tag.id)
                      ? "bg-primary text-on-primary shadow-md"
                      : "bg-primary-container/10 border border-primary-container/20 text-on-primary-container hover:bg-primary-container/20"
                  }`}
                >
                  {tag.name}
                </button>
              ))}
            </div>

            {feasibilityIssue && (
              <TripIssue
                issue={feasibilityIssue}
                busy={checking}
                onFix={retryFeasibility}
                onGoToStep={goToStep}
              />
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-stack-lg">
            {generateError && (
              generateErrorCode === "generate_quota_exceeded" ? (
                <div
                  role="alert"
                  className="rounded-xl border border-error/20 bg-error-container/10 p-stack-md space-y-3 mt-stack-md"
                >
                  <div className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-error text-[20px] shrink-0 mt-0.5">
                      lock
                    </span>
                    <div className="space-y-1">
                      <p className="font-semibold text-body-md text-error">
                        {generateError}
                      </p>
                      <p className="text-body-sm text-on-surface-variant">
                        Nâng cấp gói dịch vụ để tiếp tục tạo các hành trình khám phá không giới hạn.
                      </p>
                    </div>
                  </div>

                  {quotaMetadata && (quotaMetadata.limit != null || quotaMetadata.resetAt) && (
                    <div className="bg-surface rounded-lg p-3 text-body-sm space-y-1 border border-outline-variant/10">
                      {quotaMetadata.limit != null && (
                        <div className="flex justify-between text-on-surface">
                          <span>Đã sử dụng:</span>
                          <span className="font-semibold">
                            {quotaMetadata.used ?? quotaMetadata.limit} / {quotaMetadata.limit} lượt
                          </span>
                        </div>
                      )}
                      {quotaMetadata.resetAt && (
                        <div className="flex justify-between text-on-surface-variant">
                          <span>Làm mới vào:</span>
                          <span className="font-medium">
                            {formatVnDateTime(quotaMetadata.resetAt)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => navigate("/subscription")}
                    className="w-full py-2.5 px-4 bg-primary text-on-primary rounded-full font-semibold text-label-md flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[18px]">workspace_premium</span>
                    Nâng cấp gói dịch vụ
                  </button>
                </div>
              ) : (
                <div className="mt-stack-md">
                  <TripIssue
                    issue={{
                      code: generateErrorCode,
                      message: generateError,
                      suggestedStations: generateSuggestedStations,
                    }}
                    onFix={retryGenerate}
                    onGoToStep={goToStep}
                  />
                </div>
              )
            )}
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
                  aria-pressed={selectedTagIds.includes(tag.id)}
                  onClick={() => toggleTag(tag.id)}
                  className={`p-stack-md rounded-lg border-2 flex flex-col items-start gap-1 transition-all active:scale-95 ${
                    selectedTagIds.includes(tag.id)
                      ? "border-primary bg-primary-container/10"
                      : "border-surface-container-highest bg-white hover:border-primary-container"
                  }`}
                >
                  <span
                    className={`font-semibold text-body-md ${selectedTagIds.includes(tag.id) ? "text-primary" : "text-on-surface"}`}
                  >
                    {tag.name}
                  </span>
                </button>
              ))}
            </div>

            <section className="space-y-stack-sm">
              <label htmlFor="trip-note" className="text-title-md font-semibold text-on-surface">
                Ghi chú thêm{" "}
                <span className="font-normal text-on-surface-variant">(tuỳ chọn)</span>
              </label>
              <textarea
                id="trip-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={NOTE_MAX_LENGTH}
                rows={3}
                placeholder="Ví dụ: muốn chỗ yên tĩnh, có view sông, hợp chụp ảnh"
                className="w-full resize-none rounded-DEFAULT bg-surface-container-low p-3 text-body-md placeholder:text-outline-variant focus:outline-none focus:ring-2 focus:ring-primary-container"
              />
              <p className="flex justify-between gap-2 text-label-md text-on-surface-variant">
                <span>
                  Địa điểm hợp ghi chú sẽ được ưu tiên. Nên viết khẳng định, ví dụ "yên tĩnh" thay vì "không ồn".
                </span>
                <span className="shrink-0">
                  {note.length}/{NOTE_MAX_LENGTH}
                </span>
              </p>
            </section>

            {isDemo && (
              <p role="status" className="card text-body-md text-on-surface-variant">
                Phiên demo chỉ xem được gợi ý. Hãy đăng nhập hoặc đăng ký tài khoản để tạo và lưu lịch trình.
              </p>
            )}

            {prefill && (
              <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-stack-md text-body-md">
                <p className="font-semibold text-primary">Thay đổi so với lịch cũ</p>
                <ul className="space-y-0.5 text-on-surface">
                  {prefill.changed.map((name) => (
                    <li key={name}>
                      {FIELD_LABELS[name] ?? name}:{" "}
                      {formatField(name, prefill.base[name], lookups) || "chưa chọn"} →{" "}
                      <strong>
                        {formatField(name, prefill.fields[name], lookups) || "chưa chọn"}
                      </strong>
                    </li>
                  ))}
                </ul>
                {/* BE tự bỏ ngày đã qua của lịch cũ mà không báo trong changed */}
                {prefill.fields.plannedDate == null && (
                  <p className="text-label-md text-error">
                    Ngày đi của lịch cũ đã qua nên đang để hôm nay.{" "}
                    <button
                      type="button"
                      onClick={() => goToStep(1)}
                      className="font-semibold underline"
                    >
                      Chọn ngày
                    </button>
                  </p>
                )}
                {prefill.fields.durationHours == null && (
                  <p className="text-label-md text-error">
                    Số giờ cũ không còn vừa trong ngày, đang để {effectiveDuration} giờ.{" "}
                    <button
                      type="button"
                      onClick={() => goToStep(1)}
                      className="font-semibold underline"
                    >
                      Chọn lại
                    </button>
                  </p>
                )}
                <p className="text-label-md text-on-surface-variant">
                  Lịch cũ vẫn được giữ nguyên. Tạo lịch mới tính 1 lượt tạo lịch.
                </p>
              </div>
            )}

            <div className="card space-y-2">
              <p className="text-label-md text-on-surface-variant uppercase tracking-wider">
                Tóm tắt
              </p>
              <div className="space-y-1 text-body-md text-on-surface">
                <p>📍 Xuất phát: {startStationOrder != null ? `ga ${startLabel}` : startLabel}</p>
                {startStationOrder == null && feasibility?.nearestStation && (
                  <p>
                    🚇 Ga gần bạn: {feasibility.nearestStation.stationName}, cách{" "}
                    {formatDistance(feasibility.nearestStation.distanceMeters)}
                  </p>
                )}
                {(destinationStation ?? feasibility?.anchorStation) && (
                  <p>
                    🎯 Chơi quanh ga {(destinationStation ?? feasibility.anchorStation).name}
                    {!destinationStation && " (gần bạn)"}
                  </p>
                )}
                <p>
                  🧭 Di chuyển: {TRAVEL_MODES.find((m) => m.value === effectiveTravelMode)?.label}
                </p>
                <p>
                  📅 {formatPlannedDate(effectiveDate)} · {startTime} – {endTime}
                </p>
                <p>⏱ {effectiveDuration} giờ</p>
                <p>💰 {budgetOption?.label}</p>
                {note.trim() && <p>📝 {note.trim()}</p>}
                <p>
                  👥 {peopleOption?.label}
                  {peopleCount > 1 &&
                    ` · tổng nhóm tối đa ~${formatCurrency(budgetPerPerson * peopleCount)}`}
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
        ) : isDemo ? (
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="flex min-h-12 shrink-0 items-center whitespace-nowrap bg-primary text-on-primary rounded-full px-4 py-3 font-semibold text-button active:scale-95 transition-all shadow-lg shadow-primary/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary sm:px-8"
          >
            Đăng nhập để tạo
            <span className="material-symbols-outlined ml-2 hidden min-[360px]:inline">login</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => handleGenerate()}
            className="flex min-h-12 shrink-0 items-center whitespace-nowrap bg-primary text-on-primary rounded-full px-4 py-3 font-semibold text-button active:scale-95 transition-all shadow-lg shadow-primary/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary sm:px-8"
          >
            {prefill ? "Tạo lịch mới" : "Tạo lịch trình"}
            <span className="material-symbols-outlined ml-2 hidden min-[360px]:inline">auto_awesome</span>
          </button>
        )}
      </nav>
    </div>
  );
}
