import { useEffect, useMemo, useState } from "react";
import AdminPageHeader from "../../components/admin/AdminPageHeader";
import { ADMIN_PRIMARY_BUTTON, ADMIN_SECONDARY_BUTTON, ADMIN_TERTIARY_BUTTON } from "../../components/admin/adminStyles";
import { AdminErrorState, AdminField, AdminSurface, ConfirmDialog, EmptyState, LoadingState, NoticeBanner, StatusBadge } from "../../components/admin/ui";
import { adminSettingService } from "../../services/adminSettingService";
import { formatDateTimeInVietnam } from "../../utils/vnTime";

// Nhãn theo `group` BE, nhóm lạ hiện nguyên mã
const GROUP_INFO = {
  Ai: { label: "AI", icon: "auto_awesome", description: "Bật/tắt và giới hạn lượt dùng các tính năng AI." },
  Dashboard: { label: "Dashboard", icon: "monitoring", description: "Chỉ số trên trang Tổng quan." },
  Planning: { label: "Lập lịch trình", icon: "schedule", description: "Thời gian tham quan mặc định và trọng số ghi chú khi tạo lịch." },
  Semantic: { label: "Tìm theo nghĩa", icon: "manage_search", description: "Ngưỡng để một địa điểm được tính là gợi ý liên quan." },
  Stations: { label: "Ga Metro", icon: "directions_subway", description: "Cụm địa điểm quanh ga và ngưỡng thiếu dữ liệu." },
  Travel: { label: "Di chuyển", icon: "directions_walk", description: "Tốc độ và cách ước tính quãng đường giữa các chặng." },
  Trips: { label: "Lịch trình & gợi ý", icon: "route", description: "Vùng phục vụ và gợi ý thay thế địa điểm." },
};

const numberFormatter = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });
const formatValue = (value, unit) => `${numberFormatter.format(value)}${unit ? ` ${unit}` : ""}`;

// Kiểm tra giống SystemSettingDefinitions.Validate (BE) để báo lỗi ngay, BE vẫn kiểm tra lại.
// Nhận cả dấu phẩy thập phân ("4,8"). Trả { value } hoặc { error }.
function parseSettingInput(text, setting) {
  const normalized = text.trim().replace(",", ".");
  if (!normalized) return { error: "Giá trị là bắt buộc." };
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return { error: "Giá trị phải là số." };
  const value = Number(normalized);
  if (setting.valueType === "Integer" && !Number.isInteger(value)) return { error: "Giá trị phải là số nguyên." };
  if (value < setting.minValue || value > setting.maxValue) {
    return { error: `Giá trị phải từ ${numberFormatter.format(setting.minValue)} đến ${numberFormatter.format(setting.maxValue)}.` };
  }
  return { value };
}

