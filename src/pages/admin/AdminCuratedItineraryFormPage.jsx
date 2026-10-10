import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AdminPageHeader from "../../components/admin/AdminPageHeader";
import ImageUploadDropzone from "../../components/admin/ImageUploadDropzone";
import CuratedPlacePicker from "../../components/admin/curated/CuratedPlacePicker";
import { CURATED_BASE_PATH, CURATED_LIMITS as LIMITS, formatCostRange, toFieldErrors } from "../../components/admin/curated/curatedLabels";
import { ADMIN_ICON_BUTTON, ADMIN_INPUT, ADMIN_PRIMARY_BUTTON, ADMIN_SECONDARY_BUTTON } from "../../components/admin/adminStyles";
import { AdminErrorState, AdminField, AdminSurface, EmptyState, LoadingState } from "../../components/admin/ui";
import { PLACE_CATEGORY_LABELS } from "../../constants";
import { adminCuratedItineraryService } from "../../services/adminCuratedItineraryService";
import { formatDuration } from "../../utils/formatCurrency";

const SECTION_TITLE = "mb-5 text-lg font-bold leading-[26px]";
const STOP_WARNING = "mt-1 text-xs font-semibold leading-[18px] text-amber-700";

export default function AdminCuratedItineraryFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: "", description: "", coverImageUrl: "" });
  // Chặng theo thứ tự đi: { placeId, name, category, status, isDeleted, estimatedCostMin, estimatedCostMax }
  const [stops, setStops] = useState([]);
  const [savedDuration, setSavedDuration] = useState(null);
  const [loadState, setLoadState] = useState({ loading: isEdit, error: "" });
  const [reloadCount, setReloadCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!isEdit) return undefined;
    let active = true;
    adminCuratedItineraryService.getItinerary(id)
      .then((data) => {
        if (!active) return;
        setForm({ title: data.title, description: data.description ?? "", coverImageUrl: data.coverImageUrl ?? "" });
        setStops(data.items);
        setSavedDuration(data.estimatedDurationMinutes);
        setLoadState({ loading: false, error: "" });
      })
      .catch((err) => {
        if (!active) return;
        setLoadState({
          loading: false,
          error: err?.status === 404 ? "Lịch trình mẫu không tồn tại hoặc đã bị xoá." : err?.message || "Không tải được lịch trình mẫu.",
        });
      });
    return () => { active = false; };
  }, [id, isEdit, reloadCount]);

  const title = form.title.trim();
  const description = form.description.trim();
  const deleted = stops.filter((stop) => stop.isDeleted);
  const selectedIds = useMemo(() => new Set(stops.map((stop) => stop.placeId)), [stops]);
  const costMin = stops.reduce((sum, stop) => sum + stop.estimatedCostMin, 0);
  const costMax = stops.reduce((sum, stop) => sum + stop.estimatedCostMax, 0);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const changeStops = (next) => {
    setStops(next);
    if (errors.placeIds) setErrors((prev) => ({ ...prev, placeIds: "" }));
  };

  const addStop = (place) => changeStops([...stops, {
    placeId: place.id,
    name: place.name,
    category: place.category,
    status: place.status,
    isDeleted: false,
    estimatedCostMin: place.estimatedCostMin,
    estimatedCostMax: place.estimatedCostMax,
  }]);

  const moveStop = (index, delta) => {
    const next = [...stops];
    const [moved] = next.splice(index, 1);
    next.splice(index + delta, 0, moved);
    changeStops(next);
  };

  // Cùng luật với BE để báo lỗi trước khi gửi
  const validate = () => {
    const next = {};
    if (!title) next.title = "Tiêu đề không được để trống.";
    else if (title.length > LIMITS.title) next.title = `Tiêu đề tối đa ${LIMITS.title} ký tự.`;
    if (description.length > LIMITS.description) next.description = `Mô tả tối đa ${LIMITS.description} ký tự.`;
    if (stops.length < LIMITS.minPlaces || stops.length > LIMITS.maxPlaces) {
      next.placeIds = `Lịch trình mẫu cần từ ${LIMITS.minPlaces} đến ${LIMITS.maxPlaces} địa điểm.`;
    } else if (deleted.length > 0) {
      // Chặng đang ẩn thì để BE kiểm tra: admin có thể vừa bật lại ở tab khác
      next.placeIds = `Hãy bỏ địa điểm đã bị xoá trước khi lưu: ${deleted.map((stop) => stop.name).join(", ")}.`;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    if (!validate()) {
      setFormError("Vui lòng kiểm tra lại các ô báo lỗi.");
      return;
    }
    setSubmitting(true);
    setFormError("");
    const payload = {
      title,
      description: description || null,
      coverImageUrl: form.coverImageUrl || null,
      placeIds: stops.map((stop) => stop.placeId),
    };
    try {
      const saved = isEdit
        ? await adminCuratedItineraryService.updateItinerary(id, payload)
        : await adminCuratedItineraryService.createItinerary(payload);
      // Không mở lại nút: BE không chặn trùng, bấm hai lần sẽ ra hai lịch
      navigate(CURATED_BASE_PATH, {
        state: { notice: { type: "success", message: isEdit ? `Đã lưu lịch trình mẫu "${saved.title}".` : `Đã tạo lịch trình mẫu "${saved.title}". Lịch đã hiện trên app.` } },
      });
    } catch (err) {
      const fieldErrors = err?.code === "invalid_curated_itinerary" ? toFieldErrors(err.errors) : {};
      setErrors(fieldErrors);
      if (Object.keys(fieldErrors).length > 0) setFormError("Vui lòng kiểm tra lại các ô báo lỗi.");
      else if (err?.code === "curated_itinerary_not_found") setFormError("Lịch trình mẫu này đã bị xoá, không lưu được nữa.");
      else setFormError(err?.message || "Không lưu được lịch trình mẫu. Vui lòng thử lại.");
      setSubmitting(false);
    }
  };

  const back = { to: CURATED_BASE_PATH, label: "Danh sách lịch trình mẫu" };
  const pageTitle = isEdit ? "Sửa lịch trình mẫu" : "Tạo lịch trình mẫu";

  if (loadState.loading) return <LoadingState label="Đang tải lịch trình mẫu..." />;
  if (loadState.error) {
    return (
      <div className="space-y-6">
        <AdminPageHeader back={back} title={pageTitle} />
        <AdminErrorState message={loadState.error} onRetry={() => { setLoadState({ loading: true, error: "" }); setReloadCount((count) => count + 1); }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        back={back}
        title={pageTitle}
        description="Không có bản nháp: lưu xong là lịch hiện trên app ngay. Chuyến đi người dùng đã tạo từ lịch này không bị ảnh hưởng."
      />
      <AdminSurface as="form" onSubmit={handleSubmit} className="space-y-6">
        <section className="border-b border-[#DCE2EE] pb-6">
          <h2 className={SECTION_TITLE}>Thông tin chung</h2>
          <AdminField id="curated-title" label="Tiêu đề *" error={errors.title} hint={`${title.length}/${LIMITS.title}`}>
            <input
              id="curated-title"
              type="text"
              value={form.title}
              onChange={(event) => handleChange("title", event.target.value)}
              disabled={submitting}
              aria-invalid={Boolean(errors.title)}
              aria-describedby={errors.title ? "curated-title-error curated-title-hint" : "curated-title-hint"}
              placeholder="Ví dụ: Nửa ngày khám phá Bến Thành"
              className={ADMIN_INPUT}
            />
          </AdminField>
          <AdminField className="mt-5" id="curated-description" label="Mô tả" error={errors.description} hint={`${description.length}/${LIMITS.description}`}>
            <textarea
              id="curated-description"
              rows={3}
              value={form.description}
              onChange={(event) => handleChange("description", event.target.value)}
              disabled={submitting}
              aria-invalid={Boolean(errors.description)}
              aria-describedby={errors.description ? "curated-description-error curated-description-hint" : "curated-description-hint"}
              className={`${ADMIN_INPUT} !h-auto resize-y py-3`}
            />
          </AdminField>
        </section>

        <section className="border-b border-[#DCE2EE] pb-6">
          <h2 className={SECTION_TITLE}>Ảnh bìa</h2>
          <ImageUploadDropzone subject="lịch trình mẫu" value={form.coverImageUrl} onChange={(url) => handleChange("coverImageUrl", url)} error={errors.coverImageUrl} />
        </section>

        <section className="border-b border-[#DCE2EE] pb-6">
          <h2 className="text-lg font-bold leading-[26px]">Các chặng</h2>
          <p className="mb-5 mt-2 text-sm text-[#5C6B8A]">
            Thứ tự bên dưới là thứ tự đi. Cần {LIMITS.minPlaces}–{LIMITS.maxPlaces} địa điểm đang hoạt động, tổng thời lượng không quá 16 giờ.
          </p>
          <div className="grid gap-6 xl:grid-cols-2">
            <div className="min-w-0">
              <h3 className="text-[13px] font-semibold leading-[18px] text-[#0F2148]">Đã chọn ({stops.length}/{LIMITS.maxPlaces})</h3>
              {stops.length === 0 ? (
                <EmptyState density="compact" icon="add_location_alt" title="Chưa có chặng nào" description="Chọn địa điểm ở danh sách bên cạnh." />
              ) : (
                <ol className="mt-3 space-y-2">
                  {stops.map((stop, index) => {
                    const active = stop.status === "Active" && !stop.isDeleted;
                    return (
                      <li key={stop.placeId} className={`flex items-center gap-3 rounded-[12px] border p-3 ${active ? "border-[#DCE2EE]" : "border-amber-300 bg-amber-50"}`}>
                        <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#F4F6FA] text-sm font-semibold text-[#0F2148]">{index + 1}</span>
                        <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                          <p className="font-semibold text-[#0F2148]">{stop.name}</p>
                          <p className="text-xs leading-[18px] text-[#5C6B8A]">
                            {PLACE_CATEGORY_LABELS[stop.category] ?? stop.category} · {formatCostRange(stop.estimatedCostMin, stop.estimatedCostMax)}
                          </p>
                          {stop.isDeleted ? (
                            <p className={STOP_WARNING}>Địa điểm đã bị xoá, người dùng không thấy chặng này. Bỏ ra để lưu được.</p>
                          ) : !active && (
                            <p className={STOP_WARNING}>
                              Đang ẩn hoặc chờ duyệt, người dùng không thấy chặng này.{" "}
                              <Link to={`/admin/places/${stop.placeId}`} target="_blank" rel="noreferrer" className="underline">Mở địa điểm</Link>
                              {" "}để bật lại rồi lưu, hoặc bỏ ra.
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0">
                          <button type="button" aria-label={`Đưa ${stop.name} lên trước`} disabled={submitting || index === 0} onClick={() => moveStop(index, -1)} className={ADMIN_ICON_BUTTON}>
                            <span aria-hidden="true" className="material-symbols-outlined text-[20px]">arrow_upward</span>
                          </button>
                          <button type="button" aria-label={`Đưa ${stop.name} xuống sau`} disabled={submitting || index === stops.length - 1} onClick={() => moveStop(index, 1)} className={ADMIN_ICON_BUTTON}>
                            <span aria-hidden="true" className="material-symbols-outlined text-[20px]">arrow_downward</span>
                          </button>
                          <button type="button" aria-label={`Bỏ ${stop.name} khỏi lịch trình`} disabled={submitting} onClick={() => changeStops(stops.filter((item) => item.placeId !== stop.placeId))} className={`${ADMIN_ICON_BUTTON} hover:!text-red-700`}>
                            <span aria-hidden="true" className="material-symbols-outlined text-[20px]">close</span>
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
              {errors.placeIds && <p role="alert" className="mt-3 text-xs leading-[18px] text-red-700 [overflow-wrap:anywhere]">{errors.placeIds}</p>}
              {stops.length > 0 && (
                <dl className="mt-4 grid grid-cols-2 gap-4 rounded-[12px] bg-[#F8FAFC] p-4 text-sm">
                  <div>
                    <dt className="text-xs text-[#5C6B8A]">Chi phí ước tính</dt>
                    <dd className="mt-1 font-semibold text-[#0F2148]">{formatCostRange(costMin, costMax)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[#5C6B8A]">Thời lượng</dt>
                    <dd className="mt-1 font-semibold text-[#0F2148]">{savedDuration != null ? `${formatDuration(savedDuration)} (bản đang lưu)` : "Tính khi lưu"}</dd>
                  </div>
                  <p className="col-span-2 text-xs leading-[18px] text-[#5C6B8A]">Thời lượng và chi phí trên app chỉ cập nhật khi bấm lưu. Nếu vừa đổi giá hoặc ẩn địa điểm trong lịch này, hãy lưu lại để app hiện số mới.</p>
                </dl>
              )}
            </div>
            <CuratedPlacePicker selectedIds={selectedIds} full={stops.length >= LIMITS.maxPlaces} disabled={submitting} onAdd={addStop} />
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-end gap-3">
          {formError && <p role="alert" className="min-w-0 flex-1 basis-full text-sm text-red-700 sm:basis-auto">{formError}</p>}
          <Link to={CURATED_BASE_PATH} className={ADMIN_SECONDARY_BUTTON}>Hủy bỏ</Link>
          <button type="submit" disabled={submitting} className={ADMIN_PRIMARY_BUTTON}>
            <span aria-hidden="true" className={`material-symbols-outlined text-[20px] ${submitting ? "animate-spin motion-reduce:animate-none" : ""}`}>{submitting ? "progress_activity" : "save"}</span>
            {isEdit ? "Lưu thay đổi" : "Tạo lịch trình mẫu"}
          </button>
        </div>
      </AdminSurface>
    </div>
  );
}
