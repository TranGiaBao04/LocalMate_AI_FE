import { useEffect, useState, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTrip } from "../../context/TripContext";
import { useAuth } from "../../context/AuthContext";
import { useSubscription } from "../../context/SubscriptionContext";
import {
  formatCurrencyShort,
  formatDuration,
} from "../../utils/formatCurrency";
import { formatPlannedDate } from "../../utils/vnTime";
import TimelineItemDirections from "../../components/TimelineItemDirections";
import { itineraryPurchaseService, canPurchaseSingle, isAvailableSingleEntitlement } from "../../services/itineraryPurchaseService";
import SingleItineraryPaymentModal from "../../components/itineraryPurchase/SingleItineraryPaymentModal";
import { formatPlanPrice } from "../../utils/subscriptionUtils";
import TripRequestAssistant from "../../components/trip/TripRequestAssistant";
import { toParseBase } from "../../services/tripService";
import { getAiErrorMessage } from "../../utils/aiErrors";

const ITEM_ERROR_MESSAGES = {
  cannot_delete_last_item: "Lịch trình cần ít nhất một địa điểm nên không xoá được chặng cuối cùng.",
  trip_finalized: "Lịch trình đã chốt nên không sửa được nữa.",
  already_finalized: "Lịch trình này đã được chốt rồi.",
  itinerary_item_not_found: "Không tìm thấy địa điểm này. Hãy tải lại lịch trình.",
  saved_trip_quota_exceeded: "Bạn đã đạt giới hạn lịch trình được lưu của gói hiện tại.",
  entitlement_consumed: "Lượt mua lẻ này đã được sử dụng trước đó.",
  entitlement_not_found: "Không tìm thấy quyền mua lẻ hợp lệ.",
  invalid_funding: "Nguồn thanh toán lịch trình không hợp lệ.",
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
      <p className="mb-1 text-label-md text-on-surface-variant flex items-center gap-1">
        <span className="material-symbols-outlined text-[14px]">{mode.icon}</span>
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
    <div className="mb-1 rounded bg-secondary/5 px-2 py-1 text-label-md">
      <p className="flex items-center gap-1 font-medium text-secondary">
        <span className="material-symbols-outlined text-[14px]">train</span>
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

function DraftItineraryPageInner() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentTrip, finalizeTrip, deleteItem, explainTrip } = useTrip();
  const { isDemo } = useAuth();
  const { refreshSubscription } = useSubscription();
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [showSinglePurchaseModal, setShowSinglePurchaseModal] = useState(false);
  const [availability, setAvailability] = useState(null);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [availableEntitlements, setAvailableEntitlements] = useState([]);
  const activeRef = useRef(true);
  const availabilityGeneration = useRef(0);
  const finalizingRef = useRef(false);
  const [finalizing, setFinalizing] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [finalizeError, setFinalizeError] = useState("");
  const [finalizeErrorCode, setFinalizeErrorCode] = useState("");
  const [toastMessage, setToastMessage] = useState(location.state?.toast ?? "");
  const [explaining, setExplaining] = useState(false);
  const [explainError, setExplainError] = useState("");
  // 429 ai_trip_limit_reached: trip này đã hết số lần nhờ AI viết lý do
  const [explainLocked, setExplainLocked] = useState(false);

  const fetchAvailability = useCallback(async () => {
    const generation = ++availabilityGeneration.current;
    setLoadingAvailability(true);
    setAvailability(null);
    setAvailableEntitlements([]);
    try {
      const [data, evidence] = await Promise.all([
        itineraryPurchaseService.getAvailability(),
        itineraryPurchaseService.getMyEntitlements(),
      ]);
      if (!activeRef.current || generation !== availabilityGeneration.current) return null;
      setAvailability(data);
      setAvailableEntitlements(evidence?.entitlements?.filter(isAvailableSingleEntitlement) ?? []);
      return data;
    } catch {
      return null;
    } finally {
      if (activeRef.current && generation === availabilityGeneration.current) setLoadingAvailability(false);
    }
  }, []);

  useEffect(() => {
    activeRef.current = true;
    return () => { activeRef.current = false; };
  }, []);

  const handleOpenFinalizeModal = () => {
    setFinalizeError("");
    setFinalizeErrorCode("");
    setShowFinalizeModal(true);
    fetchAvailability();
  };

  const handleCloseFinalizeModal = () => {
    setShowFinalizeModal(false);
  };

  const handleFinalize = async () => {
    if (finalizingRef.current || availability?.normalFinalizeAvailable !== true) return;
    finalizingRef.current = true;
    setFinalizing(true);
    setFinalizeError("");
    setFinalizeErrorCode("");
    try {
      await finalizeTrip(currentTrip.id, { fundingSource: "Normal" });
      if (!activeRef.current) return;
      await fetchAvailability();
      await refreshSubscription().catch(() => {});
      if (!activeRef.current) return;
      setShowFinalizeModal(false);
      navigate("/finalized");
    } catch (err) {
      if (!activeRef.current) return;
      setFinalizeErrorCode(err.code || "");
      setFinalizeError(ITEM_ERROR_MESSAGES[err.code] ?? err.message);
      if (err.code === "saved_trip_quota_exceeded") {
        fetchAvailability();
      }
    } finally {
      finalizingRef.current = false;
      if (activeRef.current) setFinalizing(false);
    }
  };

  const handleFinalizeWithSingleEntitlement = async (entitlementIdToUse = null) => {
    if (finalizingRef.current) return;
    finalizingRef.current = true;
    setFinalizing(true);
    setFinalizeError("");
    setFinalizeErrorCode("");
    try {
      const myData = await itineraryPurchaseService.getMyEntitlements();
      if (!activeRef.current) return;
      const available = myData?.entitlements?.find((e) =>
        isAvailableSingleEntitlement(e) && (!entitlementIdToUse || e.entitlementId === entitlementIdToUse));
      const targetEntitlementId = available?.entitlementId;

      if (!targetEntitlementId) {
        throw new Error(
          "Không tìm thấy lượt mua lẻ khả dụng nào. Vui lòng thử lại.",
        );
      }

      await finalizeTrip(currentTrip.id, {
        fundingSource: "SingleEntitlement",
        entitlementId: targetEntitlementId,
      });
      if (!activeRef.current) return;
      await fetchAvailability();
      await refreshSubscription().catch(() => {});
      if (!activeRef.current) return;
      setShowFinalizeModal(false);
      setShowSinglePurchaseModal(false);
      navigate("/finalized");
    } catch (err) {
      if (!activeRef.current) return;
      setFinalizeErrorCode(err.code || "");
      setFinalizeError(ITEM_ERROR_MESSAGES[err.code] ?? err.message);
      fetchAvailability();
    } finally {
      finalizingRef.current = false;
      if (activeRef.current) setFinalizing(false);
    }
  };

  const handleUsePurchasedEntitlement = async (entitlement) => {
    if (isAvailableSingleEntitlement(entitlement)) {
      await handleFinalizeWithSingleEntitlement(entitlement.entitlementId);
    } else {
      setShowSinglePurchaseModal(false);
      setShowFinalizeModal(true);
      fetchAvailability();
    }
  };

  const handleClosePurchaseModal = () => {
    setShowSinglePurchaseModal(false);
    fetchAvailability();
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
    setExplaining(true);
    try {
      await explainTrip(currentTrip.id);
    } catch (err) {
      if (!activeRef.current) return;
      if (err.code === "ai_trip_limit_reached") setExplainLocked(true);
      // AI lỗi thì các câu lý do đang có vẫn giữ nguyên
      setExplainError(getAiErrorMessage(err));
    } finally {
      if (activeRef.current) setExplaining(false);
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
      <div className="app-shell flex flex-col items-center justify-center gap-4 px-container-margin">
        <span
          className="material-symbols-outlined text-primary"
          style={{ fontSize: 64 }}
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
          className="btn-primary w-auto px-8"
        >
          Tạo lịch trình
        </button>
      </div>
    );
  }

  return (
    <div className="app-shell flex flex-col">
      <header className="app-header flex h-16 items-center justify-between border-b border-outline-variant/20 px-container-margin py-stack-sm lg:px-8">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full hover:bg-surface-container-high flex items-center justify-center"
        >
          <span className="material-symbols-outlined text-on-surface-variant">
            arrow_back
          </span>
        </button>
        <h1 className="text-title-md font-semibold text-on-surface">
          Lịch trình đề xuất
        </h1>
        <div className="px-3 py-1 bg-tertiary-container/30 text-tertiary rounded-full">
          <span className="text-label-md font-bold">Nháp</span>
        </div>
      </header>

      <main className="content-shell flex-1 space-y-stack-md px-container-margin pb-32 pt-20 lg:px-8">
        <div className="card bg-gradient-to-br from-primary/5 to-primary-container/10 border-primary/20">
          <h2 className="text-title-md font-bold text-on-surface mb-1">
            {currentTrip.title}
          </h2>
          <p className="text-body-md text-on-surface-variant mb-stack-md">
            {currentTrip.summary}
          </p>

          <div className="grid grid-cols-3 gap-2 text-center">
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
                className="bg-surface-container-lowest rounded-DEFAULT p-2"
              >
                <span className="material-symbols-outlined text-primary text-[18px]">
                  {item.icon}
                </span>
                <p className="text-label-md font-bold text-on-surface mt-0.5">
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
              Kết thúc dự kiến {currentTrip.endTime} · di chuyển{" "}
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
                : "Chưa tìm được địa điểm khớp với ghi chú của bạn, lịch được tạo theo sở thích và vị trí."}
            </p>
          )}
          {currentTrip.totalMinutes != null &&
            currentTrip.totalMinutes < currentTrip.durationHours * 60 - 30 && (
              <p className="text-label-md text-on-surface-variant mt-1">
                Lịch ngắn hơn thời gian bạn chọn vì chưa có thêm địa điểm phù hợp.
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
              disabled={explaining || explainLocked}
              className="flex min-h-10 items-center gap-1 rounded-full border border-primary px-4 py-2 text-label-md font-bold text-primary transition-all active:scale-95 disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
              {explaining
                ? "AI đang viết…"
                : currentTrip.aiExplainedAt
                  ? "Nhờ AI viết lại lý do"
                  : "Nhờ AI viết lý do"}
            </button>
            <span className="text-label-md text-on-surface-variant">
              {currentTrip.aiExplainedAt ? "Lý do do AI viết. " : ""}Mỗi lần tính 1 lượt AI trong ngày.
            </span>
            {explainError && (
              <p role="alert" className="w-full text-label-md text-error">{explainError}</p>
            )}
          </div>
        )}

        <div className="space-y-0">
          {currentTrip.items.map((item, idx) => (
            <div key={item.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center text-[11px] font-bold flex-shrink-0 mt-1">
                  {idx + 1}
                </div>
                {idx < currentTrip.items.length - 1 && (
                  <div className="w-0.5 flex-1 bg-primary-container/30 my-1 min-h-[16px]" />
                )}
              </div>

              <div className="flex-1 mb-4">
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
                <div className="card space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-label-md text-primary font-bold">
                        {item.time}
                      </span>
                      <h3 className="text-body-md font-bold text-on-surface leading-tight">
                        {item.placeName}
                      </h3>
                    </div>
                    <span className="px-2 py-0.5 bg-primary-container/15 text-on-primary-container text-[10px] rounded-full font-bold ml-2 flex-shrink-0">
                      {item.placeCategory}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-on-surface-variant">
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

                  {/* Chặng vừa thay địa điểm có reason = null cho tới khi nhờ AI viết lại */}
                  {explaining ? (
                    <p className="text-label-md text-on-surface-variant italic">AI đang viết…</p>
                  ) : (
                    item.reason && (
                      <p className="text-label-md text-on-surface-variant italic">
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
                  />

                  {item.travelNote && (
                    <div className="flex items-center gap-1.5 bg-secondary/5 rounded px-2 py-1">
                      <span className="material-symbols-outlined text-secondary text-[14px]">
                        train
                      </span>
                      <span className="text-label-md text-secondary">
                        {item.travelNote}
                      </span>
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => navigate(`/place/${item.placeId}`)}
                      className="flex-1 py-2 bg-primary text-on-primary rounded-full text-label-md font-bold flex items-center justify-center gap-1 active:scale-95 transition-all"
                    >
                      <span className="material-symbols-outlined text-[14px]">
                        info
                      </span>
                      Xem thông tin
                    </button>
                    <button
                      onClick={() => navigate(`/replace/${item.id}`)}
                      className="flex-1 py-2 border border-outline-variant text-on-surface-variant rounded-full text-label-md font-bold flex items-center justify-center gap-1 active:scale-95 transition-all hover:border-primary hover:text-primary"
                    >
                      <span className="material-symbols-outlined text-[14px]">
                        swap_horiz
                      </span>
                      Thay thế
                    </button>
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      disabled={deletingItemId === item.id}
                      aria-label="Xoá địa điểm"
                      className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full border border-error/40 text-error active:scale-95 transition-all disabled:opacity-60"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        delete
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {deleteError && (
          <p className="text-label-md text-error bg-error-container/10 rounded-lg px-3 py-2">
            {deleteError}
          </p>
        )}

        {!isDemo && (
          <TripRequestAssistant
            title="Muốn đổi gì?"
            placeholder='Ví dụ: "rẻ hơn chút", "ngắn hơn 1 tiếng", "dời sang thứ bảy"'
            submitLabel="Xem thay đổi"
            base={toParseBase(currentTrip)}
            onParsed={handleChangeParsed}
          />
        )}
      </main>

      <div className="app-footer flex gap-3 border-t border-outline-variant/20 px-container-margin py-stack-md lg:px-8">
        <button
          onClick={() => navigate("/create")}
          className="flex-1 py-3 border border-primary text-primary rounded-full font-semibold text-button active:scale-95 transition-all flex items-center justify-center gap-1"
        >
          <span className="material-symbols-outlined text-[18px]">refresh</span>
          Tạo lại
        </button>
        <button
          onClick={handleOpenFinalizeModal}
          className="flex-1 py-3 bg-primary text-on-primary rounded-full font-semibold text-button active:scale-95 transition-all shadow-lg shadow-primary/30 flex items-center justify-center gap-1"
        >
          Chốt lịch trình
          <span className="material-symbols-outlined text-[18px]">
            check_circle
          </span>
        </button>
      </div>

      {toastMessage && (
        <div className="fixed bottom-24 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-3 rounded-full bg-inverse-surface px-6 py-3 text-inverse-on-surface shadow-2xl">
          <span className="material-symbols-outlined text-primary-container">
            check_circle
          </span>
          <span className="text-label-md font-medium">{toastMessage}</span>
        </div>
      )}

      {showFinalizeModal && (() => {
        const isExhausted =
          finalizeErrorCode === "saved_trip_quota_exceeded" ||
          (availability != null && availability.normalFinalizeAvailable === false);
        const unusedCount = availability?.unusedEntitlementCount ?? 0;
        const singleTripPrice = canPurchaseSingle(availability) ? availability.price : null;
        const quotaDisplay =
          availability?.normalSavedTripsUsed != null && availability?.normalSavedTripLimit != null
            ? `${availability.normalSavedTripsUsed}/${availability.normalSavedTripLimit}`
            : null;

        return (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center">
            <div role="dialog" aria-label="Chốt lịch trình" className="w-full max-w-md bg-surface rounded-t-lg p-stack-lg space-y-stack-md animate-fade-in-up lg:rounded-lg max-h-[92vh] overflow-y-auto">
              <div className="w-10 h-1 bg-outline-variant rounded-full mx-auto mb-2" />

              {(loadingAvailability || !availability) && <div role="status" className="space-y-2 text-center">
                <p>{loadingAvailability ? "Đang kiểm tra hạn mức và lượt mua lẻ..." : "Chưa thể tải thông tin khả dụng."}</p>
                {!loadingAvailability && <button type="button" onClick={fetchAvailability} className="rounded-lg border px-4 py-2">Tải lại thông tin khả dụng</button>}
              </div>}

              {isExhausted && unusedCount > 0 ? (
                /* CASE 2: Normal exhausted BUT user has unused single entitlements */
                <>
                  <h3 className="text-title-md font-bold text-on-surface text-center">
                    Chốt bằng lượt mua lẻ
                  </h3>
                  <p className="text-body-md text-on-surface-variant text-center">
                    Lịch trình này sẽ được lưu vĩnh viễn và không bị tính vào giới hạn gói.
                  </p>

                  <div className="card space-y-1">
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

                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-1.5 text-left">
                    <div className="flex items-center gap-2 text-primary font-semibold text-body-sm">
                      <span className="material-symbols-outlined text-[20px]">
                        confirmation_number
                      </span>
                      <span>
                        Bạn đang có {unusedCount} lượt mua lẻ chưa sử dụng
                      </span>
                    </div>
                    <p className="text-body-xs text-on-surface-variant leading-relaxed">
                      Bạn đã dùng hết lượt lưu theo gói hiện tại{quotaDisplay ? ` (${quotaDisplay} lịch trình)` : ""}.
                      Bạn có thể sử dụng 1 lượt mua lẻ để chốt lịch trình này ngay.
                    </p>
                  </div>

                  {finalizeError && finalizeErrorCode !== "saved_trip_quota_exceeded" && (
                    <p role="alert" className="text-label-md text-error bg-error-container/10 rounded-lg px-3 py-2">
                      {finalizeError}
                    </p>
                  )}

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={handleCloseFinalizeModal}
                      disabled={finalizing}
                      className="flex-1 py-3 border border-outline-variant text-on-surface-variant rounded-full font-semibold active:scale-95 transition-all disabled:opacity-50"
                    >
                      Quay lại
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFinalizeWithSingleEntitlement()}
                      disabled={finalizing || availableEntitlements.length === 0 || loadingAvailability}
                      className="flex-1 py-3 bg-primary text-on-primary rounded-full font-semibold active:scale-95 transition-all shadow-lg shadow-primary/30 disabled:opacity-60 flex items-center justify-center gap-1.5"
                    >
                      {finalizing ? "Đang chốt..." : "Dùng 1 lượt để chốt"}
                    </button>
                  </div>
                </>
              ) : isExhausted && unusedCount === 0 ? (
                /* CASE 3: Normal exhausted AND no single entitlements */
                <>
                  <h3 className="text-title-md font-bold text-on-surface text-center">
                    Đã đạt giới hạn lưu lịch trình
                  </h3>
                  <p className="text-body-md text-on-surface-variant text-center">
                    Gói hiện tại của bạn đã đạt giới hạn số lịch trình được lưu.
                  </p>

                  <div className="card space-y-1">
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

                  <div
                    role="alert"
                    className="rounded-xl border border-error/20 bg-error-container/10 p-stack-md space-y-3"
                  >
                    <div className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-error text-[20px] shrink-0 mt-0.5">
                        folder_off
                      </span>
                      <div className="space-y-1">
                        <p className="font-semibold text-body-md text-error">
                          {finalizeError || "Bạn đã đạt giới hạn lịch trình được lưu của gói hiện tại."}
                        </p>
                        <p className="text-body-sm text-on-surface-variant">
                          Bạn có thể mua một lượt chốt và để dành cho lịch trình bất kỳ. Nâng cấp sang gói phù hợp để có thêm hạn mức.
                        </p>
                      </div>
                    </div>

                    {quotaDisplay && (
                      <div className="bg-surface rounded-lg p-3 text-body-sm border border-outline-variant/10 flex justify-between text-on-surface">
                        <span>Đã lưu:</span>
                        <span className="font-semibold">
                          {quotaDisplay} lịch trình
                        </span>
                      </div>
                    )}

                    <div className="space-y-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          if (loadingAvailability || !canPurchaseSingle(availability)) return;
                          setShowFinalizeModal(false);
                          setShowSinglePurchaseModal(true);
                        }}
                        disabled={loadingAvailability || !canPurchaseSingle(availability)}
                        className="w-full py-2.5 px-4 bg-primary text-on-primary rounded-full font-semibold text-label-md flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-sm disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          shopping_bag
                        </span>
                        {singleTripPrice != null ? `Mua thêm 1 lịch trình — ${formatPlanPrice(singleTripPrice)}` : "Mua thêm lịch trình chưa khả dụng"}
                      </button>
                      {!canPurchaseSingle(availability) && !loadingAvailability && <p className="text-body-sm text-on-surface-variant">Hiện chưa thể mua thêm lịch trình. Vui lòng tải lại thông tin khả dụng.</p>}

                      <button
                        type="button"
                        onClick={() => {
                          setShowFinalizeModal(false);
                          navigate("/subscription");
                        }}
                        className="w-full py-2.5 px-4 bg-surface-container-high text-on-surface rounded-full font-semibold text-label-md flex items-center justify-center gap-2 hover:bg-surface-container-highest transition-all"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          workspace_premium
                        </span>
                        Nâng cấp gói dịch vụ
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleCloseFinalizeModal}
                    className="w-full py-3 border border-outline-variant text-on-surface-variant rounded-full font-semibold active:scale-95 transition-all"
                  >
                    Quay lại
                  </button>
                </>
              ) : (
                /* CASE 1: Normal finalize available */
                <>
                  <h3 className="text-title-md font-bold text-on-surface text-center">
                    Xác nhận chốt lịch trình?
                  </h3>
                  <p className="text-body-md text-on-surface-variant text-center">
                    Lịch trình sẽ được lưu và sẵn sàng sử dụng.
                  </p>

                  <div className="card space-y-1">
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

                  {unusedCount > 0 && (
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 flex items-center gap-2.5 text-on-surface-variant text-body-sm text-left">
                      <span className="material-symbols-outlined text-primary text-[20px] shrink-0">
                        info
                      </span>
                      <span>
                        Bạn đang dùng lượt lưu theo gói hiện tại. Bạn còn{" "}
                        <strong className="text-primary font-bold">
                          {unusedCount}
                        </strong>{" "}
                        lượt mua lẻ dự phòng.
                      </span>
                    </div>
                  )}

                  {finalizeError && (
                    <p role="alert" className="text-label-md text-error bg-error-container/10 rounded-lg px-3 py-2">
                      {finalizeError}
                    </p>
                  )}

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={handleCloseFinalizeModal}
                      disabled={finalizing}
                      className="flex-1 py-3 border border-outline-variant text-on-surface-variant rounded-full font-semibold active:scale-95 transition-all disabled:opacity-50"
                    >
                      Quay lại
                    </button>
                    <button
                      type="button"
                      onClick={handleFinalize}
                      disabled={finalizing || loadingAvailability || availability?.normalFinalizeAvailable !== true}
                      className="flex-1 py-3 bg-primary text-on-primary rounded-full font-semibold active:scale-95 transition-all shadow-lg shadow-primary/30 disabled:opacity-60"
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

      {showSinglePurchaseModal && (
        <SingleItineraryPaymentModal
          isOpen={showSinglePurchaseModal}
          onClose={handleClosePurchaseModal}
          draftTripId={currentTrip.id}
          availability={availability}
          onUseEntitlement={handleUsePurchasedEntitlement}
        />
      )}
    </div>
  );
}

export default function DraftItineraryPage() {
  const { user } = useAuth();
  const { currentTrip } = useTrip();
  return <DraftItineraryPageInner key={`${user?.id ?? "anonymous"}:${currentTrip?.id ?? "none"}`} />;
}
