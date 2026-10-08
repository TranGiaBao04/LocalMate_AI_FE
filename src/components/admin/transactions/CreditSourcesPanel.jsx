import StatusBadge from "../ui/StatusBadge";
import { formatPlanPrice, formatVnDateTime } from "../../../utils/subscriptionUtils";

const SOURCE_STATES = {
  Reserved: { label: "Đã giữ", status: "pending" },
  Consumed: { label: "Đã sử dụng", status: "success" },
  Released: { label: "Đã giải phóng", status: "info" },
  Conflict: { label: "Xung đột", status: "failed" },
};

function EvidenceField({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-[#5C6B8A]">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-medium text-[#0F2148] [overflow-wrap:anywhere]">
        {children}
      </dd>
    </div>
  );
}

function money(value) {
  return value != null ? formatPlanPrice(value) : "—";
}

function time(value) {
  return formatVnDateTime(value) || "—";
}

export default function CreditSourcesPanel({ sources }) {
  if (!Array.isArray(sources) || sources.length === 0) return null;

  return (
    <section aria-labelledby="credit-sources-heading" className="space-y-3">
      <h3 id="credit-sources-heading" className="text-sm font-semibold text-slate-700">
        Nguồn credit ({sources.length})
      </h3>
      <div className="space-y-3">
        {sources.map((source, index) => {
          const state = SOURCE_STATES[source.state] || {
            label: source.state || "—",
            status: "inactive",
          };
          const evidence = source.releaseEvidence;
          return (
            <article key={index} aria-label={`Nguồn credit ${index + 1}`} className="space-y-4 rounded-[8px] border border-[#DCE2EE] p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="min-w-0 break-words font-semibold text-[#0F2148] [overflow-wrap:anywhere]">
                  {source.planName || source.planCode || "Gói đăng ký"}
                </p>
                <StatusBadge status={state.status} label={state.label} />
              </div>
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <EvidenceField label="Hạn gốc">{time(source.originalEndsAt)}</EvidenceField>
                <EvidenceField label="Số ngày còn lại">{source.remainingDays ?? "—"}</EvidenceField>
                <EvidenceField label="Credit tính từ nguồn">{money(source.calculatedCreditAmount)}</EvidenceField>
                {source.terminatedAt && <EvidenceField label="Kết thúc hiệu lực">{time(source.terminatedAt)}</EvidenceField>}
                {source.releasedAt && <EvidenceField label="Giải phóng lúc">{time(source.releasedAt)}</EvidenceField>}
              </dl>
              {evidence && (
                <div className="border-t border-slate-100 pt-3">
                  <h4 className="mb-3 text-xs font-semibold text-slate-700">Bằng chứng giải phóng</h4>
                  <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <EvidenceField label="Kiểm tra nhà cung cấp">{time(evidence.providerCheckedAt)}</EvidenceField>
                    <EvidenceField label="Trạng thái nhà cung cấp">{evidence.providerStatus || "—"}</EvidenceField>
                    <EvidenceField label="Số tiền yêu cầu">{money(evidence.requestedAmount)}</EvidenceField>
                    <EvidenceField label="Đã trả nhà cung cấp">{money(evidence.amountPaid)}</EvidenceField>
                    <EvidenceField label="Còn phải trả">{money(evidence.amountRemaining)}</EvidenceField>
                    <EvidenceField label="Mã lý do">{evidence.reasonCode || "—"}</EvidenceField>
                  </dl>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
