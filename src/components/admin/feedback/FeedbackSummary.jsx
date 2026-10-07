import { useEffect, useState } from "react";
import DashboardRangeFilter from "../dashboard/DashboardRangeFilter";
import {
  DEFAULT_RANGE_PRESET,
  countDays,
  countFormatter,
  formatDayLabel,
  getDashboardFieldErrors,
  resolvePresetRange,
} from "../dashboard/dashboardUtils";
import { AdminErrorState, AdminSurface, StatusBadge } from "../ui";
import RatingStars from "../../ui/RatingStars";
import { adminFeedbackService } from "../../../services/adminFeedbackService";
import { formatRating } from "../../../utils/formatCurrency";
import { formatTimeInVietnam } from "../../../utils/vnTime";


function Stat({ label, value, loading, children }) {
  return (
    <AdminSurface density="compact">
      <p className="text-[13px] font-medium text-[#5C6B8A]">{label}</p>
      {loading ? (
        <div className="mt-3 h-8 w-20 animate-pulse rounded bg-[#F4F6FA]" />
      ) : (
        <p className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-2xl font-bold text-[#0F2148]">{value}</span>
          {children}
        </p>
      )}
    </AdminSurface>
  );
}

function Panel({ title, description, loading, children }) {
  return (
    <AdminSurface as="section">
      <h3 className="text-base font-bold leading-6 text-[#0F2148]">{title}</h3>
      {description && <p className="mt-1 text-sm leading-6 text-[#5C6B8A]">{description}</p>}
      {loading ? <div className="mt-4 h-40 animate-pulse rounded-[12px] bg-[#F4F6FA]" /> : children}
    </AdminSurface>
  );
}

// items: [{ key, label, count }]. BE luôn trả đủ mọi mức/mã, kể cả 0 lượt.
function BarList({ items, emptyText }) {
  const max = Math.max(1, ...items.map((item) => item.count));
  if (items.every((item) => item.count === 0)) {
    return <p className="mt-4 text-sm text-[#5C6B8A]">{emptyText}</p>;
  }
  return (
    <ul className="mt-4 space-y-3">
      {items.map((item) => (
        <li key={item.key}>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 break-words font-medium text-[#0F2148]">{item.label}</span>
            <span className="shrink-0 font-bold text-[#0F2148]">{countFormatter.format(item.count)}</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#F4F6FA]">
            <div className="h-full rounded-full bg-primary" style={{ width: `${(item.count / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

// Thống kê theo ngày gửi (giờ VN). Luật khoảng ngày giống dashboard: to ≤ hôm nay, tối đa 366 ngày.
// reviewTagLabels / feedbackTagLabels: { mã: nhãn } từ master-data, thiếu thì hiện mã.
export default function FeedbackSummary({ reviewTagLabels, feedbackTagLabels, onOpenPlaceReviews }) {
  const [preset, setPreset] = useState(DEFAULT_RANGE_PRESET);
  const [range, setRange] = useState(() => resolvePresetRange(DEFAULT_RANGE_PRESET));
  const [reloadCount, setReloadCount] = useState(0);
  const [result, setResult] = useState({ key: null, data: null, error: "", fieldErrors: null });

  const key = `${range.from}|${range.to}|${reloadCount}`;
  const loading = result.key !== key;
  const data = loading ? null : result.data;
  const reviews = data?.reviews;
  const tripFeedback = data?.tripFeedback;

  useEffect(() => {
    let active = true;
    adminFeedbackService
      .getSummary(range)
      .then((summary) => {
        if (active) setResult({ key, data: summary, error: "", fieldErrors: null });
      })
      .catch((err) => {
        if (!active) return;
        const fieldErrors = getDashboardFieldErrors(err, "invalid_admin_feedback_query");
        setResult({
          key,
          data: null,
          fieldErrors,
          error: fieldErrors
            ? "Khoảng ngày chưa hợp lệ, kiểm tra lại ô được đánh dấu."
            : err?.message || "Không tải được thống kê.",
        });
      });
    return () => { active = false; };
  }, [range, key]);

  const handlePresetChange = (nextPreset) => {
    if (nextPreset === preset) return;
    setPreset(nextPreset);
    // "Tùy chọn": giữ khoảng đang xem tới khi bấm Áp dụng
    if (nextPreset !== "custom") setRange(resolvePresetRange(nextPreset));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div className="text-sm text-[#5C6B8A]">
          <p>
            Từ {formatDayLabel(range.from)} đến {formatDayLabel(range.to)} · {countDays(range)} ngày, tính theo ngày gửi (giờ Việt Nam).
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs">
            {data?.generatedAt && <span>Cập nhật lúc {formatTimeInVietnam(data.generatedAt)}</span>}
            <button
              type="button"
              onClick={() => setReloadCount((count) => count + 1)}
              disabled={loading}
              className="inline-flex min-h-11 items-center gap-2 font-semibold text-[#1D3E82] disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-[16px] ${loading ? "animate-spin" : ""}`}>refresh</span>
              Tải lại
            </button>
          </p>
        </div>
        <DashboardRangeFilter
          preset={preset}
          range={range}
          serverErrors={loading ? null : result.fieldErrors}
          onPresetChange={handlePresetChange}
          onApplyCustom={setRange}
        />
      </div>

      {!loading && result.error && <AdminErrorState message={result.error} onRetry={() => setReloadCount(count => count + 1)} />}

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Đánh giá địa điểm" loading={loading} value={reviews ? countFormatter.format(reviews.count) : "—"} />
        <Stat
          label="Điểm trung bình"
          loading={loading}
          value={reviews?.averageRating != null ? formatRating(reviews.averageRating) : "—"}
        >
          {reviews?.averageRating != null && <RatingStars value={reviews.averageRating} />}
        </Stat>
        <Stat label="Feedback chuyến đi" loading={loading} value={tripFeedback ? countFormatter.format(tripFeedback.count) : "—"} />
      </div>

      {(loading || data) && (
        <>
          <div className="grid gap-4 xl:grid-cols-2">
            <Panel title="Phân bố số sao" loading={loading}>
              <BarList
                emptyText="Chưa có đánh giá nào trong khoảng này."
                items={(reviews?.ratings ?? []).map((row) => ({ key: row.rating, label: `${row.rating} sao`, count: row.count }))}
              />
            </Panel>

            <Panel
              title="Địa điểm điểm thấp nhất"
              description="Tính trên đánh giá gửi trong khoảng ngày, nên có thể khác điểm trên trang địa điểm. Địa điểm chỉ có 1 đánh giá cũng được xếp hạng."
              loading={loading}
            >
              {data?.lowestRatedPlaces?.length ? (
                <ol className="mt-4 space-y-2">
                  {data.lowestRatedPlaces.map((place) => (
                    <li key={place.placeId} className="flex flex-col gap-3 border-b border-[#DCE2EE] py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[#0F2148]">
                          <span className="break-words">{place.name}</span>
                          {!place.isVisible && <StatusBadge status="inactive" label="Đã ẩn" />}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[#5C6B8A]">
                          <RatingStars value={place.averageRating} size={14} />
                          {formatRating(place.averageRating)} · {place.reviewCount} đánh giá
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onOpenPlaceReviews({
                          placeId: place.placeId,
                          placeName: place.name,
                          from: data.from,
                          to: data.to,
                        })}
                        className="inline-flex min-h-11 shrink-0 items-center text-sm font-semibold text-[#1D3E82] hover:underline"
                      >
                        Xem đánh giá
                      </button>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-4 text-sm text-[#5C6B8A]">Chưa có đánh giá nào trong khoảng này.</p>
              )}
            </Panel>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Panel
              title="Nhận xét nhanh về địa điểm"
              description="Một đánh giá gắn nhiều nhãn được đếm vào từng nhãn, nên tổng có thể lớn hơn số đánh giá."
              loading={loading}
            >
              <BarList
                emptyText="Chưa có nhãn nào được chọn trong khoảng này."
                items={(reviews?.quickTags ?? []).map((row) => ({
                  key: row.code,
                  label: reviewTagLabels[row.code] ?? row.code,
                  count: row.count,
                }))}
              />
            </Panel>

            <Panel title="Feedback chuyến đi theo nhãn" loading={loading}>
              <BarList
                emptyText="Chưa có feedback chuyến đi nào trong khoảng này."
                items={(tripFeedback?.quickTags ?? []).map((row) => ({
                  key: row.quickTag,
                  label: feedbackTagLabels[row.quickTag] ?? row.quickTag,
                  count: row.count,
                }))}
              />
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
