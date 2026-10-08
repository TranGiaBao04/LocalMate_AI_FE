import { useEffect, useState } from "react";
import { AdminField, AdminOverlayFrame, LoadingState } from "../ui";
import { ADMIN_PRIMARY_BUTTON, ADMIN_SECONDARY_BUTTON, ADMIN_SELECT } from "../adminStyles";
import { adminRoleService } from "../../../services/adminRoleService";
import { getRoleErrorMessage } from "./roleLabels";

// Đổi role của một user (PUT /admin/users/{id}/role, cần ManageRoles).
// user: { id, fullName, email, role: { id, name } }. Thành công thì onAssigned({ userId, roleId, roleName }).
export default function AssignRoleDialog({ user, onClose, onAssigned }) {
  const [options, setOptions] = useState({ loaded: false, roles: [], permissionNames: {}, error: "" });
  const [roleId, setRoleId] = useState(user.role?.id ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([adminRoleService.getRoles(), adminRoleService.getPermissions()])
      .then(([roles, permissions]) => {
        if (!active) return;
        setOptions({
          loaded: true,
          roles: roles ?? [],
          permissionNames: Object.fromEntries((permissions ?? []).map((permission) => [permission.code, permission.name])),
          error: "",
        });
      })
      .catch((err) => {
        if (active) setOptions({ loaded: true, roles: [], permissionNames: {}, error: err?.message || "Không tải được danh sách role." });
      });
    return () => { active = false; };
  }, []);

  const selectedRole = options.roles.find((role) => role.id === roleId);
  const canSubmit = !submitting && selectedRole && roleId !== user.role?.id;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      onAssigned(await adminRoleService.assignUserRole(user.id, roleId));
    } catch (err) {
      setError(getRoleErrorMessage(err, "Không đổi được role. Vui lòng thử lại."));
      setSubmitting(false);
    }
  };

  return (
    <AdminOverlayFrame open title="Đổi role" onClose={onClose} loading={submitting}
      footer={<>
        <button type="button" disabled={submitting} onClick={onClose} className={ADMIN_SECONDARY_BUTTON}>Hủy</button>
        <button type="submit" form="assign-role-form" disabled={!canSubmit} className={ADMIN_PRIMARY_BUTTON}>{submitting ? "Đang lưu..." : "Đổi role"}</button>
      </>}>
      <form id="assign-role-form" onSubmit={handleSubmit} className="space-y-5">
        <p className="text-sm leading-[22px] text-[#5C6B8A]"><strong className="text-[#0F2148]">{user.fullName}</strong> <span className="break-all">({user.email})</span> đang giữ role <strong className="text-[#0F2148]">{user.role?.name}</strong>. Quyền mới có hiệu lực ngay.</p>
        {!options.loaded ? <LoadingState label="Đang tải role" /> : options.error ? <p role="alert" className="text-red-700">{options.error}</p> : (
          <AdminField id="assign-role-select" label="Role mới">
            <select id="assign-role-select" value={roleId} onChange={event => setRoleId(event.target.value)} disabled={submitting} className={ADMIN_SELECT}>
              {options.roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}
            </select>
            {selectedRole && <p className="break-words text-xs leading-[18px] text-[#5C6B8A]">{selectedRole.permissions.length > 0 ? `Quyền: ${selectedRole.permissions.map(code => options.permissionNames[code] ?? code).join(", ")}.` : "Role này không có quyền quản trị."}</p>}
          </AdminField>
        )}
        {error && <p role="alert" className="rounded-[12px] border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      </form>
    </AdminOverlayFrame>
  );
}
