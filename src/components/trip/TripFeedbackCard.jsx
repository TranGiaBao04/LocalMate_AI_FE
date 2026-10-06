import { useEffect, useRef, useState } from "react";
import { feedbackService } from "../../services/feedbackService";
import { masterDataService } from "../../services/masterDataService";
import { formatVnDate } from "../../utils/subscriptionUtils";

const MAX_COMMENT_LENGTH = 1000;
const ERROR_MESSAGES = {
  trip_not_finalized: "Hãy chốt lịch trình trước khi gửi phản hồi.",
  trip_not_found: "Không tìm thấy chuyến đi này.",
  feedback_requires_persisted_user: "Vui lòng đăng ký tài khoản để gửi phản hồi.",
};

// Phản hồi cho cả chuyến đi (khác đánh giá từng địa điểm): đúng 1 nhãn + nhận xét tuỳ chọn.
// Gửi 1 lần, BE chưa có API sửa/xoá. Chỉ dựng cho chuyến đã chốt.
export default function TripFeedbackCard({ tripId }) {
  const [reloadCount, setReloadCount] = useState(0);
  // status: "sent" | "form" | "error"; tags: [{ code, label }] từ master-data
  const [state, setState] = useState({ key: null, status: "form", feedback: null, tags: [] });
  const [quickTag, setQuickTag] = useState("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const pending = useRef(false);

  const key = `${tripId}#${reloadCount}`;
  const status = state.key === key ? state.status : "loading";

  useEffect(() => {
    let active = true;
    Promise.all([
      feedbackService.getTripFeedback(tripId).catch((err) => {
        if (err.code === "feedback_not_found") return null; // chưa gửi ⇒ hiện form
        throw err;
      }),
      // Thiếu nhãn: bản đã gửi vẫn hiện được (bằng mã), còn form thì không có gì để chọn
      masterDataService.getMasterData().then((data) => data.feedbackQuickTags ?? []).catch(() => []),
    ])
      .then(([feedback, tags]) => {
        if (!active) return;
        setState({ key, feedback, tags, status: feedback ? "sent" : tags.length > 0 ? "form" : "error" });
      })
      .catch(() => {
        if (active) setState({ key, status: "error", feedback: null, tags: [] });
      });
    return () => { active = false; };
  }, [tripId, key]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!quickTag || pending.current) return;
    pending.current = true;
    setSubmitting(true);
    setSubmitError("");
    try {
      const feedback = await feedbackService.submitTripFeedback({ tripId, quickTag, comment });
      setState((previous) => ({ ...previous, status: "sent", feedback }));
    } catch (err) {
      if (err.code === "feedback_already_exists") {
        // Đã gửi ở tab/thiết bị khác: tải lại để hiện bản đã gửi
        setReloadCount((count) => count + 1);
      } else {
        setSubmitError(ERROR_MESSAGES[err.code] ?? (
          err.status === 401 || err.status === 403
            ? "Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại."
            : "Không thể gửi phản hồi lúc này. Vui lòng thử lại."
        ));
      }
    } finally {
      pending.current = false;
      setSubmitting(false);
    }
  };

  const sentLabel = state.feedback
    && (state.tags.find((tag) => tag.code === state.feedback.quickTag)?.label ?? state.feedback.quickTag);

  return (
    <section className="rounded-lg border border-outline-variant/30 bg-surface-container-lowest p-stack-md">
      <h3 className="mb-2 text-title-md font-bold text-on-surface">Chuyến đi này thế nào?</h3>

      {status === "loading" && <p className="text-body-md text-on-surface-variant">Đang tải...</p>}

      {status === "error" && (
        <div role="alert" className="flex items-center justify-between gap-3 text-label-md text-error">
          <span>Không tải được phần phản hồi.</span>
          <button type="button" onClick={() => setReloadCount((count) => count + 1)} className="font-bold underline">
            Thử lại
          </button>
        </div>
      )}

      {status === "sent" && (
        <div className="space-y-2">
          <span className="chip-active text-label-md">{sentLabel}</span>
          {state.feedback.comment && (
            <p className="whitespace-pre-line break-words text-body-md text-on-surface-variant">
              {state.feedback.comment}
            </p>
          )}
          <p className="text-label-md text-on-surface-variant">
            Bạn đã gửi phản hồi ngày {formatVnDate(state.feedback.createdAt)}.
          </p>
        </div>
      )}

      {status === "form" && (
        <form onSubmit={handleSubmit} className="space-y-stack-sm">
          <p className="text-label-md text-on-surface-variant">Chọn một nhận xét cho cả lịch trình:</p>
          <div className="flex flex-wrap gap-2">
            {state.tags.map((tag) => (
              <button
                key={tag.code}
                type="button"
                aria-pressed={quickTag === tag.code}
                disabled={submitting}
                onClick={() => setQuickTag(tag.code)}
                className={`rounded-full px-3 py-1.5 text-label-md transition-all active:scale-95 ${
                  quickTag === tag.code
                    ? "bg-primary text-on-primary"
                    : "border border-outline-variant text-on-surface-variant hover:border-primary"
                }`}
              >
                {tag.label}
              </button>
            ))}
          </div>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            aria-label="Nhận xét thêm về chuyến đi"
            maxLength={MAX_COMMENT_LENGTH}
            disabled={submitting}
            placeholder="Bạn muốn chia sẻ thêm gì không? (tuỳ chọn)"
            rows={3}
            className="w-full resize-none rounded-DEFAULT bg-surface-container-low p-3 text-body-md placeholder:text-outline-variant focus:outline-none focus:ring-2 focus:ring-primary-container"
          />
          {submitError && (
            <p role="alert" className="rounded-lg bg-error-container/10 px-3 py-2 text-label-md text-error">
              {submitError}
            </p>
          )}
          <button
            type="submit"
            disabled={!quickTag || submitting}
            className="w-full rounded-full bg-primary py-3 font-semibold text-on-primary transition-transform active:scale-95 disabled:opacity-50"
          >
            {submitting ? "Đang gửi..." : "Gửi phản hồi"}
          </button>
          <p className="text-label-md text-on-surface-variant">Phản hồi chỉ gửi được một lần và chưa sửa được.</p>
        </form>
      )}
    </section>
  );
}
