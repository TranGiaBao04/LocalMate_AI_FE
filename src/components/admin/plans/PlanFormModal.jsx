import { useState } from "react";
import BenefitEditor from "./BenefitEditor";
import { adminPlanService } from "../../../services/adminPlanService";
import { formatPlanPrice } from "../../../utils/subscriptionUtils";

const CODE_REGEX = /^[A-Z][A-Z0-9_]{0,63}$/;

function PlanFormContent({ mode, plan, onClose, onSuccess }) {
  const isEdit = mode === "edit";
  const isFree = isEdit && plan?.code === "FREE";

  const cv = plan?.currentVersion;
  const cvFeatureIds = Array.isArray(cv?.features)
    ? cv.features.map((f) => f.id)
    : Array.isArray(plan?.featureIds)
      ? plan.featureIds
      : [];

  const [form, setForm] = useState(() => ({
    code: isEdit ? (plan?.code || "") : "",
    name: isEdit ? (plan?.name || "") : "",
    entitlementPriority: isEdit ? (plan?.entitlementPriority ?? 10) : 10,
    price: isEdit ? (isFree ? 0 : (cv?.price ?? 0)) : 50000,
    durationDays: isEdit ? (isFree ? null : (cv?.durationDays ?? 30)) : 30,
    generateLimit: isEdit ? (cv?.generateLimit ?? 0) : 10,
    generateUnlimited: isEdit ? (cv?.generateLimit == null) : false,
    savedTripLimit: isEdit ? (cv?.savedTripLimit ?? 0) : 5,
    savedTripUnlimited: isEdit ? (cv?.savedTripLimit == null) : false,
    featureIds: isEdit ? cvFeatureIds : [],
  }));

  const [fieldErrors, setFieldErrors] = useState({});
  const [generalError, setGeneralError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validateClient = () => {
    const errors = {};

    if (!isEdit) {
      const trimmedCode = form.code.trim().toUpperCase();
      if (!trimmedCode) {
        errors.code = "Mã gói dịch vụ không được để trống.";
      } else if (!CODE_REGEX.test(trimmedCode)) {
        errors.code = "Mã gói phải viết hoa, bắt đầu bằng chữ cái, tối đa 64 ký tự (ví dụ: TRIP_PASS, VIP_MONTHLY).";
      }

      const numPriority = Number(form.entitlementPriority);
      if (
        form.entitlementPriority === "" ||
        form.entitlementPriority == null ||
        Number.isNaN(numPriority) ||
        numPriority < 0 ||
        !Number.isInteger(numPriority)
      ) {
        errors.entitlementPriority = "Độ ưu tiên phải là số nguyên không âm (>= 0).";
      }
    }

    if (!form.name.trim()) {
      errors.name = "Tên gói không được để trống.";
    } else if (form.name.trim().length > 200) {
      errors.name = "Tên gói không được vượt quá 200 ký tự.";
    }

    if (isFree) {
      // Free plan has fixed price 0 and no duration (null)
    } else {
      const numPrice = Number(form.price);
      if (
        form.price === "" ||
        form.price == null ||
        Number.isNaN(numPrice) ||
        numPrice <= 0 ||
        !Number.isInteger(numPrice)
      ) {
        errors.price = "Giá gói trả phí phải là số nguyên dương VND (ví dụ: 19000, 59000).";
      }

      const numDuration = Number(form.durationDays);
      if (
        form.durationDays === "" ||
        form.durationDays == null ||
        Number.isNaN(numDuration) ||
        numDuration <= 0 ||
        !Number.isInteger(numDuration)
      ) {
        errors.durationDays = "Thời hạn gói trả phí là bắt buộc và phải là số ngày nguyên dương (> 0).";
      }
    }

    if (!form.generateUnlimited) {
      const numGen = Number(form.generateLimit);
      if (
        form.generateLimit === "" ||
        form.generateLimit == null ||
        Number.isNaN(numGen) ||
        numGen < 0 ||
        !Number.isInteger(numGen)
      ) {
        errors.generateLimit = "Hạn mức tạo AI phải là số nguyên không âm (>= 0) hoặc chọn Không giới hạn.";
      }
    }

    if (!form.savedTripUnlimited) {
      const numTrip = Number(form.savedTripLimit);
      if (
        form.savedTripLimit === "" ||
        form.savedTripLimit == null ||
        Number.isNaN(numTrip) ||
        numTrip < 0 ||
        !Number.isInteger(numTrip)
      ) {
        errors.savedTripLimit = "Hạn mức lưu chuyến phải là số nguyên không âm (>= 0) hoặc chọn Không giới hạn.";
      }
    }

    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGeneralError("");

    const clientErrors = validateClient();
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      return;
    }

    try {
      setSubmitting(true);

      if (isEdit) {
        // UpdateAdminPlanRequest: ONLY send allowed properties!
        // DO NOT send code, entitlementPriority, isSystem, id, etc.
        const updatePayload = {
          name: form.name.trim(),
          price: isFree ? 0 : Number(form.price),
          durationDays: isFree ? null : Number(form.durationDays),
          generateLimit: form.generateUnlimited ? null : Number(form.generateLimit),
          savedTripLimit: form.savedTripUnlimited ? null : Number(form.savedTripLimit),
          featureIds: form.featureIds || [],
        };

        const result = await adminPlanService.updatePlan(plan.id, updatePayload);
        onSuccess?.(result, "Cập nhật gói dịch vụ thành công.");
      } else {
        // CreateAdminPlanRequest:
        const createPayload = {
          code: form.code.trim().toUpperCase(),
          name: form.name.trim(),
          entitlementPriority: Number(form.entitlementPriority),
          price: Number(form.price),
          durationDays: Number(form.durationDays),
          generateLimit: form.generateUnlimited ? null : Number(form.generateLimit),
          savedTripLimit: form.savedTripUnlimited ? null : Number(form.savedTripLimit),
          featureIds: form.featureIds || [],
        };

        const result = await adminPlanService.createPlan(createPayload);
        onSuccess?.(result, "Tạo gói dịch vụ mới thành công (trạng thái ban đầu: Tạm dừng).");
      }
      onClose();
    } catch (err) {
      // Handle known conflict / validation error codes
      if (err?.code === "plan_code_exists") {
        setFieldErrors((prev) => ({ ...prev, code: "Mã gói đã tồn tại. Vui lòng chọn mã khác." }));
      } else if (err?.code === "plan_priority_exists") {
        setFieldErrors((prev) => ({ ...prev, entitlementPriority: "Độ ưu tiên này đã được gán cho một gói khác." }));
      } else if (err?.code === "system_plan_locked") {
        setGeneralError("Gói hệ thống không cho phép sửa đổi các trường cốt lõi.");
      } else if (err?.code === "invalid_plan_data" || err?.errors) {
        const mappedErrors = {};
        if (err.errors) {
          Object.entries(err.errors).forEach(([field, msgs]) => {
            const normalizedField = field.charAt(0).toLowerCase() + field.slice(1);
            mappedErrors[normalizedField] = Array.isArray(msgs) ? msgs.join(" ") : msgs;
          });
        }
        setFieldErrors(mappedErrors);
        setGeneralError(err.message || "Dữ liệu nhập vào chưa hợp lệ.");
      } else {
        setGeneralError(err?.message || "Đã xảy ra lỗi khi lưu thông tin gói dịch vụ.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-form-title"
      className="my-auto w-full max-w-2xl rounded-2xl bg-white shadow-2xl transition"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-[#1d3e82]">
            <span className="material-symbols-outlined text-[22px]">
              {isEdit ? "edit_note" : "add_box"}
            </span>
          </div>
          <div>
            <h2 id="plan-form-title" className="text-lg font-bold text-slate-900">
              {isEdit ? `Chỉnh sửa gói: ${plan?.name}` : "Tạo gói dịch vụ mới"}
            </h2>
            <p className="text-xs text-slate-500">
              {isEdit
                ? `Mã: ${plan?.code} · Phiên bản hiện tại: v${plan?.currentVersion?.versionNumber ?? 1}`
                : "Thiết lập thông số thương mại và quyền lợi cho gói cước mới"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
          aria-label="Đóng"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>

      {/* Form Body */}
      <form onSubmit={handleSubmit}>
        <div className="max-h-[calc(100vh-200px)] space-y-5 overflow-y-auto px-6 py-5">
          {generalError && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-700"
            >
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span className="flex-1 font-medium">{generalError}</span>
            </div>
          )}

          {isEdit && (
            <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3.5 text-xs text-slate-600">
              <div className="flex items-start gap-2.5">
                <span className="material-symbols-outlined mt-0.5 text-[18px] text-[#1d3e82]">info</span>
                <div className="space-y-1 leading-relaxed">
                  <p className="font-semibold text-slate-800">Cơ chế quản lý phiên bản (Immutable Versioning):</p>
                  <p>
                    Mọi thay đổi về giá, thời hạn, hạn mức hoặc tính năng sẽ tự động phát hành phiên bản mới.
                    Người dùng đang đăng ký gói hiện tại vẫn được bảo lưu trọn vẹn quyền lợi cũ đến hết chu kỳ, không bị thay đổi hồi tố.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Row 1: Code & Priority (Create Only) */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Mã gói (Code) <span className="text-rose-500">*</span>
              </label>
              {isEdit ? (
                <div className="mt-1.5 flex h-11 items-center justify-between rounded-xl border border-slate-200 bg-slate-100 px-3.5 text-sm font-semibold font-mono text-slate-700">
                  <span>{plan?.code}</span>
                  <span className="rounded bg-slate-200 px-2 py-0.5 text-[10px] uppercase text-slate-600">
                    Cố định
                  </span>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => handleChange("code", e.target.value.toUpperCase().replace(/\s+/g, "_"))}
                    placeholder="VD: PRO_YEARLY, TRIP_PASS"
                    maxLength={64}
                    className={`mt-1.5 h-11 w-full rounded-xl border px-3.5 font-mono text-sm uppercase outline-none transition focus:ring-4 ${
                      fieldErrors.code
                        ? "border-rose-300 bg-rose-50/30 focus:border-rose-400 focus:ring-rose-100"
                        : "border-slate-200 bg-slate-50 focus:border-blue-300 focus:bg-white focus:ring-blue-100/60"
                    }`}
                  />
                  {fieldErrors.code ? (
                    <p className="mt-1 text-xs text-rose-600">{fieldErrors.code}</p>
                  ) : (
                    <p className="mt-1 text-[11px] text-slate-400">
                      Bắt đầu bằng chữ in hoa, chỉ chứa [A-Z, 0-9, _].
                    </p>
                  )}
                </>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Độ ưu tiên quyền hạn <span className="text-rose-500">*</span>
              </label>
              {isEdit ? (
                <div className="mt-1.5 flex h-11 items-center justify-between rounded-xl border border-slate-200 bg-slate-100 px-3.5 text-sm font-semibold text-slate-700">
                  <span>{plan?.entitlementPriority}</span>
                  <span className="rounded bg-slate-200 px-2 py-0.5 text-[10px] uppercase text-slate-600">
                    Cố định
                  </span>
                </div>
              ) : (
                <>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={form.entitlementPriority}
                    onChange={(e) => handleChange("entitlementPriority", e.target.value)}
                    placeholder="10, 20, 30..."
                    className={`mt-1.5 h-11 w-full rounded-xl border px-3.5 text-sm outline-none transition focus:ring-4 ${
                      fieldErrors.entitlementPriority
                        ? "border-rose-300 bg-rose-50/30 focus:border-rose-400 focus:ring-rose-100"
                        : "border-slate-200 bg-slate-50 focus:border-blue-300 focus:bg-white focus:ring-blue-100/60"
                    }`}
                  />
                  {fieldErrors.entitlementPriority ? (
                    <p className="mt-1 text-xs text-rose-600">{fieldErrors.entitlementPriority}</p>
                  ) : (
                    <p className="mt-1 text-[11px] text-slate-400">
                      Số nguyên không âm; số càng cao ưu tiên càng lớn.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Row 2: Name */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
              Tên hiển thị gói <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="VD: Gói Khám Phá Nâng Cao, Membership 30 Ngày"
              maxLength={200}
              className={`mt-1.5 h-11 w-full rounded-xl border px-3.5 text-sm outline-none transition focus:ring-4 ${
                fieldErrors.name
                  ? "border-rose-300 bg-rose-50/30 focus:border-rose-400 focus:ring-rose-100"
                  : "border-slate-200 bg-slate-50 focus:border-blue-300 focus:bg-white focus:ring-blue-100/60"
              }`}
            />
            {fieldErrors.name && (
              <p className="mt-1 text-xs text-rose-600">{fieldErrors.name}</p>
            )}
          </div>

          {/* Row 3: Price & Duration */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Giá bán (VND) <span className="text-rose-500">*</span>
              </label>
              {isFree ? (
                <div className="mt-1.5 flex h-11 items-center justify-between rounded-xl border border-slate-200 bg-slate-100 px-3.5 text-sm font-semibold text-slate-700">
                  <span>0 VND (Miễn phí)</span>
                  <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                    Mặc định hệ thống
                  </span>
                </div>
              ) : (
                <>
                  <div className="relative mt-1.5">
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={form.price}
                      onChange={(e) => handleChange("price", e.target.value)}
                      placeholder="59000"
                      className={`h-11 w-full rounded-xl border pl-3.5 pr-14 text-sm outline-none transition focus:ring-4 ${
                        fieldErrors.price
                          ? "border-rose-300 bg-rose-50/30 focus:border-rose-400 focus:ring-rose-100"
                          : "border-slate-200 bg-slate-50 focus:border-blue-300 focus:bg-white focus:ring-blue-100/60"
                      }`}
                    />
                    <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                      VND
                    </span>
                  </div>
                  {fieldErrors.price ? (
                    <p className="mt-1 text-xs text-rose-600">{fieldErrors.price}</p>
                  ) : (
                    <p className="mt-1 text-[11px] text-slate-500">
                      Hiển thị: <strong className="text-slate-700">{formatPlanPrice(Number(form.price) || 0)}</strong>
                    </p>
                  )}
                </>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Thời hạn hiệu lực (Ngày) {!isFree && <span className="text-rose-500">*</span>}
              </label>
              {isFree ? (
                <div className="mt-1.5 flex h-11 items-center rounded-xl border border-slate-200 bg-slate-100 px-3.5 text-sm font-semibold text-slate-700">
                  <span>Không áp dụng (Gói mặc định, không có thời hạn mua)</span>
                </div>
              ) : (
                <>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={form.durationDays}
                    onChange={(e) => handleChange("durationDays", e.target.value)}
                    placeholder="30, 365..."
                    className={`mt-1.5 h-11 w-full rounded-xl border px-3.5 text-sm outline-none transition focus:ring-4 ${
                      fieldErrors.durationDays
                        ? "border-rose-300 bg-rose-50/30 focus:border-rose-400 focus:ring-rose-100"
                        : "border-slate-200 bg-slate-50 focus:border-blue-300 focus:bg-white focus:ring-blue-100/60"
                    }`}
                  />
                  {fieldErrors.durationDays ? (
                    <p className="mt-1 text-xs text-rose-600">{fieldErrors.durationDays}</p>
                  ) : (
                    <p className="mt-1 text-[11px] text-slate-400">
                      Số ngày người dùng được hưởng quyền lợi sau khi thanh toán.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Row 4: Quotas (GenerateLimit & SavedTripLimit) */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Lượt tạo AI (Generate Limit)
                </label>
                <label className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-[#1d3e82]">
                  <input
                    type="checkbox"
                    checked={form.generateUnlimited}
                    onChange={(e) => handleChange("generateUnlimited", e.target.checked)}
                    className="rounded border-slate-300 text-[#1d3e82] focus:ring-[#1d3e82]"
                  />
                  <span>Không giới hạn (∞)</span>
                </label>
              </div>
              {form.generateUnlimited ? (
                <div className="mt-2 flex h-10 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
                  <span className="text-emerald-700">Không giới hạn lượt tạo</span>
                </div>
              ) : (
                <div className="mt-2">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={form.generateLimit}
                    onChange={(e) => handleChange("generateLimit", e.target.value)}
                    placeholder="0, 1, 10..."
                    className={`h-10 w-full rounded-lg border px-3 text-sm outline-none transition focus:ring-4 ${
                      fieldErrors.generateLimit
                        ? "border-rose-300 bg-rose-50/30 focus:border-rose-400 focus:ring-rose-100"
                        : "border-slate-200 bg-white focus:border-blue-300 focus:ring-blue-100/60"
                    }`}
                  />
                  {fieldErrors.generateLimit ? (
                    <p className="mt-1 text-xs text-rose-600">{fieldErrors.generateLimit}</p>
                  ) : (
                    <p className="mt-1 text-[11px] text-slate-400">
                      Nhập 0 nếu gói không cho phép tạo AI.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Lượt lưu chuyến (Saved Trip Limit)
                </label>
                <label className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-[#1d3e82]">
                  <input
                    type="checkbox"
                    checked={form.savedTripUnlimited}
                    onChange={(e) => handleChange("savedTripUnlimited", e.target.checked)}
                    className="rounded border-slate-300 text-[#1d3e82] focus:ring-[#1d3e82]"
                  />
                  <span>Không giới hạn (∞)</span>
                </label>
              </div>
              {form.savedTripUnlimited ? (
                <div className="mt-2 flex h-10 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
                  <span className="text-emerald-700">Không giới hạn lượt lưu</span>
                </div>
              ) : (
                <div className="mt-2">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={form.savedTripLimit}
                    onChange={(e) => handleChange("savedTripLimit", e.target.value)}
                    placeholder="0, 3, 10..."
                    className={`h-10 w-full rounded-lg border px-3 text-sm outline-none transition focus:ring-4 ${
                      fieldErrors.savedTripLimit
                        ? "border-rose-300 bg-rose-50/30 focus:border-rose-400 focus:ring-rose-100"
                        : "border-slate-200 bg-white focus:border-blue-300 focus:ring-blue-100/60"
                    }`}
                  />
                  {fieldErrors.savedTripLimit ? (
                    <p className="mt-1 text-xs text-rose-600">{fieldErrors.savedTripLimit}</p>
                  ) : (
                    <p className="mt-1 text-[11px] text-slate-400">
                      Nhập 0 nếu gói không cho phép lưu chuyến.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Row 5: Dynamic Benefit Editor (FE-125) */}
          <BenefitEditor
            selectedIds={form.featureIds}
            onChange={(ids) => handleChange("featureIds", ids)}
            disabled={submitting}
            error={fieldErrors.featureIds}
          />
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50/70 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="min-w-28 rounded-xl bg-[#1d3e82] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#17366f] focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-wait disabled:opacity-60"
          >
            {submitting
              ? "Đang lưu..."
              : isEdit
                ? "Cập nhật gói"
                : "Tạo gói dịch vụ"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function PlanFormModal({
  isOpen,
  mode = "create",
  plan = null,
  onClose,
  onSuccess,
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-slate-950/45 p-4 backdrop-blur-sm sm:p-6"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <PlanFormContent
        key={`${mode}-${plan?.id || "new"}`}
        mode={mode}
        plan={plan}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    </div>
  );
}
