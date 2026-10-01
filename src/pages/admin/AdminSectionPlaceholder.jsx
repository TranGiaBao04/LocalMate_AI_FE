import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { adminApiClient } from "../../api/adminApiClient";

const configs = {
  "/admin/places": { key: "places", icon: "location_on", eyebrow: "Places Management", title: "Địa điểm & Tiện ích", description: "Quản lý POI, trạng thái hiển thị và dữ liệu trải nghiệm quanh ga.", endpoint: "/admin/places" },
  "/admin/import": { key: "import", icon: "upload_file", eyebrow: "Places Import", title: "Nhập dữ liệu Địa điểm", description: "Tải lên tệp Excel hoặc CSV, kiểm tra dữ liệu trước khi đồng bộ." },
  "/admin/plans": { key: "plans", icon: "loyalty", eyebrow: "Membership Plans", title: "Gói thành viên & Định giá AI", description: "Quản lý gói dịch vụ, quota và quyền lợi hội viên.", endpoint: "/admin/plans?page=1&pageSize=50" },
  "/admin/transactions": { key: "transactions", icon: "payments", eyebrow: "PayOS", title: "Giao dịch PayOS & Webhook Log", description: "Theo dõi giao dịch, trạng thái thanh toán và đối soát PayOS.", endpoint: "/admin/transactions?page=1&pageSize=20" },
  "/admin/users": { key: "users", icon: "group", eyebrow: "Users Management", title: "Người dùng & Hội viên", description: "Tra cứu tài khoản, gói đang sử dụng và trạng thái hoạt động." },
  "/admin/permissions": { key: "permissions", icon: "admin_panel_settings", eyebrow: "RBAC & Auth Guard", title: "Phân quyền & Quản trị", description: "Kiểm soát vai trò, phạm vi truy cập và chính sách bảo mật." },
};

const rowsOf = (data) => Array.isArray(data) ? data : data?.items ?? data?.data ?? [];
const valueOf = (object, keys, fallback = "—") => keys.map((key) => object?.[key]).find((value) => value !== undefined && value !== null && value !== "") ?? fallback;

function Header({ config, action }) {
  return <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end"><div><div className="mb-2 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-blue-700"><span className="material-symbols-outlined text-[15px]">{config.icon}</span>{config.eyebrow}</div><h1 className="text-2xl font-extrabold tracking-tight text-[#0f2042] sm:text-[30px]">{config.title}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{config.description}</p></div>{action}</div>;
}

function ConnectionState({ loading, error, emptyText }) {
  if (loading) return <div className="grid min-h-72 place-items-center"><div className="text-center"><span className="material-symbols-outlined animate-spin text-4xl text-blue-600">progress_activity</span><p className="mt-3 text-sm font-semibold text-slate-500">Đang tải dữ liệu...</p></div></div>;
  return <div className="grid min-h-72 place-items-center px-6 py-12 text-center"><div className="max-w-md"><span className="material-symbols-outlined text-5xl text-slate-300">inventory_2</span><h2 className="mt-4 font-extrabold text-[#0f2042]">{emptyText}</h2>{!error && <p className="mt-2 text-sm leading-6 text-slate-500">Hiện chưa có dữ liệu để hiển thị.</p>}</div></div>;
}

function SearchBar({ query, setQuery, placeholder }) {
  return <div className="flex h-10 flex-1 items-center rounded-lg border border-slate-200 bg-slate-50 px-3"><span className="material-symbols-outlined text-[19px] text-slate-400">search</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={placeholder} className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-slate-400" /></div>;
}

function PlacesPanel({ rows, loading, error, query, setQuery }) {
  const filtered = rows.filter((item) => `${item.name ?? ""} ${item.address ?? ""} ${item.category ?? ""}`.toLocaleLowerCase("vi").includes(query.toLocaleLowerCase("vi")));
  const active = rows.filter((item) => String(item.status).toLowerCase() === "active").length;
  return <><div className="mt-6 grid gap-3 sm:grid-cols-3"><Metric label="Tổng số địa điểm" value={rows.length || "—"} icon="storefront" /><Metric label="Đang hiển thị" value={rows.length ? active : "—"} icon="visibility" /><Metric label="Chờ kiểm duyệt" value={rows.length ? rows.length - active : "—"} icon="fact_check" /></div><Panel><div className="flex gap-3 border-b border-slate-100 p-4"><SearchBar query={query} setQuery={setQuery} placeholder="Tìm theo tên, địa chỉ hoặc danh mục..." /><FilterButton /></div>{filtered.length ? <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left"><TableHead labels={["Địa điểm", "Địa chỉ", "Danh mục", "Trạng thái", "Thao tác"]} /><tbody className="divide-y divide-slate-100">{filtered.map((item, index) => <tr key={item.id ?? index} className="text-sm hover:bg-slate-50"><td className="px-5 py-4 font-bold text-slate-800">{valueOf(item, ["name"])}</td><td className="max-w-xs px-5 py-4 text-slate-500">{valueOf(item, ["address"])}</td><td className="px-5 py-4 text-slate-500">{valueOf(item, ["category"])}</td><td className="px-5 py-4"><Badge text={valueOf(item, ["status"], "Chưa xác định")} /></td><td className="px-5 py-4"><IconActions /></td></tr>)}</tbody></table></div> : <ConnectionState loading={loading} error={error} emptyText="Chưa có địa điểm" />}</Panel></>;
}

function ImportPanel() {
  const [fileName, setFileName] = useState("");
  return <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_360px]"><Panel className="mt-0"><div className="p-6"><div className="rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/50 px-6 py-14 text-center"><span className="material-symbols-outlined text-5xl text-blue-600">cloud_upload</span><h2 className="mt-4 text-lg font-extrabold text-[#0f2042]">Kéo thả tệp dữ liệu vào đây</h2><p className="mt-2 text-sm text-slate-500">Hỗ trợ Excel (.xlsx, .xls) hoặc CSV UTF-8</p><label className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700"><span className="material-symbols-outlined text-[18px]">upload_file</span>Chọn tệp<input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(event) => setFileName(event.target.files?.[0]?.name ?? "")} /></label>{fileName && <p className="mt-4 text-sm font-bold text-emerald-700">Đã chọn: {fileName}</p>}</div></div></Panel><aside><div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-extrabold text-[#0f2042]">Quy trình nhập dữ liệu</h3>{["Chọn tệp Excel hoặc CSV", "Kiểm tra định dạng dữ liệu", "Xem trước và xử lý lỗi", "Xác nhận đồng bộ"].map((step, index) => <div key={step} className="mt-4 flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-blue-50 text-xs font-extrabold text-blue-700">{index + 1}</span><p className="pt-1 text-sm text-slate-600">{step}</p></div>)}</div></aside></div>;
}

function PlansPanel({ rows, loading, error }) {
  return <><div className="mt-6 grid gap-3 sm:grid-cols-3"><Metric label="Tổng số gói" value={rows.length || "—"} icon="inventory_2" /><Metric label="Đang mở bán" value={rows.length ? rows.filter((item) => item.isActive).length : "—"} icon="check_circle" /><Metric label="Tạm ngưng" value={rows.length ? rows.filter((item) => !item.isActive).length : "—"} icon="pause_circle" /></div><Panel>{rows.length ? <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">{rows.map((item, index) => <article key={item.id ?? index} className="rounded-xl border border-slate-200 p-5"><div className="flex items-start justify-between gap-3"><span className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-700"><span className="material-symbols-outlined">loyalty</span></span><Badge text={item.isActive ? "Đang mở bán" : "Tạm ngưng"} /></div><h2 className="mt-4 text-lg font-extrabold text-[#0f2042]">{valueOf(item, ["name", "displayName"])}</h2></article>)}</div> : <ConnectionState loading={loading} error={error} emptyText="Chưa có gói thành viên" />}</Panel></>;
}

