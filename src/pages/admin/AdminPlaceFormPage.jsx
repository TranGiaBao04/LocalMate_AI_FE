import { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate, useParams, Link } from "react-router-dom";
import { AdminSurface, AdminField, LoadingState, NoticeBanner } from "../../components/admin/ui";
import { ADMIN_INPUT, ADMIN_SELECT, ADMIN_PRIMARY_BUTTON, ADMIN_SECONDARY_BUTTON } from "../../components/admin/adminStyles";
import AdminPageHeader from "../../components/admin/AdminPageHeader";
import { adminPlaceService } from "../../services/adminPlaceService";
import MapCoordinatePicker from "../../components/admin/MapCoordinatePicker";
import ValidationAlert from "../../components/admin/ValidationAlert";
import ImageUploadDropzone from "../../components/admin/ImageUploadDropzone";
import OpenHoursEditor from "../../components/admin/OpenHoursEditor";
import {
  emptyHours,
  fromOpeningHours,
  mapServerHoursErrors,
  toSaveDays,
  validateHours,
} from "../../components/admin/openingHoursRows";
import { placeListReturnTo } from "../../components/admin/placeListReturn";
import MultiTagSelector from "../../components/admin/MultiTagSelector";
import ConflictModal from "../../components/admin/ConflictModal";

const CATEGORIES = [
  { value: "Food", label: "Ăn uống (Food)" },
  { value: "Cafe", label: "Cà phê (Cafe)" },
  { value: "Culture", label: "Văn hóa (Culture)" },
  { value: "CheckIn", label: "Sống ảo (CheckIn)" },
];

