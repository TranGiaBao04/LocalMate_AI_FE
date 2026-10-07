import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import AdminPageHeader from "../../components/admin/AdminPageHeader";
import { ADMIN_SECTIONS } from "../../components/admin/adminSections";
import { AdminSurface, AdminErrorState, EmptyState, LoadingState } from "../../components/admin/ui";
import { ADMIN_PRIMARY_BUTTON, ADMIN_SECONDARY_BUTTON, ADMIN_SELECT } from "../../components/admin/adminStyles";
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

const SELECT_CLASS = ADMIN_SELECT + " !w-auto";

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

function SectionHeading({ id, title, description, action }) {
  return (
    <div className="flex min-w-0 flex-col justify-between gap-4 lg:flex-row lg:items-end">
      <div className="min-w-0">
        <h2 id={id} className="text-lg font-bold leading-[26px] text-[#0F2148]">{title}</h2>
        {description && <p className="mt-1 text-sm leading-[22px] text-[#5C6B8A]">{description}</p>}
      </div>
      {action}
    </div>
  );
}

function MetricCard({ label, value, suffix, caption, icon, tone, loading }) {
  return (
    <AdminSurface as="article" aria-label={label} className="flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-semibold leading-[18px] text-[#5C6B8A]">{label}</p>
        <span aria-hidden="true" className={`grid h-9 w-9 shrink-0 place-items-center rounded-[10px] ${tone}`}>
          <span className="material-symbols-outlined text-[20px]">{icon}</span>
        </span>
      </div>
      <div className="mt-3">
        {loading ? <LoadingState variant="inline" label={`Đang tải ${label.toLowerCase()}...`} /> : (
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="break-words text-[28px] font-bold leading-9 tabular-nums text-[#0F2148]">{value}</span>
            {suffix && <span className="text-xs leading-[18px] text-[#5C6B8A]">{suffix}</span>}
          </p>
        )}
      </div>
      {caption && <p className="mt-3 text-xs leading-[18px] text-[#5C6B8A]">{caption}</p>}
    </AdminSurface>
  );
}

function DataPanel({ title, description, action, icon, source, pendingText, emptyText, isEmpty, className = "", children }) {
  return (
    <AdminSurface className={className}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-bold leading-6">{title}</h3>
          {description && <p className="mt-1 text-sm text-[#5C6B8A]">{description}</p>}
        </div>
        {action}
      </div>
      {source.status === "loading" ? <LoadingState label={`Đang tải ${title.toLowerCase()}...`} />
        : source.status === "error" ? <div className="mt-4"><AdminErrorState message={source.error} onRetry={source.retry} /></div>
        : source.status === "unavailable" || isEmpty ? <EmptyState icon={icon} title={source.status === "unavailable" ? "Chờ API thống kê" : "Chưa có dữ liệu"} description={source.status === "unavailable" ? pendingText : emptyText} />
        : children}
    </AdminSurface>
  );
}

