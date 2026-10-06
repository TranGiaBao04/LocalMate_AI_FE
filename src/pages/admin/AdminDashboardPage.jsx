import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import AdminPageHeader from "../../components/admin/AdminPageHeader";
import { ADMIN_SECTIONS } from "../../components/admin/adminSections";
import BreakEvenCard from "../../components/admin/dashboard/BreakEvenCard";
import DashboardRangeFilter from "../../components/admin/dashboard/DashboardRangeFilter";
import RevenueChart from "../../components/admin/dashboard/RevenueChart";
import TopStationList from "../../components/admin/dashboard/TopStationList";
import TripsFinalizedChart from "../../components/admin/dashboard/TripsFinalizedChart";
import {
  DEFAULT_RANGE_PRESET,
  DEFAULT_STATION_LIMIT,
  STATION_LIMIT_OPTIONS,
  countDays,
  countFormatter,
  formatDayLabel,
  formatMonthLabel,
  getDashboardFieldErrors,
  recentMonths,
  resolvePresetRange,
  vndFormatter,
} from "../../components/admin/dashboard/dashboardUtils";
import { ADMIN_PERMISSIONS } from "../../constants";
import { adminDashboardService } from "../../services/adminDashboardService";
import { adminPlaceService } from "../../services/adminPlaceService";
import { adminStationService } from "../../services/adminStationService";
import { hasAnyPermission } from "../../utils/adminAccess";
import { formatPlannedDate, formatTimeInVietnam, minutesNowInVietnam, todayInVietnam } from "../../utils/vnTime";

const CARD = "rounded-2xl border border-[#eef1f8] bg-white shadow-[0_1px_2px_rgba(15,23,42,.04)]";
const SELECT_CLASS =
  "h-8 rounded-md border border-[#e3e7f1] bg-white px-2 text-sm text-on-surface outline-none focus:border-navy-mid";

// Số đơn/doanh thu tính theo ngày thanh toán, lịch trình gồm cả trip đã xoá (theo BE).
const BUSINESS_METRICS = [
  { key: "newUsers", label: "Người dùng mới", icon: "person_add", tone: "bg-blue-50 text-blue-700", suffix: "người" },
  {
    key: "tripsCreated",
    label: "Lịch trình đã tạo",
    icon: "route",
    tone: "bg-emerald-50 text-emerald-700",
    suffix: "lịch trình",
    caption: "Gồm AI tạo, áp dụng lịch mẫu và sao chép",
  },
  {
    key: "paidOrders",
    label: "Đơn đã thanh toán",
    icon: "workspace_premium",
    tone: "bg-amber-50 text-amber-700",
    suffix: "đơn",
  },
  {
    key: "revenue",
    label: "Doanh thu",
    icon: "payments",
    tone: "bg-violet-50 text-violet-700",
    isMoney: true,
    caption: "Chưa trừ phí PayOS",
  },
];

function getGreeting() {
  const hour = Math.floor(minutesNowInVietnam() / 60);
  if (hour < 11) return "Chào buổi sáng";
  if (hour < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}

// Đủ 14 ga, số Active khớp metro-clusters; ngưỡng thiếu và bán kính lấy từ Cấu hình hệ thống
const loadStationCoverage = () => adminStationService.getStations();

// BE-93 đổi admin/places sang PagedResult ⇒ khi đó cần API đếm riêng thay vì tải cả danh sách
async function loadPlaceSummary() {
  const data = await adminPlaceService.getPlaces();
  const places = Array.isArray(data) ? data : data?.items ?? [];
  return {
    pending: places.filter((place) => place.status === "Pending").length,
    unverified: places.filter((place) => place.status === "Active" && !place.isVerified).length,
  };
}

// Tải 1 khối dữ liệu. status: "idle" (thiếu quyền, không gọi) | "loading" | "ready" | "error"
// | "unavailable" (BE chưa có endpoint ⇒ 404, hiện "Chờ API" thay vì báo lỗi).
// fieldErrors: lỗi 400 invalid_dashboard_query theo ô. Đổi `load` (vd đổi khoảng ngày) ⇒ tự tải lại.
function useDashboardData(load, enabled) {
  const [state, setState] = useState({ source: null, status: "loading", error: "", fieldErrors: null, data: null });
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    load()
      .then((data) => {
        if (active) setState({ source: load, status: "ready", error: "", fieldErrors: null, data });
      })
      .catch((err) => {
        if (!active) return;
        const fieldErrors = getDashboardFieldErrors(err);
        setState({
          source: load,
          status: err?.status === 404 ? "unavailable" : "error",
          error: fieldErrors ? "Bộ lọc chưa hợp lệ, kiểm tra lại ô được đánh dấu." : err?.message || "Không tải được dữ liệu.",
          fieldErrors,
          data: null,
        });
      });
    return () => {
      active = false;
    };
  }, [load, enabled, retryKey]);

  const retry = () => {
    setState((current) => ({ ...current, source: null }));
    setRetryKey((key) => key + 1);
  };

  const status = !enabled ? "idle" : state.source === load ? state.status : "loading";
  return {
    status,
    error: state.error,
    fieldErrors: status === "error" ? state.fieldErrors : null,
    data: status === "ready" ? state.data : null,
    retry,
  };
}

