import { useEffect, useMemo, useState } from "react";
import { AdminPagination, EmptyState, LoadingState } from "../ui";
import { ADMIN_INPUT, ADMIN_SECONDARY_BUTTON, ADMIN_SELECT } from "../adminStyles";
import { PLACE_CATEGORY_LABELS } from "../../../constants";
import { adminPlaceService } from "../../../services/adminPlaceService";
import { adminStationService } from "../../../services/adminStationService";
import { formatCostRange } from "./curatedLabels";

const PAGE_SIZE = 8;

// Danh sách địa điểm để thêm vào lịch trình mẫu. Chỉ lấy địa điểm Active vì BE từ chối trạng thái khác.
// selectedIds: Set id đã chọn; full: đã đủ số chặng tối đa.
export default function CuratedPlacePicker({ selectedIds, full, disabled, onAdd }) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [stationId, setStationId] = useState("");
  const [page, setPage] = useState(1);
  const [reloadCount, setReloadCount] = useState(0);
  const [stations, setStations] = useState([]);
  const [response, setResponse] = useState({ key: null, data: null, error: "" });

  const query = useMemo(() => ({
    status: "Active",
    search: debouncedSearch.trim(),
    stationId,
    page,
    pageSize: PAGE_SIZE,
    sortBy: "name",
    sortDirection: "asc",
  }), [debouncedSearch, stationId, page]);
  const queryKey = `${JSON.stringify(query)}#${reloadCount}`;
  const loading = response.key !== queryKey;

  useEffect(() => {
    let active = true;
    adminStationService.getStations()
      .then((data) => {
        if (active) setStations(data?.stations ?? []);
      })
      .catch(() => {}); // Thiếu danh sách ga vẫn tìm được địa điểm
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let active = true;
    adminPlaceService.getPlaces(query)
      .then((data) => {
        if (active) setResponse({ key: queryKey, data, error: "" });
      })
      .catch((err) => {
        if (active) setResponse({ key: queryKey, data: null, error: err?.message || "Không tải được danh sách địa điểm." });
      });
    return () => { active = false; };
  }, [query, queryKey]);

  const rows = loading ? [] : response.data?.items ?? [];

  return (
    <div className="min-w-0">
      <h3 className="text-[13px] font-semibold leading-[18px] text-[#0F2148]">Thêm địa điểm</h3>
      <div className="mt-3 flex flex-wrap gap-3">
        <input
          type="search"
          aria-label="Tìm địa điểm"
          value={search}
          maxLength={100}
          onChange={(event) => setSearch(event.target.value)}
          // Ô này nằm trong form của trang: Enter không được gửi form
          onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }}
          placeholder="Tìm theo tên hoặc địa chỉ (gõ không dấu được)"
          className={`${ADMIN_INPUT} min-w-0 flex-1 basis-56`}
        />
        {stations.length > 0 && (
          <select
            aria-label="Lọc theo ga"
            value={stationId}
            onChange={(event) => { setStationId(event.target.value); setPage(1); }}
            className={`${ADMIN_SELECT} sm:w-auto`}
          >
            <option value="">Tất cả ga</option>
            {stations.map((station) => <option key={station.id} value={station.id}>Ga {station.name}</option>)}
          </select>
        )}
      </div>

      {full && <p className="mt-3 text-xs leading-[18px] text-amber-700">Đã đủ số địa điểm tối đa. Bỏ bớt một chặng để thêm địa điểm khác.</p>}

      {response.error && !loading ? (
        <div role="alert" className="mt-3 flex flex-wrap items-center gap-3 text-sm text-rose-700">
          <span className="min-w-0 flex-1">{response.error}</span>
          <button type="button" onClick={() => setReloadCount((count) => count + 1)} className={ADMIN_SECONDARY_BUTTON}>Thử lại</button>
        </div>
      ) : loading ? (
        <LoadingState label="Đang tải địa điểm" />
      ) : rows.length === 0 ? (
        <EmptyState density="compact" icon="location_off" title="Không có địa điểm phù hợp" description="Chỉ địa điểm đang hoạt động mới thêm được vào lịch trình mẫu." />
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((place) => {
            const selected = selectedIds.has(place.id);
            return (
              <li key={place.id} className="flex items-center gap-3 rounded-[12px] border border-[#DCE2EE] p-3">
                {place.imageUrl
                  ? <img src={place.imageUrl} alt="" className="h-11 w-11 shrink-0 rounded-[8px] object-cover" />
                  : <span aria-hidden="true" className="material-symbols-outlined grid h-11 w-11 shrink-0 place-items-center rounded-[8px] bg-[#F4F6FA] text-[#8993AC]">location_on</span>}
                <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                  <p className="font-semibold text-[#0F2148]">{place.name}</p>
                  <p className="text-xs leading-[18px] text-[#5C6B8A]">
                    {PLACE_CATEGORY_LABELS[place.category] ?? place.category} · {formatCostRange(place.estimatedCostMin, place.estimatedCostMax)}
                  </p>
                  <p className="truncate text-xs leading-[18px] text-[#8993AC]">{place.address}</p>
                </div>
                <button
                  type="button"
                  disabled={disabled || selected || full}
                  onClick={() => onAdd(place)}
                  aria-label={selected ? `${place.name} đã có trong lịch trình` : `Thêm ${place.name} vào lịch trình`}
                  className={`${ADMIN_SECONDARY_BUTTON} shrink-0`}
                >
                  {selected ? "Đã chọn" : "Thêm"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {response.data && !response.error && <AdminPagination {...response.data} onPageChange={setPage} disabled={loading} />}
    </div>
  );
}
