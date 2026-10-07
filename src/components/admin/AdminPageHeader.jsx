import { Link } from "react-router-dom";

// Phần đầu trang dùng chung cho trang admin: link quay lại (trang con), dòng nhóm, tiêu đề, mô tả, nút bên phải
export default function AdminPageHeader({ back, eyebrow, title, badge, description, children }) {
  return (
    <header className="space-y-4">
      {back && (
        <Link to={back.to} className="inline-flex min-h-11 items-center gap-2 rounded-[8px] text-sm font-medium text-[#5C6B8A] transition-colors hover:text-[#1D3E82] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2C56A8] motion-reduce:transition-none">
          <span aria-hidden="true" className="material-symbols-outlined text-[20px]">arrow_back</span>
          {back.label}
        </Link>
      )}
      <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-start">
        <div className="min-w-0">
          {eyebrow && <p className="text-[13px] font-semibold leading-[18px] text-[#2C56A8]">{eyebrow}</p>}
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-3">
            <h1 className="min-w-0 break-words text-[28px] font-bold leading-9 tracking-normal text-[#0F2148] [overflow-wrap:anywhere]">{title}</h1>
            {badge}
          </div>
          {description && <div className="mt-2 max-w-3xl break-words text-sm leading-[22px] text-[#5C6B8A] [overflow-wrap:anywhere]">{description}</div>}
        </div>
        {children && <div className="flex min-w-0 flex-wrap items-center gap-3 xl:max-w-[45%] xl:justify-end [&>*]:max-w-full">{children}</div>}
      </div>
    </header>
  );
}
