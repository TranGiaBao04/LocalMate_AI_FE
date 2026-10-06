// Thanh tiêu đề cố định dùng chung cho các trang cấp 1 (các mục trên sidebar)
export default function PageHeader({ title, children }) {
  return (
    <header className="app-header flex h-16 items-center justify-between gap-3 border-b border-outline-variant/20 px-container-margin lg:px-8">
      <h1 className="min-w-0 truncate text-headline-lg-mobile font-extrabold text-primary">
        {title}
      </h1>
      {children}
    </header>
  );
}
