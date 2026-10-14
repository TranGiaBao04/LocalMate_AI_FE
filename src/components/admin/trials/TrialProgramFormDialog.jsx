import { useRef, useState } from "react";
import { AdminField, AdminOverlayFrame } from "../ui";
import { ADMIN_INPUT, ADMIN_PRIMARY_BUTTON, ADMIN_SECONDARY_BUTTON } from "../adminStyles";
import { adminTrialProgramService } from "../../../services/adminTrialProgramService";
import { todayInVietnam } from "../../../utils/vnTime";
import TrialEnabledSwitch from "./TrialEnabledSwitch";
import {
  TRIAL_DAYS_MAX, TRIAL_DAYS_MIN, TRIAL_ERROR_MESSAGES, TRIAL_MAX_RECIPIENTS_MAX, TRIAL_NAME_MAX_LENGTH, getTrialFieldErrors,
} from "./trialProgramLabels";

// program = null ⇒ tạo mới. aiHint: dòng nhắc cạnh ô giới hạn số người nhận (trang cha dựng từ /admin/plans).
// Thành công thì onSaved(chương trình, isEdit). 404 thì onNotFound(), trang cha đóng dialog và tải lại.
export default function TrialProgramFormDialog({ program, aiHint, onClose, onSaved, onNotFound }) {
  const isEdit = Boolean(program);
  const today = todayInVietnam();
  const [form, setForm] = useState(() => ({
    name: program?.name ?? "",
    startsOn: program?.startsOn ?? today,
    endsOn: program?.endsOn ?? "",
    trialDays: String(program?.trialDays ?? 7),
    maxRecipients: program?.maxRecipients != null ? String(program.maxRecipients) : "",
    isEnabled: program?.isEnabled ?? true,
  }));
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const nameRef = useRef(null);

  const update = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => (prev[field] ? { ...prev, [field]: "" } : prev));
  };

  // Kiểm tra trước theo đúng luật BE; BE vẫn là nơi quyết định cuối
  const name = form.name.trim();
  const trialDays = Number(form.trialDays);
  const maxRecipients = form.maxRecipients.trim() === "" ? null : Number(form.maxRecipients);
  const clientErrors = {
    name: name.length > TRIAL_NAME_MAX_LENGTH ? `Tên tối đa ${TRIAL_NAME_MAX_LENGTH} ký tự.` : "",
    endsOn: form.startsOn && form.endsOn && form.endsOn < form.startsOn
      ? "Ngày kết thúc phải từ ngày bắt đầu trở đi."
      : form.isEnabled && form.endsOn && form.endsOn < today
        ? "Chương trình đang bật không được kết thúc trong quá khứ. Hãy tắt chương trình hoặc kéo dài ngày kết thúc."
        : "",
    trialDays: form.trialDays !== "" && !(Number.isInteger(trialDays) && trialDays >= TRIAL_DAYS_MIN && trialDays <= TRIAL_DAYS_MAX)
      ? `Số ngày dùng thử phải từ ${TRIAL_DAYS_MIN} đến ${TRIAL_DAYS_MAX}.`
      : "",
    maxRecipients: maxRecipients !== null && !(Number.isInteger(maxRecipients) && maxRecipients >= 1 && maxRecipients <= TRIAL_MAX_RECIPIENTS_MAX)
      ? `Giới hạn phải từ 1 đến ${TRIAL_MAX_RECIPIENTS_MAX.toLocaleString("vi-VN")}, hoặc để trống.`
      : "",
  };
  const errorOf = (field) => fieldErrors[field] || clientErrors[field] || "";
  const canSubmit = !submitting && name && form.startsOn && form.endsOn && form.trialDays !== ""
    && !Object.values(clientErrors).some(Boolean);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    const payload = { name, startsOn: form.startsOn, endsOn: form.endsOn, trialDays, maxRecipients, isEnabled: form.isEnabled };
    try {
      const saved = isEdit
        ? await adminTrialProgramService.updateProgram(program.id, payload)
        : await adminTrialProgramService.createProgram(payload);
      onSaved(saved, isEdit);
    } catch (err) {
      setSubmitting(false);
      const serverFieldErrors = getTrialFieldErrors(err);
      if (serverFieldErrors) {
        setFieldErrors(serverFieldErrors);
        return;
      }
      if (err?.code === "trial_program_not_found") {
        onNotFound();
        return;
      }
      setError(TRIAL_ERROR_MESSAGES[err?.code] ?? err?.message ?? "Không lưu được chương trình. Vui lòng thử lại.");
    }
  };

  const describedBy = (id, hasHint) => [errorOf(id.replace("trial-", "")) && `${id}-error`, hasHint && `${id}-hint`].filter(Boolean).join(" ") || undefined;

  return (
    <AdminOverlayFrame open title={isEdit ? "Sửa chương trình dùng thử" : "Tạo chương trình dùng thử"} onClose={onClose} loading={submitting} initialFocusRef={nameRef}
      footer={<>
        <button type="button" disabled={submitting} onClick={onClose} className={ADMIN_SECONDARY_BUTTON}>Hủy</button>
        <button type="submit" form="trial-program-form" disabled={!canSubmit} className={ADMIN_PRIMARY_BUTTON}>{submitting ? "Đang lưu..." : isEdit ? "Lưu thay đổi" : "Tạo chương trình"}</button>
      </>}>
      <form id="trial-program-form" onSubmit={handleSubmit} className="space-y-5">
        <p className="text-sm leading-[22px] text-[#5C6B8A]">
          Tài khoản tạo mới trong khoảng ngày này (tính cả hai đầu, theo lịch Việt Nam) được dùng thử <strong className="text-[#0F2148]">Trip Pass</strong>.
          {isEdit && program.grantedCount > 0 && ` Đã có ${program.grantedCount.toLocaleString("vi-VN")} người nhận, sửa chương trình không ảnh hưởng tới họ.`}
        </p>
        <AdminField id="trial-name" label="Tên chương trình *" error={errorOf("name")} hint={`${name.length}/${TRIAL_NAME_MAX_LENGTH}`}>
          <input ref={nameRef} id="trial-name" value={form.name} onChange={(event) => update("name", event.target.value)} aria-invalid={Boolean(errorOf("name"))} aria-describedby={describedBy("trial-name", true)} placeholder="Ví dụ: Khai trương tháng 10" className={ADMIN_INPUT} />
        </AdminField>
        <div className="grid gap-4 sm:grid-cols-2">
          <AdminField id="trial-startsOn" label="Từ ngày *" error={errorOf("startsOn")}>
            <input id="trial-startsOn" type="date" value={form.startsOn} onChange={(event) => update("startsOn", event.target.value)} aria-invalid={Boolean(errorOf("startsOn"))} aria-describedby={describedBy("trial-startsOn", false)} className={ADMIN_INPUT} />
          </AdminField>
          <AdminField id="trial-endsOn" label="Đến ngày *" error={errorOf("endsOn")}>
            <input id="trial-endsOn" type="date" min={form.startsOn || undefined} value={form.endsOn} onChange={(event) => update("endsOn", event.target.value)} aria-invalid={Boolean(errorOf("endsOn"))} aria-describedby={describedBy("trial-endsOn", false)} className={ADMIN_INPUT} />
          </AdminField>
        </div>
        <AdminField id="trial-trialDays" label="Số ngày dùng thử *" error={errorOf("trialDays")} hint={`Từ ${TRIAL_DAYS_MIN} đến ${TRIAL_DAYS_MAX} ngày, tính từ lúc đăng ký`}>
          <input id="trial-trialDays" type="number" inputMode="numeric" min={TRIAL_DAYS_MIN} max={TRIAL_DAYS_MAX} step={1} value={form.trialDays} onChange={(event) => update("trialDays", event.target.value)} aria-invalid={Boolean(errorOf("trialDays"))} aria-describedby={describedBy("trial-trialDays", true)} className={ADMIN_INPUT} />
        </AdminField>
        <AdminField id="trial-maxRecipients" label="Giới hạn số người nhận" error={errorOf("maxRecipients")} hint={`Để trống nếu không giới hạn. ${aiHint}`}>
          <input id="trial-maxRecipients" type="number" inputMode="numeric" min={1} max={TRIAL_MAX_RECIPIENTS_MAX} step={1} value={form.maxRecipients} onChange={(event) => update("maxRecipients", event.target.value)} aria-invalid={Boolean(errorOf("maxRecipients"))} aria-describedby={describedBy("trial-maxRecipients", true)} placeholder="Không giới hạn" className={ADMIN_INPUT} />
        </AdminField>
        <div className="flex items-center justify-between gap-3 rounded-[12px] border border-[#DCE2EE] px-4 py-2">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-[#0F2148]">Bật chương trình</p>
            <p className="text-xs text-[#5C6B8A]">Chỉ chương trình đang bật mới cấp dùng thử. Không được trùng ngày với chương trình đang bật khác.</p>
          </div>
          <TrialEnabledSwitch checked={form.isEnabled} onChange={() => update("isEnabled", !form.isEnabled)} disabled={submitting} label="Bật chương trình" />
        </div>
        {errorOf("isEnabled") && <p role="alert" className="text-xs text-red-700">{errorOf("isEnabled")}</p>}
        {error && <p role="alert" className="rounded-[12px] border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      </form>
    </AdminOverlayFrame>
  );
}
