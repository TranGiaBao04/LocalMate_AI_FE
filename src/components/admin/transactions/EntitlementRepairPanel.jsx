import { useState } from "react";
import { formatVnDateTime } from "../../../utils/subscriptionUtils";

const GRANT_STATUS_CONFIG = {
  Granted: {
    label: "Đã ghi nhận quyền",
    style: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  },
  Missing: {
    label: "Thiếu entitlement",
    style: "bg-amber-50 text-amber-700 ring-amber-600/15",
  },
  Unknown: {
    label: "Chưa xác định",
    style: "bg-slate-100 text-slate-700 ring-slate-200",
  },
  Conflict: {
    label: "Xung đột dữ liệu",
    style: "bg-rose-50 text-rose-700 ring-rose-600/15",
  },
  NotApplicable: {
    label: "Không áp dụng",
    style: "bg-slate-100 text-slate-600 ring-slate-200",
  },
};

const REPAIR_OUTCOME_CONFIG = {
  Repaired: {
    label: "Đã khôi phục",
    style: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  },
  AlreadyGranted: {
    label: "Quyền đã tồn tại",
    style: "bg-blue-50 text-blue-700 ring-blue-600/15",
  },
  NotEligible: {
    label: "Không đủ điều kiện",
    style: "bg-amber-50 text-amber-700 ring-amber-600/15",
  },
  Conflict: {
    label: "Xung đột",
    style: "bg-rose-50 text-rose-700 ring-rose-600/15",
  },
};

function renderGrantStatusPill(status) {
  if (!status) return <span className="text-slate-400">Chưa xác định</span>;
  const config = GRANT_STATUS_CONFIG[status] || {
    label: status,
    style: "bg-slate-100 text-slate-700 ring-slate-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${config.style}`}
    >
      {config.label}
    </span>
  );
}

function renderRepairOutcomePill(outcome) {
  if (!outcome) return <span className="text-slate-400">—</span>;
  const config = REPAIR_OUTCOME_CONFIG[outcome] || {
    label: outcome,
    style: "bg-slate-100 text-slate-700 ring-slate-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${config.style}`}
    >
      {config.label}
    </span>
  );
}

