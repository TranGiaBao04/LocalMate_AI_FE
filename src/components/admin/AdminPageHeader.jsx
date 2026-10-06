import { Link } from "react-router-dom";

// Phần đầu trang dùng chung cho trang admin: link quay lại (trang con), dòng nhóm, tiêu đề, mô tả, nút bên phải
export default function AdminPageHeader({ back, eyebrow, title, badge, description, children }) {
  return (
    <header className="space-y-3">
      {back && (
        <Link to={back.to} className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 transition hover:text-primary">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          {back.label}
        </Link>
      )}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="min-w-0">
          {eyebrow && <p className="text-sm font-semibold text-primary">{eyebrow}</p>}
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{title}</h1>
            {badge}
          </div>
          {description && <div className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{description}</div>}
        </div>
        {children && <div className="flex shrink-0 flex-wrap items-center gap-3">{children}</div>}
      </div>
    </header>
  );
}
