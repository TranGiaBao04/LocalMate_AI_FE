import { useEffect, useRef, useState } from "react";
import { adminRoleService } from "../../../services/adminRoleService";
import { ROLE_DESCRIPTION_MAX_LENGTH, ROLE_NAME_MAX_LENGTH, getRoleErrorMessage } from "./roleLabels";

const INPUT_CLASS = "mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100/60";

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

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, submitting]);

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
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/45 p-5 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && !submitting && onClose()}
    >
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="role-form-title"
        className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl"
      >
        <div className="border-b border-slate-100 px-6 py-5">
          <h2 id="role-form-title" className="text-xl font-bold text-slate-950">
            {isEdit ? "Sửa role" : "Tạo role mới"}
          </h2>
          {isEdit && role.userCount > 0 && (
            <p className="mt-1 text-sm text-slate-500">
              Thay đổi áp dụng ngay cho {role.userCount} người dùng đang giữ role này.
            </p>
          )}
        </div>

        <div className="space-y-5 overflow-y-auto px-6 py-5">
          <div>
            <label htmlFor="role-name" className="text-sm font-semibold text-slate-700">
              Tên role <span className="text-rose-600">*</span>
            </label>
            <input
              ref={nameRef}
              id="role-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={submitting}
              aria-invalid={Boolean(nameError)}
              placeholder="Ví dụ: Chăm sóc khách hàng"
              className={INPUT_CLASS}
            />
            {nameError && <p className="mt-1 text-xs text-rose-600">{nameError}</p>}
          </div>

          <div>
            <label htmlFor="role-description" className="text-sm font-semibold text-slate-700">Mô tả</label>
            <textarea
              id="role-description"
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={submitting}
              aria-invalid={Boolean(descriptionError)}
              className={`${INPUT_CLASS} resize-none`}
            />
            <div className="mt-1 flex justify-between gap-3 text-xs">
              <span className="text-rose-600">{descriptionError}</span>
              <span className={descriptionError ? "text-rose-600" : "text-slate-400"}>
                {trimmedDescription.length}/{ROLE_DESCRIPTION_MAX_LENGTH}
              </span>
            </div>
          </div>

          <fieldset disabled={submitting}>
            <legend className="text-sm font-semibold text-slate-700">Quyền</legend>
            <p className="mt-1 text-xs text-slate-500">
              Không chọn quyền nào thì người giữ role này không vào được trang quản trị.
            </p>
            <div className="mt-3 space-y-2">
              {permissions.map((permission) => (
                <label
                  key={permission.code}
                  className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 px-3.5 py-3 transition hover:bg-slate-50 has-[:checked]:border-blue-300 has-[:checked]:bg-blue-50/50"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(permission.code)}
                    onChange={() => togglePermission(permission.code)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-800">{permission.name}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-slate-500">{permission.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {error && (
            <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">{error}</p>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button type="button" disabled={submitting} onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50">
            Hủy
          </button>
          <button type="submit" disabled={!canSubmit} className="min-w-24 rounded-xl bg-[#1d3e82] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#17366f] focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60">
            {submitting ? "Đang lưu..." : isEdit ? "Lưu thay đổi" : "Tạo role"}
          </button>
        </div>
      </form>
    </div>
  );
}