function SectionHeading({ id, title, description, badge, action }) {
  return (
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 id={id} className="text-lg font-bold text-navy-darkest">{title}</h2>
          {badge && (
            <span className="rounded-full bg-surface-container-low px-2.5 py-1 text-xs font-semibold text-text-muted">{badge}</span>
          )}
        </div>
        {description && <p className="mt-1 text-sm text-text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

function MetricCard({ label, value, suffix, caption, icon, tone, loading }) {
  return (
    <div className={`${CARD} p-5`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">{label}</p>
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-[10px] ${tone}`}>
          <span className="material-symbols-outlined text-[22px]">{icon}</span>
        </span>
      </div>
      {loading ? (
        <div className="mt-3 h-9 w-24 animate-pulse rounded-md bg-surface-container-low" />
      ) : (
        <p className="mt-2 flex flex-wrap items-baseline gap-x-2">
          <span className="text-[28px] font-bold leading-tight tracking-tight text-navy-darkest">{value}</span>
          {suffix && <span className="text-sm font-medium text-text-muted">{suffix}</span>}
        </p>
      )}
      {caption && <p className="mt-3 text-xs leading-5 text-text-muted">{caption}</p>}
    </div>
  );
}

function InlineError({ message, onRetry }) {
  return (
    <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl border border-error-container bg-error-container/40 px-4 py-3 text-sm text-on-error-container">
      <span>{message}</span>
      <button type="button" onClick={onRetry} className="shrink-0 font-semibold underline-offset-2 hover:underline">
        Thử lại
      </button>
    </div>
  );
}

// Khung 1 panel: tự hiện loading / chờ API / lỗi / rỗng; chỉ render children khi có dữ liệu
function DataPanel({ title, description, action, icon, source, pendingText, emptyText, isEmpty, className = "", children }) {
  let body;
  if (source.status === "loading") {
    body = <div className="mt-5 h-48 animate-pulse rounded-2xl bg-surface-container-low" />;
  } else if (source.status === "error") {
    body = (
      <div className="mt-5">
        <InlineError message={source.error} onRetry={source.retry} />
      </div>
    );
  } else if (source.status === "unavailable" || isEmpty) {
    body = (
      <div className="grid flex-1 place-items-center py-8 text-center">
        <div className="max-w-xs">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-surface-container-low text-text-faint">
            <span className="material-symbols-outlined text-[26px]">{icon}</span>
          </span>
          <p className="mt-3 text-sm leading-6 text-text-muted">{source.status === "unavailable" ? pendingText : emptyText}</p>
        </div>
      </div>
    );
  } else {
    body = children;
  }

  return (
    <div className={`${CARD} flex min-h-64 flex-col p-6 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-navy-darkest">{title}</h3>
          {description && <p className="mt-1 text-sm text-text-muted">{description}</p>}
        </div>
        {action}
      </div>
      {body}
    </div>
  );
}

function coverageTone(station) {
  if (station.totals.active === 0) return { bar: "bg-error", text: "text-error" };
  if (station.isUnderstocked) return { bar: "bg-amber-400", text: "text-amber-600" };
  return { bar: "bg-navy-mid", text: "text-navy-darkest" };
}

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const canManagePlaces = hasAnyPermission(user, [ADMIN_PERMISSIONS.MANAGE_PLACES]);
  const canViewRevenue = hasAnyPermission(user, [ADMIN_PERMISSIONS.VIEW_REVENUE]);
  const quickActions = ADMIN_SECTIONS.filter((section) => hasAnyPermission(user, section.permissions));

  const [rangePreset, setRangePreset] = useState(DEFAULT_RANGE_PRESET);
  const [range, setRange] = useState(() => resolvePresetRange(DEFAULT_RANGE_PRESET));
  const [stationLimit, setStationLimit] = useState(DEFAULT_STATION_LIMIT);
  const monthOptions = recentMonths();
  const [month, setMonth] = useState(monthOptions[0]);

  const loadSummary = useCallback(() => adminDashboardService.getSummary(range), [range]);
  const loadRevenueDaily = useCallback(() => adminDashboardService.getRevenueDaily(range), [range]);
  const loadTripsFinalizedDaily = useCallback(
    () => adminDashboardService.getTripsFinalizedDaily(range),
    [range],
  );
  const loadTopStations = useCallback(
    () => adminDashboardService.getTopStations({ ...range, limit: stationLimit }),
    [range, stationLimit],
  );
  const loadBreakEven = useCallback(() => adminDashboardService.getBreakEven({ month }), [month]);

  const coverage = useDashboardData(loadStationCoverage, canManagePlaces);
  const placeSummary = useDashboardData(loadPlaceSummary, canManagePlaces);
  const summary = useDashboardData(loadSummary, canViewRevenue);
  const revenueDaily = useDashboardData(loadRevenueDaily, canViewRevenue);
  const tripsFinalizedDaily = useDashboardData(loadTripsFinalizedDaily, canViewRevenue);
  const topStations = useDashboardData(loadTopStations, canViewRevenue);
  const breakEven = useDashboardData(loadBreakEven, canViewRevenue);

  const stations = coverage.data?.stations ?? [];
  const minActivePlaces = coverage.data?.minActivePlacesPerStation;
  const radiusMeters = coverage.data?.radiusMeters;
  const stationsWithData = stations.filter((station) => station.totals.active > 0).length;
  const totalPlaces = stations.reduce((sum, station) => sum + station.totals.active, 0);
  const lowStations = stations
    .filter((station) => station.isUnderstocked)
    .sort((a, b) => a.totals.active - b.totals.active || a.order - b.order);
  const maxCount = Math.max(1, ...stations.map((station) => station.totals.active));
  const isLoading = (source) => source.status === "loading";

  const handlePresetChange = (key) => {
    if (key === rangePreset) return;
    setRangePreset(key);
    // "Tùy chọn": giữ khoảng đang xem tới khi bấm Áp dụng
    if (key !== "custom") setRange(resolvePresetRange(key));
  };

  const rangeSources = [summary, revenueDaily, tripsFinalizedDaily, topStations];
  const rangeErrorSource = rangeSources.find((source) => source.fieldErrors?.from || source.fieldErrors?.to);
  const rangeFieldErrors = rangeErrorSource
    ? { from: rangeErrorSource.fieldErrors.from, to: rangeErrorSource.fieldErrors.to }
    : null;
  const businessSources = [...rangeSources, breakEven];
  const refreshing = businessSources.some(isLoading);
  // BE cache 5 phút ⇒ tải lại trong 5 phút vẫn ra số cũ
  const refreshBusiness = () => businessSources.forEach((source) => source.retry());
  const updatedAt = summary.data?.generatedAt;

  return (
    <div className="space-y-10">
      <AdminPageHeader
        eyebrow={`${getGreeting()}, ${user?.fullName || "quản trị viên"}`}
        title="Tổng quan vận hành"
        description="Theo dõi độ phủ dữ liệu quanh 14 ga Metro số 1, việc cần xử lý và chỉ số kinh doanh của LocalMate."
      >
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-[#dde1ff] px-3.5 py-1.5 text-sm font-semibold text-navy-mid">
          <span className="material-symbols-outlined text-[18px]">calendar_today</span>
          {formatPlannedDate(todayInVietnam())}
        </span>
      </AdminPageHeader>

      {canManagePlaces && (
        <section aria-labelledby="coverage-title" className="space-y-4">
          <SectionHeading
            id="coverage-title"
            title="Dữ liệu địa điểm quanh ga"
            description={
              radiusMeters
                ? `Địa điểm đang hoạt động trong bán kính ${countFormatter.format(radiusMeters)} m, mỗi địa điểm tính cho ga gần nhất.`
                : "Địa điểm đang hoạt động quanh ga, mỗi địa điểm tính cho ga gần nhất."
            }
            action={
              <Link to="/admin/stations" className="inline-flex items-center gap-1 text-sm font-semibold text-navy-mid hover:text-navy-darkest">
                Quản lý Ga Metro
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </Link>
            }
          />

          {coverage.status === "error" && <InlineError message={coverage.error} onRetry={coverage.retry} />}
          {placeSummary.status === "error" && <InlineError message={placeSummary.error} onRetry={placeSummary.retry} />}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Ga có dữ liệu"
              icon="directions_subway"
              tone="bg-sky-50 text-sky-700"
              loading={isLoading(coverage)}
              value={coverage.data ? stationsWithData : "—"}
              suffix={coverage.data ? `/ ${stations.length} ga` : null}
              caption="Có ít nhất 1 địa điểm quanh ga"
            />
            <MetricCard
              label="Địa điểm quanh ga"
              icon="location_on"
              tone="bg-emerald-50 text-emerald-700"
              loading={isLoading(coverage)}
              value={coverage.data ? countFormatter.format(totalPlaces) : "—"}
              suffix={coverage.data ? "địa điểm" : null}
              caption="Tổng của cả 14 ga"
            />
            <MetricCard
              label="Ga thiếu dữ liệu"
              icon="report"
              tone="bg-rose-50 text-rose-700"
              loading={isLoading(coverage)}
              value={coverage.data ? lowStations.length : "—"}
              suffix={coverage.data ? "ga" : null}
              caption={
                minActivePlaces
                  ? `Dưới ${minActivePlaces} địa điểm, dễ không tạo được lịch trình`
                  : "Dưới ngưỡng tối thiểu, dễ không tạo được lịch trình"
              }
            />
            <MetricCard
              label="Chờ duyệt"
              icon="pending_actions"
              tone="bg-amber-50 text-amber-700"
              loading={isLoading(placeSummary)}
              value={placeSummary.data ? placeSummary.data.pending : "—"}
              suffix={placeSummary.data ? "địa điểm" : null}
              caption={placeSummary.data ? `${placeSummary.data.unverified} địa điểm đang hiển thị chưa xác minh` : null}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <div className={`${CARD} p-6 xl:col-span-2`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-bold text-navy-darkest">Độ phủ theo ga</h3>
                <div className="flex flex-wrap gap-3 text-xs text-text-muted">
                  <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-navy-mid" />Đủ dữ liệu</span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400" />Dưới {minActivePlaces ?? "ngưỡng"}</span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-error" />Chưa có</span>
                </div>
              </div>

              {isLoading(coverage) ? (
                <div className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
                  {Array.from({ length: 8 }, (_, index) => (
                    <div key={index} className="h-10 animate-pulse rounded-md bg-surface-container-low" />
                  ))}
                </div>
              ) : (
                <ul className="mt-4 grid gap-x-8 sm:grid-cols-2">
                  {stations.map((station) => {
                    const tone = coverageTone(station);
                    return (
                      <li key={station.id} className="flex items-center gap-3 border-b border-[#f1f3f9] py-3">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-surface-container-low text-xs font-bold text-navy-darkest">
                          {String(station.order).padStart(2, "0")}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-semibold text-on-surface">{station.name}</p>
                            <span className={`shrink-0 text-sm font-bold ${tone.text}`}>{station.totals.active}</span>
                          </div>
                          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-container-low">
                            <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${(station.totals.active / maxCount) * 100}%` }} />
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className={`${CARD} flex flex-col p-6`}>
              <h3 className="font-bold text-navy-darkest">Ga cần bổ sung dữ liệu</h3>
              <p className="mt-1 text-sm text-text-muted">Ưu tiên thêm địa điểm cho các ga này.</p>

              {isLoading(coverage) ? (
                <div className="mt-4 space-y-3">
                  {Array.from({ length: 4 }, (_, index) => (
                    <div key={index} className="h-12 animate-pulse rounded-md bg-surface-container-low" />
                  ))}
                </div>
              ) : lowStations.length === 0 ? (
                <div className="grid flex-1 place-items-center py-8 text-center">
                  <div>
                    <span className="material-symbols-outlined text-[32px] text-emerald-600">task_alt</span>
                    <p className="mt-2 text-sm text-text-muted">
                      {coverage.data ? "Tất cả ga đã đủ dữ liệu." : "Chưa tải được dữ liệu ga."}
                    </p>
                  </div>
                </div>
              ) : (
                <ul className="mt-4 flex-1 space-y-2">
                  {lowStations.map((station) => {
                    const tone = coverageTone(station);
                    return (
                      <li key={station.id} className="flex items-center justify-between gap-3 rounded-[10px] bg-surface px-3.5 py-2.5">
                        <span className="min-w-0 truncate text-sm font-medium text-on-surface">
                          <span className="mr-2 text-xs font-bold text-text-faint">{String(station.order).padStart(2, "0")}</span>
                          {station.name}
                        </span>
                        <span className={`shrink-0 text-xs font-semibold ${tone.text}`}>
                          {station.totals.active === 0 ? "Chưa có" : `${station.totals.active} địa điểm`} · thiếu {station.shortfall}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}

              <Link
                to="/admin/places"
                className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-[10px] bg-navy-darkest px-4 text-sm font-semibold text-white transition hover:bg-navy-dark"
              >
                <span className="material-symbols-outlined text-[20px]">add_circle</span>
                Thêm địa điểm
              </Link>
            </div>
          </div>
        </section>
      )}

      {canViewRevenue && (
        <section aria-labelledby="business-title" className="space-y-4">
          <SectionHeading
            id="business-title"
            title="Kinh doanh"
            description={`Từ ${formatDayLabel(range.from)} đến ${formatDayLabel(range.to)} · ${countDays(range)} ngày, theo giờ Việt Nam.`}
            badge={summary.status === "unavailable" ? "Chờ API thống kê" : null}
            action={
              <DashboardRangeFilter
                preset={rangePreset}
                range={range}
                serverErrors={rangeFieldErrors}
                onPresetChange={handlePresetChange}
                onApplyCustom={setRange}
              />
            }
          />

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
            {updatedAt && <span>Cập nhật lúc {formatTimeInVietnam(updatedAt)}</span>}
            <span>Số liệu được làm mới sau mỗi 5 phút.</span>
            <button
              type="button"
              onClick={refreshBusiness}
              disabled={refreshing}
              className="inline-flex items-center gap-1 font-semibold text-navy-mid transition hover:text-navy-darkest disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-[16px] ${refreshing ? "animate-spin" : ""}`}>refresh</span>
              Tải lại
            </button>
          </div>

          {summary.status === "error" && <InlineError message={summary.error} onRetry={summary.retry} />}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {BUSINESS_METRICS.map((metric) => {
              const raw = summary.data?.[metric.key];
              const hasValue = typeof raw === "number";
              return (
                <MetricCard
                  key={metric.key}
                  label={metric.label}
                  icon={metric.icon}
                  tone={metric.tone}
                  loading={isLoading(summary)}
                  value={hasValue ? (metric.isMoney ? vndFormatter.format(raw) : countFormatter.format(raw)) : "—"}
                  suffix={hasValue && !metric.isMoney ? metric.suffix : null}
                  caption={summary.status === "unavailable" ? "Chờ API thống kê" : metric.caption}
                />
              );
            })}
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <DataPanel
              className="xl:col-span-2"
              title="Doanh thu theo ngày"
              icon="monitoring"
              source={revenueDaily}
              isEmpty={!revenueDaily.data?.days?.length || revenueDaily.data.totalRevenue === 0}
              pendingText="Biểu đồ doanh thu PayOS từng ngày sẽ hiển thị khi hệ thống có API thống kê."
              emptyText="Chưa có đơn thanh toán trong khoảng này."
            >
              <RevenueChart days={revenueDaily.data?.days ?? []} totalRevenue={revenueDaily.data?.totalRevenue ?? 0} />
            </DataPanel>
            <DataPanel
              title="Ga được chọn nhiều nhất"
              icon="leaderboard"
              source={topStations}
              isEmpty={!topStations.data?.stations?.length}
              pendingText="Xếp hạng ga theo số lịch trình được tạo sẽ hiển thị khi hệ thống có API thống kê."
              emptyText="Chưa có lịch trình nào trong khoảng này."
              action={
                <label className="flex items-center gap-2 text-xs text-text-muted">
                  Hiển thị
                  <select
                    value={stationLimit}
                    onChange={(event) => setStationLimit(Number(event.target.value))}
                    className={SELECT_CLASS}
                  >
                    {STATION_LIMIT_OPTIONS.map((limit) => (
                      <option key={limit} value={limit}>{limit === 14 ? "Tất cả" : `Top ${limit}`}</option>
                    ))}
                  </select>
                </label>
              }
            >
              <TopStationList stations={topStations.data?.stations ?? []} totalTrips={topStations.data?.totalTrips ?? 0} />
            </DataPanel>
          </div>

          <DataPanel
            title="Lịch trình đã chốt theo ngày"
            icon="task_alt"
            source={tripsFinalizedDaily}
            isEmpty={!tripsFinalizedDaily.data?.days?.length || tripsFinalizedDaily.data.totalTripsFinalized === 0}
            pendingText="Biểu đồ lịch trình đã chốt từng ngày sẽ hiển thị khi hệ thống có API thống kê."
            emptyText="Chưa có lịch trình nào được chốt trong khoảng này."
          >
            <TripsFinalizedChart
              days={tripsFinalizedDaily.data?.days ?? []}
              total={tripsFinalizedDaily.data?.totalTripsFinalized ?? 0}
            />
          </DataPanel>

          <DataPanel
            title="Tiến độ hoà vốn"
            description="Doanh thu tháng so với mục tiêu hoà vốn, không phụ thuộc khoảng ngày ở trên."
            icon="flag"
            source={breakEven}
            pendingText="Tiến độ hoà vốn sẽ hiển thị khi hệ thống có API thống kê."
            action={
              <div className="flex flex-col items-end gap-1">
                <label className="flex items-center gap-2 text-xs text-text-muted">
                  Tháng
                  <select value={month} onChange={(event) => setMonth(event.target.value)} className={SELECT_CLASS}>
                    {monthOptions.map((value) => (
                      <option key={value} value={value}>{formatMonthLabel(value)}</option>
                    ))}
                  </select>
                </label>
                {breakEven.fieldErrors?.month && <p className="text-xs text-error">{breakEven.fieldErrors.month}</p>}
              </div>
            }
          >
            {breakEven.data && <BreakEvenCard data={breakEven.data} />}
          </DataPanel>
        </section>
      )}

      <section aria-labelledby="quick-actions-title" className="space-y-4">
        <SectionHeading id="quick-actions-title" title="Truy cập nhanh" description="Các chức năng bạn được cấp quyền." />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {quickActions.map((action) => (
            <Link
              key={action.path}
              to={`/admin/${action.path}`}
              className={`${CARD} group p-5 transition hover:-translate-y-0.5 hover:border-navy-mid/30 hover:shadow-[0_14px_32px_rgba(15,23,42,.08)]`}
            >
              <span className={`grid h-11 w-11 place-items-center rounded-[10px] ${action.tone}`}>
                <span className="material-symbols-outlined text-[22px]">{action.icon}</span>
              </span>
              <div className="mt-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-navy-darkest">{action.label}</h3>
                  <p className="mt-1.5 text-sm leading-6 text-text-muted">{action.description}</p>
                </div>
                <span className="material-symbols-outlined mt-0.5 text-[20px] text-text-faint transition group-hover:translate-x-1 group-hover:text-navy-mid">
                  arrow_forward
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
