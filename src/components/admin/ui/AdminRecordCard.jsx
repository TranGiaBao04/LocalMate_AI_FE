import AdminSurface from "./AdminSurface";

export default function AdminRecordCard({ title, subtitle, leading, status, children, primaryAction, moreAction }) {
  return <AdminSurface as="article" density="compact" className="[overflow-wrap:anywhere]">
    <div className="flex items-start gap-3">
      {leading && <div className="shrink-0">{leading}</div>}
      <div className="min-w-0 flex-1"><h3 className="text-base font-semibold leading-6">{title}</h3>{subtitle && <div className="mt-1 text-xs leading-[18px] text-[#5C6B8A]">{subtitle}</div>}</div>
      {moreAction && <div className="shrink-0 [&_button]:min-h-11 [&_button]:min-w-11">{moreAction}</div>}
    </div>
    {status && <div className="mt-3">{status}</div>}
    {children && <div className="mt-4 text-sm leading-[22px] text-[#5C6B8A]">{children}</div>}
    {primaryAction && <div className="mt-4 border-t border-[#DCE2EE] pt-4 [&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center [&_button]:min-h-11">{primaryAction}</div>}
  </AdminSurface>;
}
