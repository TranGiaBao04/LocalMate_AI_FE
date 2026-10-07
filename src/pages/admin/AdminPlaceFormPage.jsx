import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { AdminSurface, AdminField, LoadingState } from "../../components/admin/ui";
import { ADMIN_INPUT, ADMIN_SELECT, ADMIN_PRIMARY_BUTTON, ADMIN_SECONDARY_BUTTON } from "../../components/admin/adminStyles";
import AdminPageHeader from "../../components/admin/AdminPageHeader";
import { adminPlaceService } from "../../services/adminPlaceService";
import MapCoordinatePicker from "../../components/admin/MapCoordinatePicker";
import ValidationAlert from "../../components/admin/ValidationAlert";
import ImageUploadDropzone from "../../components/admin/ImageUploadDropzone";
import OpenHoursEditor from "../../components/admin/OpenHoursEditor";
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
    openingHours: [],
    selectedTagIds: [],
  });

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
      const place = await adminPlaceService.getPlaceById(id);
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
          openingHours: place.openingHours || [],
          selectedTagIds: place.tagIds || [],
        });
      }
    } catch (err) {
      alert("Lỗi tải thông tin địa điểm: " + err.message);
      navigate("/admin/places");
    } finally {
      setFetching(false);
    }
  }, [id, isEdit, navigate]);

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
    if (!validateForm()) return;

    setLoading(true);
    try {
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
        openingHours: form.openingHours,
      };

      if (isEdit) {
        await adminPlaceService.updatePlace(id, payload);
      } else {
        await adminPlaceService.createPlace(payload);
      }

      navigate("/admin/places");
    } catch (err) {
      if (err.status === 409 || err.code === "concurrency_conflict") {
        setShowConflictModal(true);
      } else {
        alert(err.message || "Lưu thông tin địa điểm thất bại.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return <LoadingState label="Đang tải thông tin địa điểm..." />;
  return (
    <div className="space-y-6">
      <AdminPageHeader back={{to:"/admin/places",label:"Danh sách địa điểm"}} title={isEdit ? "Chỉnh sửa địa điểm" : "Thêm địa điểm mới"} description="Thông tin, vị trí và thời gian hoạt động của địa điểm" />
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
        <section className="border-b border-[#DCE2EE] pb-6"><h2 className="mb-5 text-lg font-bold leading-[26px]">Thời gian hoạt động</h2><OpenHoursEditor value={form.openingHours} onChange={(hours) => handleChange("openingHours",hours)} /></section>
        <div className="flex flex-wrap justify-end gap-3 border-t border-[#DCE2EE] pt-5">
          <Link to="/admin/places" className={ADMIN_SECONDARY_BUTTON}>Hủy bỏ</Link>
          <button type="submit" disabled={loading} className={ADMIN_PRIMARY_BUTTON}><span aria-hidden="true" className={`material-symbols-outlined text-[20px] ${loading ? "animate-spin motion-reduce:animate-none" : ""}`}>{loading ? "progress_activity" : "save"}</span>{isEdit ? "Cập nhật địa điểm" : "Tạo địa điểm"}</button>
        </div>
      </AdminSurface>
      <ConflictModal isOpen={showConflictModal} onClose={() => setShowConflictModal(false)} onReload={() => { setShowConflictModal(false); loadPlaceData(); }} />
    </div>
  );
}
