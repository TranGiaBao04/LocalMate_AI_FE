import { useId, useState } from "react";
import { tripService } from "../../services/tripService";
import { getAiErrorMessage } from "../../utils/aiErrors";
import { getAiQuotaHint } from "../../utils/subscriptionUtils";

// Khớp TripRequestParsingPrompt của BE
const MIN_TEXT_LENGTH = 5;
const MAX_TEXT_LENGTH = 500;

// Ô nhập tự do: AI đọc câu thành tiêu chí tạo lịch. Chỉ gọi khi bấm gửi/Enter vì mỗi lần tính 1 lượt AI
// (lần AI lỗi có tính hay không do BE báo qua charged). base: tiêu chí của lịch đang xem, có thì câu được hiểu
// là yêu cầu thay đổi lịch đó.
// aiQuota: kết quả getAiQuota (null khi chưa có số). blockedReason: câu giải thích khi trang muốn khoá ô này.
// cooldownSeconds: số giây còn phải chờ sau một lần AI lỗi; chỉ khoá nút gửi, vẫn cho gõ.
// onSettled(err): gọi sau mỗi lần gửi để trang tải lại số lượt; err là lỗi của lần gửi đó, nếu có.
export default function TripRequestAssistant({ title, placeholder, submitLabel, base, onParsed, aiQuota = null, blockedReason = "", cooldownSeconds = 0, onSettled }) {
  const inputId = useId();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const trimmed = text.trim();
  const blocked = Boolean(blockedReason) || aiQuota?.remaining === 0;
  const coolingDown = cooldownSeconds > 0;
  const canSubmit = trimmed.length >= MIN_TEXT_LENGTH && !loading && !blocked && !coolingDown;
  const usageText =
    blockedReason || (aiQuota ? getAiQuotaHint(aiQuota) : "Mỗi lần gửi tính 1 lượt AI trong ngày.");

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setMessage("");
    setError("");
    let failure;
    try {
      const result = await tripService.parseTripRequest(trimmed, base);
      // message là câu tiếng Việt BE viết sẵn: câu không phải yêu cầu đi chơi, thiếu chi tiết, hoặc không đổi gì
      setMessage(result.message ?? "");
      onParsed(result);
    } catch (err) {
      failure = err;
      setError(getAiErrorMessage(err));
    } finally {
      setLoading(false);
      onSettled?.(failure);
    }
  };

  return (
    <form onSubmit={handleSubmit} aria-busy={loading} className="space-y-3 rounded-[8px] border border-primary/20 bg-white p-4 sm:p-5">
      <label htmlFor={inputId} className="flex items-start gap-2 text-body-lg font-semibold leading-6 text-navy-dark">
        <span aria-hidden="true" className="material-symbols-outlined shrink-0 text-[22px] text-primary">auto_awesome</span>
        {title}
      </label>
      <textarea
        id={inputId}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          // Enter gửi, Shift+Enter xuống dòng. Bỏ qua Enter khi đang gõ dấu (IME).
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) handleSubmit(e);
        }}
        maxLength={MAX_TEXT_LENGTH}
        disabled={blocked}
        rows={2}
        placeholder={placeholder}
        aria-describedby={`${inputId}-usage`}
        className="min-h-24 w-full min-w-0 resize-y rounded-[8px] border border-border-soft bg-surface-container-low/40 p-3 text-body-md leading-6 placeholder:text-text-muted focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
      />
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <span id={`${inputId}-usage`} className="text-[13px] leading-5 text-text-muted">{usageText}</span>
        <button
          type="submit"
          disabled={!canSubmit}
          className="min-h-11 w-full shrink-0 rounded-[8px] bg-primary px-4 py-2.5 text-body-md font-semibold text-on-primary transition-colors hover:bg-navy-dark disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:w-auto"
        >
          {loading ? "AI đang đọc…" : coolingDown ? `Thử lại sau ${cooldownSeconds} giây` : submitLabel}
        </button>
      </div>
      {message && <p role="status" className="break-words border-t border-border-soft pt-3 text-body-md leading-6 text-text-muted">{message}</p>}
      {error && <p role="alert" className="break-words rounded-[8px] border border-error/20 bg-error-container/20 p-3 text-body-md leading-6 text-error">{error}</p>}
    </form>
  );
}
