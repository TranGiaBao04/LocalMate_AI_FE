import { useEffect, useState } from "react";
import RatingStars from "../ui/RatingStars";
import { masterDataService } from "../../services/masterDataService";
import { placeService } from "../../services/placeService";
import { formatRating } from "../../utils/formatCurrency";
import { formatVnDate } from "../../utils/subscriptionUtils";

const PAGE_SIZE = 10;
const SORT_OPTIONS = [
  { value: "createdAt:desc", label: "Mới nhất" },
  { value: "rating:desc", label: "Điểm cao nhất" },
  { value: "rating:asc", label: "Điểm thấp nhất" },
];
const SELECT_CLASS =
  "min-h-11 w-full min-w-0 rounded-[8px] border border-border-soft bg-white px-3 py-2 text-sm text-navy-dark focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-navy sm:w-auto";

// averageRating = null nghĩa là chưa có đánh giá (không hiện 0 sao)
export function PlaceRatingSummary({ averageRating, reviewCount }) {
  if (averageRating == null) {
    return <p className="text-sm leading-6 text-text-muted">Chưa có đánh giá</p>;
  }
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm leading-6 text-text-muted">
      <span className="font-semibold text-navy-dark">{formatRating(averageRating)}</span>
      <RatingStars value={averageRating} />
      <span>({reviewCount} đánh giá)</span>
    </p>
  );
}

// Đánh giá công khai của một địa điểm: lọc theo số sao, sắp xếp, "Xem thêm" theo trang.
// averageRating/reviewCount lấy từ GET /places/{id} (tính trên mọi đánh giá, không theo bộ lọc).
export default function PlaceReviews({ placeId, averageRating, reviewCount }) {
  const [rating, setRating] = useState("");
  const [sort, setSort] = useState(SORT_OPTIONS[0].value);
  const [page, setPage] = useState(1);
  const [reloadCount, setReloadCount] = useState(0);
  const [result, setResult] = useState({ key: null, filterKey: null, items: [], totalPages: 0, error: "" });
  const [tagLabels, setTagLabels] = useState({});

  const hasReviews = reviewCount > 0;
  const filterKey = `${rating}|${sort}`;
  const queryKey = `${filterKey}|${page}|${reloadCount}`;
  const loading = hasReviews && result.key !== queryKey;
  const items = result.filterKey === filterKey ? result.items : [];
  const error = loading ? "" : result.error;
  const hasMore = !error && items.length > 0 && page < result.totalPages;

  useEffect(() => {
    if (!hasReviews) return undefined;
    let active = true;
    const [sortBy, sortDirection] = sort.split(":");
    placeService
      .getPlaceReviews(placeId, { page, pageSize: PAGE_SIZE, sortBy, sortDirection, rating })
      .then((data) => {
        if (!active) return;
        setResult((previous) => {
          // "Xem thêm": nối vào các trang trước, bỏ dòng trùng nếu có đánh giá mới chen vào giữa 2 lần gọi
          const kept = page > 1 && previous.filterKey === filterKey ? previous.items : [];
          const seen = new Set(kept.map((review) => review.id));
          return {
            key: queryKey,
            filterKey,
            items: [...kept, ...data.items.filter((review) => !seen.has(review.id))],
            totalPages: data.totalPages,
            error: "",
          };
        });
      })
      .catch(() => {
        if (active) {
          setResult((previous) => ({
            ...previous,
            key: queryKey,
            error: "Không tải được đánh giá. Vui lòng thử lại.",
          }));
        }
      });
    return () => { active = false; };
  }, [placeId, hasReviews, rating, sort, page, filterKey, queryKey]);

  useEffect(() => {
    if (!hasReviews) return undefined;
    let active = true;
    masterDataService
      .getMasterData()
      .then((data) => {
        if (active) {
          setTagLabels(Object.fromEntries((data.reviewQuickTags ?? []).map((tag) => [tag.code, tag.label])));
        }
      })
      .catch(() => {}); // Thiếu nhãn thì hiện mã
    return () => { active = false; };
  }, [hasReviews]);

  const changeRating = (event) => { setRating(event.target.value); setPage(1); };
  const changeSort = (event) => { setSort(event.target.value); setPage(1); };

  return (
    <section aria-labelledby="place-reviews-title" className="min-w-0 space-y-5 border-t border-border-soft pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="place-reviews-title" className="flex items-start gap-2 text-lg font-bold leading-7 text-navy-dark">
          <span aria-hidden="true" className="material-symbols-outlined flex-none text-xl text-primary">reviews</span>
          Đánh giá từ người đã ghé
        </h3>
        <PlaceRatingSummary averageRating={averageRating} reviewCount={reviewCount} />
      </div>

      {hasReviews && (
        <>
          <div className="flex flex-wrap gap-2">
            <select value={rating} onChange={changeRating} aria-label="Lọc theo số sao" className={SELECT_CLASS}>
              <option value="">Tất cả mức sao</option>
              {[5, 4, 3, 2, 1].map((star) => <option key={star} value={star}>{star} sao</option>)}
            </select>
            <select value={sort} onChange={changeSort} aria-label="Sắp xếp đánh giá" className={SELECT_CLASS}>
              {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>

          <ul className="space-y-4">
            {items.map((review) => (
              <li key={review.id} className="min-w-0 space-y-3 rounded-[8px] border border-border-soft bg-white p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="min-w-0 break-words text-sm font-semibold leading-6 text-navy-dark">{review.reviewerName}</p>
                  <span className="text-xs leading-5 text-text-muted">{formatVnDate(review.createdAt)}</span>
                </div>
                <RatingStars value={review.rating} />
                {review.quickTags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {review.quickTags.map((code) => (
                      <span key={code} className="max-w-full break-words rounded-full border border-border-soft bg-chip-bg-alt px-3 py-1 text-xs leading-5 text-navy">{tagLabels[code] ?? code}</span>
                    ))}
                  </div>
                )}
                {review.comment && (
                  <p className="whitespace-pre-line break-words text-sm leading-6 text-text-muted">{review.comment}</p>
                )}
              </li>
            ))}
          </ul>

          {loading && <p role="status" className="py-4 text-sm leading-6 text-text-muted">Đang tải đánh giá...</p>}
          {!loading && !error && items.length === 0 && (
            <p className="py-4 text-sm leading-6 text-text-muted">
              {rating ? `Chưa có đánh giá ${rating} sao.` : "Chưa có đánh giá."}
            </p>
          )}
          {error && (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-3 text-sm leading-6 text-error">
              <span className="min-w-0 break-words">{error}</span>
              <button type="button" onClick={() => setReloadCount((count) => count + 1)} className="min-h-11 rounded-[8px] px-3 font-semibold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy">
                Thử lại
              </button>
            </div>
          )}
          {hasMore && (
            <button
              type="button"
              disabled={loading}
              onClick={() => setPage((current) => current + 1)}
              className="min-h-11 w-full rounded-[8px] border border-border-soft bg-white px-4 py-3 text-sm font-semibold text-navy hover:bg-chip-bg-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy disabled:opacity-50"
            >
              Xem thêm đánh giá
            </button>
          )}
        </>
      )}
    </section>
  );
}
