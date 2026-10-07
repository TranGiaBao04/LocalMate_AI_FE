import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { adminPlaceService } from "../../services/adminPlaceService";
import { adminStationService } from "../../services/adminStationService";
import AdminPageHeader from "../../components/admin/AdminPageHeader";
import { ADMIN_PRIMARY_BUTTON, ADMIN_SECONDARY_BUTTON, ADMIN_ICON_BUTTON } from "../../components/admin/adminStyles";
import { DataTable, AdminRecordCard, AdminPagination, AdminErrorState, EmptyState, LoadingState, StatusBadge } from "../../components/admin/ui";
import PlaceFilterBar from "../../components/admin/PlaceFilterBar";
import { VerifiedBadge, PlaceStatusToggle } from "../../components/admin/VerifiedBadge";
import DeletePlaceDialog from "../../components/admin/DeletePlaceDialog";

export default function AdminPlaceListPage() {
  const navigate = useNavigate();
  const [data, setData] = useState({ items: [], page: 1, pageSize: 10, totalCount: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
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
    setError("");
    try {
      const res = await adminPlaceService.getPlaces(filters);
      setData(res || { items: [], page: 1, pageSize: 10, totalCount: 0, totalPages: 0 });
    } catch (err) {
      console.error("Lỗi tải danh sách địa điểm:", err);
      setError(err.message || "Không thể tải danh sách địa điểm.");
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

  const price = (place) => place.estimatedCostMin || place.estimatedCostMax
    ? `${place.estimatedCostMin?.toLocaleString()}đ - ${place.estimatedCostMax?.toLocaleString()}đ` : "Miễn phí";
  const identity = (place) => <div className="flex min-w-52 items-center gap-3">
    {place.imageUrl ? <img src={place.imageUrl} alt="" className="h-11 w-11 shrink-0 rounded-[8px] object-cover" /> : <span aria-hidden="true" className="material-symbols-outlined grid h-11 w-11 shrink-0 place-items-center rounded-[8px] bg-[#F4F6FA] text-[#8993AC]">location_on</span>}
    <div className="min-w-0"><p className="font-semibold text-[#0F2148]">{place.name}</p><p className="text-xs text-[#8993AC]">ID: {place.id.slice(0, 8)}...</p></div>
  </div>;
  const status = (place) => <div className="flex flex-wrap items-center gap-2">
    <PlaceStatusToggle status={place.status} onToggle={() => handleStatusToggle(place)} loading={toggleLoadingId === place.id} />
    <StatusBadge status={place.status} />
  </div>;
  const actions = (place) => <div className="flex flex-wrap items-center gap-1">
    <button type="button" aria-label={`Xem chi tiết ${place.name}`} title="Xem chi tiết địa điểm" onClick={() => navigate(`/admin/places/${place.id}`)} className={ADMIN_ICON_BUTTON}><span aria-hidden="true" className="material-symbols-outlined text-[20px]">visibility</span></button>
    <button type="button" aria-label={`Chỉnh sửa ${place.name}`} title="Chỉnh sửa địa điểm" onClick={() => navigate(`/admin/places/edit/${place.id}`)} className={ADMIN_ICON_BUTTON}><span aria-hidden="true" className="material-symbols-outlined text-[20px]">edit</span></button>
    <button type="button" aria-label={`Xóa mềm ${place.name}`} title="Xóa mềm địa điểm" disabled={deleteLoading} onClick={() => setDeleteTarget(place)} className={`${ADMIN_ICON_BUTTON} hover:!text-red-700`}><span aria-hidden="true" className="material-symbols-outlined text-[20px]">delete</span></button>
  </div>;
  const columns = [
    { key: "name", header: "Hình ảnh & Tên địa điểm", render: identity },
    { key: "category", header: "Danh mục", render: (place) => <StatusBadge variant="info" label={place.category} /> },
    { key: "address", header: "Địa chỉ", cellClassName: "min-w-48 max-w-xs break-words" },
    { key: "price", header: "Khoảng giá (VNĐ)", render: price },
    { key: "status", header: "Trạng thái", render: status },
    { key: "verified", header: "Xác thực", render: (place) => <VerifiedBadge isVerified={place.isVerified} /> },
    { key: "actions", header: "Thao tác", render: actions },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader eyebrow="Dữ liệu Metro" title="Quản lý địa điểm" description={error ? "Danh sách địa điểm" : `Tổng số ${data.totalCount || 0} địa điểm trong hệ thống`}>
        <Link to="/admin/places/import" className={ADMIN_SECONDARY_BUTTON}><span aria-hidden="true" className="material-symbols-outlined text-[20px]">upload_file</span>Import CSV / Excel</Link>
        <Link to="/admin/places/create" className={ADMIN_PRIMARY_BUTTON}><span aria-hidden="true" className="material-symbols-outlined text-[20px]">add</span>Thêm địa điểm mới</Link>
      </AdminPageHeader>
      <PlaceFilterBar filters={filters} onChange={handleFilterChange} onReset={handleResetFilters} stations={stations} />
      {error ? <AdminErrorState message={error} onRetry={fetchPlaces} /> : <>
        <div className="hidden md:block">
        <DataTable rows={data.items} columns={columns} loading={loading} tableLabel="Danh sách địa điểm"
          emptyState={{icon:"location_on",title:"Không tìm thấy địa điểm nào",description:"Thử nới lỏng từ khóa hoặc điều kiện lọc"}}
        />
        </div>
        <div className="space-y-3 md:hidden">
          {loading ? <LoadingState variant="card" /> : data.items.length === 0 ? <EmptyState icon="location_on" title="Không tìm thấy địa điểm nào" description="Thử nới lỏng từ khóa hoặc điều kiện lọc" /> : data.items.map((place) => <AdminRecordCard key={place.id} title={place.name} subtitle={place.category}
            status={<div className="flex flex-wrap gap-2">{status(place)}<VerifiedBadge isVerified={place.isVerified} /></div>}
            primaryAction={actions(place)}>
            <p>{place.address}</p><p className="mt-2 font-medium text-[#0F2148]">{price(place)}</p>
          </AdminRecordCard>)}
        </div>
        {data.totalPages > 1 && <AdminPagination page={data.page} totalPages={data.totalPages} totalCount={data.totalCount} disabled={loading} onPageChange={(page) => handleFilterChange({page})} />}
      </>}
      <DeletePlaceDialog isOpen={Boolean(deleteTarget)} place={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDeleteConfirm} loading={deleteLoading} />
    </div>
  );
}