function TransactionsPanel({ rows, loading, error, query, setQuery }) {
  const filtered = rows.filter((item) => JSON.stringify(item).toLocaleLowerCase("vi").includes(query.toLocaleLowerCase("vi")));
  return <><div className="mt-6 grid gap-3 sm:grid-cols-3"><Metric label="Giao dịch tìm thấy" value={rows.length || "—"} icon="receipt_long" /><Metric label="Doanh thu thực nhận" value="—" icon="payments" /><Metric label="Cần đối soát" value="—" icon="balance" /></div><Panel><div className="flex gap-3 border-b border-slate-100 p-4"><SearchBar query={query} setQuery={setQuery} placeholder="Tìm mã đơn hoặc khách hàng..." /><FilterButton /></div>{filtered.length ? <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left"><TableHead labels={["Mã đơn", "Khách hàng", "Gói dịch vụ", "Số tiền", "Thời gian", "Trạng thái"]} /><tbody className="divide-y divide-slate-100">{filtered.map((item, index) => <tr key={item.id ?? index} className="text-sm hover:bg-slate-50"><td className="px-5 py-4 font-bold text-blue-700">{valueOf(item, ["orderCode", "code", "id"])}</td><td className="px-5 py-4 text-slate-600">{valueOf(item, ["customerEmail", "email", "userEmail"])}</td><td className="px-5 py-4 text-slate-600">{valueOf(item, ["planName", "productName"])}</td><td className="px-5 py-4 font-bold text-slate-800">{valueOf(item, ["amountFormatted", "amount"])}</td><td className="px-5 py-4 text-slate-500">{valueOf(item, ["createdAt", "paidAt"])}</td><td className="px-5 py-4"><Badge text={valueOf(item, ["status"])} /></td></tr>)}</tbody></table></div> : <ConnectionState loading={loading} error={error} emptyText="Chưa có giao dịch" />}</Panel></>;
}

function UsersPanel() {
  return <><div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Tổng người dùng" value="—" icon="group" /><Metric label="Hội viên trả phí" value="—" icon="workspace_premium" /><Metric label="Đang hoạt động" value="—" icon="verified_user" /><Metric label="Tài khoản bị khóa" value="—" icon="lock" /></div><Panel><div className="flex gap-3 border-b border-slate-100 p-4"><div className="flex h-10 flex-1 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-400"><span className="material-symbols-outlined mr-2 text-[19px]">search</span>Tìm email, tên hoặc mã người dùng...</div><FilterButton /></div><div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left"><TableHead labels={["Người dùng", "Vai trò", "Gói sử dụng", "Ngày tạo", "Trạng thái", "Hành động"]} /></table></div><ConnectionState loading={false} error="Backend hiện chưa có API danh sách người dùng dành cho Admin." emptyText="Chưa có người dùng" /></Panel></>;
}

function PermissionsPanel({ roles, permissions, loading, error }) {
  return <><div className="mt-6 grid gap-3 sm:grid-cols-3"><Metric label="Vai trò hệ thống" value={roles.length || "—"} icon="badge" /><Metric label="Quyền đang định nghĩa" value={permissions.length || "—"} icon="policy" /><Metric label="Admin Route Guard" value="Đang bật" icon="shield_lock" /></div><div className="mt-6"><Panel className="mt-0"><div className="border-b border-slate-100 p-5"><h2 className="font-extrabold text-[#0f2042]">Vai trò & phạm vi truy cập</h2><p className="mt-1 text-sm text-slate-500">Dữ liệu role và permission lấy trực tiếp từ Backend.</p></div>{roles.length ? <div className="divide-y divide-slate-100">{roles.map((role, index) => <div key={role.id ?? index} className="flex items-center gap-4 p-5"><span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-700"><span className="material-symbols-outlined">admin_panel_settings</span></span><div className="min-w-0 flex-1"><h3 className="font-extrabold text-slate-800">{valueOf(role, ["name"])}</h3><p className="mt-1 text-xs text-slate-400">{(role.permissions ?? []).length} quyền được gán</p></div><Badge text={role.isSystem ? "Vai trò hệ thống" : "Tùy chỉnh"} /></div>)}</div> : <ConnectionState loading={loading} error={error} emptyText="Chưa có vai trò" />}</Panel></div></>;
}

function Metric({ label, value, icon }) { return <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p><span className="material-symbols-outlined text-[21px] text-blue-600">{icon}</span></div><p className="mt-4 text-2xl font-extrabold text-[#0f2042]">{value}</p></article>; }
function Panel({ children, className = "" }) { return <section className={`mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</section>; }
function FilterButton() { return <button type="button" disabled className="inline-flex h-10 cursor-not-allowed items-center gap-2 rounded-lg border border-slate-200 px-4 text-xs font-bold text-slate-400"><span className="material-symbols-outlined text-[18px]">filter_list</span>Bộ lọc</button>; }
function Badge({ text }) { return <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700">{String(text)}</span>; }
function IconActions() { return <div className="flex gap-2"><button disabled className="grid h-8 w-8 cursor-not-allowed place-items-center rounded-lg border border-slate-200 text-slate-300"><span className="material-symbols-outlined text-[17px]">edit</span></button><button disabled className="grid h-8 w-8 cursor-not-allowed place-items-center rounded-lg border border-slate-200 text-slate-300"><span className="material-symbols-outlined text-[17px]">visibility</span></button></div>; }
function TableHead({ labels }) { return <thead className="bg-slate-50 text-[10px] font-extrabold uppercase tracking-wide text-slate-500"><tr>{labels.map((label) => <th key={label} className="px-5 py-3">{label}</th>)}</tr></thead>; }

export default function AdminSectionPlaceholder() {
  const { pathname } = useLocation();
  const config = configs[pathname] || configs["/admin/users"];
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(config.endpoint || config.key === "permissions"));
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    const request = config.key === "permissions"
      ? Promise.all([adminApiClient.get("/admin/roles"), adminApiClient.get("/admin/permissions")]).then(([roles, permissions]) => ({ roles, permissions }))
      : config.endpoint ? adminApiClient.get(config.endpoint) : Promise.resolve(null);
    request.then((response) => { if (active) setData(response); }).catch((requestError) => { if (active) setError(requestError?.status === 404 ? "API của module chưa có trong bản Backend đang chạy." : "Không thể tải dữ liệu từ Backend."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [config.endpoint, config.key]);

  const rows = useMemo(() => rowsOf(data), [data]);
  const action = config.key === "import" ? null : <button type="button" disabled className="inline-flex h-10 w-fit cursor-not-allowed items-center gap-2 rounded-lg bg-slate-200 px-4 text-xs font-bold text-slate-400"><span className="material-symbols-outlined text-[18px]">add_circle</span>Thêm mới</button>;

  return <div><Header config={config} action={action} />
    {config.key === "places" && <PlacesPanel rows={rows} loading={loading} error={error} query={query} setQuery={setQuery} />}
    {config.key === "import" && <ImportPanel />}
    {config.key === "plans" && <PlansPanel rows={rows} loading={loading} error={error} />}
    {config.key === "transactions" && <TransactionsPanel rows={rows} loading={loading} error={error} query={query} setQuery={setQuery} />}
    {config.key === "users" && <UsersPanel />}
    {config.key === "permissions" && <PermissionsPanel roles={data?.roles ?? []} permissions={data?.permissions ?? []} loading={loading} error={error} />}
  </div>;
}
