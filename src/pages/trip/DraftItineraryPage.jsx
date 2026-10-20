import { useEffect, useState, useRef, useCallback } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useTrip } from "../../context/TripContext";
import { useAuth } from "../../context/AuthContext";
import { useSubscription } from "../../context/SubscriptionContext";
import {
  formatCurrencyShort,
  formatDuration,
} from "../../utils/formatCurrency";
import { addDays, formatClock, formatPlannedDate } from "../../utils/vnTime";
import TimelineItemDirections from "../../components/TimelineItemDirections";
import {
  getAiQuota,
  getAiQuotaHint,
  isGenerateQuotaExhausted,
} from "../../utils/subscriptionUtils";
import TripRequestAssistant from "../../components/trip/TripRequestAssistant";
import UpgradeHint from "../../components/subscription/UpgradeHint";
import ReplacePlacePanel from "../../components/trip/ReplacePlacePanel";
import BottomSheet from "../../components/trip/BottomSheet";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { toParseBase } from "../../services/tripService";
import { getAiErrorMessage } from "../../utils/aiErrors";
import { useAiCooldown } from "../../hooks/useAiCooldown";

const ITEM_ERROR_MESSAGES = {
  cannot_delete_last_item: "Lịch trình cần ít nhất một địa điểm nên không xoá được chặng cuối cùng.",
  trip_finalized: "Lịch trình đã chốt nên không sửa được nữa.",
  already_finalized: "Lịch trình này đã được chốt rồi.",
  itinerary_item_not_found: "Không tìm thấy địa điểm này. Hãy tải lại lịch trình.",
  saved_trip_quota_exceeded: "Bạn đã đạt giới hạn lịch trình được lưu của gói hiện tại.",
};

// Thời gian đi từ chặng trước. Auto dùng số BE đã tính; chọn phương tiện cụ thể thì dùng field theo phương tiện
function travelLabel(trip, item) {
  if (item.travelMinutesFromPrevious == null) return null;
  const walking = trip.travelMode === "Walking";
  const motorbike = trip.travelMode === "Motorbike";
  const minutes = walking
    ? item.walkingMinutes
    : motorbike
      ? item.motorbikeMinutes
      : item.travelMinutesFromPrevious;
  if (minutes == null) return null;
  const isWalk =
    walking ||
    (!motorbike && item.travelMinutesFromPrevious === item.walkingMinutes);
  return {
    icon: isWalk ? "directions_walk" : "two_wheeler",
    text: `Đi ${minutes} phút`,
  };
}

const LEG_MODES = {
  Walking: { icon: "directions_walk", label: "Đi bộ", toStation: "đi bộ ra ga" },
  Motorbike: { icon: "two_wheeler", label: "Xe máy", toStation: "xe máy ra ga" },
};

// Cách đi tới một chặng theo item.leg. Đoạn Metro: ra ga -> chờ tàu -> ngồi tàu -> đi bộ từ ga xuống.
function LegInfo({ leg, fromOrigin }) {
  const suffix = fromOrigin ? " từ điểm xuất phát" : "";
  if (leg.mode !== "Metro") {
    const mode = LEG_MODES[leg.mode] ?? LEG_MODES.Motorbike;
    return (
      <p className="mb-3 flex flex-wrap items-center gap-1.5 break-words text-[13px] leading-5 text-text-muted">
        <span aria-hidden="true" className="material-symbols-outlined text-[18px]">{mode.icon}</span>
        {mode.label} {leg.totalMinutes} phút{suffix}
        {leg.fallback === "metro_unavailable" && " · đã hết chuyến tàu nên tính theo xe máy"}
      </p>
    );
  }
  const parts = [
    // toStationMode null = đang đứng sẵn ở ga
    leg.toStationMode &&
      `${LEG_MODES[leg.toStationMode]?.toStation ?? "ra ga"} ${leg.toStationMinutes} phút`,
    `chờ tàu ${leg.waitMinutes} phút`,
    `đi tàu ${leg.rideMinutes} phút (${leg.stopCount} ga)`,
    leg.walkMinutes > 0 && `đi bộ ${leg.walkMinutes} phút`,
  ].filter(Boolean);
  return (
    <div className="mb-3 space-y-2 break-words rounded-[8px] border border-secondary/20 bg-secondary/5 p-3 text-[13px] leading-5">
      <p className="flex flex-wrap items-center gap-1.5 font-semibold text-secondary">
        <span aria-hidden="true" className="material-symbols-outlined text-[18px]">train</span>
        Metro {leg.boardStation.name} → {leg.alightStation.name} · {leg.totalMinutes} phút{suffix}
      </p>
      <p className="text-on-surface-variant">Gồm: {parts.join(" · ")}. Giờ tàu là dự kiến.</p>
    </div>
  );
}

