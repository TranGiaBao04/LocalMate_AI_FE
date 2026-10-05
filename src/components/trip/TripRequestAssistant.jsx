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
    <form onSubmit={handleSubmit} className="card space-y-2">
      <label htmlFor={inputId} className="flex items-center gap-1.5 text-title-md font-semibold text-on-surface">
        <span className="material-symbols-outlined text-[20px] text-primary">auto_awesome</span>
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
        className="w-full resize-none rounded-DEFAULT bg-surface-container-low p-3 text-body-md placeholder:text-outline-variant focus:outline-none focus:ring-2 focus:ring-primary-container"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-label-md text-on-surface-variant">Mỗi lần gửi tính 1 lượt AI trong ngày.</span>
        <button
          type="submit"
          disabled={!canSubmit}
          className="min-h-10 shrink-0 rounded-full bg-primary px-4 py-2 text-label-md font-bold text-on-primary transition-all active:scale-95 disabled:opacity-50"
        >
          {loading ? "AI đang đọc…" : submitLabel}
        </button>
      </div>
      {message && <p role="status" className="text-label-md text-on-surface-variant">{message}</p>}
      {error && <p role="alert" className="text-label-md text-error">{error}</p>}
    </form>
  );
}
