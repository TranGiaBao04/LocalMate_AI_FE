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
  "rounded-full border border-outline-variant bg-surface-container-lowest px-3 py-1.5 text-label-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container";

// averageRating = null nghĩa là chưa có đánh giá (không hiện 0 sao)
export function PlaceRatingSummary({ averageRating, reviewCount }) {
  if (averageRating == null) {
    return <p className="text-body-md text-on-surface-variant">Chưa có đánh giá</p>;
  }
  return (
    <p className="flex items-center gap-2 text-body-md text-on-surface-variant">
      <span className="font-bold text-on-surface">{formatRating(averageRating)}</span>
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
    <section aria-labelledby="place-reviews-title" className="space-y-stack-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="place-reviews-title" className="flex items-center gap-2 text-title-md font-bold text-on-surface">
          <span className="material-symbols-outlined text-[20px] text-primary">reviews</span>
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

          <ul className="space-y-3">
            {items.map((review) => (
              <li key={review.id} className="card space-y-2 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-body-md font-semibold text-on-surface">{review.reviewerName}</p>
                  <span className="text-label-md text-on-surface-variant">{formatVnDate(review.createdAt)}</span>
                </div>
                <RatingStars value={review.rating} />
                {review.quickTags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {review.quickTags.map((code) => (
                      <span key={code} className="chip text-label-md">{tagLabels[code] ?? code}</span>
                    ))}
                  </div>
                )}
                {review.comment && (
                  <p className="whitespace-pre-line break-words text-body-md text-on-surface-variant">{review.comment}</p>
                )}
              </li>
            ))}
          </ul>

          {loading && <p className="text-body-md text-on-surface-variant">Đang tải đánh giá...</p>}
          {!loading && !error && items.length === 0 && (
            <p className="text-body-md text-on-surface-variant">
              {rating ? `Chưa có đánh giá ${rating} sao.` : "Chưa có đánh giá."}
            </p>
          )}
          {error && (
            <div role="alert" className="flex items-center justify-between gap-3 text-label-md text-error">
              <span>{error}</span>
              <button type="button" onClick={() => setReloadCount((count) => count + 1)} className="font-bold underline">
                Thử lại
              </button>
            </div>
          )}
          {hasMore && (
            <button
              type="button"
              disabled={loading}
              onClick={() => setPage((current) => current + 1)}
              className="w-full rounded-full border border-primary py-2.5 text-label-md font-bold text-primary transition-all active:scale-95 disabled:opacity-50"
            >
              Xem thêm đánh giá
            </button>
          )}
        </>
      )}
    </section>
  );
}
