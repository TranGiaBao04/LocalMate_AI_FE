import { useEffect, useRef, useState } from "react";
import { AdminField, AdminOverlayFrame } from "../ui";
import { ADMIN_INPUT, ADMIN_PRIMARY_BUTTON, ADMIN_SECONDARY_BUTTON, ADMIN_SELECT } from "../adminStyles";
import { adminPlanService } from "../../../services/adminPlanService";
import { adminUserService } from "../../../services/adminUserService";
import { GRANT_DAYS_MAX, GRANT_DAYS_MIN, GRANT_ERROR_MESSAGES, GRANT_REASON_MAX_LENGTH } from "./userLabels";

// Chỉ tặng được gói trả phí đang bật, có phiên bản hiện hành. Mã ở /admin/plans là mã nội bộ ("FREE", "TRIP_PASS").
const isGrantablePlan = (plan) => Boolean(plan?.isActive && plan.code !== "FREE" && plan.currentVersion);

// Tặng gói: điền form → bước xác nhận (BE không có API thu hồi) → gọi API.
// Thành công thì onDone(kết quả), trang cha đóng dialog và tải lại.
export default function GrantPlanDialog({ user, onClose, onDone }) {
  const [plans, setPlans] = useState({ loading: true, items: [], error: "" });
  const [planId, setPlanId] = useState("");
  const [days, setDays] = useState("7");
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const planRef = useRef(null);

  useEffect(() => {
    let active = true;
    adminPlanService.getPlans({ isActive: true, pageSize: 100 })
      .then((data) => {
        if (!active) return;
        const items = (data?.items ?? []).filter(isGrantablePlan);
        setPlans({ loading: false, items, error: "" });
        if (items.length === 1) setPlanId(items[0].id);
      })
      .catch((err) => {
        if (active) setPlans({ loading: false, items: [], error: err?.message || "Không tải được danh sách gói." });
      });
    return () => { active = false; };
  }, []);

  const selectedPlan = plans.items.find((plan) => plan.id === planId);
  const dayCount = Number(days);
  const daysValid = Number.isInteger(dayCount) && dayCount >= GRANT_DAYS_MIN && dayCount <= GRANT_DAYS_MAX;
  const trimmedReason = reason.trim();
  const reasonTooLong = trimmedReason.length > GRANT_REASON_MAX_LENGTH;
  const formValid = Boolean(selectedPlan) && daysValid && trimmedReason.length > 0 && !reasonTooLong;

  const daysError = fieldErrors.days || (days !== "" && !daysValid ? `Số ngày phải từ ${GRANT_DAYS_MIN} đến ${GRANT_DAYS_MAX}.` : "");
  const reasonError = fieldErrors.reason || (reasonTooLong ? `Lý do tối đa ${GRANT_REASON_MAX_LENGTH} ký tự.` : "");

  const clearFieldError = (field) => setFieldErrors((prev) => (prev[field] ? { ...prev, [field]: "" } : prev));

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!formValid || submitting) return;
    if (!confirming) {
      setError("");
      setConfirming(true);
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const result = await adminUserService.grantPlan(user.id, { planId, days: dayCount, reason: trimmedReason });
      onDone(result);
    } catch (err) {
      setSubmitting(false);
      setConfirming(false);
      if (err?.code === "invalid_grant" && err.errors) {
        // Câu lỗi theo field của BE là tiếng Việt, hiện thẳng dưới ô (PlanId → planid)
        setFieldErrors(Object.fromEntries(
          Object.entries(err.errors).map(([field, messages]) => [field.toLowerCase(), String(messages?.[0] ?? "Giá trị không hợp lệ.")]),
        ));
        return;
      }
      setError(GRANT_ERROR_MESSAGES[err?.code] ?? err?.message ?? "Không tặng được gói. Vui lòng thử lại.");
    }
  };

  const noPlans = !plans.loading && !plans.error && plans.items.length === 0;

  return (
    <AdminOverlayFrame open title={confirming ? "Xác nhận tặng gói" : "Tặng gói"} onClose={onClose} loading={submitting} initialFocusRef={planRef}
      footer={confirming ? <>
        <button type="button" disabled={submitting} onClick={() => setConfirming(false)} className={ADMIN_SECONDARY_BUTTON}>Quay lại</button>
        <button type="submit" form="grant-plan-form" disabled={submitting} className={ADMIN_PRIMARY_BUTTON}>{submitting ? "Đang tặng..." : "Xác nhận tặng"}</button>
      </> : <>
        <button type="button" onClick={onClose} className={ADMIN_SECONDARY_BUTTON}>Hủy</button>
        <button type="submit" form="grant-plan-form" disabled={!formValid} className={ADMIN_PRIMARY_BUTTON}>Tiếp tục</button>
      </>}>
      <form id="grant-plan-form" onSubmit={handleSubmit} className="space-y-5">
        {confirming ? (
          <div className="space-y-3 break-words text-sm leading-[22px] text-[#0F2148]">
            <p>
              Tặng <strong>{selectedPlan?.name}</strong> trong <strong>{dayCount} ngày</strong> cho{" "}
              <strong>{user.fullName}</strong> <span className="break-all text-[#5C6B8A]">({user.email})</span>.
            </p>
            <p className="whitespace-pre-line text-[#5C6B8A]"><span className="font-semibold text-[#0F2148]">Lý do:</span> {trimmedReason}</p>
            <p className="rounded-[12px] border border-amber-200 bg-amber-50 p-3 text-amber-900">
              Gói tặng không thu hồi được. Nếu người dùng đang có gói bằng hoặc cao hơn, gói tặng sẽ bắt đầu sau khi gói đó hết.
            </p>
          </div>
        ) : <>
          <p className="break-words text-sm leading-[22px] text-[#5C6B8A]">
            Tặng gói cho <strong className="text-[#0F2148]">{user.fullName}</strong> <span className="break-all">({user.email})</span>. Người dùng nhận thông báo và dùng được ngay hoặc sau khi gói hiện tại hết.
          </p>
          <AdminField id="grant-plan" label="Gói *" error={plans.error || fieldErrors.planid || (noPlans ? "Chưa có gói trả phí nào đang bật để tặng." : "")}>
            <select ref={planRef} id="grant-plan" value={planId} disabled={plans.loading} onChange={(event) => { setPlanId(event.target.value); clearFieldError("planid"); }} className={ADMIN_SELECT}>
              <option value="">{plans.loading ? "Đang tải gói..." : "Chọn gói"}</option>
              {plans.items.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
            </select>
          </AdminField>
          <AdminField id="grant-days" label="Số ngày *" error={daysError} hint={`Từ ${GRANT_DAYS_MIN} đến ${GRANT_DAYS_MAX} ngày`}>
            <input id="grant-days" type="number" inputMode="numeric" min={GRANT_DAYS_MIN} max={GRANT_DAYS_MAX} step={1} value={days} onChange={(event) => { setDays(event.target.value); clearFieldError("days"); }} aria-invalid={Boolean(daysError)} aria-describedby={daysError ? "grant-days-error grant-days-hint" : "grant-days-hint"} className={ADMIN_INPUT} />
          </AdminField>
          <AdminField id="grant-reason" label="Lý do *" error={reasonError} hint={`${trimmedReason.length}/${GRANT_REASON_MAX_LENGTH} · Ghi chú nội bộ`}>
            <textarea id="grant-reason" rows={3} value={reason} onChange={(event) => { setReason(event.target.value); clearFieldError("reason"); }} aria-invalid={Boolean(reasonError)} aria-describedby={reasonError ? "grant-reason-error grant-reason-hint" : "grant-reason-hint"} placeholder="Ví dụ: tặng dùng thử giai đoạn ra mắt" className={ADMIN_INPUT + " h-auto resize-y py-3"} />
          </AdminField>
        </>}
        {error && <p role="alert" className="rounded-[12px] border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      </form>
    </AdminOverlayFrame>
  );
}
