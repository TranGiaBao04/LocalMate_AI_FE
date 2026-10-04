import { AlertTriangle } from "lucide-react";

export default function ValidationAlert({ warning }) {
  if (!warning) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
      <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
      <div className="text-xs text-amber-800 space-y-0.5">
        <p className="font-semibold text-amber-900">Cảnh báo khoảng cách tới ga Metro (&gt;1.5 km)</p>
        <p>{warning}</p>
      </div>
    </div>
  );
}
