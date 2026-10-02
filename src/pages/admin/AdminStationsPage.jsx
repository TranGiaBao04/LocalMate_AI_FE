import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { ADMIN_PERMISSIONS, PLACE_CATEGORY_LABELS } from "../../constants";
import { adminStationService } from "../../services/adminStationService";
import { hasAnyPermission } from "../../utils/adminAccess";

const countFormatter = new Intl.NumberFormat("vi-VN");
const categoryLabel = (category) => PLACE_CATEGORY_LABELS[category] ?? category;
const stationCode = (order) => String(order).padStart(2, "0");

const STATUS_COLUMNS = [
  { key: "active", label: "Hoạt động", tone: "bg-emerald-50 text-emerald-700" },
  { key: "pending", label: "Chờ duyệt", tone: "bg-amber-50 text-amber-700" },
  { key: "inactive", label: "Ngừng", tone: "bg-slate-100 text-slate-600" },
];

function SummaryCard({ label, icon, iconTone, value, valueTone = "text-[#0f2042]", caption, loading }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
        <span className={`material-symbols-outlined ${iconTone}`}>{icon}</span>
      </div>
      {loading ? (
        <div className="mt-4 h-9 w-20 animate-pulse rounded-md bg-slate-100" />
      ) : (
        <p className={`mt-4 text-3xl font-extrabold ${valueTone}`}>{value}</p>
      )}
      {caption && !loading && <p className="mt-2 text-xs leading-5 text-slate-500">{caption}</p>}
    </article>
  );
}

function StockBadge({ station }) {
  return station.isUnderstocked ? (
    <span className="shrink-0 rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-bold text-rose-700">
      Thiếu {station.shortfall} địa điểm
    </span>
  ) : (
    <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">Đủ dữ liệu</span>
  );
}

function MissingCategories({ categories }) {
  if (categories.length === 0) return null;
  return <p className="text-xs font-semibold text-amber-700">Chưa có {categories.map(categoryLabel).join(", ")}</p>;
}

