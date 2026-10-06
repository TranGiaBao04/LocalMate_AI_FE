import { useCallback, useEffect, useMemo, useState } from "react";
import AdminPageHeader from "../../components/admin/AdminPageHeader";
import { ADMIN_PRIMARY_BUTTON } from "../../components/admin/adminStyles";
import { ConfirmDialog, DataTable, NoticeBanner } from "../../components/admin/ui";
import RoleFormDialog from "../../components/admin/roles/RoleFormDialog";
import { getRoleErrorMessage } from "../../components/admin/roles/roleLabels";
import { useAuth } from "../../context/AuthContext";
import { adminRoleService } from "../../services/adminRoleService";

const ACTION_CLASS = "inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40";

export default function AdminRolesPage() {
  const { refreshProfile } = useAuth();
  const [reloadCount, setReloadCount] = useState(0);
  const [response, setResponse] = useState({ key: null, roles: [], permissions: [], error: "" });
  const [formTarget, setFormTarget] = useState(null); // { role: null (tạo mới) | role }
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState(null);
  const loading = response.key !== reloadCount;

  useEffect(() => {
    let active = true;
    Promise.all([adminRoleService.getRoles(), adminRoleService.getPermissions()])
      .then(([roles, permissions]) => {
        if (active) setResponse({ key: reloadCount, roles: roles ?? [], permissions: permissions ?? [], error: "" });
      })
      .catch((err) => {
        // Tải lại lỗi thì giữ danh sách cũ
        if (active) setResponse((prev) => ({ ...prev, key: reloadCount, error: err?.message || "Không tải được danh sách role." }));
      });
    return () => { active = false; };
  }, [reloadCount]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(timer);
  }, [notice]);

  const reload = useCallback(() => setReloadCount((count) => count + 1), []);
  const closeForm = useCallback(() => setFormTarget(null), []);

  const handleSaved = (saved, isEdit) => {
    setFormTarget(null);
    setNotice({ type: "success", message: isEdit ? `Đã lưu role "${saved.name}".` : `Đã tạo role "${saved.name}".` });
    reload();
    // Role vừa sửa có thể là role của chính mình ⇒ nạp lại quyền để menu khớp
    if (isEdit) refreshProfile().catch(() => {});
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await adminRoleService.deleteRole(deleteTarget.id);
      setNotice({ type: "success", message: `Đã xoá role "${deleteTarget.name}".` });
    } catch (err) {
      setNotice({ type: "error", message: getRoleErrorMessage(err, "Không xoá được role. Vui lòng thử lại.") });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
      reload();
    }
  };

  const permissionNames = useMemo(
    () => Object.fromEntries(response.permissions.map((permission) => [permission.code, permission.name])),
    [response.permissions]
  );

  const columns = useMemo(() => [
    {
      key: "name",
      header: "Role",
      render: (row) => (
        <div className="min-w-[180px]">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-slate-900">{row.name}</p>
            {row.isSystem && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                <span className="material-symbols-outlined text-[14px]">lock</span>
                Hệ thống
              </span>
            )}
          </div>
          {row.description && <p className="mt-1 text-xs leading-5 text-slate-500">{row.description}</p>}
        </div>
      ),
    },
    {
      key: "permissions",
      header: "Quyền",
      render: (row) => (row.permissions.length > 0 ? (
        <div className="flex max-w-xl flex-wrap gap-1.5">
          {row.permissions.map((code) => (
            <span key={code} className="rounded-lg bg-violet-50 px-2 py-1 text-xs font-semibold text-violet-700">
              {permissionNames[code] ?? code}
            </span>
          ))}
        </div>
      ) : <span className="text-slate-400">Không có quyền quản trị</span>),
    },
    {
      key: "userCount",
      header: "Người dùng",
      render: (row) => <span className="font-medium text-slate-800">{row.userCount.toLocaleString("vi-VN")}</span>,
    },
    {
      key: "actions",
      header: "Thao tác",
      className: "text-right",
      cellClassName: "text-right",
      render: (row) => (row.isSystem ? (
        <span className="text-xs text-slate-400">Không sửa được</span>
      ) : (
        <div className="flex justify-end gap-1">
          <button type="button" onClick={() => setFormTarget({ role: row })} className={`${ACTION_CLASS} text-[#1d3e82] hover:bg-blue-50`}>
            <span className="material-symbols-outlined text-[16px]">edit</span>
            Sửa
          </button>
          <button
            type="button"
            onClick={() => setDeleteTarget(row)}
            disabled={row.userCount > 0}
            title={row.userCount > 0 ? "Role đang có người dùng, hãy chuyển họ sang role khác trước" : undefined}
            className={`${ACTION_CLASS} text-rose-600 hover:bg-rose-50`}
          >
            <span className="material-symbols-outlined text-[16px]">delete</span>
            Xoá
          </button>
        </div>
      )),
    },
  ], [permissionNames]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Người dùng & Phân quyền"
        title="Phân quyền & Quản trị"
        description="Tạo role và chọn quyền cho từng role. Gán role cho người dùng ở trang chi tiết người dùng."
      >
        <button
          type="button"
          onClick={() => setFormTarget({ role: null })}
          disabled={response.key === null || response.permissions.length === 0}
          className={ADMIN_PRIMARY_BUTTON}
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          Tạo role
        </button>
      </AdminPageHeader>

      <NoticeBanner notice={notice} onClose={() => setNotice(null)} />

      {response.error && !loading && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <span>{response.error}</span>
          <button type="button" onClick={reload} className="shrink-0 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-700">
            Thử lại
          </button>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={response.roles}
        loading={response.key === null}
        emptyState={{ icon: "admin_panel_settings", title: "Chưa có role nào" }}
      />

      {formTarget && (
        <RoleFormDialog role={formTarget.role} permissions={response.permissions} onClose={closeForm} onSaved={handleSaved} />
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xoá role"
        message={deleteTarget ? `Xoá role "${deleteTarget.name}"? Thao tác này không hoàn tác được.` : ""}
        confirmLabel="Xoá role"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
