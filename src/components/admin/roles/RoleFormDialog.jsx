import { useRef, useState } from "react";
import { AdminField, AdminOverlayFrame } from "../ui";
import { ADMIN_INPUT, ADMIN_PRIMARY_BUTTON, ADMIN_SECONDARY_BUTTON } from "../adminStyles";
import { adminRoleService } from "../../../services/adminRoleService";
import { ROLE_DESCRIPTION_MAX_LENGTH, ROLE_NAME_MAX_LENGTH, getRoleErrorMessage } from "./roleLabels";


// role = null ⇒ tạo mới. permissions: [{ code, name, description }] từ GET /admin/permissions.
// Thành công thì onSaved(role đã lưu, isEdit), trang cha đóng dialog và tải lại.
export default function RoleFormDialog({ role, permissions, onClose, onSaved }) {
  const isEdit = Boolean(role);
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [selected, setSelected] = useState(() => new Set(role?.permissions ?? []));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const nameRef = useRef(null);

  const trimmedName = name.trim();
  const trimmedDescription = description.trim();
  const nameError = trimmedName.length > ROLE_NAME_MAX_LENGTH ? `Tên role tối đa ${ROLE_NAME_MAX_LENGTH} ký tự.` : "";
  const descriptionError = trimmedDescription.length > ROLE_DESCRIPTION_MAX_LENGTH
    ? `Mô tả tối đa ${ROLE_DESCRIPTION_MAX_LENGTH} ký tự.`
    : "";
  const canSubmit = !submitting && trimmedName && !nameError && !descriptionError;

  const togglePermission = (code) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    const payload = {
      name: trimmedName,
      description: trimmedDescription || null,
      permissions: permissions.map((permission) => permission.code).filter((code) => selected.has(code)),
    };
    try {
      const saved = isEdit
        ? await adminRoleService.updateRole(role.id, payload)
        : await adminRoleService.createRole(payload);
      onSaved(saved, isEdit);
    } catch (err) {
      setError(getRoleErrorMessage(err, "Không lưu được role. Vui lòng thử lại."));
      setSubmitting(false);
    }
  };

  return (
    <AdminOverlayFrame open title={isEdit ? "Sửa role" : "Tạo role mới"} onClose={onClose} loading={submitting} initialFocusRef={nameRef}
      footer={<>
        <button type="button" disabled={submitting} onClick={onClose} className={ADMIN_SECONDARY_BUTTON}>Hủy</button>
        <button type="submit" form="role-form" disabled={!canSubmit} className={ADMIN_PRIMARY_BUTTON}>{submitting ? "Đang lưu..." : isEdit ? "Lưu thay đổi" : "Tạo role"}</button>
      </>}>
      <form id="role-form" onSubmit={handleSubmit} className="space-y-5">
        {isEdit && role.userCount > 0 && <p className="text-sm text-[#5C6B8A]">Thay đổi áp dụng ngay cho {role.userCount} người dùng đang giữ role này.</p>}
        <AdminField id="role-name" label="Tên role *" error={nameError}>
          <input ref={nameRef} id="role-name" type="text" value={name} onChange={event => setName(event.target.value)} disabled={submitting} aria-invalid={Boolean(nameError)} aria-describedby={nameError ? "role-name-error" : undefined} placeholder="Ví dụ: Chăm sóc khách hàng" className={ADMIN_INPUT} />
        </AdminField>
        <AdminField id="role-description" label="Mô tả" error={descriptionError} hint={`${trimmedDescription.length}/${ROLE_DESCRIPTION_MAX_LENGTH}`}>
          <textarea id="role-description" rows={2} value={description} onChange={event => setDescription(event.target.value)} disabled={submitting} aria-invalid={Boolean(descriptionError)} aria-describedby={descriptionError ? "role-description-error role-description-hint" : "role-description-hint"} className={ADMIN_INPUT + " h-auto resize-y py-3"} />
        </AdminField>
        <fieldset disabled={submitting}>
          <legend className="text-[13px] font-semibold text-[#0F2148]">Quyền</legend>
          <p className="mt-2 text-xs leading-[18px] text-[#5C6B8A]">Không chọn quyền nào thì người giữ role này không vào được trang quản trị.</p>
          <div className="mt-3 space-y-2">
            {permissions.map(permission => (
              <label key={permission.code} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-[8px] border border-[#DCE2EE] p-3 hover:bg-[#F8FAFC] has-[:checked]:border-[#2C56A8] has-[:checked]:bg-blue-50/50">
                <input type="checkbox" checked={selected.has(permission.code)} onChange={() => togglePermission(permission.code)} className="mt-1 h-4 w-4 shrink-0 accent-[#2C56A8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" />
                <span className="min-w-0"><span className="block text-sm font-semibold text-[#0F2148]">{permission.name}</span><span className="mt-1 block text-xs leading-[18px] text-[#5C6B8A]">{permission.description}</span></span>
              </label>
            ))}
          </div>
        </fieldset>
        {error && <p role="alert" className="rounded-[12px] border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      </form>
    </AdminOverlayFrame>
  );
}