// Phương tiện cho nút chỉ đường Google Maps. Xe máy dùng "driving" (Maps URL không có xe máy).
// Auto: BE chọn đi bộ khi gần, xa hơn thì xe máy; chặng đầu chưa có số liệu theo phương tiện nên để đi bộ.
function mapsTravelMode(trip, item) {
  if (item.leg) {
    if (item.leg.mode === "Metro") return "transit";
    return item.leg.mode === "Walking" ? "walking" : "driving";
  }
  if (trip.travelMode === "Walking") return "walking";
  if (trip.travelMode === "Motorbike") return "driving";
  return item.travelMinutesFromPrevious != null &&
    item.travelMinutesFromPrevious !== item.walkingMinutes
    ? "driving"
    : "walking";
}

// Từ 1280px chia hai cột (thanh bên đã chiếm 220px, nhỏ hơn thì khung phải quá hẹp)
const TWO_COLUMN_QUERY = "(min-width: 1280px)";
const PANEL_TABS = [
  { id: "replace", label: "Thay địa điểm" },
  { id: "ai", label: "Hỏi AI" },
];

function DraftItineraryPageInner() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentTrip, finalizeTrip, deleteItem, explainTrip, explainingTripIds, noteAiError } = useTrip();
  const aiCooldown = useAiCooldown();
  const { isDemo } = useAuth();
  const { subscription, refreshSubscription } = useSubscription();
  const aiQuota = getAiQuota(subscription);
  const generateExhausted = isGenerateQuotaExhausted(subscription);
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  // Lượt lưu lấy từ /subscription/me (savedTrips), tải lại mỗi lần mở hộp chốt
  const [checkingQuota, setCheckingQuota] = useState(false);
  const savedTrips = subscription?.savedTrips;
  const savedTripsFull = typeof savedTrips?.limit === "number" && savedTrips.used >= savedTrips.limit;
  const activeRef = useRef(true);
  const finalizingRef = useRef(false);
  const [finalizing, setFinalizing] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [finalizeError, setFinalizeError] = useState("");
  const [finalizeErrorCode, setFinalizeErrorCode] = useState("");
  const [toastMessage, setToastMessage] = useState(location.state?.toast ?? "");
  const explaining = explainingTripIds.includes(currentTrip?.id);
  const [explainError, setExplainError] = useState("");
  const [explainErrorCode, setExplainErrorCode] = useState("");
  const aiExhausted = aiQuota?.remaining === 0 || explainErrorCode === "ai_daily_limit_reached";
  // 429 ai_trip_limit_reached: khoá nút trong lần xem này. Không lưu lại vì mã này cũng trả khi một lần gọi khác
  // của trip đang chờ kết quả; tải lại trang thì cho bấm lại, BE tự chặn nếu thật sự hết lượt.
  const [explainLocked, setExplainLocked] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const twoColumns = useMediaQuery(TWO_COLUMN_QUERY);
  const [activeTab, setActiveTab] = useState("replace");
  const [aiSheetOpen, setAiSheetOpen] = useState(false);
  // Chặng đang thay lưu trên URL (?thay=) để mở "Xem thông tin" rồi quay lại vẫn đúng chặng.
  // Chặng đã bị xoá/thay thì coi như chưa chọn.
  const selectedItem = currentTrip?.items.find((i) => i.id === searchParams.get("thay")) ?? null;
  const selectItem = useCallback((itemId) => {
    setSearchParams(itemId ? { thay: itemId } : {}, { replace: true });
    if (itemId) setActiveTab("replace");
  }, [setSearchParams]);
  const clearSelection = useCallback(() => selectItem(null), [selectItem]);
  const closeAiSheet = useCallback(() => setAiSheetOpen(false), []);
  const handleReplaced = (toast) => {
    selectItem(null);
    setToastMessage(toast);
  };

  useEffect(() => {
    activeRef.current = true;
    return () => { activeRef.current = false; };
  }, []);

  const handleOpenFinalizeModal = () => {
    setFinalizeError("");
    setFinalizeErrorCode("");
    setShowFinalizeModal(true);
    setCheckingQuota(true);
    Promise.resolve(refreshSubscription())
      .catch(() => {})
      .finally(() => {
        if (activeRef.current) setCheckingQuota(false);
      });
  };

  const handleCloseFinalizeModal = () => {
    setShowFinalizeModal(false);
  };

  const handleFinalize = async () => {
    // Không tải lại được gói thì vẫn cho chốt: BE tự kiểm tra lượt lưu và trả saved_trip_quota_exceeded
    if (finalizingRef.current) return;
    finalizingRef.current = true;
    setFinalizing(true);
    setFinalizeError("");
    setFinalizeErrorCode("");
    try {
      await finalizeTrip(currentTrip.id);
      if (!activeRef.current) return;
      await refreshSubscription().catch(() => {});
      if (!activeRef.current) return;
      setShowFinalizeModal(false);
      navigate("/finalized");
    } catch (err) {
      if (!activeRef.current) return;
      setFinalizeErrorCode(err.code || "");
      setFinalizeError(ITEM_ERROR_MESSAGES[err.code] ?? err.message);
      // Hết lượt lưu: tải lại số để thẻ nâng cấp hiện đúng "đã lưu x/y"
      if (err.code === "saved_trip_quota_exceeded") refreshSubscription().catch(() => {});
    } finally {
      finalizingRef.current = false;
      if (activeRef.current) setFinalizing(false);
    }
  };

  const handleDeleteItem = async (itemId) => {
    setDeleteError("");
    setDeletingItemId(itemId);
    try {
      await deleteItem(currentTrip.id, itemId);
      setToastMessage("Đã xoá địa điểm khỏi lịch trình");
    } catch (err) {
      setDeleteError(ITEM_ERROR_MESSAGES[err.code] ?? err.message);
    } finally {
      setDeletingItemId(null);
    }
  };

  const handleExplain = async () => {
    setExplainError("");
    setExplainErrorCode("");
    try {
      await explainTrip(currentTrip.id);
    } catch (err) {
      if (!activeRef.current) return;
      if (err.code === "ai_trip_limit_reached") setExplainLocked(true);
      // AI lỗi thì các câu lý do đang có vẫn giữ nguyên
      setExplainError(getAiErrorMessage(err));
      setExplainErrorCode(err.code || "");
    } finally {
      // Lượt AI trong ngày tính cả lần lỗi
      refreshSubscription();
    }
  };

  // "Muốn đổi gì?": AI ghép thay đổi vào tiêu chí của lịch này rồi mở form tạo lịch đã điền sẵn.
  // Kết quả là một trip MỚI, lịch này không bị sửa.
  const handleChangeParsed = (result) => {
    // Không đổi gì: ô nhập tự hiện message của BE (isTripRequest có thể true hoặc false nên dựa vào changed)
    if (result.changed.length === 0) return;
    navigate("/create", {
      state: {
        prefill: {
          fields: result.fields,
          changed: result.changed,
          missing: result.missing,
          base: toParseBase(currentTrip),
          origin: { latitude: currentTrip.startLatitude, longitude: currentTrip.startLongitude },
        },
      },
    });
  };

  useEffect(() => {
    if (!toastMessage) return undefined;
    const timer = setTimeout(() => setToastMessage(""), 2600);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  if (!currentTrip) {
    return (
      <div className="app-shell flex min-w-0 flex-col items-center justify-center gap-5 px-4 text-center">
        <span
          className="material-symbols-outlined text-primary"
          aria-hidden="true"
          style={{ fontSize: 40 }}
        >
          map_search
        </span>
        <p className="text-body-lg text-on-surface-variant text-center">
          Chưa có lịch trình nào.
          <br />
          Hãy tạo lịch trình mới!
        </p>
        <button
          onClick={() => navigate("/create")}
          className="min-h-11 rounded-[8px] bg-primary px-6 py-3 font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Tạo lịch trình
        </button>
      </div>
    );
  }

  const closedCount = currentTrip.items.filter((i) => i.openingStatus === "Closed").length;
  // Chặng đầu tiên sang ngày hôm sau: chèn dòng phân cách phía trên (cần biết ngày đi)
  const firstNextDayIndex = currentTrip.items.findIndex((i) => i.isNextDay);

  const replacePanel = selectedItem ? (
    <ReplacePlacePanel
      key={selectedItem.id}
      tripId={currentTrip.id}
      itemId={selectedItem.id}
      itemName={selectedItem.placeName}
      onReplaced={handleReplaced}
      onClose={clearSelection}
    />
  ) : (
    <div className="space-y-3 py-6 text-center text-body-md text-on-surface-variant">
      <span aria-hidden="true" className="material-symbols-outlined text-[28px] text-primary">swap_horiz</span>
      <p>
        Chọn <strong className="text-navy-dark">Thay thế</strong> ở một chặng để xem các địa điểm gợi ý thay thế.
      </p>
      <p className="text-[13px] text-text-muted">Thay địa điểm sửa ngay lịch này, không tốn lượt.</p>
    </div>
  );
  // Khung "Muốn đổi gì?" cũ, chuyển từ cuối trang vào tab/ngăn kéo "Hỏi AI", không đổi hành vi
  const assistant = !isDemo && (
    <TripRequestAssistant
      title="Muốn đổi gì?"
      description="AI sẽ tạo một lịch mới theo thay đổi của bạn (tốn 1 lượt tạo lịch). Lịch hiện tại không bị sửa."
      placeholder='Ví dụ: "rẻ hơn chút", "ngắn hơn 1 tiếng", "dời sang thứ bảy"'
      submitLabel="Xem thay đổi"
      base={toParseBase(currentTrip)}
      onParsed={handleChangeParsed}
      aiQuota={aiQuota}
      cooldownSeconds={aiCooldown}
      onSettled={(err) => {
        if (err) noteAiError(err);
        refreshSubscription();
      }}
      blockedReason={generateExhausted ? "Bạn đã hết lượt tạo lịch trình nên chưa tạo được lịch mới từ thay đổi này." : ""}
      hint={generateExhausted ? <UpgradeHint reason="generate" variant="inline" /> : null}
    />
  );
  const tabs = PANEL_TABS.filter((tab) => tab.id !== "ai" || !isDemo);
  const shownTab = activeTab === "ai" && !isDemo ? "ai" : "replace";

  return (
    <div className="app-shell flex min-w-0 flex-col">
      <header className="app-header flex h-16 items-center justify-between gap-3 border-b border-border-soft !bg-white px-4 py-2 sm:px-6 lg:px-8">
        <button
          aria-label="Quay lại"
          onClick={() => navigate(-1)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px] hover:bg-primary/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          <span className="material-symbols-outlined text-on-surface-variant">
            arrow_back
          </span>
        </button>
        <h1 className="min-w-0 text-body-md font-semibold leading-5 text-navy-dark sm:text-title-md">
          Lịch trình đề xuất
        </h1>
        <div className="shrink-0 rounded-[4px] border border-tertiary/20 bg-tertiary-container/20 px-2.5 py-1 text-tertiary">
          <span className="text-label-md font-bold">Nháp</span>
        </div>
      </header>

      <main className="content-shell !mx-auto !max-w-[960px] min-w-0 flex-1 px-4 pb-36 pt-24 sm:px-6 lg:px-8 xl:!max-w-[1360px]">
        <div className="xl:grid xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] xl:items-start xl:gap-8">
        <div className="min-w-0 space-y-6">
        <div className="space-y-3 border-b border-border-soft pb-6">
          <h2 className="break-words text-[24px] font-bold leading-8 tracking-normal text-navy-dark sm:text-[28px] sm:leading-9">
            {currentTrip.title}
          </h2>
          <p className="break-words text-body-md leading-6 text-text-muted">
            {currentTrip.summary}
          </p>

          <div className="grid grid-cols-3 gap-2 border-y border-border-soft py-4 sm:gap-4">
            {[
              { icon: "schedule", label: `${currentTrip.durationHours} tiếng` },
              {
                icon: "payments",
                label: `${formatCurrencyShort(currentTrip.estimatedBudget)}/người`,
              },
              { icon: "place", label: `${currentTrip.items.length} điểm` },
            ].map((item) => (
              <div
                key={item.icon}
                className="min-w-0 space-y-1"
              >
                <span aria-hidden="true" className="material-symbols-outlined text-primary text-[20px]">
                  {item.icon}
                </span>
                <p className="break-words text-[13px] font-semibold leading-5 text-navy-dark sm:text-body-md">
                  {item.label}
                </p>
              </div>
            ))}
          </div>

          {currentTrip.plannedDate && (
            <p className="text-label-md text-on-surface-variant mt-stack-sm">
              {formatPlannedDate(currentTrip.plannedDate)}
              {currentTrip.startTime && ` · xuất phát ${currentTrip.startTime}`}
            </p>
          )}
          {currentTrip.endTime && (
            <p className="text-label-md text-on-surface-variant mt-1">
              Kết thúc dự kiến {formatClock(currentTrip.endTime, currentTrip.endsNextDay)} · di chuyển{" "}
              {currentTrip.totalTravelMinutes ?? 0} phút
            </p>
          )}
          {currentTrip.travelMode === "Metro" && (
            <p className="text-label-md text-on-surface-variant mt-1">
              Đi Metro · giờ tàu là lịch dự kiến.
            </p>
          )}
          {currentTrip.note && (
            <p className="text-label-md text-on-surface-variant mt-1">
              Ghi chú: "{currentTrip.note}".{" "}
              {currentTrip.noteApplied
                ? "Đã ưu tiên theo ghi chú của bạn."
                : "Lần này lịch được tạo theo sở thích và vị trí, chưa áp dụng được ghi chú."}
            </p>
          )}
          {currentTrip.totalMinutes != null &&
            currentTrip.totalMinutes < currentTrip.durationHours * 60 - 30 && (
              <p className="text-label-md text-on-surface-variant mt-1">
                Lịch ngắn hơn thời gian bạn chọn vì chưa có thêm địa điểm phù hợp hoặc còn mở cửa vào giờ đó.
              </p>
            )}
          {closedCount > 0 && (
            <p className="mt-1 flex items-start gap-1.5 break-words text-label-md font-medium text-error">
              <span aria-hidden="true" className="material-symbols-outlined shrink-0 text-[16px]">schedule</span>
              {closedCount} địa điểm có thể đã đóng cửa vào giờ ghé. Bạn nên thay hoặc xoá các chặng đó.
            </p>
          )}

          {currentTrip.metroFriendly && (
            <div className="flex items-center gap-1.5 mt-stack-sm">
              <span className="material-symbols-outlined text-secondary text-[16px]">
                train
              </span>
              <span className="text-label-md text-secondary font-medium">
                Metro-friendly
              </span>
            </div>
          )}
        </div>

        {!isDemo && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExplain}
              disabled={explaining || explainLocked || aiQuota?.remaining === 0 || aiCooldown > 0}
              className="flex min-h-11 max-w-full items-center gap-2 rounded-[8px] border border-primary bg-white px-4 py-2.5 text-body-md font-semibold text-primary transition-colors hover:bg-primary/5 disabled:opacity-60 motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[20px]">auto_awesome</span>
              {explaining
                ? "AI đang viết…"
                : currentTrip.aiExplainedAt
                  ? "Nhờ AI viết lại lý do"
                  : "Nhờ AI viết lý do"}
            </button>
            <span className="text-label-md text-on-surface-variant">
              {currentTrip.aiExplainedAt ? "Lý do do AI viết. " : ""}
              {aiCooldown > 0
                ? `AI vừa gặp lỗi. Thử lại sau ${aiCooldown} giây.`
                : aiQuota ? getAiQuotaHint(aiQuota) : "Mỗi lần tính 1 lượt AI trong ngày."}
            </span>
            {explainError && (
              <p role="alert" className="w-full break-words text-body-md leading-6 text-error">{explainError}</p>
            )}
            {/* Một lời nhắc mỗi màn hình: hết lượt tạo lịch thì đã nhắc ở khung "Muốn đổi gì?" */}
            {!generateExhausted && aiExhausted && (
              <div className="w-full">
                <UpgradeHint reason="ai" variant="inline" />
              </div>
            )}
          </div>
        )}

        <div className="space-y-0">
          {currentTrip.items.map((item, idx) => (
            <div key={item.id}>
              {idx === firstNextDayIndex && currentTrip.plannedDate && (
                <p className="mb-4 flex items-center gap-2 text-label-md font-semibold text-primary">
                  <span aria-hidden="true" className="material-symbols-outlined text-[18px]">dark_mode</span>
                  Sang ngày {formatPlannedDate(addDays(currentTrip.plannedDate, 1))}
                </p>
              )}
            <div className="flex min-w-0 gap-3 sm:gap-4">
              <div className="flex flex-col items-center">
                <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-[13px] font-semibold text-on-primary">
                  {idx + 1}
                </div>
                {idx < currentTrip.items.length - 1 && (
                  <div className="w-0.5 flex-1 bg-primary-container/30 my-1 min-h-[16px]" />
                )}
              </div>

              <div className="mb-6 min-w-0 flex-1">
                {item.leg ? (
                  <LegInfo leg={item.leg} fromOrigin={idx === 0} />
                ) : (
                  <>
                    {/* Trip cũ / BE chưa trả leg */}
                    {idx === 0 && currentTrip.travelMinutesFromOrigin != null && (
                      <p className="mb-1 text-label-md text-on-surface-variant flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">
                          near_me
                        </span>
                        Đi {currentTrip.travelMinutesFromOrigin} phút từ điểm xuất phát
                      </p>
                    )}
                    {travelLabel(currentTrip, item) && (
                      <p className="mb-1 text-label-md text-on-surface-variant flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">
                          {travelLabel(currentTrip, item).icon}
                        </span>
                        {travelLabel(currentTrip, item).text}
                      </p>
                    )}
                  </>
                )}
                <div
                  className={`space-y-3 rounded-[8px] border bg-white p-4 sm:p-5 ${
                    selectedItem?.id === item.id ? "border-primary ring-2 ring-primary/20" : "border-border-soft"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 basis-40">
                      <span className="text-label-md text-primary font-bold">
                        {formatClock(item.time, item.isNextDay)}
                      </span>
                      <h3 className="mt-1 break-words text-body-lg font-semibold leading-6 text-navy-dark">
                        {item.placeName}
                      </h3>
                    </div>
                    <span className="max-w-full break-words rounded-[4px] bg-primary/5 px-2 py-1 text-[12px] font-medium leading-5 text-primary">
                      {item.placeCategory}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-on-surface-variant">
                    <span className="flex items-center gap-1 text-label-md">
                      <span className="material-symbols-outlined text-[14px]">
                        schedule
                      </span>
                      {formatDuration(item.durationMinutes)}
                    </span>
                    <span className="flex items-center gap-1 text-label-md">
                      <span className="material-symbols-outlined text-[14px]">
                        payments
                      </span>
                      {formatCurrencyShort(item.estimatedCost)}
                    </span>
                  </div>

                  {item.openingStatus === "Closed" && (
                    <p className="flex items-start gap-2 break-words rounded-[8px] border border-error/20 bg-error-container/10 p-3 text-[13px] leading-5 text-error">
                      <span aria-hidden="true" className="material-symbols-outlined shrink-0 text-[18px]">door_front</span>
                      Địa điểm có thể đã đóng cửa vào giờ này. Bạn nên thay hoặc xoá chặng này.
                    </p>
                  )}

                  {/* Chặng vừa thay địa điểm có reason = null cho tới khi nhờ AI viết lại */}
                  {explaining ? (
                    <p className="text-label-md text-on-surface-variant italic">AI đang viết…</p>
                  ) : (
                    item.reason && (
                      <p className="break-words border-l-2 border-primary/20 pl-3 text-[13px] leading-6 text-text-muted">
                        "{item.reason}"
                      </p>
                    )
                  )}

                  {/* SPEC-03 / FE-69: Nút chỉ đường trên từng điểm dừng Timeline */}
                  <TimelineItemDirections
                    prevStop={
                      idx > 0
                        ? currentTrip.items[idx - 1]
                        : {
                            latitude: currentTrip.startLatitude,
                            longitude: currentTrip.startLongitude,
                            placeName: "điểm xuất phát",
                          }
                    }
                    currentStop={item}
                    travelMode={mapsTravelMode(currentTrip, item)}
                    className="!flex-wrap !gap-2 !space-x-0 [&>div]:min-w-0 [&>div]:break-words [&_button]:min-h-11 [&_button]:focus-visible:outline [&_button]:focus-visible:outline-2 [&_button]:focus-visible:outline-primary"
                  />

                  {item.travelNote && (
                    <div className="flex items-start gap-2 rounded-[8px] bg-secondary/5 p-3">
                      <span className="material-symbols-outlined text-secondary text-[14px]">
                        train
                      </span>
                      <span className="min-w-0 break-words text-[13px] leading-5 text-secondary">
                        {item.travelNote}
                      </span>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 border-t border-border-soft pt-3">
                    <button
                      onClick={() => navigate(`/place/${item.placeId}`)}
                      className="flex min-h-11 min-w-0 flex-1 basis-28 items-center justify-center gap-1 rounded-[8px] bg-primary px-2 py-2 text-[13px] font-semibold text-on-primary transition-colors hover:bg-navy-dark motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      <span className="material-symbols-outlined text-[14px]">
                        info
                      </span>
                      Xem thông tin
                    </button>
                    <button
                      type="button"
                      onClick={() => selectItem(item.id)}
                      aria-pressed={selectedItem?.id === item.id}
                      className={`flex min-h-11 min-w-0 flex-1 basis-20 items-center justify-center gap-1 rounded-[8px] border px-2 py-2 text-[13px] font-semibold text-primary transition-colors hover:border-primary motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                        selectedItem?.id === item.id ? "border-primary bg-primary/5" : "border-border-soft"
                      }`}
                    >
                      <span aria-hidden="true" className="material-symbols-outlined text-[14px]">
                        swap_horiz
                      </span>
                      {selectedItem?.id === item.id ? "Đang thay" : "Thay thế"}
                    </button>
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      disabled={deletingItemId === item.id}
                      aria-label="Xoá địa điểm"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px] border border-error/30 text-error transition-colors hover:bg-error/5 disabled:opacity-60 motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-error"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        delete
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
            </div>
          ))}
        </div>

        {deleteError && (
          <p role="alert" className="break-words rounded-[8px] border border-error/20 bg-error-container/10 px-4 py-3 text-body-md leading-6 text-error">
            {deleteError}
          </p>
        )}

        </div>

        {twoColumns && (
          <aside
            aria-label="Chỉnh lịch trình"
            className="sticky top-24 max-h-[calc(100dvh-12rem)] overflow-y-auto overscroll-contain rounded-[8px] border border-border-soft bg-white"
          >
            <div role="tablist" aria-label="Cách chỉnh lịch" className="sticky top-0 z-10 flex border-b border-border-soft bg-white">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={`draft-tab-${tab.id}`}
                  aria-selected={shownTab === tab.id}
                  aria-controls="draft-tabpanel"
                  onClick={() => setActiveTab(tab.id)}
                  className={`min-h-11 flex-1 border-b-2 px-3 text-body-md font-semibold transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary ${
                    shownTab === tab.id ? "border-primary text-primary" : "border-transparent text-text-muted hover:text-navy-dark"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div role="tabpanel" id="draft-tabpanel" aria-labelledby={`draft-tab-${shownTab}`} className="p-4">
              {shownTab === "ai" ? assistant : replacePanel}
            </div>
          </aside>
        )}
        </div>
      </main>

      {/* Màn hẹp: nút nổi "Hỏi AI" nằm trên thanh nút cuối trang */}
      {!twoColumns && !isDemo && (
        <button
          type="button"
          onClick={() => setAiSheetOpen(true)}
          className="fixed bottom-24 right-4 z-40 flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-4 text-body-md font-semibold text-on-primary shadow-md transition-colors hover:bg-navy-dark motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[20px]">auto_awesome</span>
          Hỏi AI
        </button>
      )}
      <BottomSheet open={!twoColumns && Boolean(selectedItem)} title="Thay địa điểm" onClose={clearSelection}>
        {replacePanel}
      </BottomSheet>
      <BottomSheet open={!twoColumns && aiSheetOpen} title="Hỏi AI" onClose={closeAiSheet} showHeader>
        {assistant}
      </BottomSheet>

      <div className="app-footer flex min-h-20 gap-3 border-t border-border-soft !bg-white px-4 py-3 sm:px-6 lg:px-8">
        <button
          onClick={() => navigate("/create")}
          className="flex min-h-12 min-w-0 flex-1 items-center justify-center gap-1 rounded-[8px] border border-border-soft px-2 py-3 text-body-md font-semibold text-primary transition-colors hover:bg-primary/5 motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          <span className="material-symbols-outlined text-[18px]">refresh</span>
          Tạo lại
        </button>
        <button
          onClick={handleOpenFinalizeModal}
          className="flex min-h-12 min-w-0 flex-1 items-center justify-center gap-1 rounded-[8px] bg-primary px-2 py-3 text-body-md font-semibold text-on-primary transition-colors hover:bg-navy-dark motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          Chốt lịch trình
          <span className="material-symbols-outlined text-[18px]">
            check_circle
          </span>
        </button>
      </div>

      {toastMessage && (
        <div role="status" className="fixed bottom-40 left-1/2 z-[60] xl:bottom-24 flex w-max max-w-[calc(100%-32px)] -translate-x-1/2 items-center gap-3 rounded-[8px] bg-inverse-surface px-4 py-3 text-inverse-on-surface shadow-sm">
          <span className="material-symbols-outlined text-primary-container">
            check_circle
          </span>
          <span className="min-w-0 break-words text-[13px] font-medium leading-5">{toastMessage}</span>
        </div>
      )}

      {showFinalizeModal && (() => {
        const isExhausted = finalizeErrorCode === "saved_trip_quota_exceeded" || savedTripsFull;
        const tripSummary = (
          <div className="space-y-2 break-words border-y border-border-soft py-4">
            <p className="text-body-md text-on-surface">
              📍 {currentTrip.mainArea}
            </p>
            <p className="text-body-md text-on-surface">
              ⏱ {currentTrip.durationHours} tiếng · {currentTrip.items.length}{" "}
              địa điểm
            </p>
            <p className="text-body-md text-on-surface">
              💰 ~{formatCurrencyShort(currentTrip.estimatedBudget)}/người
            </p>
          </div>
        );

        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-6">
            <div role="dialog" aria-label="Chốt lịch trình" className="max-h-[92dvh] w-full max-w-lg space-y-5 overflow-y-auto overscroll-contain rounded-t-[8px] border border-border-soft bg-white p-5 text-body-md leading-6 shadow-lg animate-fade-in-up motion-reduce:animate-none sm:rounded-[8px] sm:p-6 [&_button]:min-h-11 [&_button]:min-w-0 [&_button]:break-words [&_button]:rounded-[8px] [&_button]:focus-visible:outline [&_button]:focus-visible:outline-2 [&_button]:focus-visible:outline-offset-2 [&_button]:focus-visible:outline-primary [&_button]:motion-reduce:transition-none">
              <div aria-hidden="true" className="mx-auto mb-2 h-1 w-10 rounded-full bg-border-soft sm:hidden" />

              {checkingQuota && (
                <p role="status" className="text-center text-on-surface-variant">
                  Đang kiểm tra lượt lưu của gói...
                </p>
              )}

              {isExhausted ? (
                /* Hết lượt lưu của gói: chỉ gợi ý nâng cấp */
                <>
                  <h3 className="text-title-md font-bold text-on-surface text-center">
                    Đã đạt giới hạn lưu lịch trình
                  </h3>
                  {tripSummary}
                  <UpgradeHint reason="savedTrips" />
                  <button
                    type="button"
                    onClick={handleCloseFinalizeModal}
                    className="w-full border border-border-soft px-4 py-3 font-semibold text-primary transition-colors hover:bg-primary/5"
                  >
                    Quay lại
                  </button>
                </>
              ) : (
                /* Chốt theo lượt lưu của gói */
                <>
                  <h3 className="text-title-md font-bold text-on-surface text-center">
                    Xác nhận chốt lịch trình?
                  </h3>
                  <p className="text-body-md text-on-surface-variant text-center">
                    Lịch trình sẽ được lưu và sẵn sàng sử dụng.
                  </p>
                  {tripSummary}

                  {finalizeError && (
                    <p role="alert" className="break-words rounded-[8px] border border-error/20 bg-error-container/10 px-3 py-2 text-body-md text-error">
                      {finalizeError}
                    </p>
                  )}

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={handleCloseFinalizeModal}
                      disabled={finalizing}
                      className="flex-1 border border-border-soft px-4 py-3 font-semibold text-primary transition-colors hover:bg-primary/5 disabled:opacity-50"
                    >
                      Quay lại
                    </button>
                    <button
                      type="button"
                      onClick={handleFinalize}
                      disabled={finalizing || checkingQuota}
                      className="flex-1 bg-primary px-4 py-3 font-semibold text-on-primary transition-colors hover:bg-navy-dark disabled:opacity-60"
                    >
                      {finalizing ? "Đang chốt..." : "Chốt lịch trình"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default function DraftItineraryPage() {
  const { user } = useAuth();
  const { currentTrip } = useTrip();
  return <DraftItineraryPageInner key={`${user?.id ?? "anonymous"}:${currentTrip?.id ?? "none"}`} />;
}