export default function AdminPlaceFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = placeListReturnTo(location);
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [form, setForm] = useState({
    name: "",
    address: "",
    category: "Food",
    latitude: 10.7769,
    longitude: 106.7009,
    estimatedCostMin: "",
    estimatedCostMax: "",
    description: "",
    imageUrl: "",
    selectedTagIds: [],
  });

  // Giờ mở cửa lưu bằng API riêng (PUT .../opening-hours, ghi đè cả tuần), không nằm trong body tạo/sửa
  const [hours, setHours] = useState(emptyHours);
  // Bản đang có trên server: chỉ gọi PUT khi admin đổi giờ, tránh ghi đè giờ người khác vừa lưu
  const [savedHours, setSavedHours] = useState(emptyHours);
  const [hoursErrors, setHoursErrors] = useState({});
  const [hoursLoadError, setHoursLoadError] = useState("");
  // Tạo địa điểm xong mà lưu giờ lỗi: mở trang sửa kèm lời nhắn và giờ admin vừa nhập
  const [notice, setNotice] = useState(() => location.state?.notice ?? null);
  const [pendingHours, setPendingHours] = useState(() => location.state?.pendingHours ?? null);

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [errors, setErrors] = useState({});
  const [distanceWarning, setDistanceWarning] = useState("");
  const [showConflictModal, setShowConflictModal] = useState(false);

  // Load existing place if editing
  const loadPlaceData = useCallback(async () => {
    if (!isEdit) return;
    setFetching(true);
    try {
      const [place, openingHours] = await Promise.all([
        adminPlaceService.getPlaceById(id),
        // Không tải được giờ thì khoá khối giờ, không để admin lưu bảng trống đè lên dữ liệu cũ
        adminPlaceService.getOpeningHours(id).catch(() => null),
      ]);
      if (place) {
        setForm({
          name: place.name || "",
          address: place.address || "",
          category: place.category || "Food",
          latitude: place.latitude || 10.7769,
          longitude: place.longitude || 106.7009,
          estimatedCostMin: place.estimatedCostMin ?? "",
          estimatedCostMax: place.estimatedCostMax ?? "",
          description: place.description || "",
          imageUrl: place.imageUrl || "",
          selectedTagIds: place.tagIds || [],
        });
      }
      if (openingHours) {
        const rows = fromOpeningHours(openingHours);
        setSavedHours(rows);
        setHours(pendingHours ?? rows);
        setHoursLoadError("");
      } else {
        setHoursLoadError("Không tải được giờ mở cửa. Tải lại trang để chỉnh giờ mở cửa.");
      }
    } catch (err) {
      alert("Lỗi tải thông tin địa điểm: " + err.message);
      navigate(returnTo);
    } finally {
      setFetching(false);
    }
  }, [id, isEdit, navigate, pendingHours, returnTo]);

  useEffect(() => {
    loadPlaceData();
  }, [loadPlaceData]);

  // Check PostGIS distance warning (>1.5km) when coordinates change
  useEffect(() => {
    const handler = setTimeout(async () => {
      if (form.latitude && form.longitude) {
        try {
          const res = await adminPlaceService.validateDistance({
            latitude: form.latitude,
            longitude: form.longitude,
          });
          if (res?.hasWarning && res?.warningMessage) {
            setDistanceWarning(res.warningMessage);
          } else {
            setDistanceWarning("");
          }
        } catch {
          setDistanceWarning("");
        }
      }
    }, 400);

    return () => clearTimeout(handler);
  }, [form.latitude, form.longitude]);

  const handleChange = (field, val) => {
    setForm((prev) => ({ ...prev, [field]: val }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!form.name.trim()) newErrors.name = "Tên địa điểm không được để trống.";
    if (!form.address.trim()) newErrors.address = "Địa chỉ không được để trống.";
    if (!form.imageUrl) newErrors.imageUrl = "Vui lòng tải ảnh đại diện cho địa điểm.";

    if (form.estimatedCostMin && form.estimatedCostMax) {
      if (Number(form.estimatedCostMin) > Number(form.estimatedCostMax)) {
        newErrors.estimatedCostMin = "Giá tối thiểu không được lớn hơn giá tối đa.";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formOk = validateForm();
    const hoursValidation = validateHours(hours);
    setHoursErrors(hoursValidation);
    if (!formOk || Object.keys(hoursValidation).length > 0) return;

    const days = toSaveDays(hours);
    const hoursChanged = !hoursLoadError && JSON.stringify(days) !== JSON.stringify(toSaveDays(savedHours));
    setLoading(true);
    setNotice(null);
    const payload = {
      name: form.name.trim(),
      address: form.address.trim(),
      category: form.category,
      latitude: form.latitude,
      longitude: form.longitude,
      estimatedCostMin: form.estimatedCostMin ? Number(form.estimatedCostMin) : 0,
      estimatedCostMax: form.estimatedCostMax ? Number(form.estimatedCostMax) : 0,
      description: form.description.trim() || null,
      imageUrl: form.imageUrl,
    };

    let placeId = id;
    try {
      if (isEdit) await adminPlaceService.updatePlace(id, payload);
      else placeId = (await adminPlaceService.createPlace(payload)).id;
    } catch (err) {
      if (err.status === 409 || err.code === "concurrency_conflict") {
        setShowConflictModal(true);
      } else {
        alert(err.message || "Lưu thông tin địa điểm thất bại.");
      }
      setLoading(false);
      return;
    }

    if (hoursChanged) {
      try {
        await adminPlaceService.saveOpeningHours(placeId, days);
      } catch (err) {
        const failed = {
          type: "error",
          message: `Đã lưu thông tin địa điểm nhưng chưa lưu được giờ mở cửa: ${err.message || "lỗi không xác định"}. Hãy kiểm tra rồi bấm lưu lại.`,
        };
        setNotice(failed);
        setHoursErrors(mapServerHoursErrors(err.errors, days));
        setLoading(false);
        if (!isEdit) {
          // Địa điểm đã được tạo: sang trang sửa để lưu lại giờ, bấm lưu lần nữa không tạo trùng
          setPendingHours(hours);
          navigate(`/admin/places/edit/${placeId}`, { replace: true, state: { notice: failed, pendingHours: hours, returnTo } });
        }
        return;
      }
    }
    navigate(returnTo);
  };

  if (fetching) return <LoadingState label="Đang tải thông tin địa điểm..." />;
  return (
    <div className="space-y-6">
      <AdminPageHeader back={{to:returnTo,label:"Danh sách địa điểm"}} title={isEdit ? "Chỉnh sửa địa điểm" : "Thêm địa điểm mới"} description="Thông tin, vị trí và thời gian hoạt động của địa điểm" />
      <NoticeBanner notice={notice} onClose={() => setNotice(null)} />
      <AdminSurface as="form" onSubmit={handleSubmit} className="space-y-6">
        <section className="border-b border-[#DCE2EE] pb-6">
          <h2 className="mb-5 text-lg font-bold leading-[26px]">Thông tin cơ bản</h2>
          <div className="grid gap-5 md:grid-cols-2">
            <AdminField id="place-name" label="Tên địa điểm *" error={errors.name}><input id="place-name" type="text" placeholder="Ví dụ: Phở Phượng Sài Gòn" value={form.name} onChange={(e) => handleChange("name",e.target.value)} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "place-name-error" : undefined} className={ADMIN_INPUT} /></AdminField>
            <AdminField id="place-category" label="Danh mục *"><select id="place-category" value={form.category} onChange={(e) => handleChange("category",e.target.value)} className={ADMIN_SELECT}>{CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></AdminField>
          </div>
          <AdminField className="mt-5" id="place-address" label="Địa chỉ chi tiết *" error={errors.address}><input id="place-address" type="text" placeholder="Ví dụ: 25 Hoàng Sa, Phường Đa Kao, Quận 1" value={form.address} onChange={(e) => handleChange("address",e.target.value)} aria-invalid={Boolean(errors.address)} aria-describedby={errors.address ? "place-address-error" : undefined} className={ADMIN_INPUT} /></AdminField>
          <AdminField className="mt-5" id="place-description" label="Mô tả chi tiết"><textarea id="place-description" rows={4} placeholder="Nhập mô tả về không gian, món ăn nổi bật hoặc lưu ý..." value={form.description} onChange={(e) => handleChange("description",e.target.value)} className={`${ADMIN_INPUT} !h-auto py-3`} /></AdminField>
        </section>
        <section className="border-b border-[#DCE2EE] pb-6"><h2 className="mb-5 text-lg font-bold leading-[26px]">Vị trí & Metro</h2><MapCoordinatePicker latitude={form.latitude} longitude={form.longitude} onChange={(lat,lng) => { handleChange("latitude",lat); handleChange("longitude",lng); }} /><ValidationAlert warning={distanceWarning} /></section>
        <section className="border-b border-[#DCE2EE] pb-6"><h2 className="mb-5 text-lg font-bold leading-[26px]">Chi phí</h2><div className="grid gap-5 sm:grid-cols-2">
          <AdminField id="place-min" label="Giá từ (VNĐ)" error={errors.estimatedCostMin}><input id="place-min" type="number" placeholder="30000" value={form.estimatedCostMin} onChange={(e) => handleChange("estimatedCostMin",e.target.value)} aria-invalid={Boolean(errors.estimatedCostMin)} aria-describedby={errors.estimatedCostMin ? "place-min-error" : undefined} className={ADMIN_INPUT} /></AdminField>
          <AdminField id="place-max" label="Giá đến (VNĐ)"><input id="place-max" type="number" placeholder="50000" value={form.estimatedCostMax} onChange={(e) => handleChange("estimatedCostMax",e.target.value)} className={ADMIN_INPUT} /></AdminField>
        </div></section>
        <section className="border-b border-[#DCE2EE] pb-6"><h2 className="mb-5 text-lg font-bold leading-[26px]">Ảnh địa điểm</h2><ImageUploadDropzone value={form.imageUrl} onChange={(url) => handleChange("imageUrl",url)} error={errors.imageUrl} /></section>
        <section className="border-b border-[#DCE2EE] pb-6"><h2 className="mb-5 text-lg font-bold leading-[26px]">Thẻ phân loại</h2><MultiTagSelector selectedTagIds={form.selectedTagIds} onChange={(tags) => handleChange("selectedTagIds",tags)} /></section>
        <section className="space-y-4 border-b border-[#DCE2EE] pb-6">
          <h2 className="text-lg font-bold leading-[26px]">Giờ mở cửa</h2>
          {hoursLoadError && <NoticeBanner notice={{ type: "warning", message: hoursLoadError }} />}
          <OpenHoursEditor
            value={hours}
            onChange={(rows) => { setHours(rows); setHoursErrors({}); }}
            errors={hoursErrors}
            disabled={Boolean(hoursLoadError)}
          />
        </section>
        <div className="flex flex-wrap justify-end gap-3 border-t border-[#DCE2EE] pt-5">
          <Link to={returnTo} className={ADMIN_SECONDARY_BUTTON}>Hủy bỏ</Link>
          <button type="submit" disabled={loading} className={ADMIN_PRIMARY_BUTTON}><span aria-hidden="true" className={`material-symbols-outlined text-[20px] ${loading ? "animate-spin motion-reduce:animate-none" : ""}`}>{loading ? "progress_activity" : "save"}</span>{isEdit ? "Cập nhật địa điểm" : "Tạo địa điểm"}</button>
        </div>
      </AdminSurface>
      <ConflictModal isOpen={showConflictModal} onClose={() => setShowConflictModal(false)} onReload={() => { setShowConflictModal(false); loadPlaceData(); }} />
    </div>
  );
}
