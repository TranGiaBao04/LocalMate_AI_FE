import { useEffect, useMemo, useState } from "react";
import { masterDataService } from "../../services/masterDataService";

export default function AdminStationsPage() {
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [view, setView] = useState("grid");

  const loadStations = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await masterDataService.getMasterData();
      setStations([...(data?.metroStations ?? [])].sort((a, b) => a.order - b.order));
    } catch {
      setError("Không tải được dữ liệu nhà ga. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    masterDataService.getMasterData()
      .then((data) => {
        if (active) setStations([...(data?.metroStations ?? [])].sort((a, b) => a.order - b.order));
      })
      .catch(() => {
        if (active) setError("Không tải được dữ liệu nhà ga. Vui lòng thử lại.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const filteredStations = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("vi");
    if (!keyword) return stations;
    return stations.filter((station) => station.name.toLocaleLowerCase("vi").includes(keyword) || String(station.order).includes(keyword));
  }, [query, stations]);

  return (
    <div>
      <section className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-blue-700"><span className="material-symbols-outlined text-[15px]">train</span>Metro Line 1</div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#0f2042] sm:text-[30px]">Quản lý 14 Ga Metro Tuyến 1</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Theo dõi danh mục ga Bến Thành – Suối Tiên và tọa độ vận hành được đồng bộ từ hệ thống.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={loadStations} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 shadow-sm transition hover:border-blue-200 hover:text-blue-700"><span className={`material-symbols-outlined text-[18px] ${loading ? "animate-spin" : ""}`}>sync</span>Đồng bộ dữ liệu</button>
          <button type="button" disabled className="inline-flex h-10 cursor-not-allowed items-center gap-2 rounded-lg bg-slate-200 px-4 text-xs font-bold text-slate-400"><span className="material-symbols-outlined text-[18px]">edit_location_alt</span>Cập nhật thông tin ga</button>
        </div>
      </section>

      <section className="mt-6 grid gap-3 md:grid-cols-2">
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Tổng số ga trong hệ thống</p><span className="material-symbols-outlined text-blue-600">subway</span></div><p className="mt-4 text-3xl font-extrabold text-[#0f2042]">{loading ? "—" : stations.length}</p></article>
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Trạng thái dữ liệu</p><span className={`material-symbols-outlined ${error ? "text-rose-600" : "text-emerald-600"}`}>{error ? "error" : "verified"}</span></div><p className={`mt-4 text-xl font-extrabold ${error ? "text-rose-700" : "text-emerald-700"}`}>{error ? "Mất kết nối" : loading ? "Đang tải..." : "Đã đồng bộ"}</p></article>
      </section>

      <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center">
          <div className="flex h-10 flex-1 items-center rounded-lg border border-slate-200 bg-slate-50 px-3"><span className="material-symbols-outlined text-[19px] text-slate-400">search</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo tên hoặc số thứ tự nhà ga..." className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-slate-400" /></div>
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-1"><button type="button" onClick={() => setView("grid")} aria-label="Dạng lưới" className={`grid h-8 w-9 place-items-center rounded-md ${view === "grid" ? "bg-white text-blue-700 shadow-sm" : "text-slate-400"}`}><span className="material-symbols-outlined text-[19px]">grid_view</span></button><button type="button" onClick={() => setView("table")} aria-label="Dạng bảng" className={`grid h-8 w-9 place-items-center rounded-md ${view === "table" ? "bg-white text-blue-700 shadow-sm" : "text-slate-400"}`}><span className="material-symbols-outlined text-[19px]">view_list</span></button></div>
        </div>

        {error ? <div className="grid min-h-72 place-items-center p-8 text-center"><div><span className="material-symbols-outlined text-4xl text-rose-500">cloud_off</span><p className="mt-3 font-bold text-slate-800">{error}</p><button type="button" onClick={loadStations} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white">Thử lại</button></div></div>
          : loading ? <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-44 animate-pulse rounded-xl bg-slate-100" />)}</div>
            : filteredStations.length === 0 ? <div className="grid min-h-72 place-items-center p-8 text-center"><div><span className="material-symbols-outlined text-4xl text-slate-300">search_off</span><p className="mt-3 font-bold text-slate-700">Không tìm thấy nhà ga phù hợp</p></div></div>
              : view === "grid" ? (
                <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredStations.map((station) => <article key={station.id} className="group rounded-xl border border-slate-200 p-5 transition hover:border-blue-200 hover:shadow-lg"><div className="flex items-start justify-between gap-4"><div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#0f2042] text-sm font-extrabold text-white">{String(station.order).padStart(2, "0")}</span><div><h2 className="font-extrabold text-[#0f2042]">Ga {station.name}</h2></div></div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">Đã đồng bộ</span></div></article>)}
                </div>
              ) : (
                <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left"><thead className="bg-slate-50 text-[10px] font-extrabold uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Mã ga</th><th className="px-5 py-3">Tên nhà ga</th><th className="px-5 py-3">Tuyến</th><th className="px-5 py-3">Trạng thái</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredStations.map((station) => <tr key={station.id} className="text-sm hover:bg-slate-50"><td className="px-5 py-4 font-extrabold text-blue-700">GA-{String(station.order).padStart(2, "0")}</td><td className="px-5 py-4 font-bold text-slate-800">Ga {station.name}</td><td className="px-5 py-4 text-slate-500">Metro Line 1</td><td className="px-5 py-4"><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">Đã đồng bộ</span></td></tr>)}</tbody></table></div>
              )}
        <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">Hiển thị {filteredStations.length} trên tổng số {stations.length} nhà ga</div>
      </section>
    </div>
  );
}
