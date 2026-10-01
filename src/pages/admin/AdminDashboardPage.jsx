import { Link } from "react-router-dom";

const modules = [
  { title: "Quản lý 14 Ga Metro", description: "Quản lý thông tin nhà ga, lối Exit và dữ liệu liên kết.", icon: "train", to: "/admin/stations", color: "text-blue-700 bg-blue-50" },
  { title: "Địa điểm & Tiện ích", description: "Kiểm duyệt POI và dữ liệu trải nghiệm quanh nhà ga.", icon: "location_on", to: "/admin/places", color: "text-emerald-700 bg-emerald-50" },
  { title: "Nhập dữ liệu Excel / CSV", description: "Khu vực nhập dữ liệu địa điểm theo lô.", icon: "upload_file", to: "/admin/import", color: "text-violet-700 bg-violet-50" },
  { title: "Gói thành viên", description: "Quản lý gói dịch vụ và cấu hình quyền lợi.", icon: "loyalty", to: "/admin/plans", color: "text-amber-700 bg-amber-50" },
  { title: "Giao dịch PayOS", description: "Theo dõi giao dịch và trạng thái đối soát.", icon: "payments", to: "/admin/transactions", color: "text-cyan-700 bg-cyan-50" },
  { title: "Quản lý Users", description: "Tra cứu tài khoản và trạng thái người dùng.", icon: "group", to: "/admin/users", color: "text-rose-700 bg-rose-50" },
];

const reportCards = [
  { label: "Người dùng mới tháng này", icon: "person_add" },
  { label: "Lịch trình đã sinh", icon: "route" },
  { label: "Doanh thu PayOS", icon: "account_balance_wallet" },
  { label: "Gói Explorer đang hoạt động", icon: "verified" },
];

export default function AdminDashboardPage() {
  return (
    <div>
      <section className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-blue-700"><span className="material-symbols-outlined text-[15px]">grid_view</span>Dashboard tổng quan</div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#0f2042] sm:text-[30px]">Trung tâm vận hành LocalMate AI</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Quản trị dữ liệu Metro Line 1, địa điểm, hội viên và các giao dịch thanh toán trong một giao diện thống nhất.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/import" className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 shadow-sm transition hover:border-blue-200 hover:text-blue-700"><span className="material-symbols-outlined text-[18px]">upload_file</span>Nhập dữ liệu</Link>
          <Link to="/admin/places" className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700"><span className="material-symbols-outlined text-[18px]">add_location_alt</span>Thêm địa điểm</Link>
        </div>
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Chỉ số vận hành">
        {reportCards.map((item) => (
          <article key={item.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,.04)]">
            <div className="flex items-start justify-between gap-3"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{item.label}</p><span className="material-symbols-outlined text-[21px] text-blue-600">{item.icon}</span></div>
          </article>
        ))}
      </section>

      <section className="mt-6">
        <div className="mb-4"><h2 className="text-lg font-extrabold text-[#0f2042]">Thao tác quản trị nhanh</h2><p className="mt-1 text-sm text-slate-500">Truy cập các module theo cấu trúc Admin Portal trong Stitch</p></div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {modules.map((module) => (
            <Link key={module.to} to={module.to} className="group flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,.04)] transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg">
              <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg ${module.color}`}><span className="material-symbols-outlined text-[22px]">{module.icon}</span></span>
              <div className="min-w-0 flex-1"><h3 className="text-sm font-extrabold text-slate-800">{module.title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{module.description}</p></div>
              <span className="material-symbols-outlined text-[18px] text-slate-300 transition group-hover:translate-x-1 group-hover:text-blue-600">arrow_forward</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
