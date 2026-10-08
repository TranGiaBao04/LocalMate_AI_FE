import { useNavigate } from "react-router-dom";

export default function GuestTourCard({ onDismiss }) {
  const navigate = useNavigate();

  return (
    <section
      aria-labelledby="guest-tour-title"
      className="min-w-0 border-b border-border-soft pb-6"
    >
      <div className="flex flex-col gap-5">
        {/* Card Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-navy">
              <span aria-hidden="true" className="material-symbols-outlined text-lg text-primary">
                explore
              </span>
              <span>Dành cho khách mới</span>
            </div>
            <h3
              id="guest-tour-title"
              className="text-lg font-bold leading-7 text-navy-dark sm:text-xl"
            >
              Khám phá TP.HCM cùng LocalMate AI
            </h3>
            <p className="text-sm leading-6 text-text-muted">
              Lên lịch trình thông minh quanh trục Metro số 1 chỉ với 3 bước đơn giản:
            </p>
          </div>

          <button
            type="button"
            onClick={onDismiss}
            aria-label="Đóng hướng dẫn nhanh"
            className="flex h-11 w-11 flex-none items-center justify-center rounded-[8px] text-text-muted hover:bg-chip-bg-alt hover:text-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* 3 Quick Steps */}
        <ol className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <li className="flex min-w-0 items-start gap-3">
            <div aria-hidden="true" className="flex h-8 w-8 flex-none items-center justify-center text-primary">
              <span className="material-symbols-outlined text-xl">train</span>
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold leading-6 text-navy-dark">
                1. Điểm xuất phát
              </div>
              <div className="mt-1 text-sm leading-6 text-text-muted">
                Chọn khu vực hoặc ga Metro gần bạn để tối ưu đi bộ.
              </div>
            </div>
          </li>

          <li className="flex min-w-0 items-start gap-3">
            <div aria-hidden="true" className="flex h-8 w-8 flex-none items-center justify-center text-primary">
              <span className="material-symbols-outlined text-xl">tune</span>
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold leading-6 text-navy-dark">
                2. Gu &amp; Ngân sách
              </div>
              <div className="mt-1 text-sm leading-6 text-text-muted">
                Tùy biến thời gian, chi phí và sở thích cà phê, văn hóa, ẩm thực.
              </div>
            </div>
          </li>

          <li className="flex min-w-0 items-start gap-3">
            <div aria-hidden="true" className="flex h-8 w-8 flex-none items-center justify-center text-primary">
              <span className="material-symbols-outlined text-xl">auto_awesome</span>
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold leading-6 text-navy-dark">
                3. Lịch trình AI
              </div>
              <div className="mt-1 text-sm leading-6 text-text-muted">
                Nhận lộ trình trọn vẹn, dễ dàng đổi điểm và lưu lại khi cần.
              </div>
            </div>
          </li>
        </ol>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-[540px] text-xs leading-5 text-text-muted">
            💡 Bạn có thể tạo lịch trình trải nghiệm ngay mà không cần cấu hình phức tạp.
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onDismiss}
              className="min-h-11 rounded-[8px] px-4 py-3 text-sm font-semibold text-text-muted hover:bg-chip-bg-alt hover:text-navy-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
            >
              Để sau
            </button>
            <button
              type="button"
              onClick={() => navigate("/create")}
              className="flex min-h-11 items-center justify-center gap-2 rounded-[8px] bg-navy px-4 py-3 text-sm font-semibold text-white hover:bg-navy-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
            >
              <span>Bắt đầu tạo lịch trình</span>
              <span aria-hidden="true" className="material-symbols-outlined flex-none text-lg">arrow_forward</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
