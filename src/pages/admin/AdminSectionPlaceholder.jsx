import AdminPageHeader from "../../components/admin/AdminPageHeader";

// section: 1 phần tử của ADMIN_SECTIONS, truyền từ route
export default function AdminSectionPlaceholder({ section }) {
  return (
    <div>
      <AdminPageHeader eyebrow={section.group} title={section.label} />

      <section className="mt-7 grid min-h-[420px] place-items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-[0_1px_2px_rgba(15,23,42,.03)]">
        <div className="max-w-md">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-blue-50 text-[#1d3e82]">
            <span className="material-symbols-outlined text-[30px]">{section.icon}</span>
          </div>
          <h2 className="mt-5 text-xl font-bold text-slate-900">Trang {section.label} đang được xây dựng</h2>
          <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500">
            <span className="material-symbols-outlined text-[16px]">construction</span>
            Đang phát triển
          </span>
        </div>
      </section>
    </div>
  );
}
