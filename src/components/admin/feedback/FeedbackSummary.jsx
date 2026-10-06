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
import { StatusBadge } from "../ui";
import RatingStars from "../../ui/RatingStars";
import { adminFeedbackService } from "../../../services/adminFeedbackService";
import { formatRating } from "../../../utils/formatCurrency";
import { formatTimeInVietnam } from "../../../utils/vnTime";

const CARD = "rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,.03)]";

function Stat({ label, value, loading, children }) {
  return (
    <div className={CARD}>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      {loading ? (
        <div className="mt-3 h-8 w-20 animate-pulse rounded bg-slate-100" />
      ) : (
        <p className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-2xl font-bold tracking-tight text-slate-950">{value}</span>
          {children}
        </p>
      )}
    </div>
  );
}

function Panel({ title, description, loading, children }) {
  return (
    <section className={CARD}>
      <h3 className="font-bold text-slate-950">{title}</h3>
      {description && <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>}
      {loading ? <div className="mt-4 h-40 animate-pulse rounded-xl bg-slate-100" /> : children}
    </section>
  );
}

// items: [{ key, label, count }]. BE luôn trả đủ mọi mức/mã, kể cả 0 lượt.
function BarList({ items, emptyText }) {
  const max = Math.max(1, ...items.map((item) => item.count));
  if (items.every((item) => item.count === 0)) {
    return <p className="mt-4 text-sm text-slate-500">{emptyText}</p>;
  }
  return (
    <ul className="mt-4 space-y-3">
      {items.map((item) => (
        <li key={item.key}>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate font-medium text-slate-700">{item.label}</span>
            <span className="shrink-0 font-bold text-slate-900">{countFormatter.format(item.count)}</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
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
        <div className="text-sm text-slate-500">
          <p>
            Từ {formatDayLabel(range.from)} đến {formatDayLabel(range.to)} · {countDays(range)} ngày, tính theo ngày gửi (giờ Việt Nam).
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs">
            {data?.generatedAt && <span>Cập nhật lúc {formatTimeInVietnam(data.generatedAt)}</span>}
            <button
              type="button"
              onClick={() => setReloadCount((count) => count + 1)}
              disabled={loading}
              className="inline-flex items-center gap-1 font-semibold text-primary disabled:opacity-50"
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

      {!loading && result.error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <span>{result.error}</span>
          <button type="button" onClick={() => setReloadCount((count) => count + 1)} className="shrink-0 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-700">
            Thử lại
          </button>
        </div>
      )}

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
                    <li key={place.placeId} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3.5 py-2.5">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
                          <span className="truncate">{place.name}</span>
                          {!place.isVisible && <StatusBadge status="inactive" label="Đã ẩn" />}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
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
                        className="shrink-0 text-xs font-semibold text-primary hover:underline"
                      >
                        Xem đánh giá
                      </button>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-4 text-sm text-slate-500">Chưa có đánh giá nào trong khoảng này.</p>
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
