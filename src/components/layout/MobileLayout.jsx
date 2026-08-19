export default function MobileLayout({
  children,
  className = "",
}) {
  return (
    <div className={`app-shell flex flex-col ${className}`}>
      {children}
    </div>
  );
}
