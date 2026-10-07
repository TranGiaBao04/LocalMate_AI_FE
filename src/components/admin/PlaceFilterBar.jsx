import { useEffect, useState } from "react";
import { FilterBar } from "./ui";
import { ADMIN_SELECT, ADMIN_ICON_BUTTON } from "./adminStyles";

const CATEGORIES = [
  { value: "Food", label: "Ăn uống (Food)" },
  { value: "Cafe", label: "Cà phê (Cafe)" },
  { value: "Culture", label: "Văn hóa (Culture)" },
  { value: "CheckIn", label: "Sống ảo (CheckIn)" },
];

const STATUSES = [
  { value: "Active", label: "Đang hoạt động (Active)" },
  { value: "Inactive", label: "Tạm ẩn (Inactive)" },
  { value: "Pending", label: "Chờ duyệt (Pending)" },
];

export default function PlaceFilterBar({
  filters,
  onChange,
  onReset,
  stations = [],
}) {
  const [searchTerm, setSearchTerm] = useState(filters.search || "");

  // Debounce 300ms for search term
  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchTerm !== (filters.search || "")) {
        onChange({ search: searchTerm, page: 1 });
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [searchTerm, filters.search, onChange]);

  const hasActiveFilters =
    filters.search ||
    filters.category ||
    filters.status ||
    filters.stationId;

  return (
    <FilterBar searchValue={searchTerm} searchLabel="Tìm địa điểm" searchPlaceholder="Tìm kiếm theo tên địa điểm, địa chỉ..."
      onSearchChange={setSearchTerm} activeFilterCount={[filters.category,filters.status,filters.stationId].filter(Boolean).length}
      onClear={hasActiveFilters ? () => { setSearchTerm(""); onReset(); } : undefined}>
      {searchTerm && <button type="button" aria-label="Xóa từ khóa" className={ADMIN_ICON_BUTTON} onClick={() => { setSearchTerm(""); onChange({search:"",page:1}); }}><span aria-hidden="true" className="material-symbols-outlined text-[20px]">close</span></button>}
      <select aria-label="Danh mục" value={filters.category || ""} onChange={(e) => onChange({category:e.target.value,page:1})} className={`${ADMIN_SELECT} !w-full sm:!w-auto`}>
        <option value="">Tất cả danh mục</option>{CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
      </select>
      <select aria-label="Trạng thái" value={filters.status || ""} onChange={(e) => onChange({status:e.target.value,page:1})} className={`${ADMIN_SELECT} !w-full sm:!w-auto`}>
        <option value="">Tất cả trạng thái</option>{STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>
      <select aria-label="Ga Metro" value={filters.stationId || ""} onChange={(e) => onChange({stationId:e.target.value,page:1})} className={`${ADMIN_SELECT} !w-full sm:!w-auto sm:max-w-52`}>
        <option value="">Tất cả ga Metro</option>{stations.map((station) => <option key={station.id} value={station.id}>{station.name}</option>)}
      </select>
    </FilterBar>
  );
}
