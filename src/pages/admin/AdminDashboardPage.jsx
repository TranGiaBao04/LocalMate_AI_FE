import { Link } from "react-router-dom";

const quickActions = [
  {
    title: "Quản lý người dùng",
    description: "Xem danh sách, thông tin và trạng thái tài khoản.",
    icon: "group",
    to: "/admin/users",
    tone: "bg-blue-50 text-blue-700",
  },
  {
    title: "Quản lý địa điểm",
    description: "Kiểm duyệt và cập nhật dữ liệu địa điểm.",
    icon: "location_on",
    to: "/admin/places",
    tone: "bg-emerald-50 text-emerald-700",
  },
  {
    title: "Theo dõi giao dịch",
    description: "Tra cứu các giao dịch và trạng thái thanh toán.",
    icon: "receipt_long",
    to: "/admin/transactions",
    tone: "bg-amber-50 text-amber-700",
  },
  {
    title: "Xử lý phản hồi",
    description: "Theo dõi nội dung cần quản trị viên xem xét.",
    icon: "reviews",
    to: "/admin/feedback",
    tone: "bg-rose-50 text-rose-700",
  },
];

export default function AdminDashboardPage() {
  return (
    <div className="mx-auto max-w-[1440px]">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold text-[#1d3e82]">Tổng quan hệ thống</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Chào buổi tối, Admin</h1>
          <p className="mt-2 text-sm text-slate-500">Chọn một khu vực để bắt đầu quản lý LocalMate.</p>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 shadow-sm">
          <span className="material-symbols-outlined text-[19px] text-slate-400">calendar_today</span>
          29 tháng 09, 2026
        </div>
      </div>

      <section aria-labelledby="quick-actions-title">
        <div className="mb-4">
          <h2 id="quick-actions-title" className="text-lg font-bold text-slate-900">Truy cập nhanh</h2>
          <p className="mt-1 text-sm text-slate-400">Các chức năng quản trị chính</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {quickActions.map((action) => (
            <Link
              key={action.to}
              to={action.to}
              className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,.04)] transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-[0_14px_32px_rgba(15,23,42,.08)]"
            >
              <div className={`grid h-12 w-12 place-items-center rounded-xl ${action.tone}`}>
                <span className="material-symbols-outlined text-[24px]">{action.icon}</span>
              </div>
              <div className="mt-5 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-900">{action.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{action.description}</p>
                </div>
                <span className="material-symbols-outlined mt-0.5 text-[20px] text-slate-300 transition group-hover:translate-x-1 group-hover:text-[#1d3e82]">arrow_forward</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,.04)] sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-blue-50 text-[#1d3e82]">
              <span className="material-symbols-outlined text-[24px]">monitoring</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Báo cáo vận hành</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                Khu vực thống kê sẽ hiển thị khi hệ thống có API tổng hợp dữ liệu thực. Dashboard hiện không sử dụng số liệu giả.
              </p>
            </div>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500">
            <span className="material-symbols-outlined text-[16px]">schedule</span>
            Chờ dữ liệu thực
          </span>
        </div>
      </section>
    </div>
  );
}
