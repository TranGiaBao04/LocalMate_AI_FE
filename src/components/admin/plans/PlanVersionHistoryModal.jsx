import { useState, useEffect } from "react";
import { adminPlanService } from "../../../services/adminPlanService";
import { formatPlanPrice, formatVnDateTime } from "../../../utils/subscriptionUtils";

function PlanVersionHistoryContent({ plan, onClose }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isCancelled = false;

    adminPlanService
      .getPlanVersions(plan.id, { page, pageSize: 10 })
      .then((data) => {
        if (isCancelled) return;
        setVersions(Array.isArray(data?.items) ? data.items : []);
        setTotalPages(data?.totalPages ?? 1);
        setTotalCount(data?.totalCount ?? 0);
        setError(null);
      })
      .catch((err) => {
        if (isCancelled) return;
        setError(err?.message || "Không thể tải lịch sử phiên bản của gói.");
      })
      .finally(() => {
        if (!isCancelled) setLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [plan.id, page, refreshKey]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="history-modal-title"
      className="my-auto w-full max-w-3xl rounded-2xl bg-white shadow-2xl transition"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-purple-50 text-purple-700">
            <span className="material-symbols-outlined text-[22px]">history</span>
          </div>
          <div>
            <h2 id="history-modal-title" className="text-lg font-bold text-slate-900">
              Lịch sử phiên bản: {plan.name}
            </h2>
            <p className="text-xs text-slate-500">
              Mã: <span className="font-mono font-semibold">{plan.code}</span> · {totalCount} phiên bản đã lưu
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Đóng"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>

      {/* Content */}
      <div className="max-h-[calc(100vh-220px)] space-y-4 overflow-y-auto px-6 py-5">
        {error && (
          <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                setRefreshKey((k) => k + 1);
              }}
              className="font-semibold underline hover:no-underline"
            >
              Thử lại
            </button>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        ) : versions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
            Chưa có phiên bản nào được ghi nhận cho gói này.
          </div>
        ) : (
          <div className="space-y-4">
            {versions.map((ver) => (
              <div
                key={ver.id}
                className={`rounded-2xl border p-5 transition ${
                  ver.isCurrent
                    ? "border-blue-200 bg-blue-50/20 shadow-sm ring-1 ring-blue-100"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 font-mono text-xs font-bold text-slate-800">
                      v{ver.versionNumber}
                    </span>
                    {ver.isCurrent && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                        Phiên bản hiện tại
                      </span>
                    )}
                    {ver.origin && (
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                        {ver.origin}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400">
                    Tạo lúc:{" "}
                    <span className="font-medium text-slate-600">
                      {formatVnDateTime(ver.publishedAt || ver.createdAt)}
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50/80 p-3 text-xs sm:grid-cols-4">
                  <div>
                    <p className="text-slate-400">Giá bán</p>
                    <p className="mt-0.5 font-bold text-slate-900">
                      {formatPlanPrice(ver.price)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">Thời hạn</p>
                    <p className="mt-0.5 font-bold text-slate-900">
                      {ver.durationDays != null
                        ? `${ver.durationDays} ngày`
                        : plan?.code === "FREE"
                          ? "Không áp dụng"
                          : "Không có thời hạn mua"}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">Lượt tạo AI</p>
                    <p className="mt-0.5 font-bold text-slate-900">
                      {ver.generateLimit == null ? "Không giới hạn (∞)" : `${ver.generateLimit} lượt`}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">Lượt lưu chuyến</p>
                    <p className="mt-0.5 font-bold text-slate-900">
                      {ver.savedTripLimit == null ? "Không giới hạn (∞)" : `${ver.savedTripLimit} chuyến`}
                    </p>
                  </div>
                </div>

                {Array.isArray(ver.features) && ver.features.length > 0 && (
                  <div className="mt-3.5 border-t border-slate-100 pt-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Quyền lợi bao gồm ({ver.features.length})
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {ver.features.map((feat) => (
                        <span
                          key={feat.id || feat.code}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700"
                          title={feat.description || feat.name}
                        >
                          <span className="material-symbols-outlined text-[14px] text-emerald-600">check</span>
                          <span>{feat.name}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer with pagination */}
      <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/70 px-6 py-3 text-xs text-slate-500">
        <div>
          Trang {page} / {totalPages || 1} · {totalCount} bản ghi
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => {
              setLoading(true);
              setPage((p) => p - 1);
            }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Trước
          </button>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => {
              setLoading(true);
              setPage((p) => p + 1);
            }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Sau
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PlanVersionHistoryModal({
  isOpen,
  plan = null,
  onClose,
}) {
  if (!isOpen || !plan) return null;

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-slate-950/45 p-4 backdrop-blur-sm sm:p-6"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <PlanVersionHistoryContent key={plan.id} plan={plan} onClose={onClose} />
    </div>
  );
}