function coverageTone(station) {
  if (station.totals.active === 0) return { bar: "bg-red-500", text: "text-red-700", label: "Chưa có dữ liệu" };
  if (station.isUnderstocked) return { bar: "bg-amber-500", text: "text-amber-700", label: "Dưới ngưỡng" };
  return { bar: "bg-[#2C56A8]", text: "text-[#1D3E82]", label: "Đủ dữ liệu" };
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

  const topStationPanel = canViewRevenue && (
    <DataPanel title="Ga được chọn nhiều nhất" icon="leaderboard" source={topStations}
      isEmpty={!topStations.data?.stations?.length}
      pendingText="Xếp hạng ga sẽ hiển thị khi hệ thống có API thống kê."
      emptyText="Chưa có lịch trình nào trong khoảng này."
      description={`Từ ${formatDayLabel(range.from)} đến ${formatDayLabel(range.to)}`}
      action={<label className="flex items-center gap-2 text-[13px] text-[#5C6B8A]">Hiển thị
        <select value={stationLimit} onChange={(event) => setStationLimit(Number(event.target.value))} className={SELECT_CLASS}>
          {STATION_LIMIT_OPTIONS.map((limit) => <option key={limit} value={limit}>{limit === 14 ? "Tất cả" : `Top ${limit}`}</option>)}
        </select>
      </label>}>
      <TopStationList stations={topStations.data?.stations ?? []} totalTrips={topStations.data?.totalTrips ?? 0} />
    </DataPanel>
  );

  return (
    <div className="min-w-0 space-y-8">
      <AdminPageHeader eyebrow="Tổng quan" title={`${getGreeting()}, ${user?.fullName || "quản trị viên"}`}
        description="Tổng quan hoạt động LocalMate.">
        <span className="inline-flex items-center gap-2 text-sm text-[#5C6B8A]">
          <span aria-hidden="true" className="material-symbols-outlined text-[20px]">calendar_today</span>
          {formatPlannedDate(todayInVietnam())}
        </span>
      </AdminPageHeader>

      {canViewRevenue && (
        <section aria-labelledby="business-title" className="space-y-4">
          <SectionHeading id="business-title" title="Kinh doanh"
            description={`Từ ${formatDayLabel(range.from)} đến ${formatDayLabel(range.to)} · ${countDays(range)} ngày, theo giờ Việt Nam.`}
            action={<DashboardRangeFilter preset={rangePreset} range={range} serverErrors={rangeFieldErrors}
              onPresetChange={handlePresetChange} onApplyCustom={setRange} />} />
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs leading-[18px] text-[#5C6B8A]">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {updatedAt && <span>Cập nhật lúc {formatTimeInVietnam(updatedAt)}</span>}
              <span>Số liệu được làm mới sau mỗi 5 phút.</span>
            </div>
            <button type="button" onClick={refreshBusiness} disabled={refreshing} className={ADMIN_SECONDARY_BUTTON}>
              <span aria-hidden="true" className={`material-symbols-outlined text-[20px] ${refreshing ? "animate-spin motion-reduce:animate-none" : ""}`}>refresh</span>
              Tải lại
            </button>
          </div>
          {summary.status === "error" && <AdminErrorState message={summary.error} onRetry={summary.retry} />}
          <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {BUSINESS_METRICS.map((metric) => {
              const raw = summary.data?.[metric.key];
              const hasValue = typeof raw === "number";
              return <MetricCard key={metric.key} label={metric.label} icon={metric.icon} tone={metric.tone}
                loading={isLoading(summary)}
                value={hasValue ? (metric.isMoney ? vndFormatter.format(raw) : countFormatter.format(raw)) : "—"}
                suffix={hasValue && !metric.isMoney ? metric.suffix : null}
                caption={summary.status === "unavailable" ? "Chờ API thống kê" : metric.caption} />;
            })}
          </div>
          <div className="grid min-w-0 gap-4 lg:grid-cols-2">
            <DataPanel title="Doanh thu theo ngày" icon="monitoring" source={revenueDaily}
              isEmpty={!revenueDaily.data?.days?.length || revenueDaily.data.totalRevenue === 0}
              pendingText="Biểu đồ doanh thu PayOS từng ngày sẽ hiển thị khi hệ thống có API thống kê."
              emptyText="Chưa có đơn thanh toán trong khoảng này.">
              <RevenueChart days={revenueDaily.data?.days ?? []} totalRevenue={revenueDaily.data?.totalRevenue ?? 0} />
            </DataPanel>
            <DataPanel title="Lịch trình đã chốt theo ngày" icon="task_alt" source={tripsFinalizedDaily}
              isEmpty={!tripsFinalizedDaily.data?.days?.length || tripsFinalizedDaily.data.totalTripsFinalized === 0}
              pendingText="Biểu đồ lịch trình đã chốt từng ngày sẽ hiển thị khi hệ thống có API thống kê."
              emptyText="Chưa có lịch trình nào được chốt trong khoảng này.">
              <TripsFinalizedChart days={tripsFinalizedDaily.data?.days ?? []} total={tripsFinalizedDaily.data?.totalTripsFinalized ?? 0} />
            </DataPanel>
          </div>
        </section>
      )}

      {canManagePlaces && (
        <section aria-labelledby="coverage-title" className="space-y-4">
          <SectionHeading id="coverage-title" title="Dữ liệu địa điểm quanh ga"
            description={radiusMeters ? `Địa điểm đang hoạt động trong bán kính ${countFormatter.format(radiusMeters)} m, mỗi địa điểm tính cho ga gần nhất.` : "Địa điểm đang hoạt động quanh ga, mỗi địa điểm tính cho ga gần nhất."}
            action={<Link to="/admin/stations" className={ADMIN_SECONDARY_BUTTON}>Quản lý Ga Metro<span aria-hidden="true" className="material-symbols-outlined text-[20px]">arrow_forward</span></Link>} />
          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard label="Ga có dữ liệu" icon="directions_subway" tone="bg-sky-50 text-sky-700"
              loading={isLoading(coverage)} value={coverage.data ? stationsWithData : "—"}
              suffix={coverage.data ? `/ ${stations.length} ga` : null} caption="Có ít nhất 1 địa điểm quanh ga" />
            <MetricCard label="Địa điểm quanh ga" icon="location_on" tone="bg-teal-50 text-teal-700"
              loading={isLoading(coverage)} value={coverage.data ? countFormatter.format(totalPlaces) : "—"}
              suffix={coverage.data ? "địa điểm" : null} caption="Tổng của cả 14 ga" />
            <MetricCard label="Ga thiếu dữ liệu" icon="report" tone="bg-amber-50 text-amber-700"
              loading={isLoading(coverage)} value={coverage.data ? lowStations.length : "—"}
              suffix={coverage.data ? "ga" : null} caption={minActivePlaces ? `Dưới ${minActivePlaces} địa điểm, dễ không tạo được lịch trình` : "Dưới ngưỡng tối thiểu, dễ không tạo được lịch trình"} />
          </div>
          <div className={`grid min-w-0 items-start gap-4 ${canViewRevenue ? "xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]" : ""}`}>
            <DataPanel title="Độ phủ theo ga" icon="directions_subway" source={coverage}
              isEmpty={coverage.status === "ready" && stations.length === 0}
              pendingText="Dữ liệu độ phủ sẽ hiển thị khi hệ thống có API." emptyText="Chưa có dữ liệu ga.">
              <div className="mt-4 flex flex-wrap gap-3 text-xs text-[#5C6B8A]">
                <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="h-2 w-2 rounded-full bg-[#2C56A8]" />Đủ dữ liệu</span>
                <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="h-2 w-2 rounded-full bg-amber-500" />Dưới {minActivePlaces ?? "ngưỡng"}</span>
                <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="h-2 w-2 rounded-full bg-red-500" />Chưa có dữ liệu</span>
              </div>
              <ul className="mt-2 grid gap-x-6 sm:grid-cols-2">
                {stations.map((station) => {
                  const tone = coverageTone(station);
                  return <li key={station.id} className="flex min-w-0 items-center gap-3 border-b border-[#DCE2EE]/60 py-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] bg-[#F4F6FA] text-xs font-semibold text-[#5C6B8A]">{String(station.order).padStart(2, "0")}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 break-words text-sm font-medium">{station.name}</p>
                        <span className={`shrink-0 font-bold tabular-nums ${tone.text}`}>{station.totals.active}</span>
                      </div>
                      <span className="sr-only">{tone.label}</span>
                      <div aria-hidden="true" className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#F4F6FA]">
                        <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${(station.totals.active / maxCount) * 100}%` }} />
                      </div>
                    </div>
                  </li>;
                })}
              </ul>
            </DataPanel>
            {topStationPanel}
          </div>
        </section>
      )}
      {!canManagePlaces && topStationPanel}

      {canViewRevenue && (
        <section aria-labelledby="financial-title">
          <h2 id="financial-title" className="sr-only">Phân tích tài chính tháng</h2>
          <DataPanel title="Tiến độ hoà vốn" description="Doanh thu tháng so với mục tiêu hoà vốn, không phụ thuộc khoảng ngày ở trên."
            icon="flag" source={breakEven} pendingText="Tiến độ hoà vốn sẽ hiển thị khi hệ thống có API thống kê."
            action={<div className="min-w-0 space-y-1">
              <label className="flex items-center gap-2 text-[13px] text-[#5C6B8A]">Tháng
                <select value={month} onChange={(event) => setMonth(event.target.value)} className={SELECT_CLASS}
                  aria-invalid={Boolean(breakEven.fieldErrors?.month)} aria-describedby={breakEven.fieldErrors?.month ? "break-even-month-error" : undefined}>
                  {monthOptions.map((value) => <option key={value} value={value}>{formatMonthLabel(value)}</option>)}
                </select>
              </label>
              {breakEven.fieldErrors?.month && <p id="break-even-month-error" role="alert" className="text-xs text-red-700">{breakEven.fieldErrors.month}</p>}
            </div>}>
            {breakEven.data && <BreakEvenCard data={breakEven.data} />}
          </DataPanel>
        </section>
      )}

      {canManagePlaces && (
        <section aria-labelledby="attention-title" className="space-y-4">
          <SectionHeading id="attention-title" title="Cần chú ý" description="Ưu tiên bổ sung dữ liệu và kiểm tra địa điểm." />
          <div className="grid min-w-0 items-start gap-4 lg:grid-cols-2">
            <DataPanel title="Ga cần bổ sung dữ liệu" icon="task_alt" source={coverage}
              isEmpty={coverage.status === "ready" && lowStations.length === 0}
              pendingText="Chưa có API dữ liệu ga." emptyText="Tất cả ga đã đủ dữ liệu.">
              <ul className="mt-4 divide-y divide-[#DCE2EE]/60">
                {lowStations.map((station) => <li key={station.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <span className="min-w-0 text-sm font-medium"><span className="mr-2 text-xs text-[#8993AC]">{String(station.order).padStart(2, "0")}</span>{station.name}</span>
                  <span className={`text-xs font-semibold ${coverageTone(station).text}`}>{station.totals.active === 0 ? "Chưa có" : `${station.totals.active} địa điểm`} · thiếu {station.shortfall}</span>
                </li>)}
              </ul>
              <Link to="/admin/places" className={`mt-4 ${ADMIN_PRIMARY_BUTTON}`}><span aria-hidden="true" className="material-symbols-outlined text-[20px]">add_circle</span>Thêm địa điểm</Link>
            </DataPanel>
            <DataPanel title="Địa điểm cần kiểm tra" icon="pending_actions" source={placeSummary}
              pendingText="Chưa có API địa điểm." description="Trong trang địa điểm được API trả về, không phải tổng toàn hệ thống.">
              {placeSummary.data && <dl className="mt-4 divide-y divide-[#DCE2EE]">
                <div className="flex items-center justify-between gap-3 py-4"><dt>Chờ duyệt trong trang</dt><dd className="text-xl font-bold tabular-nums">{countFormatter.format(placeSummary.data.pending)}</dd></div>
                <div className="flex items-center justify-between gap-3 py-4"><dt>Đang hiển thị, chưa xác minh trong trang</dt><dd className="text-xl font-bold tabular-nums">{countFormatter.format(placeSummary.data.unverified)}</dd></div>
              </dl>}
            </DataPanel>
          </div>
        </section>
      )}

      <section aria-labelledby="quick-actions-title" className="space-y-4">
        <SectionHeading id="quick-actions-title" title="Truy cập nhanh" description="Các chức năng bạn được cấp quyền." />
        <nav aria-label="Truy cập nhanh" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {quickActions.map((action) => <Link key={action.path} to={`/admin/${action.path}`}
            className="flex min-h-11 min-w-0 items-center gap-3 rounded-[12px] border border-[#DCE2EE] bg-white p-4 text-sm font-semibold text-[#1D3E82] transition-colors hover:bg-[#F8FAFC] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2C56A8] motion-reduce:transition-none">
            <span aria-hidden="true" className="material-symbols-outlined text-[20px] text-[#5C6B8A]">{action.icon}</span>
            <span className="min-w-0 flex-1">{action.label}</span>
            <span aria-hidden="true" className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </Link>)}
        </nav>
      </section>
    </div>
  );
}
