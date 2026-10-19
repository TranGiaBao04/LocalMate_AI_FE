import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { appFeedbackService } from "../../services/appFeedbackService";

const FEEDBACK_TYPES = [
  {
    value: 1,
    label: "Báo lỗi",
    icon: "bug_report",
    description: "Ứng dụng gặp sự cố hoặc hoạt động không đúng",
    placeholder: "Mô tả chi tiết lỗi bạn gặp phải và các bước dẫn đến lỗi...",
  },
  {
    value: 2,
    label: "Góp ý tính năng",
    icon: "lightbulb",
    description: "Ý tưởng hoặc cải tiến bạn muốn thấy",
    placeholder: "Bạn mong muốn LocalMate bổ sung tính năng gì hoặc cải thiện trải nghiệm nào...",
  },
  {
    value: 3,
    label: "Khen ngợi",
    icon: "thumb_up",
    description: "Điều bạn thấy hài lòng và yêu thích",
    placeholder: "Chia sẻ điều khiến bạn thích thú và hài lòng về LocalMate...",
  },
  {
    value: 4,
    label: "Khác",
    icon: "chat_bubble",
    description: "Câu hỏi hoặc ý kiến đóng góp khác",
    placeholder: "Chia sẻ ý kiến đóng góp của bạn cho đội ngũ phát triển...",
  },
];

const RATING_LABELS = {
  1: "Rất không hài lòng",
  2: "Chưa hài lòng",
  3: "Bình thường",
  4: "Hài lòng",
  5: "Rất hài lòng",
};

