import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Plus,
  FileSpreadsheet,
  Edit2,
  Trash2,
  Eye,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MapPin,
  Building2,
} from "lucide-react";
import { adminPlaceService } from "../../services/adminPlaceService";
import { adminStationService } from "../../services/adminStationService";
import PlaceFilterBar from "../../components/admin/PlaceFilterBar";
import { VerifiedBadge, PlaceStatusToggle } from "../../components/admin/VerifiedBadge";
import DeletePlaceDialog from "../../components/admin/DeletePlaceDialog";

export default function AdminPlaceListPage() {
  const navigate = useNavigate();
  const [data, setData] = useState({ items: [], page: 1, pageSize: 10, totalCount: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [stations, setStations] = useState([]);
  const [filters, setFilters] = useState({ page: 1, pageSize: 10, search: "", category: "", status: "", stationId: "" });

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [toggleLoadingId, setToggleLoadingId] = useState(null);

  // Fetch stations for filter bar
  useEffect(() => {
    async function loadStations() {
      try {
        const res = await adminStationService.getStations();
        setStations(Array.isArray(res) ? res : res?.stations || res?.items || []);
      } catch (err) {
        console.error("Lỗi tải ga metro:", err);
      }
    }
    loadStations();
  }, []);

  // Fetch paginated place list from server
  const fetchPlaces = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminPlaceService.getPlaces(filters);
      setData(res || { items: [], page: 1, pageSize: 10, totalCount: 0, totalPages: 0 });
    } catch (err) {
      console.error("Lỗi tải danh sách địa điểm:", err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchPlaces();
  }, [fetchPlaces]);

  const handleFilterChange = (newFilters) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  const handleResetFilters = () => {
    setFilters({ page: 1, pageSize: 10, search: "", category: "", status: "", stationId: "" });
  };

  const handleStatusToggle = async (place) => {
    setToggleLoadingId(place.id);
    try {
      const newStatus = place.status === "Active" ? "Inactive" : "Active";
      await adminPlaceService.updatePlaceStatus(place.id, newStatus);
      fetchPlaces();
    } catch (err) {
      alert(err.message || "Lỗi cập nhật trạng thái địa điểm.");
    } finally {
      setToggleLoadingId(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await adminPlaceService.deletePlace(deleteTarget.id);
      setDeleteTarget(null);
      fetchPlaces();
    } catch (err) {
      alert(err.message || "Xóa địa điểm thất bại.");
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 p-4 md:p-8 space-y-6">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="w-7 h-7 text-teal-600" />
            Quản Lý Danh Mục Địa Điểm (Admin Places)
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Tổng số {data.totalCount || 0} địa điểm trong hệ thống
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/admin/places/import"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-teal-700 bg-teal-50 border border-teal-200 hover:bg-teal-100 rounded-xl transition shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Import CSV / Excel
          </Link>

          <Link
            to="/admin/places/create"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Thêm địa điểm mới
          </Link>
        </div>
      </div>

      {/* Filter Bar */}
      <PlaceFilterBar
        filters={filters}
        onChange={handleFilterChange}
        onReset={handleResetFilters}
        stations={stations}
      />

      {/* Places Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 text-gray-400 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
            <span className="text-xs">Đang tải danh sách địa điểm...</span>
          </div>
        ) : data.items.length === 0 ? (
          <div className="text-center p-12 text-gray-400 space-y-2">
            <MapPin className="w-10 h-10 mx-auto text-gray-300" />
            <p className="text-sm font-medium text-gray-600">Không tìm thấy địa điểm nào</p>
            <p className="text-xs text-gray-400">Thử nới lỏng từ khóa hoặc điều kiện lọc</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-600">
              <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="p-4">Hình ảnh & Tên địa điểm</th>
                  <th className="p-4">Danh mục</th>
                  <th className="p-4">Địa chỉ</th>
                  <th className="p-4">Khoảng giá (VNĐ)</th>
                  <th className="p-4">Trạng thái</th>
                  <th className="p-4">Xác thực</th>
                  <th className="p-4 text-right">Thao tác</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {data.items.map((place) => (
                  <tr key={place.id} className="hover:bg-gray-50/80 transition">
                    <td className="p-4 font-medium text-gray-900">
                      <div className="flex items-center gap-3">
                        <img
                          src={place.imageUrl || "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=100&h=100&fit=crop"}
                          alt={place.name}
                          className="w-10 h-10 rounded-lg object-cover bg-gray-100 border border-gray-200"
                        />
                        <div>
                          <p className="font-bold text-gray-900 line-clamp-1">{place.name}</p>
                          <p className="text-[11px] text-gray-400">ID: {place.id.slice(0, 8)}...</p>
                        </div>
                      </div>
                    </td>

                    <td className="p-4">
                      <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-teal-50 text-teal-700 border border-teal-100">
                        {place.category}
                      </span>
                    </td>

                    <td className="p-4 max-w-xs truncate text-gray-600">
                      {place.address}
                    </td>

                    <td className="p-4">
                      {place.estimatedCostMin || place.estimatedCostMax ? (
                        <span>
                          {place.estimatedCostMin?.toLocaleString()}đ - {place.estimatedCostMax?.toLocaleString()}đ
                        </span>
                      ) : (
                        <span className="text-gray-400">Miễn phí</span>
                      )}
                    </td>

                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <PlaceStatusToggle
                          status={place.status}
                          onToggle={() => handleStatusToggle(place)}
                          loading={toggleLoadingId === place.id}
                        />
                        <span className="text-[11px] text-gray-500 font-medium">{place.status}</span>
                      </div>
                    </td>

                    <td className="p-4">
                      <VerifiedBadge isVerified={place.isVerified} />
                    </td>

                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => navigate(`/admin/places/${place.id}`)}
                          className="p-1.5 text-gray-500 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition"
                          title="Xem chi tiết địa điểm"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => navigate(`/admin/places/edit/${place.id}`)}
                          className="p-1.5 text-gray-500 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition"
                          title="Chỉnh sửa địa điểm"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => setDeleteTarget(place)}
                          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Xóa mềm địa điểm"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Server-side Pagination Footer */}
        {data.totalPages > 1 && (
          <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              Trang {data.page} / {data.totalPages} ({data.totalCount} kết quả)
            </span>

            <div className="flex items-center gap-2">
              <button
                disabled={data.page <= 1}
                onClick={() => handleFilterChange({ page: data.page - 1 })}
                className="p-1.5 text-gray-600 hover:bg-white rounded-lg border border-gray-200 disabled:opacity-40 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="text-xs font-semibold px-3 py-1 bg-white border border-gray-200 rounded-lg">
                {data.page}
              </span>

              <button
                disabled={data.page >= data.totalPages}
                onClick={() => handleFilterChange({ page: data.page + 1 })}
                className="p-1.5 text-gray-600 hover:bg-white rounded-lg border border-gray-200 disabled:opacity-40 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Dialog */}
      <DeletePlaceDialog
        isOpen={Boolean(deleteTarget)}
        place={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        loading={deleteLoading}
      />
    </div>
  );
}
