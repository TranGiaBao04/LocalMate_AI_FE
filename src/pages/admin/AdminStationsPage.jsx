import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AdminPageHeader from "../../components/admin/AdminPageHeader";
import { ADMIN_SECONDARY_BUTTON } from "../../components/admin/adminStyles";
import { AdminSurface, AdminErrorState, EmptyState, LoadingState, StatusBadge } from "../../components/admin/ui";
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
  { key: "inactive", label: "Ngừng", tone: "bg-[#F4F6FA] text-[#5C6B8A]" },
];

function SummaryCard({ label, icon, iconTone, value, valueTone = "text-[#0F2148]", caption, loading }) {
  return (
    <AdminSurface as="article" density="compact">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-semibold leading-[18px] text-[#5C6B8A]">{label}</p>
        <span aria-hidden="true" className={`material-symbols-outlined ${iconTone}`}>{icon}</span>
      </div>
      {loading ? (
        <div className="mt-4 h-9 w-20 animate-pulse motion-reduce:animate-none rounded-[8px] bg-[#F4F6FA]" />
      ) : (
        <p className={`mt-3 text-2xl font-bold ${valueTone}`}>{value}</p>
      )}
      {caption && !loading && <p className="mt-2 text-xs leading-5 text-[#5C6B8A]">{caption}</p>}
    </AdminSurface>
  );
}

function StockBadge({ station }) {
  return <StatusBadge variant={station.isUnderstocked ? "warning" : "success"} label={station.isUnderstocked ? `Thiếu ${station.shortfall} địa điểm` : "Đủ dữ liệu"} />;
}

function MissingCategories({ categories }) {
  if (categories.length === 0) return null;
  return <p className="text-xs font-semibold text-amber-700">Chưa có {categories.map(categoryLabel).join(", ")}</p>;
}

function StationCard({ station }) {
  return (
    <AdminSurface as="article" variant="interactive" className={station.isUnderstocked ? "border-amber-200" : ""}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] bg-[#1D3E82] text-sm font-extrabold text-white">
            {stationCode(station.order)}
          </span>
          <div className="min-w-0">
            <h2 className="break-words text-base font-semibold leading-6 text-[#0F2148]">Ga {station.name}</h2>
            <p className="mt-0.5 text-xs text-[#5C6B8A]">{countFormatter.format(station.totals.total)} địa điểm quanh ga</p>
          </div>
        </div>
        <StockBadge station={station} />
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        {STATUS_COLUMNS.map((column) => (
          <div key={column.key} className={`rounded-[8px] px-2 py-2 ${column.tone}`}>
            <dt className="text-xs font-semibold leading-[18px]">{column.label}</dt>
            <dd className="mt-0.5 text-lg font-extrabold">{station.totals[column.key]}</dd>
          </div>
        ))}
      </dl>

      <ul className="mt-4 space-y-1.5">
        {station.categories.map((item) => (
          <li key={item.category} className="flex items-center justify-between gap-2 text-sm">
            <span className="text-[#5C6B8A]">{categoryLabel(item.category)}</span>
            <span className={`font-bold ${item.active === 0 ? "text-amber-700" : "text-[#0F2148]"}`}>
              {item.active}
              {item.pending > 0 && <span className="ml-1 text-xs font-medium text-[#8993AC]">+{item.pending} chờ duyệt</span>}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-3">
        <MissingCategories categories={station.missingCategories} />
      </div>
    </AdminSurface>
  );
}

function StationTable({ stations, categories }) {
  return (
    <div className="overflow-x-auto">
      <table aria-label="Độ phủ địa điểm theo nhà ga" className="w-full min-w-[880px] text-left">
        <thead className="bg-[#F8FAFC] text-xs font-semibold leading-4 text-[#5C6B8A]">
          <tr>
            <th scope="col" className="px-5 py-3">Ga</th>
            {STATUS_COLUMNS.map((column) => <th scope="col" key={column.key} className="px-3 py-3 text-right">{column.label}</th>)}
            {categories.map((category) => <th scope="col" key={category} className="px-3 py-3 text-right">{categoryLabel(category)}</th>)}
            <th scope="col" className="px-5 py-3">Tình trạng</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#DCE2EE]">
          {stations.map((station) => (
            <tr key={station.id} className={`text-sm ${station.isUnderstocked ? "bg-rose-50/40" : "hover:bg-[#F8FAFC]"}`}>
              <td className="px-5 py-4">
                <span className="mr-2 font-extrabold text-blue-700">{stationCode(station.order)}</span>
                <span className="font-bold text-[#0F2148]">Ga {station.name}</span>
              </td>
              {STATUS_COLUMNS.map((column) => (
                <td key={column.key} className="px-3 py-4 text-right font-semibold text-[#0F2148]">{station.totals[column.key]}</td>
              ))}
              {categories.map((category) => {
                const active = station.categories.find((item) => item.category === category)?.active ?? 0;
                return (
                  <td key={category} className={`px-3 py-4 text-right font-semibold ${active === 0 ? "text-amber-700" : "text-[#0F2148]"}`}>
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
      <AdminPageHeader
        eyebrow="Dữ liệu Metro"
        title="Quản lý 14 Ga Metro Tuyến 1"
        description={
          <>
            {data
              ? `Địa điểm trong bán kính ${countFormatter.format(data.radiusMeters)} m, mỗi địa điểm tính cho ga gần nhất. Ga có dưới ${data.minActivePlacesPerStation} địa điểm đang hoạt động bị đánh dấu thiếu.`
              : "Số địa điểm quanh từng ga theo trạng thái và loại địa điểm."}
            {data && canManageSettings && (
              <Link to="/admin/settings" className="ml-1 font-semibold text-primary hover:underline">
                Đổi trong Cấu hình hệ thống
              </Link>
            )}
          </>
        }
      >
        <button type="button" onClick={reload} disabled={loading} className={ADMIN_SECONDARY_BUTTON}>
          <span aria-hidden="true" className={`material-symbols-outlined text-[18px] ${loading ? "animate-spin motion-reduce:animate-none" : ""}`}>sync</span>
          Tải lại
        </button>
      </AdminPageHeader>

      <section className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <SummaryCard label="Tổng số ga" icon="subway" iconTone="text-blue-600" loading={!data && loading} value={data ? stations.length : "—"} />
        <SummaryCard
          label="Ga thiếu dữ liệu"
          icon="report"
          iconTone="text-rose-600"
          valueTone={data?.understockedStationCount ? "text-rose-700" : "text-[#0F2148]"}
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

      <section className="mt-8 min-w-0">
        <div className="flex flex-col gap-3 border-b border-[#DCE2EE] p-4 lg:flex-row lg:items-center">
          <div className="flex h-11 min-w-0 flex-1 items-center rounded-[12px] border border-[#DCE2EE] bg-white px-3 focus-within:ring-2 focus-within:ring-[#2C56A8]/20">
            <span aria-hidden="true" className="material-symbols-outlined text-[19px] text-[#8993AC]">search</span>
            <input
              aria-label="Tìm nhà ga"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm theo tên hoặc số thứ tự nhà ga..."
              className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-[#8993AC]"
            />
          </div>
          <button
            type="button"
            aria-pressed={onlyUnderstocked}
            onClick={() => setOnlyUnderstocked((value) => !value)}
            className={`inline-flex min-h-11 items-center gap-2 rounded-[12px] border px-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2C56A8] ${
              onlyUnderstocked ? "border-rose-200 bg-rose-50 text-rose-700" : "border-[#DCE2EE] bg-white text-[#5C6B8A] hover:border-rose-200"
            }`}
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[18px]">filter_alt</span>
            Chỉ ga thiếu
          </button>
          <div className="hidden self-start items-center rounded-[12px] border border-[#DCE2EE] bg-[#F8FAFC] p-1 md:flex lg:self-auto">
            <button type="button" onClick={() => setView("grid")} aria-pressed={view === "grid"} aria-label="Dạng lưới" className={`grid h-11 w-11 place-items-center rounded-[8px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2C56A8] ${view === "grid" ? "bg-white text-blue-700" : "text-[#8993AC]"}`}>
              <span aria-hidden="true" className="material-symbols-outlined text-[19px]">grid_view</span>
            </button>
            <button type="button" onClick={() => setView("table")} aria-pressed={view === "table"} aria-label="Dạng bảng" className={`grid h-11 w-11 place-items-center rounded-[8px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2C56A8] ${view === "table" ? "bg-white text-blue-700" : "text-[#8993AC]"}`}>
              <span aria-hidden="true" className="material-symbols-outlined text-[19px]">view_list</span>
            </button>
          </div>
        </div>

        {result.error && !loading ? (
          <AdminErrorState message={result.error} onRetry={reload} />
        ) : !data ? (
          <LoadingState label="Đang tải nhà ga..." />
        ) : filteredStations.length === 0 ? (
          <EmptyState icon="search_off" title={onlyUnderstocked && !query.trim() ? "Không có ga nào thiếu dữ liệu" : "Không tìm thấy nhà ga phù hợp"} />
        ) : (
          <>
          <div className={`mt-5 grid gap-4 sm:grid-cols-2 2xl:grid-cols-3 ${view === "table" ? "md:hidden" : ""}`}>
            {filteredStations.map((station) => <StationCard key={station.id} station={station} />)}
          </div>
          {view === "table" && <div className="mt-5 hidden md:block"><AdminSurface density="none" className="overflow-hidden"><StationTable stations={filteredStations} categories={categories} /></AdminSurface></div>}
          </>
        )}

        <div className="mt-4 text-xs leading-[18px] text-[#5C6B8A]">
          Hiển thị {filteredStations.length} trên tổng số {stations.length} nhà ga
        </div>
      </section>
    </div>
  );
}
