import { useLocation } from "react-router-dom";

const sectionDetails = {
  "/admin/users": {
    icon: "group",
    eyebrow: "Quản lý tài khoản",
    title: "Người dùng",
  },
  "/admin/places": {
    icon: "location_on",
    eyebrow: "Quản lý nội dung",
    title: "Địa điểm",
  },
  "/admin/transactions": {
    icon: "receipt_long",
    eyebrow: "Theo dõi thanh toán",
    title: "Giao dịch",
  },
  "/admin/feedback": {
    icon: "reviews",
    eyebrow: "Chăm sóc hệ thống",
    title: "Phản hồi",
  },
};

export default function AdminSectionPlaceholder() {
  const { pathname } = useLocation();
  const section = sectionDetails[pathname] || sectionDetails["/admin/users"];

  return (
    <div className="mx-auto max-w-[1440px]">
      <div>
        <p className="text-sm font-semibold text-[#1d3e82]">{section.eyebrow}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{section.title}</h1>
      </div>

      <section className="mt-7 grid min-h-[420px] place-items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-[0_1px_2px_rgba(15,23,42,.03)]">
        <div className="max-w-md">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-blue-50 text-[#1d3e82]">
            <span className="material-symbols-outlined text-[30px]">{section.icon}</span>
          </div>
          <h2 className="mt-5 text-xl font-bold text-slate-900">Trang {section.title} đã sẵn sàng</h2>
          <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500">
            <span className="material-symbols-outlined text-[16px]">construction</span>
            Đang phát triển
          </span>
        </div>
      </section>
    </div>
  );
}
