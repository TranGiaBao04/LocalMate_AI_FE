import { CheckCircle2, AlertCircle } from "lucide-react";

export function VerifiedBadge({ isVerified }) {
  if (isVerified) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
        Đã xác thực
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-gray-50 text-gray-500 border border-gray-200 rounded-full">
      <AlertCircle className="w-3.5 h-3.5 text-gray-400" />
      Chưa xác thực
    </span>
  );
}

export function PlaceStatusToggle({ status, onToggle, loading }) {
  const isActive = status === "Active";

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={loading}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
        isActive ? "bg-teal-600" : "bg-gray-300"
      } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
      title={isActive ? "Tạm ẩn địa điểm" : "Kích hoạt địa điểm"}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          isActive ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}
