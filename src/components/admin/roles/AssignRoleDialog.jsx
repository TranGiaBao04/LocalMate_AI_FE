import { useEffect, useState } from "react";
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

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, submitting]);

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
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/45 p-5 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && !submitting && onClose()}
    >
      <form onSubmit={handleSubmit} role="dialog" aria-modal="true" aria-labelledby="assign-role-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-violet-50 text-violet-700">
          <span className="material-symbols-outlined text-[25px]">admin_panel_settings</span>
        </div>
        <h2 id="assign-role-title" className="mt-5 text-xl font-bold text-slate-950">Đổi role</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          <strong className="text-slate-800">{user.fullName}</strong> ({user.email}) đang giữ role{" "}
          <strong className="text-slate-800">{user.role?.name}</strong>. Quyền mới có hiệu lực ngay.
        </p>

        {!options.loaded ? (
          <div className="mt-5 h-11 animate-pulse rounded-xl bg-slate-100" />
        ) : options.error ? (
          <p role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">{options.error}</p>
        ) : (
          <div className="mt-5">
            <label htmlFor="assign-role-select" className="text-sm font-semibold text-slate-700">Role mới</label>
            <select
              id="assign-role-select"
              value={roleId}
              onChange={(event) => setRoleId(event.target.value)}
              disabled={submitting}
              className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100/60"
            >
              {options.roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
            </select>
            {selectedRole && (
              <p className="mt-2 text-xs leading-5 text-slate-500">
                {selectedRole.permissions.length > 0
                  ? `Quyền: ${selectedRole.permissions.map((code) => options.permissionNames[code] ?? code).join(", ")}.`
                  : "Role này không có quyền quản trị."}
              </p>
            )}
          </div>
        )}

        {error && (
          <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">{error}</p>
        )}

        <div className="mt-7 flex justify-end gap-3">
          <button type="button" disabled={submitting} onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50">
            Hủy
          </button>
          <button type="submit" disabled={!canSubmit} className="min-w-24 rounded-xl bg-[#1d3e82] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#17366f] focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60">
            {submitting ? "Đang lưu..." : "Đổi role"}
          </button>
        </div>
      </form>
    </div>
  );
}
