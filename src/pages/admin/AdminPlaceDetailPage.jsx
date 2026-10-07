import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { AdminSurface, AdminErrorState, EmptyState, LoadingState, StatusBadge } from "../../components/admin/ui";
import AdminPageHeader from "../../components/admin/AdminPageHeader";
import { ADMIN_PRIMARY_BUTTON, ADMIN_SECONDARY_BUTTON } from "../../components/admin/adminStyles";
import { adminPlaceService } from "../../services/adminPlaceService";
import { buildMapsSearchUrl } from "../../utils/googleMaps";
import { VerifiedBadge } from "../../components/admin/VerifiedBadge";

const DAYS_MAP = {
  Monday: "Thứ Hai",
  Tuesday: "Thứ Ba",
  Wednesday: "Thứ Tư",
  Thursday: "Thứ Năm",
  Friday: "Thứ Sáu",
  Saturday: "Thứ Bảy",
  Sunday: "Chủ Nhật",
};

export default function AdminPlaceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [place, setPlace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadPlace() {
      setLoading(true);
      setError(null);
      try {
        const res = await adminPlaceService.getPlaceById(id);
        setPlace(res?.data || res);
      } catch (err) {
        console.error("Lỗi tải chi tiết địa điểm:", err);
        setError(err.message || "Không thể tải thông tin địa điểm.");
      } finally {
        setLoading(false);
      }
    }
    if (id) {
      loadPlace();
    }
  }, [id]);

  if (loading) return <LoadingState label="Đang tải chi tiết địa điểm..." />;
  if (error || !place) return <div className="space-y-4"><AdminErrorState message={error || "Địa điểm không tồn tại hoặc đã bị xóa."} /><button type="button" className={ADMIN_SECONDARY_BUTTON} onClick={() => navigate("/admin/places")}>Quay lại danh sách</button></div>;
  const openingHours = place.openingHours || place.openingHoursList || [];
  const fact = (label, value) => <div className="min-w-0 border-b border-[#DCE2EE] py-3"><dt className="text-[13px] leading-[18px] text-[#5C6B8A]">{label}</dt><dd className="mt-1 break-words text-sm font-medium text-[#0F2148]">{value ?? "Chưa cập nhật"}</dd></div>;
  return (
    <div className="space-y-6">
      <AdminPageHeader back={{to:"/admin/places",label:"Danh sách địa điểm"}} eyebrow="Dữ liệu Metro" title={place.name} badge={<VerifiedBadge isVerified={place.isVerified} />} description={`ID: ${place.id}`}>
        <Link to={`/admin/places/edit/${place.id}`} className={ADMIN_PRIMARY_BUTTON}><span aria-hidden="true" className="material-symbols-outlined text-[20px]">edit</span>Chỉnh sửa địa điểm</Link>
      </AdminPageHeader>
      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          <AdminSurface as="section">
            <div className="mb-4 flex flex-wrap items-center gap-2"><StatusBadge variant="info" label={place.category || "Chưa cập nhật danh mục"} /><StatusBadge status={place.status || "Chưa cập nhật trạng thái"} /></div>
            <h2 className="text-lg font-bold leading-[26px]">Thông tin tổng quan</h2>
            <dl className="mt-3 grid gap-x-6 sm:grid-cols-2">
              {fact("Địa chỉ",place.address || null)}
              {fact("Chi phí ước tính",place.estimatedCostMin != null || place.estimatedCostMax != null ? `${place.estimatedCostMin?.toLocaleString() ?? "—"}đ - ${place.estimatedCostMax?.toLocaleString() ?? "—"}đ` : null)}
              {fact("Thời gian trải nghiệm",place.estimatedDurationMinutes ? `${place.estimatedDurationMinutes} phút` : null)}
              {fact("Đánh giá",place.rating ? `${place.rating} / 5${place.totalReviews ? ` (${place.totalReviews} lượt)` : ""}` : "Chưa có đánh giá")}
            </dl>
            {place.description && <div className="mt-5"><h3 className="font-semibold">Mô tả địa điểm</h3><p className="mt-2 whitespace-pre-line break-words text-[#5C6B8A]">{place.description}</p></div>}
            {place.tags?.length > 0 && <div className="mt-5"><h3 className="font-semibold">Thẻ phân loại (Tags)</h3><div className="mt-3 flex flex-wrap gap-2">{place.tags.map((tag,index) => <StatusBadge key={tag.id || index} variant="info" label={tag.name || tag} />)}</div></div>}
          </AdminSurface>
          <AdminSurface as="section"><h2 className="mb-4 text-lg font-bold">Ảnh địa điểm</h2>{place.imageUrl ? <img src={place.imageUrl} alt={place.name} className="max-h-96 w-full rounded-[8px] object-contain" /> : <EmptyState icon="image" title="Chưa có ảnh địa điểm" density="compact" />}</AdminSurface>
        </div>
        <div className="min-w-0 space-y-6">
          <AdminSurface as="section"><h2 className="text-lg font-bold leading-[26px]">Vị trí & kết nối Metro</h2><dl className="mt-3">
            {fact("Ga Metro gần nhất",place.nearestStationName || place.stationName || "Chưa gán ga")}
            {place.distanceToStationMeters ? fact("Khoảng cách đến ga",`${Math.round(place.distanceToStationMeters)}m`) : null}
            {fact("Vĩ độ (Lat)",place.latitude ?? place.lat ?? null)}
            {fact("Kinh độ (Lng)",place.longitude ?? place.lng ?? null)}
          </dl>
          {place.latitude && place.longitude && <a href={buildMapsSearchUrl({lat:place.latitude,lng:place.longitude,query:place.name,placeId:place.googlePlaceId})} target="_blank" rel="noopener noreferrer" className={`mt-4 ${ADMIN_SECONDARY_BUTTON}`}><span aria-hidden="true" className="material-symbols-outlined text-[20px]">open_in_new</span>Mở vị trí trên Google Maps</a>}
          </AdminSurface>
          <AdminSurface as="section"><h2 className="text-lg font-bold leading-[26px]">Lịch giờ mở cửa</h2>
            {openingHours.length === 0 ? <p className="mt-4 text-[#5C6B8A]">Chưa có thông tin giờ mở cửa</p> : <dl className="mt-3 divide-y divide-[#DCE2EE]">{openingHours.map((hours,index) => <div key={index} className="flex flex-wrap items-center justify-between gap-2 py-3"><dt>{DAYS_MAP[hours.dayOfWeek] || hours.dayOfWeek}</dt><dd><StatusBadge variant={hours.isClosed ? "neutral" : "success"} label={hours.isClosed ? "Đóng cửa" : `${hours.openTime || "Chưa cập nhật"} - ${hours.closeTime || "Chưa cập nhật"}`} /></dd></div>)}</dl>}
          </AdminSurface>
        </div>
      </div>
    </div>
  );
}