function SettingRow({ setting, onSaved, onMissing, onResetRequest }) {
  const [draft, setDraft] = useState(String(setting.value));
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState("");
  const parsed = parseSettingInput(draft, setting);
  const dirty = parsed.value === undefined || parsed.value !== setting.value;
  const error = serverError || (dirty ? parsed.error : "");
  const inputId = `setting-${setting.key}`;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving || parsed.error || !dirty) return;
    setSaving(true);
    setServerError("");
    try {
      const updated = await adminSettingService.updateSetting(setting.key, parsed.value);
      onSaved(updated, `Đã lưu "${setting.name}".`);
    } catch (err) {
      if (err?.code === "setting_not_found") onMissing();
      else setServerError(err?.message || "Không lưu được thông số. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className="grid min-w-0 gap-4 border-b border-[#DCE2EE] p-4 last:border-b-0 md:p-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,360px)] xl:gap-8">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={inputId} className="text-sm font-semibold leading-[22px] text-[#0F2148]">{setting.name}</label>
          {!setting.isDefault && (
            <StatusBadge variant="info" label="Đã chỉnh" />
          )}
        </div>
        {setting.description && <p className="mt-2 text-sm leading-[22px] text-[#5C6B8A]">{setting.description}</p>}
        <p className="mt-3 break-all font-mono text-xs leading-[18px] text-[#5C6B8A]">{setting.key}</p>
      </div>

      <form onSubmit={handleSubmit} noValidate aria-label={`Cập nhật ${setting.name}`} className="w-full min-w-0 max-w-[420px] xl:max-w-none" aria-busy={saving}>
        <AdminField
          id={inputId}
          hint={`Từ ${formatValue(setting.minValue, setting.unit)} đến ${formatValue(setting.maxValue, setting.unit)}${dirty && parsed.value !== undefined ? ` · Giá trị mới: ${formatValue(parsed.value, setting.unit)}` : ""}`}
          error={error}
        >
        <div className="flex gap-2">
          <div
            className={`flex h-11 min-w-0 flex-1 items-center rounded-[12px] border bg-white px-3 focus-within:ring-2 ${
              error ? "border-red-600 focus-within:ring-red-200" : "border-[#DCE2EE] focus-within:border-[#2C56A8] focus-within:ring-[#2C56A8]/20"
            }`}
          >
            <input
              id={inputId}
              type="text"
              inputMode={setting.valueType === "Decimal" ? "decimal" : "numeric"}
              value={draft}
              disabled={saving}
              onChange={(event) => {
                setDraft(event.target.value);
                setServerError("");
              }}
              aria-invalid={Boolean(error)}
              aria-describedby={`${inputId}-hint${error ? ` ${inputId}-error` : ""}`}
              className="h-11 w-full min-w-0 flex-1 bg-transparent text-sm font-semibold leading-5 text-[#0F2148] outline-none disabled:cursor-not-allowed disabled:text-[#8993AC]"
            />
            {setting.unit && <span className="ml-2 shrink-0 text-xs leading-[18px] text-[#5C6B8A]">{setting.unit}</span>}
          </div>
          <button
            type="submit"
            disabled={saving || !dirty || Boolean(parsed.error)}
            aria-label={`Lưu ${setting.name}`}
            className={`${ADMIN_PRIMARY_BUTTON} shrink-0`}
          >
            {saving ? "Đang lưu..." : "Lưu"}
          </button>
        </div>

        </AdminField>
        <div className="mt-2 space-y-2 text-xs leading-[18px] text-[#5C6B8A]">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p>Mặc định: {formatValue(setting.defaultValue, setting.unit)}</p>
            {!setting.isDefault && (
              <button
                type="button"
                onClick={() => onResetRequest(setting)}
                disabled={saving}
                aria-label={`Khôi phục mặc định ${setting.name}`}
                className={ADMIN_TERTIARY_BUTTON}
              >
                Khôi phục mặc định
              </button>
            )}
          </div>
          {setting.updatedAt && (
            <p className="break-words">
              Sửa lần cuối{setting.updatedBy ? ` bởi ${setting.updatedBy.fullName}` : ""} lúc {formatDateTimeInVietnam(setting.updatedAt)}
            </p>
          )}
        </div>
      </form>
    </li>
  );
}

export default function AdminSettingsPage() {
  const [reloadKey, setReloadKey] = useState(0);
  const [result, setResult] = useState({ key: null, settings: null, error: "" });
  const [notice, setNotice] = useState(null); // { type: "success" | "error", message }
  const [resetTarget, setResetTarget] = useState(null);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    let active = true;
    adminSettingService
      .getSettings()
      .then((settings) => {
        if (active) setResult({ key: reloadKey, settings: settings ?? [], error: "" });
      })
      .catch((err) => {
        if (active) setResult({ key: reloadKey, settings: null, error: err?.message || "Không tải được cấu hình. Vui lòng thử lại." });
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(timer);
  }, [notice]);

  const loading = result.key !== reloadKey;
  const settings = result.settings;
  const customizedCount = settings?.filter((setting) => !setting.isDefault).length ?? 0;
  const reload = () => setReloadKey((key) => key + 1);

  // Giữ thứ tự BE trả (đã sắp theo group, key)
  const groups = useMemo(() => {
    const byGroup = new Map();
    (settings ?? []).forEach((setting) => {
      if (!byGroup.has(setting.group)) byGroup.set(setting.group, []);
      byGroup.get(setting.group).push(setting);
    });
    return [...byGroup.entries()];
  }, [settings]);

  // Thay phần tử bằng bản BE trả sau PUT/DELETE
  const handleSaved = (updated, message) => {
    setResult((current) => ({
      ...current,
      settings: current.settings.map((item) => (item.key === updated.key ? updated : item)),
    }));
    setNotice({ type: "success", message });
  };

  const handleMissing = () => {
    setNotice({ type: "error", message: "Thông số này không còn tồn tại, danh sách đã được tải lại." });
    reload();
  };

  const handleReset = async () => {
    if (resetting || !resetTarget) return;
    setResetting(true);
    try {
      const updated = await adminSettingService.resetSetting(resetTarget.key);
      handleSaved(updated, `Đã khôi phục mặc định "${resetTarget.name}".`);
    } catch (err) {
      if (err?.code === "setting_not_found") handleMissing();
      else setNotice({ type: "error", message: err?.message || "Không khôi phục được thông số. Vui lòng thử lại." });
    } finally {
      setResetting(false);
      setResetTarget(null);
    }
  };

  return (
    <div>
      <AdminPageHeader
        eyebrow="Hệ thống"
        title="Cấu hình hệ thống"
        description="Thông số dùng khi tạo lịch trình, gợi ý thay thế và thống kê. Thay đổi có hiệu lực ngay; lịch trình đã tạo giữ nguyên giờ đã lưu."
      >
        {settings && (
          <span className="text-xs font-medium leading-[18px] text-[#5C6B8A]">
            {customizedCount} / {settings.length} thông số đã chỉnh
          </span>
        )}
        <button type="button" onClick={reload} disabled={loading} className={ADMIN_SECONDARY_BUTTON}>
          <span aria-hidden="true" className={`material-symbols-outlined text-[20px] ${loading ? "animate-spin motion-reduce:animate-none" : ""}`}>sync</span>
          Tải lại
        </button>
      </AdminPageHeader>

      {notice && <div className="mt-5"><NoticeBanner notice={notice} /></div>}

      {result.error && !loading ? (
        <div className="mt-6"><AdminErrorState message={result.error} onRetry={reload} variant="full" /></div>
      ) : !settings ? (
        <AdminSurface className="mt-6"><LoadingState label="Đang tải cấu hình..." /></AdminSurface>
      ) : settings.length === 0 ? (
        <AdminSurface className="mt-6"><EmptyState icon="settings" title="Chưa có thông số cấu hình" /></AdminSurface>
      ) : (
        <div className="mt-6 space-y-6 md:space-y-8" aria-busy={loading}>
          {groups.map(([group, items]) => {
            const info = GROUP_INFO[group] ?? { label: group, icon: "settings" };
            return (
              <AdminSurface as="section" density="none" key={group} aria-labelledby={`group-${group}`} className="overflow-hidden">
                <header className="flex items-start gap-3 border-b border-[#DCE2EE] bg-[#F8FAFC] p-4 md:px-5">
                  <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-blue-50 text-[#1D3E82]">
                    <span className="material-symbols-outlined text-[22px]">{info.icon}</span>
                  </span>
                  <div className="min-w-0">
                    <h2 id={`group-${group}`} className="break-words text-base font-semibold leading-6 text-[#0F2148]">{info.label}</h2>
                    {info.description && <p className="mt-1 text-sm leading-[22px] text-[#5C6B8A]">{info.description}</p>}
                  </div>
                </header>
                <ul>
                  {items.map((setting) => (
                    <SettingRow
                      // Đổi key sau khi lưu/khôi phục ⇒ ô nhập nhận lại giá trị mới từ BE
                      key={`${setting.key}|${setting.value}|${setting.updatedAt ?? ""}`}
                      setting={setting}
                      onSaved={handleSaved}
                      onMissing={handleMissing}
                      onResetRequest={setResetTarget}
                    />
                  ))}
                </ul>
              </AdminSurface>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(resetTarget)}
        tone="primary"
        title="Khôi phục giá trị mặc định?"
        message={
          resetTarget
            ? `"${resetTarget.name}" sẽ về ${formatValue(resetTarget.defaultValue, resetTarget.unit)} và có hiệu lực ngay.`
            : ""
        }
        confirmLabel="Khôi phục"
        loading={resetting}
        onConfirm={handleReset}
        onCancel={() => setResetTarget(null)}
      />
    </div>
  );
}
