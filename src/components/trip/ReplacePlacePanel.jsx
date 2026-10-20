import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { tripService } from "../../services/tripService";
import { useTrip } from "../../context/TripContext";
import { formatCurrencyShort } from "../../utils/formatCurrency";

const ALTERNATIVE_LIMIT = 5;

function formatDistance(meters) {
  if (meters == null) return "";
  return meters < 1000 ? `${Math.round(meters)}m` : `${(meters / 1000).toFixed(1)}km`;
}

const WARNING_LABELS = {
  different_station: "Khác cụm ga hiện tại",
  higher_cost: "Chi phí cao hơn điểm cũ",
  exceeds_duration: "Lịch kết thúc muộn hơn số giờ bạn chọn",
};

const REPLACE_ERROR_MESSAGES = {
  same_place: "Đây chính là địa điểm hiện tại.",
  place_not_found: "Địa điểm này không còn hoạt động. Hãy chọn địa điểm khác.",
  place_already_in_trip: "Địa điểm này đã có trong lịch trình.",
  itinerary_item_not_found: "Không tìm thấy chặng cần thay. Hãy tải lại lịch trình.",
  trip_finalized: "Lịch trình đã chốt nên không thay được địa điểm.",
  replacement_too_long: "Thay địa điểm này sẽ làm lịch dài quá 24 giờ. Hãy chọn địa điểm khác.",
};

// openingStatus của gợi ý, tính theo khung giờ của chặng đang thay. BE đã xếp Open → Unknown → Closed.
const OPENING_LABELS = {
  Open: { text: "Mở cửa vào giờ này", className: "text-secondary" },
  Closed: { text: "Có thể đã đóng cửa giờ này", className: "text-error" },
};

const FOCUS_RING = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/**
 * Danh sách gợi ý thay một chặng và nút Chọn. Dùng ở trang /replace/:itemId, khung bên phải và ngăn kéo của trang Nháp.
 * onReplaced(toast): gọi sau khi thay xong, kèm câu thông báo (có cảnh báo nếu BE trả).
 * onClose: có thì hiện tiêu đề "Thay …" kèm nút đóng. wide: trang riêng thì xếp 2 cột từ lg.
 */
