import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { ADMIN_PERMISSIONS } from "../../../constants";
import { hasAnyPermission } from "../../../utils/adminAccess";
import { adminAiUsageService } from "../../../services/adminAiUsageService";
import { formatVnDateTime } from "../../../utils/subscriptionUtils";
import { countFormatter, formatDayLabel } from "../dashboard/dashboardUtils";
import { AdminErrorState, AdminField, AdminPagination, AdminRecordCard, AdminSurface, DataTable, EmptyState, LoadingState, StatusBadge } from "../ui";
import { ADMIN_INPUT, ADMIN_PRIMARY_BUTTON, ADMIN_SECONDARY_BUTTON, ADMIN_SELECT } from "../adminStyles";
import { AI_KIND_LABELS, AI_STATUS_BADGES } from "./aiUsageLabels";

const INITIAL_QUERY = { page: 1, pageSize: 10, sortBy: "startedAt", sortDirection: "desc" };
const EMPTY_FILTERS = { kind: "", status: "", from: "", to: "" };
const FIELD_LABELS = { from: "Từ ngày", to: "Đến ngày", kind: "Loại yêu cầu", status: "Trạng thái", page: "Trang", pageSize: "Số dòng", sortBy: "Sắp xếp", sortDirection: "Thứ tự bắt đầu" };
const count = (value) => typeof value === "number" && Number.isFinite(value) ? countFormatter.format(value) : "—";
const time = (value) => formatVnDateTime(value) || "—";
const sum = (...values) => values.every((value) => typeof value === "number" && Number.isFinite(value))
  ? values.reduce((total, value) => total + value, 0) : null;
const rowKey = (row, index) => JSON.stringify([row.id, row.kind, row.startedAt, index]);
const statusBadge = (row) => <StatusBadge {...(AI_STATUS_BADGES[row.status] ?? { status: "inactive", label: row.status || "Không rõ" })} />;
const columns = [
  { key: "kind", header: "Loại yêu cầu", render: (row) => AI_KIND_LABELS[row.kind] ?? row.kind ?? "—" },
  { key: "status", header: "Trạng thái", render: statusBadge },
  { key: "startedAt", header: "Bắt đầu", render: (row) => time(row.startedAt) },
  { key: "completedAt", header: "Hoàn tất", render: (row) => time(row.completedAt) },
  { key: "model", header: "Mô hình", render: (row) => row.model || "—", cellClassName: "max-w-[200px] [overflow-wrap:anywhere]" },
  { key: "durationMs", header: "Thời gian (ms)", render: (row) => count(row.durationMs) },
  { key: "inputTokens", header: "Token vào", render: (row) => count(row.inputTokens) },
  { key: "outputTokens", header: "Token ra", render: (row) => count(row.outputTokens) },
];

