import { useState } from "react";
import { UploadCloud, X, Loader2, Image as ImageIcon } from "lucide-react";
import { adminPlaceService } from "../../services/adminPlaceService";

export default function ImageUploadDropzone({ value, onChange, error }) {
  const [loading, setLoading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const handleFileChange = async (file) => {
    if (!file) return;

    // Validate size < 5MB
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Dung lượng ảnh vượt quá 5MB. Vui lòng chọn ảnh nhỏ hơn.");
      return;
    }

    // Validate extension
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["jpg", "jpeg", "png", "webp"].includes(ext)) {
      setUploadError("Định dạng ảnh không hỗ trợ. Chỉ nhận file .jpg, .png, .webp.");
      return;
    }

    setUploadError("");
    setLoading(true);

    try {
      const res = await adminPlaceService.uploadImage(file);
      if (res?.url) {
        onChange(res.url);
      }
    } catch (err) {
      setUploadError(err.message || "Upload ảnh thất bại. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold text-gray-700">
        Ảnh đại diện địa điểm <span className="text-red-500">*</span>
      </label>

      {value ? (
        <div className="relative group w-full h-44 rounded-xl border border-gray-200 overflow-hidden bg-gray-50">
          <img
            src={value}
            alt="Preview địa điểm"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => onChange("")}
              className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-full transition shadow"
              title="Xóa ảnh"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <label className="relative flex flex-col items-center justify-center w-full h-44 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-primary hover:bg-blue-50/30 transition bg-gray-50">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => handleFileChange(e.target.files?.[0])}
            disabled={loading}
          />
          {loading ? (
            <div className="flex flex-col items-center gap-2 text-primary">
              <Loader2 className="w-8 h-8 animate-spin" />
              <span className="text-xs font-medium">Đang tải ảnh lên Cloudinary...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5 text-gray-500">
              <UploadCloud className="w-8 h-8 text-gray-400" />
              <span className="text-xs font-medium text-gray-700">Kéo thả hoặc click để chọn ảnh</span>
              <span className="text-[11px] text-gray-400">JPG, PNG, WEBP tối đa 5MB</span>
            </div>
          )}
        </label>
      )}

      {(uploadError || error) && (
        <p className="text-xs text-red-500 font-medium">{uploadError || error}</p>
      )}
    </div>
  );
}