export default function ReplacePlacePanel({ tripId, itemId, itemName, onReplaced, onClose, wide = false }) {
  const navigate = useNavigate();
  const { replaceItem } = useTrip();
  const [reloadCount, setReloadCount] = useState(0);
  // key: chặng + lần tải của kết quả đang giữ; khác key hiện tại nghĩa là đang tải
  const [result, setResult] = useState({ key: null, alternatives: [], error: "" });
  const [replacing, setReplacing] = useState(false);
  const [error, setError] = useState("");
  const requestKey = `${itemId}:${reloadCount}`;
  const loading = result.key !== requestKey;

  useEffect(() => {
    if (!tripId || !itemId) return undefined;
    let active = true;
    tripService
      .getItemAlternatives(tripId, itemId, ALTERNATIVE_LIMIT)
      .then((data) => {
        if (active) setResult({ key: requestKey, alternatives: data ?? [], error: "" });
      })
      .catch(() => {
        if (active) setResult({ key: requestKey, alternatives: [], error: "Chưa tải được gợi ý thay thế." });
      });
    // Đổi chặng giữa chừng thì bỏ kết quả của chặng cũ
    return () => {
      active = false;
    };
  }, [tripId, itemId, requestKey]);

  const handleReplace = async (placeId) => {
    if (!tripId || !itemId || replacing) return;
    setReplacing(true);
    setError("");
    try {
      const res = await replaceItem(tripId, itemId, placeId);
      const warningText = (res?.warnings ?? [])
        .map((w) => WARNING_LABELS[w])
        .filter(Boolean)
        .join(", ");
      onReplaced(warningText ? `Đã thay thế địa điểm (${warningText})` : "Đã thay thế địa điểm");
    } catch (err) {
      setError(REPLACE_ERROR_MESSAGES[err.code] ?? err.message);
    } finally {
      setReplacing(false);
    }
  };

  const alternatives = loading ? [] : result.alternatives;
  const hasClosed = alternatives.some((p) => p.openingStatus === "Closed");

  return (
    <div className="space-y-4">
      {onClose && (
        <div className="flex items-start justify-between gap-2">
          <h2 className="min-w-0 break-words text-body-lg font-semibold leading-6 text-navy-dark">
            Thay "{itemName}"
          </h2>
          <button
            type="button"
            aria-label="Đóng phần thay địa điểm"
            onClick={onClose}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-primary/5 ${FOCUS_RING}`}
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
      )}

      <p className="text-body-md text-on-surface-variant">
        Các gợi ý tương tự, phù hợp với lịch trình hiện tại:
      </p>
      {hasClosed && (
        <p className="text-label-md text-on-surface-variant">
          Nơi có thể đã đóng cửa vào giờ của chặng này được xếp cuối danh sách.
        </p>
      )}

      {error && (
        <p role="alert" className="text-label-md text-error bg-error-container/10 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {loading && (
        <p role="status" className="py-6 text-center text-body-md text-on-surface-variant">
          Đang tải gợi ý…
        </p>
      )}
      {!loading && result.error && (
        <div role="alert" className="space-y-2 py-4 text-center text-body-md text-error">
          <p>{result.error}</p>
          <button
            type="button"
            onClick={() => setReloadCount((n) => n + 1)}
            className={`min-h-11 rounded-[8px] border border-border-soft px-4 font-semibold text-primary hover:bg-primary/5 ${FOCUS_RING}`}
          >
            Thử lại
          </button>
        </div>
      )}
      {!loading && !result.error && alternatives.length === 0 && (
        <p className="text-body-md text-on-surface-variant text-center py-8">
          Không tìm thấy gợi ý phù hợp.
        </p>
      )}

      <div className={`grid gap-4 ${wide ? "lg:grid-cols-2" : ""}`}>
        {alternatives.map((place) => {
          const opening = OPENING_LABELS[place.openingStatus];
          const closed = place.openingStatus === "Closed";
          return (
            <div key={place.placeId} className={`card space-y-stack-sm ${closed ? "border border-error/20" : ""}`}>
              {place.imageUrl && (
                <img
                  src={place.imageUrl}
                  alt={place.name}
                  className={`h-36 w-full rounded-lg object-cover ${closed ? "opacity-60 grayscale" : ""}`}
                />
              )}
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="break-words text-body-md font-bold text-on-surface">
                    {place.name}
                  </h3>
                  <p className="break-words text-label-md text-on-surface-variant">
                    {place.address}
                  </p>
                  <p className="text-label-md text-on-surface-variant">
                    Ga {place.stationName} · {formatDistance(place.distanceFromStationMeters)}
                  </p>
                  {opening && (
                    <p className={`mt-1 flex items-center gap-1 text-label-md font-semibold ${opening.className}`}>
                      <span aria-hidden="true" className="material-symbols-outlined text-[14px]">schedule</span>
                      {opening.text}
                    </p>
                  )}
                </div>

                <span className="px-2 py-0.5 bg-primary-container/15 text-on-primary-container text-[10px] rounded-full font-bold ml-2">
                  {place.category}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-on-surface-variant">
                <span className="flex items-center gap-1 text-label-md">
                  <span aria-hidden="true" className="material-symbols-outlined text-[14px]">
                    payments
                  </span>
                  {formatCurrencyShort(place.estimatedCostMin)}–
                  {formatCurrencyShort(place.estimatedCostMax)}
                </span>

                {place.matchScore != null && (
                  <span className="flex items-center gap-1 text-label-md text-primary font-bold">
                    {Math.round(place.matchScore * 100)}% tương đồng
                  </span>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => navigate(`/place/${place.placeId}`)}
                  className={`flex-1 py-2 border border-outline-variant text-on-surface-variant rounded-full text-label-md font-bold active:scale-95 transition-all hover:border-primary hover:text-primary ${FOCUS_RING}`}
                >
                  Xem thông tin
                </button>

                <button
                  type="button"
                  onClick={() => handleReplace(place.placeId)}
                  disabled={replacing}
                  className={`flex-1 py-2 bg-primary text-on-primary rounded-full text-label-md font-bold active:scale-95 transition-all disabled:opacity-60 ${FOCUS_RING}`}
                >
                  Chọn địa điểm này
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[13px] leading-5 text-text-muted">
        Thay địa điểm sửa ngay lịch này, không tốn lượt.
      </p>
    </div>
  );
}