function StationCard({ station }) {
  return (
    <article
      className={`rounded-xl border p-5 transition hover:shadow-lg ${
        station.isUnderstocked ? "border-rose-200 bg-rose-50/40" : "border-slate-200 hover:border-blue-200"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#0f2042] text-sm font-extrabold text-white">
            {stationCode(station.order)}
          </span>
          <div className="min-w-0">
            <h2 className="truncate font-extrabold text-[#0f2042]">Ga {station.name}</h2>
            <p className="mt-0.5 text-xs text-slate-500">{countFormatter.format(station.totals.total)} địa điểm quanh ga</p>
          </div>
        </div>
        <StockBadge station={station} />
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        {STATUS_COLUMNS.map((column) => (
          <div key={column.key} className={`rounded-lg px-2 py-2 ${column.tone}`}>
            <dt className="text-[10px] font-bold uppercase tracking-wide">{column.label}</dt>
            <dd className="mt-0.5 text-lg font-extrabold">{station.totals[column.key]}</dd>
          </div>
        ))}
      </dl>

      <ul className="mt-4 space-y-1.5">
        {station.categories.map((item) => (
          <li key={item.category} className="flex items-center justify-between gap-2 text-sm">
            <span className="text-slate-600">{categoryLabel(item.category)}</span>
            <span className={`font-bold ${item.active === 0 ? "text-amber-700" : "text-slate-800"}`}>
              {item.active}
              {item.pending > 0 && <span className="ml-1 text-xs font-medium text-slate-400">+{item.pending} chờ duyệt</span>}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-3">
        <MissingCategories categories={station.missingCategories} />
      </div>
    </article>
  );
}

function StationTable({ stations, categories }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[880px] text-left">
        <thead className="bg-slate-50 text-[10px] font-extrabold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-5 py-3">Ga</th>
            {STATUS_COLUMNS.map((column) => <th key={column.key} className="px-3 py-3 text-right">{column.label}</th>)}
            {categories.map((category) => <th key={category} className="px-3 py-3 text-right">{categoryLabel(category)}</th>)}
            <th className="px-5 py-3">Tình trạng</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {stations.map((station) => (
            <tr key={station.id} className={`text-sm ${station.isUnderstocked ? "bg-rose-50/40" : "hover:bg-slate-50"}`}>
              <td className="px-5 py-4">
                <span className="mr-2 font-extrabold text-blue-700">{stationCode(station.order)}</span>
                <span className="font-bold text-slate-800">Ga {station.name}</span>
              </td>
              {STATUS_COLUMNS.map((column) => (
                <td key={column.key} className="px-3 py-4 text-right font-semibold text-slate-700">{station.totals[column.key]}</td>
              ))}
              {categories.map((category) => {
                const active = station.categories.find((item) => item.category === category)?.active ?? 0;
                return (
                  <td key={category} className={`px-3 py-4 text-right font-semibold ${active === 0 ? "text-amber-700" : "text-slate-700"}`}>
                    {active}
                  </td>
                );
              })}
              <td className="space-y-1 px-5 py-4">
                <StockBadge station={station} />
                <MissingCategories categories={station.missingCategories} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminStationsPage() {
  const { user } = useAuth();
  const canManageSettings = hasAnyPermission(user, [ADMIN_PERMISSIONS.MANAGE_SETTINGS]);
  const [reloadKey, setReloadKey] = useState(0);
  const [result, setResult] = useState({ key: null, data: null, error: "" });
  const [query, setQuery] = useState("");
  const [onlyUnderstocked, setOnlyUnderstocked] = useState(false);
  const [view, setView] = useState("grid");

  useEffect(() => {
    let active = true;
    adminStationService
      .getStations()
      .then((data) => {
        if (active) setResult({ key: reloadKey, data, error: "" });
      })
      .catch((err) => {
        if (active) {
          setResult({ key: reloadKey, data: null, error: err?.message || "Không tải được dữ liệu nhà ga. Vui lòng thử lại." });
        }
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const loading = result.key !== reloadKey;
  const data = result.data;
  const stations = useMemo(() => data?.stations ?? [], [data]);
  const categories = stations[0]?.categories.map((item) => item.category) ?? [];
  const activePlaces = stations.reduce((sum, station) => sum + station.totals.active, 0);
  const pendingPlaces = stations.reduce((sum, station) => sum + station.totals.pending, 0);
  const reload = () => setReloadKey((key) => key + 1);

  const filteredStations = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("vi");
    return stations.filter((station) => {
      if (onlyUnderstocked && !station.isUnderstocked) return false;
      if (!keyword) return true;
      return station.name.toLocaleLowerCase("vi").includes(keyword) || String(station.order).includes(keyword);
    });
  }, [onlyUnderstocked, query, stations]);

  return (
    <div>
      <section className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-blue-700">
            <span className="material-symbols-outlined text-[15px]">train</span>Metro Line 1
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#0f2042] sm:text-[30px]">Quản lý 14 Ga Metro Tuyến 1</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            {data
              ? `Địa điểm trong bán kính ${countFormatter.format(data.radiusMeters)} m, mỗi địa điểm tính cho ga gần nhất. Ga có dưới ${data.minActivePlacesPerStation} địa điểm đang hoạt động bị đánh dấu thiếu.`
              : "Số địa điểm quanh từng ga theo trạng thái và loại địa điểm."}
            {data && canManageSettings && (
              <Link to="/admin/settings" className="ml-1 font-semibold text-blue-700 hover:underline">
                Đổi trong Cấu hình hệ thống
              </Link>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={reload}
          disabled={loading}
          className="inline-flex h-10 w-fit items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 shadow-sm transition hover:border-blue-200 hover:text-blue-700 disabled:cursor-wait"
        >
          <span className={`material-symbols-outlined text-[18px] ${loading ? "animate-spin" : ""}`}>sync</span>
          Tải lại
        </button>
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Tổng số ga" icon="subway" iconTone="text-blue-600" loading={!data && loading} value={data ? stations.length : "—"} />
        <SummaryCard
          label="Ga thiếu dữ liệu"
          icon="report"
          iconTone="text-rose-600"
          valueTone={data?.understockedStationCount ? "text-rose-700" : "text-[#0f2042]"}
          loading={!data && loading}
          value={data ? data.understockedStationCount : "—"}
          caption={data ? `Dưới ${data.minActivePlacesPerStation} địa điểm đang hoạt động` : null}
        />
        <SummaryCard
          label="Địa điểm quanh ga"
          icon="location_on"
          iconTone="text-emerald-600"
          loading={!data && loading}
          value={data ? countFormatter.format(activePlaces) : "—"}
          caption={data ? `Đang hoạt động · ${countFormatter.format(pendingPlaces)} chờ duyệt` : null}
        />
        <SummaryCard
          label="Ngoài vùng phủ"
          icon="wrong_location"
          iconTone="text-amber-600"
          loading={!data && loading}
          value={data ? countFormatter.format(data.outsideCoverage.total) : "—"}
          caption={
            data
              ? `${data.outsideCoverage.active} hoạt động · ${data.outsideCoverage.pending} chờ duyệt · ${data.outsideCoverage.inactive} ngừng, xa ga gần nhất hơn ${countFormatter.format(data.radiusMeters)} m`
              : null
          }
        />
      </section>

      <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center">
          <div className="flex h-10 flex-1 items-center rounded-lg border border-slate-200 bg-slate-50 px-3">
            <span className="material-symbols-outlined text-[19px] text-slate-400">search</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm theo tên hoặc số thứ tự nhà ga..."
              className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-slate-400"
            />
          </div>
          <button
            type="button"
            aria-pressed={onlyUnderstocked}
            onClick={() => setOnlyUnderstocked((value) => !value)}
            className={`inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-xs font-bold transition ${
              onlyUnderstocked ? "border-rose-200 bg-rose-50 text-rose-700" : "border-slate-200 bg-white text-slate-600 hover:border-rose-200"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">filter_alt</span>
            Chỉ ga thiếu
          </button>
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-1">
            <button type="button" onClick={() => setView("grid")} aria-label="Dạng lưới" className={`grid h-8 w-9 place-items-center rounded-md ${view === "grid" ? "bg-white text-blue-700 shadow-sm" : "text-slate-400"}`}>
              <span className="material-symbols-outlined text-[19px]">grid_view</span>
            </button>
            <button type="button" onClick={() => setView("table")} aria-label="Dạng bảng" className={`grid h-8 w-9 place-items-center rounded-md ${view === "table" ? "bg-white text-blue-700 shadow-sm" : "text-slate-400"}`}>
              <span className="material-symbols-outlined text-[19px]">view_list</span>
            </button>
          </div>
        </div>

        {result.error && !loading ? (
          <div className="grid min-h-72 place-items-center p-8 text-center">
            <div>
              <span className="material-symbols-outlined text-4xl text-rose-500">cloud_off</span>
              <p className="mt-3 font-bold text-slate-800">{result.error}</p>
              <button type="button" onClick={reload} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white">Thử lại</button>
            </div>
          </div>
        ) : !data ? (
          <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => <div key={index} className="h-64 animate-pulse rounded-xl bg-slate-100" />)}
          </div>
        ) : filteredStations.length === 0 ? (
          <div className="grid min-h-72 place-items-center p-8 text-center">
            <div>
              <span className="material-symbols-outlined text-4xl text-slate-300">search_off</span>
              <p className="mt-3 font-bold text-slate-700">
                {onlyUnderstocked && !query.trim() ? "Không có ga nào thiếu dữ liệu" : "Không tìm thấy nhà ga phù hợp"}
              </p>
            </div>
          </div>
        ) : view === "grid" ? (
          <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
            {filteredStations.map((station) => <StationCard key={station.id} station={station} />)}
          </div>
        ) : (
          <StationTable stations={filteredStations} categories={categories} />
        )}

        <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
          Hiển thị {filteredStations.length} trên tổng số {stations.length} nhà ga
        </div>
      </section>
    </div>
  );
}
