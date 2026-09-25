import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { REVIEW_MAX_TAGS, REVIEW_TAGS } from "../../constants";
import { useTrip } from "../../context/TripContext";
import { reviewService } from "../../services/reviewService";
import {
  buildGoogleMapsDirectionUrl,
  formatCurrencyShort,
  formatDate,
  formatDuration,
} from "../../utils/formatCurrency";

const HERO_IMAGE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDN0vFFKUc3e-K_f2h2SAI_wztdv4J8tWPy268gHEYWiMvNEY02ghKlxRGjcIGgLvWktn8MhgQqG3PouyjWXsfF0fhvVjT_8Zye_ciVRX0IhzwruLEugVApYcp1nlYHm-r9vZccXdHghUmv4QcY6NI3N1A3YrQFM5ZKkAX-xyzkr25N9ThWYEHuaBHaocG9lIxQI48mDGtdqB3zt-GV5JLEfBZgAKNb7Uz9hu7-E1J1W5fXd4Y5BhfDK-VF4JejubGDFvNnqyc-Zxg";

const MAP_IMAGE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCIwipJXELcCwRCN8mPiFth-RiDa9dXloXwsx6WPzUyJSXPYNrdkffCPBN56sWsv1Q8Xec3nGc8tJnn4C5W3WHU4uhfC05PpQKdCCGV31JcgyYRU3hO2mcxUXBUZluf1EXnEo3uMD9KuhndUP21BB2lR95JzOAgWQbE-Uleqym_UotAn3BbVJyHRU8Z0Zzo4fvylxBW66bMrivbiAGr73XHrgGK_d7uq3RmQSHM1k72zKLB_V11qBfwjVqMSXSIgdb-yxzxVYlr_tU";

const STATUS_LABEL = {
  draft: "Nháp",
  finalized: "Đã chốt",
};

const REVIEW_ERROR_MESSAGES = {
  item_not_visited: "Bạn cần đánh dấu đã ghé địa điểm này trước khi đánh giá.",
  review_already_exists: "Bạn đã đánh giá địa điểm này rồi.",
  review_requires_persisted_user: "Vui lòng đăng ký tài khoản để đánh giá.",
};

