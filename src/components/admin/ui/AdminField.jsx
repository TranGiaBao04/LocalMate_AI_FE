export default function AdminField({ id, label, hint, error, children, className = "" }) {
  return <div className={`min-w-0 space-y-2 ${className}`}>
    {label && <label htmlFor={id} className="block text-[13px] font-semibold leading-[18px] text-[#0F2148]">{label}</label>}
    {children}
    {hint && <p id={id ? `${id}-hint` : undefined} className="text-xs leading-[18px] text-[#5C6B8A]">{hint}</p>}
    {error && <p id={id ? `${id}-error` : undefined} role="alert" className="text-xs leading-[18px] text-red-700">{error}</p>}
  </div>;
}
