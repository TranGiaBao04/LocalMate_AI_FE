import { useState, useEffect } from "react";
import { adminPlanService } from "../../../services/adminPlanService";
import { AdminErrorState, EmptyState, LoadingState } from "../ui";
import { ADMIN_TERTIARY_BUTTON } from "../adminStyles";

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
        <p className="text-sm font-semibold text-[#0F2148]">
          Quyền lợi & Tính năng (Đang tải...)
        </p>
        <LoadingState label="Đang tải quyền lợi" />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-semibold text-[#0F2148]">
          Quyền lợi & Tính năng
        </p>
        <AdminErrorState message={fetchError} />
      </div>
    );
  }

  const allSelected = features.length > 0 && selectedIds.length === features.length;

  return (
    <div role="group" aria-label="Quyền lợi & Tính năng" className="min-w-0 space-y-2 [overflow-wrap:anywhere]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[#0F2148]">
          Quyền lợi & Tính năng
          <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-[#1d3e82]">
            {selectedIds.length} / {features.length}
          </span>
        </p>
        {!disabled && features.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={handleSelectAll}
              disabled={allSelected}
              className={ADMIN_TERTIARY_BUTTON}
            >
              Chọn tất cả
            </button>
            <button
              type="button"
              onClick={handleDeselectAll}
              disabled={selectedIds.length === 0}
              className={ADMIN_TERTIARY_BUTTON}
            >
              Bỏ chọn
            </button>
          </div>
        )}
      </div>

      {features.length === 0 ? (
        <EmptyState density="compact" title="Hệ thống chưa có quyền lợi khả dụng nào." />
      ) : (
        <div className="max-h-56 space-y-2 overflow-y-auto rounded-[12px] border border-[#DCE2EE] bg-slate-50/40 p-3">
          {features.map((feature) => {
            const isChecked = selectedIds.includes(feature.id);
            return (
              <label
                key={feature.id}
                className={`flex min-h-11 min-w-0 cursor-pointer select-none items-start gap-3 rounded-[8px] border p-2.5 transition ${
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
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-[#1d3e82] focus:ring-[#1d3e82]"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="min-w-0 text-sm font-semibold text-[#0F2148]">
                      {feature.name}
                    </span>
                    <span className="min-w-0 font-mono text-xs uppercase text-[#5C6B8A]">
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
        <p role="alert" className="text-xs font-medium text-rose-600">{error}</p>
      )}
    </div>
  );
}