function validateDates(filters) {
  const errors = {};
  for (const field of ["from", "to"]) {
    const value = filters[field];
    if (!value) continue;
    const date = new Date(`${value}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "0001-01-01" || !Number.isFinite(date.getTime())
      || date.toISOString().slice(0, 10) !== value) errors[field] = "Ngày phải hợp lệ theo định dạng yyyy-MM-dd.";
  }
  if (!errors.from && !errors.to && filters.from && filters.to && filters.from > filters.to)
    errors.from = "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.";
  return errors;
}

function useAiRead(load, identity, enabled) {
  const [attempt, setAttempt] = useState(0);
  const [response, setResponse] = useState({ key: null });
  const key = `${identity}:${attempt}`;
  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    let active = true;
    load(controller.signal).then((data) => {
      if (active) setResponse({ key, status: "ready", data });
    }).catch((error) => {
      if (active) setResponse({ key, status: "error", error });
    });
    return () => { active = false; controller.abort(); };
  }, [load, key, enabled]);
  return {
    ...(!enabled || response.key !== key ? { status: enabled ? "loading" : "idle" } : response),
    retry: () => setAttempt((value) => value + 1),
  };
}

function SourceError({ source, label }) {
  const error = source.error;
  if (error?.status === 404) return <EmptyState density="compact" icon="cloud_off"
    title={error.code === "user_not_found" ? "Không tìm thấy người dùng" : `API ${label} chưa khả dụng`}
    description={error.code === "user_not_found" ? "Tài khoản không tồn tại hoặc đã bị xoá." : "API thống kê AI chưa khả dụng trên môi trường hiện tại."}
    actionLabel="Thử lại" onAction={source.retry} />;
  return <AdminErrorState message={error?.message || `Không tải được ${label}.`} onRetry={source.retry} />;
}

export default function UserAiUsageTab({ userId }) {
  const { user } = useAuth();
  const enabled = hasAnyPermission(user, [ADMIN_PERMISSIONS.MANAGE_USERS]);
  const owner = JSON.stringify([user?.id, userId, enabled]);
  const [query, setQuery] = useState(INITIAL_QUERY);
  const [draft, setDraft] = useState(EMPTY_FILTERS);
  const [clientErrors, setClientErrors] = useState({});
  const loadSummary = useCallback((signal) => adminAiUsageService.getUserSummary(userId, {}, { signal }), [userId]);
  const loadCalls = useCallback((signal) => adminAiUsageService.getUserCalls(userId, query, { signal }), [userId, query]);
  const summary = useAiRead(loadSummary, `${owner}:summary`, enabled);
  const calls = useAiRead(loadCalls, `${owner}:${JSON.stringify(query)}`, enabled);
  const serverErrors = calls.error?.code === "invalid_ai_usage_query"
    ? Object.fromEntries(Object.entries(calls.error.errors ?? {}).map(([field, messages]) => [field[0].toLowerCase() + field.slice(1), String(messages?.[0] ?? "Giá trị không hợp lệ.")])) : {};
  const errors = { ...serverErrors, ...clientErrors };
  const data = summary.data;
  const totals = data?.totals;
  const callData = calls.data;
  const applyFilters = (event) => {
    event.preventDefault();
    const nextErrors = validateDates(draft);
    setClientErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setQuery((current) => ({ page: 1, pageSize: 10, sortBy: "startedAt", sortDirection: current.sortDirection,
      ...Object.fromEntries(Object.entries(draft).filter(([, value]) => value !== "")) }));
  };
  const resetFilters = () => { setDraft(EMPTY_FILTERS); setClientErrors({}); setQuery(INITIAL_QUERY); };
  const changeDraft = (field) => (event) => {
    setDraft((current) => ({ ...current, [field]: event.target.value }));
    setClientErrors((current) => ({ ...current, [field]: undefined }));
  };
  if (!enabled) return null;

  return <div className="min-w-0 space-y-6">
    <section aria-labelledby="user-ai-summary-title" className="min-w-0 space-y-3">
      <h2 id="user-ai-summary-title" className="text-base font-bold text-[#0F2148]">Mức sử dụng AI</h2>
      {summary.status === "loading" ? <LoadingState label="Đang tải mức sử dụng AI..." />
        : summary.status === "error" ? <>
          <SourceError source={summary} label="mức sử dụng AI" />
          {summary.error?.code === "invalid_ai_usage_query" && <ul role="alert" className="text-sm text-red-700">{Object.entries(summary.error.errors ?? {}).map(([field, messages]) => <li key={field}>{FIELD_LABELS[field.toLowerCase()] ?? field}: {messages?.[0]}</li>)}</ul>}
        </> : !totals ? <EmptyState title="Chưa có dữ liệu mức sử dụng AI" /> : <>
          <AdminSurface className="!rounded-[8px]">
            <h3 className="font-semibold">Hôm nay</h3>
            <p aria-label="Lượt AI hôm nay" className="mt-2 text-2xl font-bold tabular-nums">{count(data.today?.used)} / {count(data.today?.limit)}</p>
            <p className="mt-1 text-xs text-[#5C6B8A]">Làm mới lúc {time(data.today?.resetAt)} (giờ Việt Nam)</p>
          </AdminSurface>
          <p className="text-sm text-[#5C6B8A]">Thống kê lịch sử: {data.from} đến {data.to} (ngày Việt Nam).</p>
          <dl className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[["Lượt gọi trong kỳ", totals.calls], ["Thành công trong kỳ", totals.succeeded],
              ["Thất bại trong kỳ", sum(totals.providerFailed, totals.invalidOutput, totals.abandoned)], ["Đang xử lý trong kỳ", totals.inProgress],
              ["Token đầu vào", totals.inputTokens], ["Token đầu ra", totals.outputTokens], ["Thời gian trung bình (ms)", totals.averageDurationMs]]
              .map(([label, value]) => <div key={label} className="min-w-0 border-b border-[#DCE2EE] py-3"><dt className="text-xs text-[#5C6B8A]">{label}</dt><dd className="mt-1 break-words text-lg font-bold tabular-nums">{count(value)}</dd></div>)}
          </dl>
          {data.generatedAt && <p className="text-xs text-[#5C6B8A]">Cập nhật mức sử dụng: {time(data.generatedAt)}</p>}
          {!!data.days?.length && <details className="min-w-0 border-b border-[#DCE2EE]">
            <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2C56A8]">Chi tiết mức sử dụng theo ngày</summary>
            <div role="region" aria-label="Mức sử dụng AI theo ngày" tabIndex={0} className="max-h-60 max-w-full overflow-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2C56A8]">
              <table className="w-full text-left text-xs"><caption className="sr-only">Mức sử dụng AI theo ngày Việt Nam</caption>
                <thead><tr>{["Ngày", "Lượt gọi", "Thành công", "Thất bại", "Token vào", "Token ra"].map((label) => <th key={label} scope="col" className="p-2">{label}</th>)}</tr></thead>
                <tbody>{data.days.map((day) => <tr key={day.date}><th scope="row" className="whitespace-nowrap p-2">{formatDayLabel(day.date)}/{day.date.slice(0, 4)}</th>{[day.calls, day.succeeded, day.failed, day.inputTokens, day.outputTokens].map((value, index) => <td key={index} className="p-2 tabular-nums">{count(value)}</td>)}</tr>)}</tbody>
              </table>
            </div>
          </details>}
        </>}
    </section>

    <section aria-labelledby="user-ai-calls-title" className="min-w-0 space-y-4">
      <h2 id="user-ai-calls-title" className="text-base font-bold text-[#0F2148]">Nhật ký gọi AI</h2>
      <p className="text-sm text-[#5C6B8A]">Toàn bộ lịch sử khi chưa lọc ngày; độc lập với kỳ thống kê phía trên.</p>
      <form aria-label="Bộ lọc lịch sử AI" onSubmit={applyFilters} noValidate className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[["kind", "Loại yêu cầu", AI_KIND_LABELS], ["status", "Trạng thái", Object.fromEntries(Object.entries(AI_STATUS_BADGES).map(([key, value]) => [key, value.label]))]].map(([field, label, options]) => <AdminField key={field} id={`ai-${field}`} label={label} error={errors[field]}>
          <select id={`ai-${field}`} value={draft[field]} onChange={changeDraft(field)} className={ADMIN_SELECT} aria-invalid={Boolean(errors[field])} aria-describedby={errors[field] ? `ai-${field}-error` : undefined}>
            <option value="">Tất cả</option>{Object.entries(options).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
          </select>
        </AdminField>)}
        {[['from', 'Từ ngày'], ['to', 'Đến ngày']].map(([field, label]) => <AdminField key={field} id={`ai-${field}`} label={label} error={errors[field]}>
          <input id={`ai-${field}`} type="date" value={draft[field]} onChange={changeDraft(field)} className={ADMIN_INPUT} aria-invalid={Boolean(errors[field])} aria-describedby={errors[field] ? `ai-${field}-error` : undefined} />
        </AdminField>)}
        <div className="flex flex-wrap gap-2 sm:col-span-2 xl:col-span-4">
          <button type="submit" className={ADMIN_PRIMARY_BUTTON}>Áp dụng bộ lọc</button>
          <button type="button" onClick={resetFilters} className={ADMIN_SECONDARY_BUTTON}>Đặt lại bộ lọc</button>
        </div>
      </form>
      <AdminField id="ai-sortDirection" label="Thứ tự bắt đầu" error={errors.sortDirection} className="max-w-xs">
        <select id="ai-sortDirection" className={ADMIN_SELECT} value={query.sortDirection} onChange={(event) => setQuery((current) => ({ ...current, page: 1, sortDirection: event.target.value }))}
          aria-invalid={Boolean(errors.sortDirection)} aria-describedby={errors.sortDirection ? "ai-sortDirection-error" : undefined}>
          <option value="desc">Mới nhất trước</option><option value="asc">Cũ nhất trước</option>
        </select>
      </AdminField>
      {Object.entries(errors).filter(([field, error]) => error && ["page", "pageSize", "sortBy"].includes(field)).map(([field, error]) => <p key={field} role="alert" className="text-sm text-red-700">{FIELD_LABELS[field]}: {error}</p>)}
      {calls.status === "loading" ? <LoadingState label="Đang tải nhật ký AI..." /> : calls.status === "error" ? <SourceError source={calls} label="nhật ký AI" /> : callData ? <>
        <p role="status" className="text-xs text-[#5C6B8A]">{count(callData.totalCount)} lượt gọi · Trang {callData.page} / {Math.max(1, callData.totalPages)}</p>
        {/* w-full: bảng giãn hết khung, min-w chỉ giữ độ rộng tối thiểu để cuộn ngang trên màn hẹp */}
        <div className="hidden min-w-0 max-w-full md:block [&_table]:w-full [&_table]:min-w-[880px]">
          <DataTable tableLabel="Nhật ký AI" columns={columns} rows={callData.items} rowKey={rowKey} emptyState={{ title: "Không có lượt gọi AI trên trang này" }} />
        </div>
        <div aria-label="Nhật ký AI trên di động" className="min-w-0 space-y-3 md:hidden">
          {callData.items.length ? callData.items.map((row, index) => <AdminRecordCard key={rowKey(row, index)} title={AI_KIND_LABELS[row.kind] ?? row.kind ?? "—"} status={statusBadge(row)}>
            <dl className="min-w-0 space-y-2">{columns.slice(2).map((column) => <div key={column.key}><dt className="text-xs">{column.header}</dt><dd className="[overflow-wrap:anywhere]">{column.render(row)}</dd></div>)}</dl>
          </AdminRecordCard>) : <EmptyState title="Không có lượt gọi AI trên trang này" />}
        </div>
        <AdminPagination page={callData.page} totalPages={callData.totalPages} totalCount={callData.totalCount} onPageChange={(page) => setQuery((current) => ({ ...current, page }))} />
        {callData.page > Math.max(1, callData.totalPages) && <button type="button" onClick={() => setQuery((current) => ({ ...current, page: 1 }))} className={ADMIN_SECONDARY_BUTTON}>Về trang đầu</button>}
      </> : <EmptyState title="Chưa có dữ liệu nhật ký AI" />}
    </section>
  </div>;
}