export default function AppFeedbackDialog({ isOpen, onClose }) {
  const location = useLocation();
  const [type, setType] = useState(2); // Default to Suggestion
  const [rating, setRating] = useState(null);
  const [hoverRating, setHoverRating] = useState(null);
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const previousFocusRef = useRef(null);

  // Reset form when dialog opens
  useEffect(() => {
    if (!isOpen) return undefined;
    previousFocusRef.current = document.activeElement;
    closeButtonRef.current?.focus();
    setType(2);
    setRating(null);
    setHoverRating(null);
    setContent("");
    setError(null);
    setIsSuccess(false);
    setIsSubmitting(false);

    return () => {
      if (previousFocusRef.current?.isConnected) {
        previousFocusRef.current.focus();
      }
    };
  }, [isOpen]);

  // Trap focus and handle ESC key
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (e) => {
      if (e.key === "Escape" && !isSubmitting) {
        onClose();
      }
      if (e.key === "Tab") {
        const controls = dialogRef.current?.querySelectorAll(
          'button:not(:disabled), textarea:not(:disabled), input:not(:disabled), a[href]'
        );
        if (!controls || controls.length === 0) return;
        const first = controls[0];
        const last = controls[controls.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const currentTypeConfig =
    FEEDBACK_TYPES.find((item) => item.value === type) ?? FEEDBACK_TYPES[1];

  const trimmedLength = content.trim().length;
  const isTooLong = content.length > 1000;
  const isValid = trimmedLength >= 1 && !isTooLong;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await appFeedbackService.submitAppFeedback({
        type,
        rating,
        content,
        pagePath: location.pathname,
      });
      setIsSuccess(true);
    } catch (err) {
      if (err?.code === "app_feedback_daily_limit_reached" || err?.status === 429) {
        setError(
          "Bạn đã gửi tối đa 5 lượt góp ý hôm nay (tối đa 5 lượt/ngày). Cảm ơn bạn và hẹn gặp lại ngày mai!"
        );
      } else if (err?.code === "app_feedback_requires_persisted_user" || err?.status === 403) {
        setError("Tính năng này chỉ dành cho tài khoản đã đăng ký (không hỗ trợ tài khoản demo).");
      } else {
        setError(err?.message || "Đã xảy ra lỗi khi gửi góp ý. Vui lòng thử lại sau.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeRating = hoverRating ?? rating;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-feedback-title"
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 backdrop-blur-xs transition-opacity lg:items-center lg:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl transition-all sm:p-6 lg:rounded-2xl">
        {/* Mobile handle */}
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-outline-variant/60 lg:hidden" />

        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-border-soft pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <span className="material-symbols-outlined text-[22px]">rate_review</span>
            </div>
            <div>
              <h2 id="app-feedback-title" className="text-lg font-bold text-navy-dark">
                Góp ý cho LocalMate
              </h2>
              <p className="text-xs text-on-surface-variant">
                Ý kiến của bạn giúp chúng mình cải thiện ứng dụng tốt hơn mỗi ngày.
              </p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Đóng cửa sổ góp ý"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition hover:bg-surface-container-high disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Success View */}
        {isSuccess ? (
          <div className="py-8 text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <span className="material-symbols-outlined text-[32px]">check_circle</span>
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-[#0F2148]">Đã gửi góp ý thành công!</h3>
              <p className="text-sm text-[#5C6B8A] max-w-sm mx-auto">
                Cảm ơn bạn đã dành thời gian đóng góp ý kiến. Đội ngũ LocalMate sẽ ghi nhận và không ngừng hoàn thiện sản phẩm.
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-primary/90"
              >
                Đóng
              </button>
            </div>
          </div>
        ) : (
          /* Feedback Form */
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {/* Error banner */}
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-700"
              >
                <span className="material-symbols-outlined shrink-0 text-[18px]">error</span>
                <span className="flex-1 break-words">{error}</span>
              </div>
            )}

            {/* Type Selection */}
            <div>
              <label className="block text-xs font-semibold text-navy-dark mb-1.5">
                Loại ý kiến <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {FEEDBACK_TYPES.map((item) => {
                  const isSelected = item.value === type;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setType(item.value)}
                      disabled={isSubmitting}
                      className={`flex flex-col items-center justify-center gap-1 rounded-xl border p-2.5 text-xs font-semibold transition ${
                        isSelected
                          ? "border-primary bg-primary/5 text-primary shadow-xs ring-2 ring-primary/20"
                          : "border-border-soft bg-surface-container-lowest text-on-surface-variant hover:border-border-medium hover:bg-surface-container-low"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Rating (Optional) */}
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-navy-dark">
                  Mức độ hài lòng <span className="text-xs font-normal text-on-surface-variant">(tuỳ chọn)</span>
                </label>
                {rating !== null && (
                  <button
                    type="button"
                    onClick={() => {
                      setRating(null);
                      setHoverRating(null);
                    }}
                    disabled={isSubmitting}
                    className="text-xs text-on-surface-variant hover:text-rose-600 underline"
                  >
                    Bỏ chọn
                  </button>
                )}
              </div>
              <div className="mt-1.5 flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((star) => {
                  const isFilled = star <= (activeRating ?? 0);
                  return (
                    <button
                      key={star}
                      type="button"
                      aria-label={`${star} sao - ${RATING_LABELS[star]}`}
                      onClick={() => setRating((prev) => (prev === star ? null : star))}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(null)}
                      disabled={isSubmitting}
                      className="group flex h-9 w-9 items-center justify-center rounded-lg transition hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <span
                        className="material-symbols-outlined text-[24px] transition-transform group-hover:scale-110"
                        style={{
                          color: isFilled ? "#efb515" : "#bacac5",
                          fontVariationSettings: isFilled ? "'FILL' 1" : "'FILL' 0",
                        }}
                      >
                        star
                      </span>
                    </button>
                  );
                })}
                <span className="ml-2 text-xs font-medium text-on-surface-variant">
                  {activeRating ? RATING_LABELS[activeRating] : "Chưa chọn"}
                </span>
              </div>
            </div>

            {/* Content Textarea */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="app-feedback-content" className="text-xs font-semibold text-navy-dark">
                  Nội dung góp ý <span className="text-rose-500">*</span>
                </label>
                <span
                  className={`text-xs ${
                    isTooLong ? "font-bold text-rose-600" : "text-on-surface-variant"
                  }`}
                >
                  {content.length}/1000
                </span>
              </div>
              <textarea
                id="app-feedback-content"
                rows={4}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={currentTypeConfig.placeholder}
                disabled={isSubmitting}
                maxLength={1050}
                required
                className={`w-full rounded-xl border p-3 text-sm text-[#0F2148] outline-none transition focus:ring-4 ${
                  isTooLong
                    ? "border-rose-400 focus:border-rose-500 focus:ring-rose-100"
                    : "border-border-medium bg-surface-container-lowest focus:border-primary focus:bg-white focus:ring-primary/15"
                }`}
              />
              {isTooLong && (
                <p className="mt-1 text-xs text-rose-600">
                  Nội dung không được vượt quá 1000 ký tự.
                </p>
              )}
            </div>

            {/* Subtle path note */}
            <p className="text-[11px] text-on-surface-variant">
              Thông tin kèm theo: đường dẫn trang (<code className="rounded bg-surface-container px-1 py-0.5">{location.pathname}</code>) và thông tin trình duyệt để hỗ trợ xử lý kỹ thuật.
            </p>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border-soft">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="min-h-10 rounded-full border border-border-medium px-4 py-2 text-sm font-semibold text-on-surface-variant transition hover:bg-surface-container-high disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={!isValid || isSubmitting}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white shadow-xs transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting && (
                  <span className="material-symbols-outlined animate-spin text-[18px]">
                    progress_activity
                  </span>
                )}
                <span>{isSubmitting ? "Đang gửi..." : "Gửi góp ý"}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
