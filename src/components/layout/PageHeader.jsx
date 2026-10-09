// Thanh tiêu đề cố định dùng chung cho các trang cấp 1 (các mục trên sidebar)
export default function PageHeader({ title, children }) {
  return (
    <header className="app-header flex h-16 min-w-0 items-center justify-between gap-3 border-b border-border-soft bg-surface-container-lowest px-container-margin lg:px-8 [&_button]:focus-visible:outline [&_button]:focus-visible:outline-2 [&_button]:focus-visible:outline-offset-2 [&_button]:focus-visible:outline-navy">
      <h1 title={typeof title === "string" ? title : undefined} className="min-w-0 truncate text-[20px] font-bold leading-7 text-navy-dark sm:text-[22px] sm:leading-8">
        {title}
      </h1>
      {children}
    </header>
  );
}
