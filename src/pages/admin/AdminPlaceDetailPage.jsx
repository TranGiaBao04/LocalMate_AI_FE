import { useEffect, useState } from "react";
import { useLocation, useParams, Link, useNavigate } from "react-router-dom";
import { placeListReturnTo } from "../../components/admin/placeListReturn";
import { AdminSurface, AdminErrorState, EmptyState, LoadingState, StatusBadge } from "../../components/admin/ui";
import AdminPageHeader from "../../components/admin/AdminPageHeader";
import { ADMIN_PRIMARY_BUTTON, ADMIN_SECONDARY_BUTTON } from "../../components/admin/adminStyles";
import { adminPlaceService } from "../../services/adminPlaceService";
import { buildMapsSearchUrl } from "../../utils/googleMaps";
import { VerifiedBadge } from "../../components/admin/VerifiedBadge";
import OpeningHoursTable from "../../components/place/OpeningHoursTable";

export default function AdminPlaceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = placeListReturnTo(location);
  const [place, setPlace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // null + hoursError = không tải được; hasData false = địa điểm chưa có giờ
  const [openingHours, setOpeningHours] = useState(null);
  const [hoursError, setHoursError] = useState(false);

  useEffect(() => {
    async function loadPlace() {
      setLoading(true);
      setError(null);
      try {
        const [res, hours] = await Promise.all([
          adminPlaceService.getPlaceById(id),
          adminPlaceService.getOpeningHours(id).catch(() => null),
        ]);
        setPlace(res?.data || res);
        setOpeningHours(hours);
        setHoursError(hours == null);
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
  if (error || !place) return <div className="space-y-4"><AdminErrorState message={error || "Địa điểm không tồn tại hoặc đã bị xóa."} /><button type="button" className={ADMIN_SECONDARY_BUTTON} onClick={() => navigate(returnTo)}>Quay lại danh sách</button></div>;
  const fact = (label, value) => <div className="min-w-0 border-b border-[#DCE2EE] py-3"><dt className="text-[13px] leading-[18px] text-[#5C6B8A]">{label}</dt><dd className="mt-1 break-words text-sm font-medium text-[#0F2148]">{value ?? "Chưa cập nhật"}</dd></div>;
  return (
    <div className="space-y-6">
      <AdminPageHeader back={{to:returnTo,label:"Danh sách địa điểm"}} eyebrow="Dữ liệu Metro" title={place.name} badge={<VerifiedBadge isVerified={place.isVerified} />} description={`ID: ${place.id}`}>
        <Link to={`/admin/places/edit/${place.id}`} state={{ returnTo }} className={ADMIN_PRIMARY_BUTTON}><span aria-hidden="true" className="material-symbols-outlined text-[20px]">edit</span>Chỉnh sửa địa điểm</Link>
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
          <AdminSurface as="section"><h2 className="mb-3 text-lg font-bold leading-[26px]">Lịch giờ mở cửa</h2>
            {hoursError ? <p className="text-[#5C6B8A]">Không tải được giờ mở cửa.</p> : <OpeningHoursTable openingHours={openingHours} />}
          </AdminSurface>
        </div>
      </div>
    </div>
  );
}
