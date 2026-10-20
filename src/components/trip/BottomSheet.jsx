import { useEffect } from "react";
import useTripDialogFocus from "../../hooks/useTripDialogFocus";

// Ngăn kéo trượt từ dưới lên cho màn hẹp. Đóng bằng nút X, bấm ra ngoài hoặc Esc;
// mở thì đưa focus vào ngăn kéo, đóng thì trả focus về nút vừa bấm (useTripDialogFocus).
// showHeader: hiện tiêu đề + nút X (bỏ khi nội dung đã có nút đóng riêng).
export default function BottomSheet({ open, title, onClose, showHeader = false, children }) {
  const dialogRef = useTripDialogFocus(open);
  useEffect(() => {
    if (!open) return undefined;
    const handleKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div data-testid="bottom-sheet-backdrop" className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[85dvh] w-full overflow-y-auto overscroll-contain rounded-t-[12px] bg-white px-4 pb-6 pt-3 shadow-lg animate-fade-in-up motion-reduce:animate-none focus:outline-none sm:px-6"
      >
        <div aria-hidden="true" className="mx-auto mb-3 h-1 w-10 rounded-full bg-border-soft" />
        {showHeader && (
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-body-lg font-semibold leading-6 text-navy-dark">{title}</h2>
            <button
              type="button"
              aria-label={`Đóng ${title}`}
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-primary/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
