import { useState } from "react";
import { LoadingState } from "./ui";
import { ADMIN_DESTRUCTIVE_BUTTON } from "./adminStyles";
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
    <div className="space-y-3">
      {value ? <div className="space-y-3"><img src={value} alt="Preview địa điểm" className="max-h-64 w-full rounded-[8px] border border-[#DCE2EE] object-contain" /><button type="button" onClick={() => onChange("")} className={ADMIN_DESTRUCTIVE_BUTTON}><span aria-hidden="true" className="material-symbols-outlined text-[20px]">delete</span>Xóa ảnh</button></div> :
        <label className="relative flex min-h-44 cursor-pointer flex-col items-center justify-center gap-3 rounded-[12px] border-2 border-dashed border-[#DCE2EE] bg-[#F8FAFC] p-5 text-center focus-within:border-[#2C56A8] focus-within:ring-2 focus-within:ring-[#2C56A8]/20">
          <input id="place-image" aria-label="Ảnh đại diện địa điểm" aria-invalid={Boolean(uploadError || error)} aria-describedby={uploadError || error ? "place-image-error" : "place-image-hint"} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => handleFileChange(e.target.files?.[0])} disabled={loading} />
          {loading ? <LoadingState variant="inline" label="Đang tải ảnh lên Cloudinary..." /> : <><span aria-hidden="true" className="material-symbols-outlined text-[32px] text-[#2C56A8]">add_photo_alternate</span><span className="text-sm font-semibold text-[#0F2148]">Chọn ảnh đại diện địa điểm</span><span id="place-image-hint" className="text-xs text-[#5C6B8A]">JPG, PNG, WEBP tối đa 5MB</span></>}
        </label>}
      {(uploadError || error) && <p id="place-image-error" role="alert" className="text-xs text-red-700">{uploadError || error}</p>}
    </div>
  );
}
