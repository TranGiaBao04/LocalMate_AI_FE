import { useId, useState } from "react";
import { tripService } from "../../services/tripService";
import { getAiErrorMessage } from "../../utils/aiErrors";

// Khớp TripRequestParsingPrompt của BE
const MIN_TEXT_LENGTH = 5;
const MAX_TEXT_LENGTH = 500;

// Ô nhập tự do: AI đọc câu thành tiêu chí tạo lịch. Chỉ gọi khi bấm gửi/Enter vì mỗi lần tính 1 lượt AI,
// kể cả khi lỗi. base: tiêu chí của lịch đang xem, có thì câu được hiểu là yêu cầu thay đổi lịch đó.
export default function TripRequestAssistant({ title, placeholder, submitLabel, base, onParsed }) {
  const inputId = useId();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const trimmed = text.trim();
  const canSubmit = trimmed.length >= MIN_TEXT_LENGTH && !loading;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setMessage("");
    setError("");
    try {
      const result = await tripService.parseTripRequest(trimmed, base);
      // message là câu tiếng Việt BE viết sẵn: câu không phải yêu cầu đi chơi, thiếu chi tiết, hoặc không đổi gì
      setMessage(result.message ?? "");
      onParsed(result);
    } catch (err) {
      setError(
        err.code === "ai_unavailable"
          ? "AI đang bận, bạn điền form giúp nhé."
          : getAiErrorMessage(err),
      );
    } finally {
      setLoading(false);
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
        rows={2}
        placeholder={placeholder}
        aria-describedby={`${inputId}-usage`}
        className="min-h-24 w-full min-w-0 resize-y rounded-[8px] border border-border-soft bg-surface-container-low/40 p-3 text-body-md leading-6 placeholder:text-text-muted focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
      />
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <span id={`${inputId}-usage`} className="text-[13px] leading-5 text-text-muted">Mỗi lần gửi tính 1 lượt AI trong ngày.</span>
        <button
          type="submit"
          disabled={!canSubmit}
          className="min-h-11 w-full shrink-0 rounded-[8px] bg-primary px-4 py-2.5 text-body-md font-semibold text-on-primary transition-colors hover:bg-navy-dark disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:w-auto"
        >
          {loading ? "AI đang đọc…" : submitLabel}
        </button>
      </div>
      {message && <p role="status" className="break-words border-t border-border-soft pt-3 text-body-md leading-6 text-text-muted">{message}</p>}
      {error && <p role="alert" className="break-words rounded-[8px] border border-error/20 bg-error-container/20 p-3 text-body-md leading-6 text-error">{error}</p>}
    </form>
  );
}
