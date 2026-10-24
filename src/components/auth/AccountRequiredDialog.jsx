import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

/** Chặn phiên demo trước khi vào tính năng cần tài khoản thật (tạo lịch trình). */
export default function AccountRequiredDialog({ onClose }) {
  const navigate = useNavigate();
  const dialogRef = useRef(null);
  const registerButtonRef = useRef(null);

  // Focus vào nút Đăng ký khi mở, trả focus về chỗ cũ khi đóng
  useEffect(() => {
    const previousFocus = document.activeElement;
    registerButtonRef.current?.focus();
    return () => {
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab") return;
      const controls = dialogRef.current?.querySelectorAll("button");
      if (!controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-required-title"
      aria-describedby="account-required-description"
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 backdrop-blur-xs lg:items-center lg:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-2xl sm:p-6 lg:rounded-2xl">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-outline-variant/60 lg:hidden" />
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
          <span aria-hidden="true" className="material-symbols-outlined text-[24px]">person_add</span>
        </div>
        <h2 id="account-required-title" className="mt-4 text-lg font-bold text-navy-dark">
          Cần tài khoản để tạo lịch trình
        </h2>
        <p id="account-required-description" className="mt-2 text-sm leading-6 text-text-muted">
          Phiên demo chỉ để xem thử ứng dụng. Đăng ký miễn phí hoặc đăng nhập để tạo, lưu và chia sẻ lịch trình của bạn.
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-[8px] px-4 py-2.5 text-sm font-semibold text-text-muted hover:bg-chip-bg-alt hover:text-navy-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
          >
            Để sau
          </button>
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="min-h-11 rounded-[8px] border border-border-soft px-4 py-2.5 text-sm font-semibold text-navy hover:bg-chip-bg-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
          >
            Đăng nhập
          </button>
          <button
            ref={registerButtonRef}
            type="button"
            onClick={() => navigate("/register")}
            className="min-h-11 rounded-[8px] bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
          >
            Đăng ký
          </button>
        </div>
      </div>
    </div>
  );
}
