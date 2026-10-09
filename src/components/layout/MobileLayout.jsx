export default function MobileLayout({
  children,
  className = "",
}) {
  return (
    <div className={`app-shell flex min-w-0 flex-col ${className}`}>
      {children}
    </div>
  );
}
