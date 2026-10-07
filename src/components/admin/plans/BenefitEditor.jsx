import { useState, useEffect } from "react";
import { adminPlanService } from "../../../services/adminPlanService";

export default function BenefitEditor({
  selectedIds = [],
  onChange,
  disabled = false,
  error = null,
}) {
  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function loadFeatures() {
      try {
        setLoading(true);
        setFetchError(null);
        const data = await adminPlanService.getFeatures();
        if (isMounted) {
          setFeatures(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (isMounted) {
          setFetchError(err?.message || "Không thể tải danh sách quyền lợi hệ thống.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    loadFeatures();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleToggle = (id) => {
    if (disabled) return;
    const exists = selectedIds.includes(id);
    const nextIds = exists
      ? selectedIds.filter((item) => item !== id)
      : [...selectedIds, id];
    onChange?.(nextIds);
  };

  const handleSelectAll = () => {
    if (disabled) return;
    onChange?.(features.map((f) => f.id));
  };

  const handleDeselectAll = () => {
    if (disabled) return;
    onChange?.([]);
  };

  if (loading) {
    return (
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-slate-700">
          Quyền lợi & Tính năng (Đang tải...)
        </label>
        <div className="space-y-2 rounded-[12px] border border-[#DCE2EE] bg-slate-50/50 p-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-[8px] bg-slate-200/70" />
          ))}
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-slate-700">
          Quyền lợi & Tính năng
        </label>
        <div className="flex items-center gap-2 rounded-[12px] border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          <span className="material-symbols-outlined text-[18px]">error</span>
          <span>{fetchError}</span>
        </div>
      </div>
    );
  }

  const allSelected = features.length > 0 && selectedIds.length === features.length;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between">
        <label className="block text-sm font-semibold text-slate-700">
          Quyền lợi & Tính năng
          <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-[#1d3e82]">
            {selectedIds.length} / {features.length}
          </span>
        </label>
        {!disabled && features.length > 0 && (
          <div className="flex items-center gap-3 text-xs font-semibold text-[#1d3e82]">
            <button
              type="button"
              onClick={handleSelectAll}
              disabled={allSelected}
              className="hover:underline disabled:opacity-40"
            >
              Chọn tất cả
            </button>
            <span className="text-slate-300">·</span>
            <button
              type="button"
              onClick={handleDeselectAll}
              disabled={selectedIds.length === 0}
              className="hover:underline disabled:opacity-40"
            >
              Bỏ chọn
            </button>
          </div>
        )}
      </div>

      {features.length === 0 ? (
        <div className="rounded-[12px] border border-dashed border-[#DCE2EE] p-4 text-center text-xs text-[#5C6B8A]">
          Hệ thống chưa có quyền lợi khả dụng nào.
        </div>
      ) : (
        <div className="max-h-56 space-y-2 overflow-y-auto rounded-[12px] border border-[#DCE2EE] bg-slate-50/40 p-3">
          {features.map((feature) => {
            const isChecked = selectedIds.includes(feature.id);
            return (
              <label
                key={feature.id}
                className={`flex cursor-pointer select-none items-start gap-3 rounded-[8px] border p-2.5 transition ${
                  isChecked
                    ? "border-blue-200 bg-blue-50/60"
                    : "border-[#DCE2EE]/80 bg-white hover:border-slate-300"
                } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => handleToggle(feature.id)}
                  disabled={disabled}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#1d3e82] focus:ring-[#1d3e82]"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800">
                      {feature.name}
                    </span>
                    <span className="font-mono text-xs uppercase text-[#5C6B8A]">
                      [{feature.code}]
                    </span>
                  </div>
                  {feature.description && (
                    <p className="mt-0.5 text-xs leading-relaxed text-[#5C6B8A]">
                      {feature.description}
                    </p>
                  )}
                </div>
              </label>
            );
          })}
        </div>
      )}

      {error && (
        <p className="text-xs font-medium text-rose-600">{error}</p>
      )}
    </div>
  );
}