export default function SavedTripDetailPage() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const { savedTrips, markVisited, fetchTrip } = useTrip();
  const trip = savedTrips.find((t) => t.id === tripId);
  const [loadedTripId, setLoadedTripId] = useState(null);
  const [tripLoadError, setTripLoadError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const loadingTrip = loadedTripId !== tripId;

  // savedTrips chỉ chứa bản tóm tắt (không có items), nên tải chi tiết khi mở trang
  useEffect(() => {
    let active = true;
    fetchTrip(tripId)
      .then(() => { if (active) setTripLoadError(""); })
      .catch((err) => {
        if (active) setTripLoadError(err.status === 404
          ? "Không tìm thấy lịch trình này."
          : err.status === 401 || err.status === 403
            ? "Bạn không có quyền xem lịch trình này. Vui lòng đăng nhập lại."
            : "Không thể tải lịch trình. Vui lòng thử lại.");
      })
      .finally(() => { if (active) setLoadedTripId(tripId); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, loadAttempt]);

  const [reviewModal, setReviewModal] = useState(null);
  const [rating, setRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState([]);
  const [comment, setComment] = useState("");
  const [reviewDone, setReviewDone] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [visitError, setVisitError] = useState("");
  const [visitingItemId, setVisitingItemId] = useState(null);
  const [reviewsByItem, setReviewsByItem] = useState({});
  const [reviewReloadKey, setReviewReloadKey] = useState(0);
  const [showToast, setShowToast] = useState(false);
  const visitPending = useRef(false);
  const reviewPending = useRef(false);
  const visitedItemIds = trip?.items.filter((item) => item.isVisited).map((item) => item.id).join(",") ?? "";

  useEffect(() => {
    if (!visitedItemIds) return undefined;
    let active = true;
    const ids = visitedItemIds.split(",");
    Promise.all(ids.map(async (id) => {
      try {
        return [id, { status: "reviewed", review: await reviewService.getReview(id) }];
      } catch (err) {
        return [id, { status: err.status === 404 && err.code === "review_not_found" ? "available" : "error" }];
      }
    })).then((entries) => {
      if (active) setReviewsByItem((previous) => ({
        ...previous,
        ...Object.fromEntries(entries.map(([id, result]) => [
          id, previous[id]?.status === "reviewed" ? previous[id] : result,
        ])),
      }));
    });
    return () => { active = false; };
  }, [tripId, visitedItemIds, reviewReloadKey]);

  useEffect(() => {
    if (!showToast) return undefined;

    const timer = setTimeout(() => setShowToast(false), 2600);
    return () => clearTimeout(timer);
  }, [showToast]);

  if (loadingTrip) {
    return (
      <div className="app-shell flex items-center justify-center px-container-margin">
        <p className="text-body-lg text-on-surface-variant">Đang tải...</p>
      </div>
    );
  }

  if (tripLoadError) {
    return (
      <div role="alert" className="app-shell flex flex-col items-center justify-center gap-4 px-container-margin text-center">
        <p className="text-body-lg text-on-surface-variant">{tripLoadError}</p>
        <button type="button" onClick={() => { setLoadedTripId(null); setLoadAttempt((attempt) => attempt + 1); }} className="btn-primary w-auto px-8">Thử lại</button>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="app-shell flex items-center justify-center px-container-margin">
        <p className="text-body-lg text-on-surface-variant">
          Không tìm thấy lịch trình.
        </p>
      </div>
    );
  }

  const visitedCount = trip.items.filter((item) => item.isVisited).length;
  const totalDuration = trip.items.reduce(
    (sum, item) => sum + item.durationMinutes,
    0,
  );
  const firstItem = trip.items[0];
  const mapHref =
    firstItem?.latitude && firstItem?.longitude
      ? buildGoogleMapsDirectionUrl(firstItem.latitude, firstItem.longitude)
      : "https://www.google.com/maps/search/?api=1&query=Ho%20Chi%20Minh%20City";

  const openReview = (itemId) => {
    setRating(0);
    setSelectedTags([]);
    setComment("");
    setReviewDone(false);
    setReviewError("");
    setReviewModal({ itemId });
  };

  const handleMarkVisited = async (itemId) => {
    if (visitPending.current || trip.status !== "finalized") return;
    visitPending.current = true;
    setVisitingItemId(itemId);
    setVisitError("");
    try {
      await markVisited(trip.id, itemId);
      openReview(itemId);
      setShowToast(true);
    } catch (err) {
      setVisitError(err.code === "trip_not_finalized"
        ? "Hãy chốt lịch trình trước khi đánh dấu đã ghé."
        : err.status === 404
          ? "Không tìm thấy địa điểm này trong lịch trình."
          : err.status === 401 || err.status === 403
            ? "Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại."
            : "Không thể đánh dấu đã ghé lúc này. Vui lòng thử lại.");
    } finally {
      visitPending.current = false;
      setVisitingItemId(null);
    }
  };

  const handleSubmitReview = async () => {
    if (!reviewModal || !rating || reviewPending.current) return;
    if (comment.trim().length > 1000) {
      setReviewError("Nhận xét không được vượt quá 1000 ký tự.");
      return;
    }
    reviewPending.current = true;
    setSubmittingReview(true);
    setReviewError("");
    try {
      const review = await reviewService.submitReview(reviewModal.itemId, {
        rating,
        quickTags: selectedTags,
        comment,
      });
      setReviewsByItem((previous) => ({
        ...previous,
        [reviewModal.itemId]: { status: "reviewed", review },
      }));
      setReviewDone(true);
    } catch (err) {
      setReviewError(REVIEW_ERROR_MESSAGES[err.code] ?? (
        err.status === 400 ? "Đánh giá không hợp lệ. Vui lòng kiểm tra lại."
          : err.status === 401 || err.status === 403 ? "Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại."
            : "Không thể gửi đánh giá lúc này. Vui lòng thử lại."
      ));
    } finally {
      reviewPending.current = false;
      setSubmittingReview(false);
    }
  };

  const toggleTag = (value) => {
    setSelectedTags((prev) => {
      if (prev.includes(value)) return prev.filter((t) => t !== value);
      return prev.length >= REVIEW_MAX_TAGS ? prev : [...prev, value];
    });
  };

  return (
    <div className="app-shell flex flex-col">
      <header className="app-header flex h-16 items-center justify-between border-b border-outline-variant/20 px-container-margin py-stack-sm shadow-sm lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={() => navigate("/trips")}
            className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-surface-container-high"
          >
            <span className="material-symbols-outlined text-primary">
              arrow_back
            </span>
          </button>

          <h1 className="truncate text-title-md font-bold text-primary">
            {trip.title}
          </h1>
        </div>

        <button className="flex h-9 w-9 items-center justify-center rounded-full text-primary transition-colors hover:bg-surface-container-high">
          <span className="material-symbols-outlined">more_vert</span>
        </button>
      </header>

      <main className="content-shell flex-1 pb-10 pt-16">
        <section className="relative h-[265px] overflow-hidden md:h-[400px] lg:rounded-b-lg">
          <img
            src={firstItem?.placeImageUrl ?? HERO_IMAGE}
            alt="Ho Chi Minh City skyline"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
          <div className="absolute bottom-0 left-0 p-container-margin lg:p-8">
            <span className="mb-2 inline-flex rounded-full bg-tertiary-container/30 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-tertiary">
              {STATUS_LABEL[trip.status] ?? trip.status}
            </span>
            <h2 className="max-w-3xl text-headline-lg-mobile font-bold text-on-surface md:text-headline-lg">
              {trip.title}
            </h2>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-body-md text-on-surface-variant">
              <span className="material-symbols-outlined text-[18px]">
                calendar_today
              </span>
              {formatDate(trip.finalizedAt ?? trip.createdAt)}
              <span>•</span>
              <span>
                {trip.items.length} địa điểm
              </span>
              <span>•</span>
              <span>
                {visitedCount}/{trip.items.length} đã ghé
              </span>
            </p>
          </div>
        </section>

        <div className="grid gap-stack-lg px-container-margin pt-stack-lg lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8">
          <section>
            <h3 className="mb-stack-md text-headline-md font-bold text-on-background">
              Lịch trình chi tiết
            </h3>
            {visitError && <p role="alert" className="mb-stack-md text-label-md text-error">{visitError}</p>}

            <div className="space-y-gutter">
              {trip.items.map((item, idx) => {
                const isLast = idx === trip.items.length - 1;

                return (
                  <div key={item.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div
                        className={`z-10 flex h-6 w-6 items-center justify-center rounded-full ${
                          item.isVisited
                            ? "bg-tertiary text-on-tertiary ring-4 ring-tertiary/20"
                            : "border-2 border-outline-variant bg-surface-container-highest text-on-surface-variant"
                        }`}
                      >
                        <span
                          className="material-symbols-outlined text-[16px]"
                          style={
                            item.isVisited
                              ? { fontVariationSettings: "'FILL' 1" }
                              : undefined
                          }
                        >
                          {item.isVisited ? "check" : "schedule"}
                        </span>
                      </div>
                      {!isLast && (
                        <div className="my-1 min-h-10 w-0.5 flex-1 bg-outline-variant/70" />
                      )}
                    </div>

                    <div
                      className={`flex-1 pb-stack-lg ${
                        item.isVisited ? "" : "opacity-85"
                      }`}
                    >
                      <article
                        className={`rounded-lg border bg-surface-container-lowest/80 p-stack-md shadow-sm backdrop-blur ${
                          item.isVisited
                            ? "border-tertiary/30 shadow-tertiary/10"
                            : "border-outline-variant/30"
                        }`}
                      >
                        <div className="mb-2 flex items-start justify-between gap-3">
                          <span
                            className={`text-label-md font-bold uppercase ${
                              item.isVisited
                                ? "text-tertiary"
                                : "text-on-surface-variant"
                            }`}
                          >
                            {item.time}
                          </span>

                          {item.isVisited && (
                            <span className="rounded bg-tertiary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-tertiary">
                              Đã tham quan
                            </span>
                          )}
                        </div>

                        <h4 className="mb-1 text-body-lg font-bold text-on-surface">
                          {item.placeName}
                        </h4>
                        {item.placeImageUrl && (
                          <img
                            src={item.placeImageUrl}
                            alt={item.placeName}
                            className="mb-stack-md h-40 w-full rounded-lg object-cover"
                          />
                        )}
                        <p className="mb-stack-md text-body-md text-on-surface-variant">
                          {item.reason}
                        </p>

                        <div className="mb-stack-md flex flex-wrap gap-3 text-label-md text-on-surface-variant">
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">
                              timer
                            </span>
                            {formatDuration(item.durationMinutes)}
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">
                              payments
                            </span>
                            {formatCurrencyShort(item.estimatedCost)}
                          </span>
                          {item.nearestMetroStation && (
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px]">
                                train
                              </span>
                              {item.nearestMetroStation}
                            </span>
                          )}
                        </div>

                        <div className="flex gap-3">
                          {item.latitude && item.longitude && (
                            <a
                              href={buildGoogleMapsDirectionUrl(
                                item.latitude,
                                item.longitude,
                              )}
                              target="_blank"
                              rel="noreferrer"
                              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-secondary/10 px-4 py-2 text-label-md font-bold text-secondary transition-transform active:scale-95"
                            >
                              <span className="material-symbols-outlined text-[18px]">
                                map
                              </span>
                              Maps
                            </a>
                          )}

                          {item.isVisited && reviewsByItem[item.id]?.status === "reviewed" ? (
                            <button type="button" disabled className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-tertiary/15 px-4 py-2 text-label-md font-bold text-tertiary">
                              <span className="material-symbols-outlined text-[18px]">star</span>
                              Đã đánh giá {reviewsByItem[item.id].review.rating}/5
                            </button>
                          ) : item.isVisited && reviewsByItem[item.id]?.status === "error" ? (
                            <button type="button" onClick={() => { setReviewsByItem((previous) => ({ ...previous, [item.id]: { status: "loading" } })); setReviewReloadKey((key) => key + 1); }} className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-tertiary px-4 py-2 text-label-md font-bold text-tertiary">
                              Thử tải đánh giá
                            </button>
                          ) : item.isVisited && (!reviewsByItem[item.id] || reviewsByItem[item.id]?.status === "loading") ? (
                            <button type="button" disabled className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-outline-variant px-4 py-2 text-label-md text-on-surface-variant">
                              Đang kiểm tra đánh giá...
                            </button>
                          ) : item.isVisited ? (
                            <button
                              type="button"
                              onClick={() => openReview(item.id)}
                              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-tertiary px-4 py-2 text-label-md font-bold text-on-tertiary transition-transform active:scale-95"
                            >
                              <span className="material-symbols-outlined text-[18px]">
                                rate_review
                              </span>
                              Đánh giá nhanh
                            </button>
                          ) : trip.status === "finalized" ? (
                            <button
                              type="button"
                              disabled={visitingItemId !== null}
                              onClick={() => handleMarkVisited(item.id)}
                              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-primary px-4 py-2 text-label-md font-bold text-primary transition-all active:scale-95 hover:bg-primary hover:text-on-primary"
                            >
                              <span className="material-symbols-outlined text-[18px]">
                                location_on
                              </span>
                              {visitingItemId === item.id ? "Đang cập nhật..." : "Đã ghé"}
                            </button>
                          ) : (
                            <span className="flex flex-1 items-center justify-center rounded-lg border border-outline-variant px-4 py-2 text-label-md text-on-surface-variant">
                              Chốt lịch trình để đánh dấu
                            </span>
                          )}
                        </div>
                      </article>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <aside className="space-y-stack-md">
            <section className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-primary-container/40 bg-primary-container/20 p-4">
                <span className="material-symbols-outlined mb-2 text-primary">
                  route
                </span>
                <p className="text-label-md font-bold uppercase text-on-primary-container">
                  Điểm đã ghé
                </p>
                <p className="text-headline-md font-bold text-primary">
                  {visitedCount}/{trip.items.length}
                </p>
              </div>

              <div className="rounded-lg border border-secondary-container/30 bg-secondary-container/10 p-4">
                <span className="material-symbols-outlined mb-2 text-secondary">
                  timer
                </span>
                <p className="text-label-md font-bold uppercase text-on-secondary-container">
                  Thời gian
                </p>
                <p className="text-headline-md font-bold text-secondary">
                  {formatDuration(totalDuration)}
                </p>
              </div>
            </section>

            <section className="rounded-lg border border-outline-variant/30 bg-surface-container-lowest p-stack-md">
              <h3 className="mb-2 text-title-md font-bold text-on-surface">
                Tóm tắt
              </h3>
              <p className="text-body-md text-on-surface-variant">
                {trip.summary}
              </p>
              <div className="mt-stack-md flex flex-wrap gap-2">
                {trip.metroFriendly && (
                  <span className="chip-active text-label-md">
                    <span className="material-symbols-outlined text-[14px]">
                      train
                    </span>
                    Metro-friendly
                  </span>
                )}
                <span className="chip text-label-md">
                  <span className="material-symbols-outlined text-[14px]">
                    payments
                  </span>
                  ~{formatCurrencyShort(trip.estimatedBudget)}
                </span>
              </div>
            </section>

            <section className="relative h-40 overflow-hidden rounded-lg border border-outline-variant/30 shadow-sm">
              <img
                src={MAP_IMAGE}
                alt="Ho Chi Minh City map preview"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                <a
                  href={mapHref}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-full bg-white/90 px-6 py-2 text-label-md font-bold text-primary shadow-lg backdrop-blur transition-transform active:scale-95"
                >
                  <span className="material-symbols-outlined">map</span>
                  Xem trên bản đồ
                </a>
              </div>
            </section>
          </aside>
        </div>
      </main>

      {showToast && (
        <div className="fixed bottom-24 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-3 rounded-full bg-inverse-surface px-6 py-3 text-inverse-on-surface shadow-2xl">
          <span className="material-symbols-outlined text-primary-container">
            check_circle
          </span>
          <span className="text-label-md font-medium">
            Đã cập nhật trạng thái tham quan
          </span>
        </div>
      )}

      {reviewModal && (
        <div role="dialog" aria-modal="true" aria-labelledby="quick-review-title" className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 lg:items-center">
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-lg bg-surface p-stack-lg space-y-stack-md animate-fade-in-up lg:rounded-lg">
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-outline-variant" />

            {!reviewDone ? (
              <>
                <h3 id="quick-review-title" className="text-center text-title-md font-bold text-on-surface">
                  Bạn thấy địa điểm này thế nào?
                </h3>

                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      aria-label={`${s} sao`}
                      aria-pressed={rating === s}
                      disabled={submittingReview}
                      onClick={() => setRating(s)}
                      className="transition-transform active:scale-90"
                    >
                      <span
                        className="material-symbols-outlined text-[36px]"
                        style={{
                          color: s <= rating ? "#efb515" : "#bacac5",
                          fontVariationSettings:
                            s <= rating ? "'FILL' 1" : "'FILL' 0",
                        }}
                      >
                        star
                      </span>
                    </button>
                  ))}
                </div>

                <div>
                  <p className="mb-2 text-label-md text-on-surface-variant">
                    Chọn nhận xét nhanh (tối đa {REVIEW_MAX_TAGS}):
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {REVIEW_TAGS.map((tag) => (
                      <button
                        key={tag.value}
                        type="button"
                        aria-pressed={selectedTags.includes(tag.value)}
                        disabled={submittingReview}
                        onClick={() => toggleTag(tag.value)}
                        className={`rounded-full px-3 py-1.5 text-label-md transition-all active:scale-95 ${
                          selectedTags.includes(tag.value)
                            ? "bg-primary text-on-primary"
                            : "border border-outline-variant text-on-surface-variant hover:border-primary"
                        }`}
                      >
                        {tag.label}
                      </button>
                    ))}
                  </div>
                </div>

                {reviewError && (
                  <p
                    role="alert"
                    className="rounded-lg bg-error-container/10 px-3 py-2 text-label-md text-error"
                  >
                    {reviewError}
                  </p>
                )}

                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  aria-label="Nhận xét thêm"
                  maxLength={1000}
                  disabled={submittingReview}
                  placeholder="Bạn muốn chia sẻ thêm gì không? (tuỳ chọn)"
                  rows={3}
                  className="w-full resize-none rounded-DEFAULT bg-surface-container-low p-3 text-body-md placeholder:text-outline-variant focus:outline-none focus:ring-2 focus:ring-primary-container"
                />

                <div className="flex gap-3">
                  <button
                    type="button"
                    disabled={submittingReview}
                    onClick={() => setReviewModal(null)}
                    className="flex-1 rounded-full border border-outline-variant py-3 font-semibold text-on-surface-variant transition-transform active:scale-95"
                  >
                    Để sau
                  </button>

                  <button
                    type="button"
                    onClick={handleSubmitReview}
                    disabled={rating === 0 || submittingReview}
                    className="flex-1 rounded-full bg-primary py-3 font-semibold text-on-primary transition-transform active:scale-95 disabled:opacity-50"
                  >
                    {submittingReview ? "Đang gửi..." : "Gửi đánh giá"}
                  </button>
                </div>
              </>
            ) : (
              <div className="py-4 text-center space-y-stack-md">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-container/20">
                  <span
                    className="material-symbols-outlined text-primary"
                    style={{ fontSize: 40, fontVariationSettings: "'FILL' 1" }}
                  >
                    favorite
                  </span>
                </div>

                <h3 id="quick-review-title" className="text-title-md font-bold text-on-surface">
                  Cảm ơn bạn!
                </h3>
                <p className="text-body-md text-on-surface-variant">
                  Phản hồi của bạn giúp LocalMate đề xuất tốt hơn.
                </p>

                <button
                  type="button"
                  onClick={() => setReviewModal(null)}
                  className="btn-primary"
                >
                  Quay lại lịch trình
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
