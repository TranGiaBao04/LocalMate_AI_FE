import { useEffect, useState } from "react";
import { Search, X, Filter } from "lucide-react";

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
    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-3 mb-6">
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Tìm kiếm theo tên địa điểm, địa chỉ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition"
          />
          {searchTerm && (
            <button
              onClick={() => {
                setSearchTerm("");
                onChange({ search: "", page: 1 });
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Category Dropdown */}
          <select
            value={filters.category || ""}
            onChange={(e) => onChange({ category: e.target.value, page: 1 })}
            className="px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-700"
          >
            <option value="">Tất cả danh mục</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>

          {/* Status Dropdown */}
          <select
            value={filters.status || ""}
            onChange={(e) => onChange({ status: e.target.value, page: 1 })}
            className="px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-700"
          >
            <option value="">Tất cả trạng thái</option>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          {/* Metro Station Dropdown */}
          <select
            value={filters.stationId || ""}
            onChange={(e) => onChange({ stationId: e.target.value, page: 1 })}
            className="px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-700 max-w-[180px]"
          >
            <option value="">Tất cả ga Metro</option>
            {stations.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name}
              </option>
            ))}
          </select>

          {/* Reset Filters button */}
          {hasActiveFilters && (
            <button
              onClick={() => {
                setSearchTerm("");
                onReset();
              }}
              className="inline-flex items-center gap-1 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition"
            >
              <X className="w-3.5 h-3.5" />
              Xóa bộ lọc
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
