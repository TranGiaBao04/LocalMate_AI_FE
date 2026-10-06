import { useState } from "react";
import { Check, AlertOctagon, ArrowRight, Loader2 } from "lucide-react";

export default function ImportModeSelector({ preview, onCommit, loading }) {
  const [mode, setMode] = useState(0); // 0 = ValidOnly, 1 = AbortOnError

  const hasErrors = preview.errorRowsCount > 0;

  return (
    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
      <h3 className="text-sm font-bold text-gray-900">Lựa chọn chế độ Import vào Database</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Mode 0: ValidOnly */}
        <label
          className={`p-4 rounded-xl border-2 cursor-pointer transition flex items-start gap-3 ${
            mode === 0
              ? "border-primary bg-blue-50/20"
              : "border-gray-200 hover:border-gray-300 bg-white"
          }`}
        >
          <input
            type="radio"
            name="importMode"
            checked={mode === 0}
            onChange={() => setMode(0)}
            className="mt-1 text-primary focus:ring-blue-200"
          />
          <div>
            <p className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
              <span>Chỉ import các dòng hợp lệ</span>
              <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800 font-semibold">Khuyên dùng</span>
            </p>
            <p className="text-[11px] text-gray-500 mt-1">
              Hệ thống sẽ bỏ qua {preview.errorRowsCount} dòng bị lỗi và lưu {preview.validRowsCount} dòng hợp lệ vào cơ sở dữ liệu.
            </p>
          </div>
        </label>

        {/* Mode 1: AbortOnError */}
        <label
          className={`p-4 rounded-xl border-2 cursor-pointer transition flex items-start gap-3 ${
            mode === 1
              ? "border-primary bg-blue-50/20"
              : "border-gray-200 hover:border-gray-300 bg-white"
          }`}
        >
          <input
            type="radio"
            name="importMode"
            checked={mode === 1}
            onChange={() => setMode(1)}
            className="mt-1 text-primary focus:ring-blue-200"
          />
          <div>
            <p className="text-xs font-bold text-gray-900">Hủy toàn bộ nếu có lỗi (Strict)</p>
            <p className="text-[11px] text-gray-500 mt-1">
              Yêu cầu toàn bộ file phải hợp lệ 100%. Nếu có bất kỳ dòng nào lỗi, hệ thống sẽ hủy bỏ toàn bộ giao dịch.
            </p>
          </div>
        </label>
      </div>

      {mode === 1 && hasErrors && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-xs text-amber-800 font-medium">
          <AlertOctagon className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span>File hiện tại có {preview.errorRowsCount} dòng bị lỗi. Lựa chọn này sẽ khiến giao dịch import bị hủy.</span>
        </div>
      )}

      <div className="flex items-center justify-end pt-2">
        <button
          type="button"
          disabled={loading || (mode === 1 && hasErrors)}
          onClick={() => onCommit(mode)}
          className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-medium text-white bg-primary hover:bg-[#17366f] rounded-xl transition shadow-sm disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Đang lưu dữ liệu vào DB...</span>
            </>
          ) : (
            <>
              <span>Xác nhận Import {preview.validRowsCount} địa điểm</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
