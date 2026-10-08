import { useState } from "react";
import { AdminOverlayFrame, AdminField, NoticeBanner } from "../ui";
import { ADMIN_INPUT, ADMIN_PRIMARY_BUTTON, ADMIN_SECONDARY_BUTTON } from "../adminStyles";
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

  const inputProps = (field) => ({
    id: `plan-${field}`,
    "aria-invalid": Boolean(fieldErrors[field]),
    "aria-describedby": fieldErrors[field] ? `plan-${field}-error` : undefined,
    className: ADMIN_INPUT,
    disabled: submitting,
  });
  return (
    <AdminOverlayFrame open title={isEdit ? `Chỉnh sửa gói: ${plan?.name}` : "Tạo gói dịch vụ mới"}
      description={isEdit ? `Mã: ${plan?.code} · Phiên bản hiện tại: v${plan?.currentVersion?.versionNumber ?? 1}` : "Thiết lập thông số thương mại và quyền lợi cho gói cước mới"}
      onClose={onClose} loading={submitting}
      footer={<>
        <button type="button" onClick={onClose} disabled={submitting} className={ADMIN_SECONDARY_BUTTON}>Hủy</button>
        <button type="submit" form="plan-form" disabled={submitting} className={ADMIN_PRIMARY_BUTTON}>{submitting ? "Đang lưu..." : isEdit ? "Cập nhật gói" : "Tạo gói dịch vụ"}</button>
      </>}>
      <form id="plan-form" onSubmit={handleSubmit} className="space-y-6">
        <NoticeBanner notice={generalError ? { type: "error", message: generalError } : null} />
        {isEdit && <p className="border-l-2 border-blue-200 pl-3 text-sm text-[#5C6B8A]">Mọi thay đổi về giá, thời hạn, hạn mức hoặc tính năng sẽ tự động phát hành phiên bản mới. Người dùng đang đăng ký gói hiện tại vẫn được bảo lưu quyền lợi cũ đến hết chu kỳ.</p>}
        <fieldset className="space-y-4">
          <legend className="mb-3 text-base font-semibold">Thông tin gói</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <AdminField id="plan-code" label="Mã gói (Code)" error={fieldErrors.code}>
              {isEdit ? <p className="break-words font-mono">{plan?.code} <span className="text-xs text-[#5C6B8A]">· Cố định</span></p> : <input {...inputProps("code")} type="text" value={form.code} onChange={e => handleChange("code", e.target.value.toUpperCase().replace(/\s+/g, "_"))} maxLength={64} placeholder="VD: PRO_YEARLY" />}
            </AdminField>
            <AdminField id="plan-entitlementPriority" label="Độ ưu tiên quyền hạn" error={fieldErrors.entitlementPriority}>
              {isEdit ? <p>{plan?.entitlementPriority} <span className="text-xs text-[#5C6B8A]">· Cố định</span></p> : <input {...inputProps("entitlementPriority")} type="number" min={0} step={1} value={form.entitlementPriority} onChange={e => handleChange("entitlementPriority", e.target.value)} />}
            </AdminField>
          </div>
          <AdminField id="plan-name" label="Tên hiển thị gói" error={fieldErrors.name}>
            <input {...inputProps("name")} type="text" value={form.name} onChange={e => handleChange("name", e.target.value)} maxLength={200} placeholder="Tên gói dịch vụ" />
          </AdminField>
        </fieldset>
        <fieldset className="space-y-4 border-t border-[#DCE2EE] pt-4">
          <legend className="px-1 text-base font-semibold">Giá bán & thời hạn</legend>
          <AdminField id="plan-price" label="Giá bán (VND)" error={fieldErrors.price}>
            {isFree ? <p>0 VND (Miễn phí)</p> : <><input {...inputProps("price")} type="number" min={1} step={1} value={form.price} onChange={e => handleChange("price", e.target.value)} /><p className="mt-1 text-xs text-[#5C6B8A]">Hiển thị: {formatPlanPrice(Number(form.price) || 0)}</p></>}
          </AdminField>
          <AdminField id="plan-durationDays" label="Thời hạn hiệu lực (Ngày)" error={fieldErrors.durationDays}>
            {isFree ? <p>Không áp dụng (Gói mặc định, không có thời hạn mua)</p> : <input {...inputProps("durationDays")} type="number" min={1} step={1} value={form.durationDays} onChange={e => handleChange("durationDays", e.target.value)} />}
          </AdminField>
        </fieldset>
        <fieldset className="space-y-4 border-t border-[#DCE2EE] pt-4">
          <legend className="px-1 text-base font-semibold">Hạn mức sử dụng</legend>
          <AdminField id="plan-generateLimit" label="Lượt tạo AI (Generate Limit)" error={fieldErrors.generateLimit}>
            <label className="mb-2 flex min-h-11 cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={form.generateUnlimited} disabled={submitting} onChange={e => handleChange("generateUnlimited", e.target.checked)} />Không giới hạn (∞)
            </label>
            {form.generateUnlimited ? <p className="text-sm text-[#5C6B8A]">Không giới hạn lượt tạo</p> : <input {...inputProps("generateLimit")} type="number" min={0} step={1} value={form.generateLimit} onChange={e => handleChange("generateLimit", e.target.value)} />}
          </AdminField>
          <AdminField id="plan-savedTripLimit" label="Lượt lưu chuyến (Saved Trip Limit)" error={fieldErrors.savedTripLimit}>
            <label className="mb-2 flex min-h-11 cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={form.savedTripUnlimited} disabled={submitting} onChange={e => handleChange("savedTripUnlimited", e.target.checked)} />Không giới hạn (∞)
            </label>
            {form.savedTripUnlimited ? <p className="text-sm text-[#5C6B8A]">Không giới hạn lượt lưu</p> : <input {...inputProps("savedTripLimit")} type="number" min={0} step={1} value={form.savedTripLimit} onChange={e => handleChange("savedTripLimit", e.target.value)} />}
          </AdminField>
        </fieldset>
        <BenefitEditor selectedIds={form.featureIds} onChange={ids => handleChange("featureIds", ids)} disabled={submitting} error={fieldErrors.featureIds} />
      </form>
    </AdminOverlayFrame>
  );
}

export default function PlanFormModal({ isOpen, mode = "create", plan = null, onClose, onSuccess }) {
  if (!isOpen) return null;
  return <PlanFormContent key={`${mode}-${plan?.id || "new"}`} mode={mode} plan={plan} onClose={onClose} onSuccess={onSuccess} />;
}
