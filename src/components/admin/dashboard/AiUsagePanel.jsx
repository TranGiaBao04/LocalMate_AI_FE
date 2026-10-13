import { Link } from "react-router-dom";
import { AdminSurface, AdminErrorState, EmptyState, LoadingState } from "../ui";
import { countFormatter } from "./dashboardUtils";
import { formatTimeInVietnam } from "../../../utils/vnTime";
import AiUsageDailyChart from "./AiUsageDailyChart";

const number = (value) => typeof value === "number" && Number.isFinite(value);
const count = (value) => number(value) ? countFormatter.format(value) : "—";
const sum = (...values) => values.every(number) ? values.reduce((total, value) => total + value, 0) : null;

export default function AiUsagePanel({ source, canManageUsers }) {
  if (source.status === "idle") return null;
  const data = source.data;
  const totals = data?.totals;
  const metrics = totals ? [
    ["Tổng lượt AI", totals.calls], ["Thành công", totals.succeeded],
    ["Thất bại", sum(totals.providerFailed, totals.invalidOutput, totals.abandoned)],
    ["Tổng token", sum(totals.inputTokens, totals.outputTokens)],
    ["Người dùng hoạt động", totals.activeUsers], ["Đang xử lý", totals.inProgress],
  ] : [];
  const generatedAt = data?.generatedAt;
  const validTimestamp = generatedAt && Number.isFinite(Date.parse(generatedAt));

  return (
    <section aria-labelledby="ai-usage-title" className="min-w-0 space-y-4">
      <div>
        <h2 id="ai-usage-title" className="text-lg font-bold leading-[26px] text-[#0F2148]">Lượt dùng AI</h2>
        <p className="mt-1 text-sm leading-[22px] text-[#5C6B8A]">Theo khoảng ngày đã chọn, giờ Việt Nam.</p>
      </div>
      {source.status === "loading" ? <LoadingState label="Đang tải thống kê AI..." />
        : source.status === "unavailable" ? <EmptyState icon="cloud_off" title="Thống kê AI chưa khả dụng"
          description="API thống kê AI chưa khả dụng trên môi trường hiện tại." actionLabel="Thử lại" onAction={source.retry} />
        : source.status === "error" ? <AdminErrorState message={source.error} onRetry={source.retry} />
        : !totals ? <EmptyState title="Chưa có dữ liệu thống kê AI" />
        : <>
          <div className="flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-xs leading-5 text-[#5C6B8A]">
            {validTimestamp && <span>Cập nhật AI lúc <time dateTime={generatedAt}>{formatTimeInVietnam(generatedAt)}</time></span>}
            <span>Backend lưu bộ nhớ đệm 5 phút; tải lại có thể giữ nguyên thời điểm cập nhật.</span>
          </div>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {metrics.map(([label, value]) => <AdminSurface key={label} as="article" aria-label={label} className="!rounded-[8px]">
              <h3 className="text-[13px] font-semibold text-[#5C6B8A]">{label}</h3>
              <p className="mt-2 break-words text-2xl font-bold leading-8 tabular-nums [overflow-wrap:anywhere]">{count(value)}</p>
            </AdminSurface>)}
          </div>
          <dl className="flex min-w-0 flex-wrap gap-x-6 gap-y-2 text-xs text-[#5C6B8A]">
            <div><dt>Token đầu vào</dt><dd className="font-semibold tabular-nums">{count(totals.inputTokens)}</dd></div>
            <div><dt>Token đầu ra</dt><dd className="font-semibold tabular-nums">{count(totals.outputTokens)}</dd></div>
            <div><dt>Thời gian xử lý trung bình</dt><dd className="font-semibold tabular-nums">{count(totals.averageDurationMs)}{number(totals.averageDurationMs) ? " ms" : ""}</dd></div>
          </dl>
          <div>
            <h3 className="mb-3 text-base font-bold">Theo loại yêu cầu</h3>
            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
              {(data.byKind ?? []).map((kind) => <AdminSurface as="article" aria-label={kind.kind} key={kind.kind} className="!rounded-[8px]">
                <h4 className="font-semibold">{kind.kind}</h4>
                <dl className="mt-3 grid min-w-0 grid-cols-2 gap-3 text-xs">
                  {[["Lượt gọi", kind.calls], ["Thành công", kind.succeeded], ["Token vào", kind.inputTokens], ["Token ra", kind.outputTokens]]
                    .map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-[#5C6B8A]">{label}</dt><dd className="break-words font-bold tabular-nums">{count(value)}</dd></div>)}
                </dl>
              </AdminSurface>)}
            </div>
          </div>
          <AdminSurface className="!rounded-[8px]">
            <h3 className="text-base font-bold">Lượt gọi theo ngày</h3>
            <AiUsageDailyChart days={data.days ?? []} />
          </AdminSurface>
          <div>
            <h3 className="text-base font-bold">Người dùng sử dụng AI nhiều nhất</h3>
            {!data.topUsers?.length ? <EmptyState density="compact" title="Chưa có người dùng sử dụng AI trong khoảng này" />
              : <ol className="mt-3 divide-y divide-[#DCE2EE]">
                {data.topUsers.slice(0, 10).map((user) => <li key={user.userId} className="flex min-w-0 flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                    {canManageUsers ? <Link to={`/admin/users/${encodeURIComponent(user.userId)}`} className="inline-flex min-h-11 max-w-full items-center rounded-[8px] font-semibold text-[#1D3E82] underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2C56A8]">{user.fullName || "Người dùng"}</Link>
                      : <p className="font-semibold">{user.fullName || "Người dùng"}</p>}
                    {user.email && <p className="text-xs text-[#5C6B8A]">{user.email}</p>}
                  </div>
                  <p className="min-w-0 text-xs leading-5 tabular-nums text-[#5C6B8A] [overflow-wrap:anywhere]">
                    <strong className="text-sm text-[#0F2148]">{count(user.calls)} lượt</strong><br />
                    {count(user.inputTokens)} token vào · {count(user.outputTokens)} token ra
                  </p>
                </li>)}
              </ol>}
          </div>
        </>}
    </section>
  );
}
