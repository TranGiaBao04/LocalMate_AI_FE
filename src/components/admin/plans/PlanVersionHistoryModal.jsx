import { useState, useEffect } from "react";
import { AdminOverlayFrame, AdminPagination, AdminErrorState, LoadingState, EmptyState, StatusBadge } from "../ui";
import { ADMIN_SECONDARY_BUTTON } from "../adminStyles";
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
    <AdminOverlayFrame open title={`Lịch sử phiên bản: ${plan.name}`} description={`Mã: ${plan.code} · ${totalCount} phiên bản đã lưu`} onClose={onClose}
      footer={<button type="button" className={ADMIN_SECONDARY_BUTTON} onClick={onClose}>Đóng</button>}>
      <div className="space-y-5">
        {error ? <AdminErrorState message={error} onRetry={() => { setLoading(true); setRefreshKey(k => k + 1); }} /> : loading ? <LoadingState /> : versions.length === 0 ? <EmptyState title="Chưa có phiên bản nào được ghi nhận cho gói này." icon="history" /> : (
          <ol aria-label="Lịch sử phiên bản" className="space-y-6">
            {versions.map(ver => (
              <li key={ver.id} className="border-l-2 border-[#DCE2EE] pl-4 [overflow-wrap:anywhere]">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-mono text-base font-semibold">v{ver.versionNumber}</h3>
                  {ver.isCurrent && <StatusBadge status="active" label="Phiên bản hiện tại" />}
                  {ver.origin && <span className="text-xs text-[#5C6B8A]">{ver.origin}</span>}
                </div>
                <p className="mt-2 text-xs text-[#5C6B8A]">Tạo lúc: {formatVnDateTime(ver.publishedAt || ver.createdAt)}</p>
                <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
                  <div><dt className="text-xs text-[#5C6B8A]">Giá bán</dt><dd className="mt-1 font-semibold">{formatPlanPrice(ver.price)}</dd></div>
                  <div><dt className="text-xs text-[#5C6B8A]">Thời hạn</dt><dd className="mt-1">{ver.durationDays != null ? `${ver.durationDays} ngày` : plan.code === "FREE" ? "Không áp dụng" : "Không có thời hạn mua"}</dd></div>
                  <div><dt className="text-xs text-[#5C6B8A]">Lượt tạo AI</dt><dd className="mt-1">{ver.generateLimit == null ? "Không giới hạn (∞)" : `${ver.generateLimit} lượt`}</dd></div>
                  <div><dt className="text-xs text-[#5C6B8A]">Lượt lưu chuyến</dt><dd className="mt-1">{ver.savedTripLimit == null ? "Không giới hạn (∞)" : `${ver.savedTripLimit} chuyến`}</dd></div>
                </dl>
                {Array.isArray(ver.features) && ver.features.length > 0 && <div className="mt-4"><p className="text-xs text-[#5C6B8A]">Quyền lợi bao gồm ({ver.features.length})</p><ul className="mt-2 space-y-1">{ver.features.map(feat => <li key={feat.id || feat.code} title={feat.description || feat.name} className="flex items-start gap-2 text-sm"><span className="material-symbols-outlined text-[18px] text-green-700" aria-hidden="true">check</span>{feat.name}</li>)}</ul></div>}
              </li>
            ))}
          </ol>
        )}
        <AdminPagination page={page} totalPages={totalPages} totalCount={totalCount} disabled={loading} onPageChange={p => { setLoading(true); setPage(p); }} />
      </div>
    </AdminOverlayFrame>
  );
}

export default function PlanVersionHistoryModal({ isOpen, plan = null, onClose }) {
  if (!isOpen || !plan) return null;
  return <PlanVersionHistoryContent key={plan.id} plan={plan} onClose={onClose} />;
}