export default function EntitlementRepairPanel({
  detail,
  canManagePlans = false,
  onOpenRepair,
  repairing = false,
}) {
  const [copiedPeriodId, setCopiedPeriodId] = useState(false);
  const [now] = useState(() => Date.now());

  const entitlement = detail?.entitlement;
  const repairEligibility = detail?.repairEligibility;
  const repairHistory = Array.isArray(detail?.repairHistory)
    ? detail.repairHistory
    : [];

  const isEligible = repairEligibility?.eligible === true;
  const isPastPeriod =
    repairEligibility?.proposedEndsAt &&
    new Date(repairEligibility.proposedEndsAt).getTime() < now;

  const handleCopyPeriodId = (periodId) => {
    if (!periodId) return;
    navigator.clipboard?.writeText(periodId);
    setCopiedPeriodId(true);
    setTimeout(() => setCopiedPeriodId(false), 2000);
  };

  return (
    <>
      {/* SECTION 2: Quyền hội viên & Khả năng khôi phục */}
      <section aria-labelledby="entitlement-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <h3
            id="entitlement-heading"
            className="text-xs font-bold uppercase tracking-wider text-slate-400"
          >
            Quyền hội viên
          </h3>
          {entitlement?.grantStatus && renderGrantStatusPill(entitlement.grantStatus)}
        </div>

        {/* Entitlement Evidence Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm shadow-sm">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <span className="text-xs text-slate-400">Trạng thái ghi nhận:</span>
              <p className="mt-0.5 font-semibold text-slate-900">
                {GRANT_STATUS_CONFIG[entitlement?.grantStatus]?.label ||
                  entitlement?.grantStatus ||
                  "Chưa xác định"}
              </p>
            </div>

            <div>
              <span className="text-xs text-slate-400">Mã kỳ hội viên (Period ID):</span>
              {entitlement?.subscriptionPeriodId ? (
                <div className="mt-0.5 flex items-center gap-1.5 font-mono text-xs text-slate-800">
                  <span className="truncate">{entitlement.subscriptionPeriodId}</span>
                  <button
                    type="button"
                    onClick={() => handleCopyPeriodId(entitlement.subscriptionPeriodId)}
                    className="inline-flex shrink-0 items-center text-slate-400 hover:text-slate-600"
                    title="Sao chép ID kỳ hội viên"
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      {copiedPeriodId ? "done" : "content_copy"}
                    </span>
                  </button>
                </div>
              ) : (
                <p className="mt-0.5 text-xs text-slate-400">—</p>
              )}
            </div>

            <div>
              <span className="text-xs text-slate-400">Thời gian bắt đầu quyền:</span>
              <p className="mt-0.5 font-medium text-slate-800">
                {entitlement?.startsAt ? formatVnDateTime(entitlement.startsAt) : "—"}
              </p>
            </div>

            <div>
              <span className="text-xs text-slate-400">Thời gian kết thúc quyền:</span>
              <p className="mt-0.5 font-medium text-slate-800">
                {entitlement?.endsAt ? formatVnDateTime(entitlement.endsAt) : "—"}
              </p>
            </div>
          </div>

          {/* Repair Eligibility Preview */}
          <div className="mt-4 border-t border-slate-100 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-700">
                Đánh giá khôi phục entitlement:
              </span>
              {repairEligibility?.code && (
                <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600">
                  {repairEligibility.code}
                </code>
              )}
            </div>

            {repairEligibility?.message && (
              <p className="mt-1 text-xs text-slate-600">
                {repairEligibility.message}
              </p>
            )}

            {(repairEligibility?.proposedStartsAt || repairEligibility?.proposedEndsAt ||
              repairEligibility?.reconstructionMode || repairEligibility?.assessedAt) && (
              <div className="mt-3 text-xs">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div>
                    <span className="text-slate-500">Kỳ quyền dự kiến:</span>
                    <p className="font-semibold text-slate-800">
                      {formatVnDateTime(repairEligibility.proposedStartsAt) || "—"}
                      <span className="mx-1 text-slate-400">→</span>
                      {formatVnDateTime(repairEligibility.proposedEndsAt) || "—"}
                    </p>
                  </div>
                  {repairEligibility.reconstructionMode && (
                    <div>
                      <span className="text-slate-500">Chế độ tái thiết:</span>
                      <p className="break-words font-semibold text-slate-800 [overflow-wrap:anywhere]">
                        {repairEligibility.reconstructionMode}
                      </p>
                    </div>
                  )}
                  {repairEligibility.assessedAt && (
                    <div className="sm:col-span-2">
                      <span className="text-slate-500">Thời điểm đánh giá:</span>
                      <p className="font-medium text-slate-700">
                        {formatVnDateTime(repairEligibility.assessedAt)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {isEligible ? (
              <div className="mt-3 space-y-3 rounded-xl border border-blue-100 bg-blue-50/50 p-3.5 text-xs">
                <p className="text-[11px] leading-relaxed text-blue-900">
                  Thao tác này khôi phục đúng kỳ quyền đã mua trong lịch sử. Không gia hạn gói và không thay đổi trạng thái thanh toán.
                </p>

                {isPastPeriod && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-800">
                    <span className="material-symbols-outlined shrink-0 text-[16px] text-amber-600">
                      warning
                    </span>
                    <span>
                      Khoảng quyền này đã hết hạn. Việc khôi phục chỉ phục hồi bằng chứng lịch sử, không cấp thêm ngày sử dụng.
                    </span>
                  </div>
                )}

                {canManagePlans && (
                  <div className="pt-1">
                    <button
                      type="button"
                      disabled={repairing}
                      onClick={onOpenRepair}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#1d3e82] px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#17366f] focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-wait disabled:opacity-60"
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        build_circle
                      </span>
                      <span>Khôi phục entitlement</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* When Not Eligible: display explanatory text, do not show active repair button */
              <div className="mt-2.5 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
                <span className="material-symbols-outlined shrink-0 text-[16px] text-slate-400">
                  info
                </span>
                <span>
                  {repairEligibility?.message ||
                    (entitlement?.grantStatus === "NotApplicable"
                      ? "Khôi phục quyền gói đăng ký không áp dụng cho sản phẩm này."
                      : "Giao dịch hiện không đủ điều kiện khôi phục entitlement.")}
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* SECTION 3: Lịch sử khôi phục entitlement */}
      <section aria-labelledby="repair-history-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <h3
            id="repair-history-heading"
            className="text-xs font-bold uppercase tracking-wider text-slate-400"
          >
            Lịch sử khôi phục entitlement ({repairHistory.length})
          </h3>
        </div>

        {repairHistory.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-6 text-center text-sm text-slate-500">
            Chưa có thao tác khôi phục entitlement nào.
          </div>
        ) : (
          <div className="space-y-3">
            {repairHistory.map((item, index) => (
              <div
                key={item.id || `repair-hist-${index}`}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    {renderRepairOutcomePill(item.outcome)}
                    {item.decisionCode && (
                      <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700">
                        {item.decisionCode}
                      </code>
                    )}
                  </div>
                  <span className="text-xs font-medium text-slate-400">
                    {formatVnDateTime(item.occurredAt)}
                  </span>
                </div>

                {/* Reason (plain text only, break-words) */}
                {item.reason && (
                  <div className="mt-2.5 rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 text-xs">
                    <span className="block text-[11px] font-medium text-slate-400">
                      Lý do:
                    </span>
                    <p className="mt-0.5 whitespace-pre-wrap break-words text-slate-800">
                      {item.reason}
                    </p>
                  </div>
                )}

                {/* Metadata details */}
                <div className="mt-2.5 grid grid-cols-1 gap-2 text-xs text-slate-600 sm:grid-cols-2">
                  {item.actorUserId && (
                    <div>
                      <span className="text-slate-400">Người thực hiện: </span>
                      <span className="font-mono text-slate-700">{item.actorUserId}</span>
                    </div>
                  )}
                  {item.subscriptionPeriodId && (
                    <div>
                      <span className="text-slate-400">Mã kỳ hội viên: </span>
                      <span className="font-mono text-slate-700">
                        {item.subscriptionPeriodId}
                      </span>
                    </div>
                  )}
                  {item.reconstructionMode && (
                    <div className="sm:col-span-2">
                      <span className="text-slate-400">Chế độ tái thiết: </span>
                      <span className="font-semibold text-slate-700">
                        {item.reconstructionMode}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
