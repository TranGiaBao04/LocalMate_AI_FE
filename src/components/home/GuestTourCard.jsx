import { useNavigate } from "react-router-dom";

export default function GuestTourCard({ onDismiss }) {
  const navigate = useNavigate();

  return (
    <section
      aria-labelledby="guest-tour-title"
      className="soft-shadow relative overflow-hidden rounded-[20px] border border-primary-container/30 bg-gradient-to-br from-white via-surface-container-lowest to-surface-container-low p-5 sm:p-6"
    >
      {/* Background decorative glow */}
      <div
        className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-primary-container/20 blur-2xl"
        aria-hidden="true"
      />

      <div className="relative flex flex-col gap-4">
        {/* Card Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary-container/25 px-3 py-1 text-[11px] font-bold text-navy-dark">
              <span className="material-symbols-outlined text-[15px] text-primary">
                explore
              </span>
              <span>Dành cho khách mới</span>
            </div>
            <h3
              id="guest-tour-title"
              className="text-lg font-extrabold text-navy-dark sm:text-xl"
            >
              Khám phá TP.HCM cùng LocalMate AI
            </h3>
            <p className="text-[13px] leading-relaxed text-text-muted">
              Lên lịch trình thông minh quanh trục Metro số 1 chỉ với 3 bước đơn giản:
            </p>
          </div>

          <button
            type="button"
            onClick={onDismiss}
            aria-label="Đóng hướng dẫn nhanh"
            className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-text-faint transition-colors hover:bg-surface-container-high hover:text-navy active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* 3 Quick Steps */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex items-start gap-3 rounded-xl border border-outline-variant/20 bg-white/80 p-3.5 backdrop-blur-[2px]">
            <div className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-primary-container/30 text-primary">
              <span className="material-symbols-outlined text-[18px]">train</span>
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-bold text-navy-dark">
                1. Điểm xuất phát
              </div>
              <div className="mt-0.5 text-[12px] leading-snug text-text-muted">
                Chọn khu vực hoặc ga Metro gần bạn để tối ưu đi bộ.
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-outline-variant/20 bg-white/80 p-3.5 backdrop-blur-[2px]">
            <div className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-primary-container/30 text-primary">
              <span className="material-symbols-outlined text-[18px]">tune</span>
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-bold text-navy-dark">
                2. Gu &amp; Ngân sách
              </div>
              <div className="mt-0.5 text-[12px] leading-snug text-text-muted">
                Tùy biến thời gian, chi phí và sở thích cà phê, văn hóa, ẩm thực.
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-outline-variant/20 bg-white/80 p-3.5 backdrop-blur-[2px]">
            <div className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-primary-container/30 text-primary">
              <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-bold text-navy-dark">
                3. Lịch trình AI
              </div>
              <div className="mt-0.5 text-[12px] leading-snug text-text-muted">
                Nhận lộ trình trọn vẹn, dễ dàng đổi điểm và lưu lại khi cần.
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant/20 pt-3">
          <div className="text-[12px] text-text-faint">
            💡 Bạn có thể tạo lịch trình trải nghiệm ngay mà không cần cấu hình phức tạp.
          </div>
          <div className="flex w-full items-center justify-end gap-2.5 sm:w-auto">
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-xl px-4 py-2.5 text-[13px] font-semibold text-text-muted transition-colors hover:text-navy-dark active:scale-95"
            >
              Để sau
            </button>
            <button
              type="button"
              onClick={() => navigate("/create")}
              className="flex items-center gap-1.5 rounded-xl bg-navy px-4 py-2.5 text-[13px] font-bold text-white shadow-sm transition-all hover:bg-navy-dark active:scale-95"
            >
              <span>Bắt đầu tạo lịch trình</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
