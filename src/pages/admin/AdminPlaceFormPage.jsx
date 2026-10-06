import { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Save, Loader2 } from "lucide-react";
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
  const loadPlaceData = async () => {
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
  };

  useEffect(() => {
    loadPlaceData();
  }, [id]);

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

  if (fetching) {
    return (
      <div className="grid min-h-64 place-items-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        back={{ to: "/admin/places", label: "Danh sách địa điểm" }}
        title={isEdit ? "Chỉnh sửa địa điểm" : "Thêm địa điểm mới"}
        description="Nhập thông tin chi tiết và vị trí tọa độ địa điểm dành cho Admin"
      />

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Tên địa điểm <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Ví dụ: Phở Phượng Sài Gòn"
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
                className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:bg-white transition"
              />
              {errors.name && <p className="text-xs text-red-500 mt-1 font-medium">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Danh mục <span className="text-red-500">*</span>
              </label>
              <select
                value={form.category}
                onChange={(e) => handleChange("category", e.target.value)}
                className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:bg-white transition"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Địa chỉ chi tiết <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Ví dụ: 25 Hoàng Sa, Phường Đa Kao, Quận 1"
              value={form.address}
              onChange={(e) => handleChange("address", e.target.value)}
              className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:bg-white transition"
            />
            {errors.address && <p className="text-xs text-red-500 mt-1 font-medium">{errors.address}</p>}
          </div>

          {/* Coordinate Picker Component */}
          <MapCoordinatePicker
            latitude={form.latitude}
            longitude={form.longitude}
            onChange={(lat, lng) => {
              handleChange("latitude", lat);
              handleChange("longitude", lng);
            }}
          />

          {/* Distance Warning Alert Component */}
          <ValidationAlert warning={distanceWarning} />

          {/* Price Range Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Giá từ (VNĐ)
              </label>
              <input
                type="number"
                placeholder="30000"
                value={form.estimatedCostMin}
                onChange={(e) => handleChange("estimatedCostMin", e.target.value)}
                className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:bg-white transition"
              />
              {errors.estimatedCostMin && <p className="text-xs text-red-500 mt-1 font-medium">{errors.estimatedCostMin}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Giá đến (VNĐ)
              </label>
              <input
                type="number"
                placeholder="50000"
                value={form.estimatedCostMax}
                onChange={(e) => handleChange("estimatedCostMax", e.target.value)}
                className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:bg-white transition"
              />
            </div>
          </div>

          {/* Image Upload Component */}
          <ImageUploadDropzone
            value={form.imageUrl}
            onChange={(url) => handleChange("imageUrl", url)}
            error={errors.imageUrl}
          />

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Mô tả chi tiết
            </label>
            <textarea
              rows={3}
              placeholder="Nhập mô tả về không gian, món ăn nổi bật hoặc lưu ý..."
              value={form.description}
              onChange={(e) => handleChange("description", e.target.value)}
              className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:bg-white transition"
            />
          </div>

          {/* Multi Tag Selector */}
          <MultiTagSelector
            selectedTagIds={form.selectedTagIds}
            onChange={(tags) => handleChange("selectedTagIds", tags)}
          />

          {/* Open Hours Editor */}
          <OpenHoursEditor
            value={form.openingHours}
            onChange={(hours) => handleChange("openingHours", hours)}
          />

          {/* Submit Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <Link
              to="/admin/places"
              className="px-4 py-2 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
            >
              Hủy bỏ
            </Link>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-medium text-white bg-primary hover:bg-[#17366f] rounded-xl transition shadow-sm disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isEdit ? "Cập nhật địa điểm" : "Tạo địa điểm"}
            </button>
          </div>
        </form>
      </div>

      {/* 409 Concurrency Conflict Modal */}
      <ConflictModal
        isOpen={showConflictModal}
        onClose={() => setShowConflictModal(false)}
        onReload={() => {
          setShowConflictModal(false);
          loadPlaceData();
        }}
      />
    </div>
  );
}
