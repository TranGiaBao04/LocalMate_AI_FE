import { useState } from "react";
import { AdminSurface, NoticeBanner } from "../ui";
import { ADMIN_PRIMARY_BUTTON } from "../adminStyles";

export default function ImportModeSelector({ preview, onCommit, loading }) {
  const [mode, setMode] = useState(0);
  const hasErrors = preview.errorRowsCount > 0;

  return <AdminSurface className="space-y-5">
    <fieldset>
      <legend className="mb-4 text-base font-semibold leading-6 text-[#0F2148]">Chế độ nhập dữ liệu</legend>
      <div className="grid gap-3 md:grid-cols-2">
        {[{ value: 0, title: "Chỉ import các dòng hợp lệ", description: `Bỏ qua ${preview.errorRowsCount} dòng bị lỗi và lưu ${preview.validRowsCount} dòng hợp lệ.` }, { value: 1, title: "Hủy toàn bộ nếu có lỗi (Strict)", description: "Toàn bộ file phải hợp lệ. Có bất kỳ dòng lỗi nào sẽ hủy toàn bộ giao dịch." }].map((option) => <label key={option.value} className={`flex min-w-0 cursor-pointer items-start gap-3 rounded-[12px] border p-4 focus-within:ring-2 focus-within:ring-[#2C56A8] ${mode === option.value ? "border-[#2C56A8] bg-blue-50/40" : "border-[#DCE2EE]"}`}>
          <input type="radio" name="importMode" checked={mode === option.value} onChange={() => setMode(option.value)} className="mt-1 h-4 w-4 shrink-0 accent-[#2C56A8]" />
          <span className="min-w-0"><span className="block text-sm font-semibold leading-[22px] text-[#0F2148]">{option.title}</span><span className="mt-1 block text-[13px] leading-[18px] text-[#5C6B8A]">{option.description}</span></span>
        </label>)}
      </div>
    </fieldset>
    {mode === 1 && hasErrors && <NoticeBanner notice={{ type: "warning", message: `File hiện tại có ${preview.errorRowsCount} dòng bị lỗi. Lựa chọn này sẽ khiến giao dịch import bị hủy.` }} />}
    <div className="flex justify-end">
      <button type="button" disabled={loading || (mode === 1 && hasErrors)} onClick={() => onCommit(mode)} className={ADMIN_PRIMARY_BUTTON}>
        <span aria-hidden="true" className={`material-symbols-outlined text-[20px] ${loading ? "animate-spin motion-reduce:animate-none" : ""}`}>{loading ? "progress_activity" : "publish"}</span>
        {loading ? "Đang lưu dữ liệu vào DB..." : `Xác nhận Import ${preview.validRowsCount} địa điểm`}
      </button>
    </div>
  </AdminSurface>;
}
