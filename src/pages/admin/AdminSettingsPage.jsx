import { useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "../../components/admin/ui";
import { adminSettingService } from "../../services/adminSettingService";
import { formatDateTimeInVietnam } from "../../utils/vnTime";

// Nhãn theo `group` BE, nhóm lạ hiện nguyên mã
const GROUP_INFO = {
  Dashboard: { label: "Dashboard", icon: "monitoring", description: "Chỉ số trên trang Tổng quan." },
  Planning: { label: "Lập lịch trình", icon: "schedule", description: "Thời gian tham quan mặc định theo loại địa điểm." },
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
    if (parsed.error || !dirty) return;
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
    <li className="grid gap-4 border-b border-slate-100 p-5 last:border-b-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={inputId} className="font-bold text-[#0f2042]">{setting.name}</label>
          {!setting.isDefault && (
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">Đã chỉnh</span>
          )}
        </div>
        {setting.description && <p className="mt-1 text-sm leading-6 text-slate-500">{setting.description}</p>}
        <p className="mt-1.5 font-mono text-[11px] text-slate-400">{setting.key}</p>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="flex gap-2">
          <div
            className={`flex h-10 min-w-0 flex-1 items-center rounded-lg border bg-white px-3 focus-within:ring-2 ${
              error ? "border-rose-300 focus-within:ring-rose-100" : "border-slate-200 focus-within:border-blue-300 focus-within:ring-blue-100"
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
              aria-describedby={`${inputId}-hint`}
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-800 outline-none"
            />
            {setting.unit && <span className="ml-2 shrink-0 text-xs text-slate-400">{setting.unit}</span>}
          </div>
          <button
            type="submit"
            disabled={saving || !dirty || Boolean(parsed.error)}
            className="h-10 shrink-0 rounded-lg bg-[#1d3e82] px-4 text-xs font-bold text-white transition hover:bg-[#17366f] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            {saving ? "Đang lưu..." : "Lưu"}
          </button>
        </div>

        <div id={`${inputId}-hint`} className="mt-2 space-y-1 text-xs leading-5">
          {error ? (
            <p role="alert" className="font-semibold text-rose-600">{error}</p>
          ) : (
            <p className="text-slate-500">
              Từ {formatValue(setting.minValue, setting.unit)} đến {formatValue(setting.maxValue, setting.unit)}
              {dirty && parsed.value !== undefined && ` · Giá trị mới: ${formatValue(parsed.value, setting.unit)}`}
            </p>
          )}
          <p className="text-slate-400">
            Mặc định: {formatValue(setting.defaultValue, setting.unit)}
            {!setting.isDefault && (
              <button
                type="button"
                onClick={() => onResetRequest(setting)}
                disabled={saving}
                className="ml-2 font-semibold text-blue-700 hover:underline disabled:opacity-50"
              >
                Khôi phục mặc định
              </button>
            )}
          </p>
          {setting.updatedAt && (
            <p className="text-slate-400">
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
    <div className="mx-auto max-w-[1200px]">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#0f2042] sm:text-[30px]">Cấu hình hệ thống</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Thông số dùng khi tạo lịch trình, gợi ý thay thế và thống kê. Thay đổi có hiệu lực ngay; lịch trình đã tạo giữ nguyên giờ đã lưu.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {settings && (
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
              {customizedCount} / {settings.length} thông số đã chỉnh
            </span>
          )}
          <button
            type="button"
            onClick={reload}
            disabled={loading}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 shadow-sm transition hover:border-blue-200 hover:text-blue-700 disabled:cursor-wait"
          >
            <span className={`material-symbols-outlined text-[18px] ${loading ? "animate-spin" : ""}`}>sync</span>
            Tải lại
          </button>
        </div>
      </section>

      {notice && (
        <div
          role="status"
          className={`mt-5 rounded-xl border px-4 py-3 text-sm font-semibold ${
            notice.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {notice.message}
        </div>
      )}

      {result.error && !loading ? (
        <div className="mt-6 grid min-h-72 place-items-center rounded-xl border border-slate-200 bg-white p-8 text-center">
          <div>
            <span className="material-symbols-outlined text-4xl text-rose-500">cloud_off</span>
            <p className="mt-3 font-bold text-slate-800">{result.error}</p>
            <button type="button" onClick={reload} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white">Thử lại</button>
          </div>
        </div>
      ) : !settings ? (
        <div className="mt-6 space-y-4">
          {Array.from({ length: 3 }, (_, index) => <div key={index} className="h-48 animate-pulse rounded-xl bg-slate-100" />)}
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {groups.map(([group, items]) => {
            const info = GROUP_INFO[group] ?? { label: group, icon: "settings" };
            return (
              <section key={group} aria-labelledby={`group-${group}`} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <header className="flex items-start gap-3 border-b border-slate-100 bg-slate-50/60 px-5 py-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white text-[#1d3e82] shadow-sm">
                    <span className="material-symbols-outlined text-[22px]">{info.icon}</span>
                  </span>
                  <div>
                    <h2 id={`group-${group}`} className="font-extrabold text-[#0f2042]">{info.label}</h2>
                    {info.description && <p className="mt-0.5 text-sm text-slate-500">{info.description}</p>}
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
              </section>
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
