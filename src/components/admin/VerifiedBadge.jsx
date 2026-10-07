import { StatusBadge } from "./ui";

export function VerifiedBadge({ isVerified }) {
  return <StatusBadge variant={isVerified ? "success" : "neutral"} icon={isVerified ? "verified" : "info"} label={isVerified ? "Đã xác thực" : "Chưa xác thực"} />;
}

export function PlaceStatusToggle({ status, onToggle, loading }) {
  const isActive = status === "Active";
  const label = isActive ? "Tạm ẩn địa điểm" : "Kích hoạt địa điểm";
  return <button type="button" role="switch" aria-checked={isActive} aria-label={label} title={label} onClick={onToggle} disabled={loading}
    className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-[8px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2C56A8] disabled:cursor-not-allowed disabled:opacity-50">
    <span aria-hidden="true" className={`relative inline-flex h-6 w-11 rounded-full border-2 border-transparent transition-colors motion-reduce:transition-none ${isActive ? "bg-emerald-600" : "bg-[#8993AC]"}`}><span className={`h-5 w-5 rounded-full bg-white transition-transform motion-reduce:transition-none ${isActive ? "translate-x-5" : "translate-x-0"}`} /></span>
  </button>;
}
