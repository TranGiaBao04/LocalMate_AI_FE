import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { ADMIN_SECTIONS } from "../../components/admin/adminSections";
import { ADMIN_PERMISSIONS } from "../../constants";
import { adminDashboardService } from "../../services/adminDashboardService";
import { adminPlaceService } from "../../services/adminPlaceService";
import { masterDataService } from "../../services/masterDataService";
import { placeService } from "../../services/placeService";
import { hasAnyPermission } from "../../utils/adminAccess";
import { addDays, formatPlannedDate, minutesNowInVietnam, todayInVietnam } from "../../utils/vnTime";

// Ga dưới mức này (địa điểm trong 800 m) dễ gặp insufficient_candidates khi tạo lịch trình
const LOW_COVERAGE_THRESHOLD = 5;
const RANGE_OPTIONS = [7, 30];

const CARD = "rounded-2xl border border-[#eef1f8] bg-white shadow-[0_1px_2px_rgba(15,23,42,.04)]";

const vndFormatter = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const countFormatter = new Intl.NumberFormat("vi-VN");

const BUSINESS_METRICS = [
  { key: "newUsers", label: "Người dùng mới", icon: "person_add", tone: "bg-blue-50 text-blue-700", suffix: "người" },
  { key: "generatedItineraries", label: "Lịch trình đã tạo", icon: "route", tone: "bg-emerald-50 text-emerald-700", suffix: "lịch trình" },
  { key: "paidItineraries", label: "Lịch trình trả phí", icon: "workspace_premium", tone: "bg-amber-50 text-amber-700", suffix: "lịch trình" },
  { key: "revenue", label: "Doanh thu", icon: "payments", tone: "bg-violet-50 text-violet-700", isMoney: true },
];

function getGreeting() {
  const hour = Math.floor(minutesNowInVietnam() / 60);
  if (hour < 11) return "Chào buổi sáng";
  if (hour < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}

// "2026-09-30" -> "30/09"
const formatDayLabel = (isoDate) => `${isoDate.slice(8, 10)}/${isoDate.slice(5, 7)}`;

// 14 ga (master-data) + số địa điểm quanh ga (metro-clusters: 800 m, mỗi địa điểm chỉ gán ga gần nhất).
// Ga chưa có địa điểm không xuất hiện trong clusters ⇒ 0.
async function loadStationCoverage() {
  const [masterData, clusters] = await Promise.all([
    masterDataService.getMasterData(),
    placeService.getMetroClusters(),
  ]);
  const countByStation = new Map((clusters ?? []).map((cluster) => [cluster.stationId, cluster.placeCount]));
  return (masterData?.metroStations ?? [])
    .map((station) => ({ ...station, placeCount: countByStation.get(station.id) ?? 0 }))
    .sort((a, b) => a.order - b.order);
}

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
// Đổi `load` (vd đổi khoảng ngày) ⇒ tự tải lại.
function useDashboardData(load, enabled) {
  const [state, setState] = useState({ source: null, status: "loading", error: "", data: null });
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    load()
      .then((data) => {
        if (active) setState({ source: load, status: "ready", error: "", data });
      })
      .catch((err) => {
        if (!active) return;
        setState({
          source: load,
          status: err?.status === 404 ? "unavailable" : "error",
          error: err?.message || "Không tải được dữ liệu.",
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
  return { status, error: state.error, data: status === "ready" ? state.data : null, retry };
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
function DataPanel({ title, icon, source, pendingText, emptyText, isEmpty, className = "", children }) {
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
      <h3 className="font-bold text-navy-darkest">{title}</h3>
      {body}
    </div>
  );
}

function RevenueChart({ days }) {
  const max = Math.max(1, ...days.map((day) => day.revenue));
  return (
    <div className="mt-5">
      <div className="flex h-48 items-end gap-1.5">
        {days.map((day) => (
          <div
            key={day.date}
            title={`${formatDayLabel(day.date)}: ${vndFormatter.format(day.revenue)} · ${day.paidOrders} đơn`}
            className="flex-1 rounded-t-md bg-navy-mid/80 transition hover:bg-navy-darkest"
            style={{ height: `${Math.max(2, (day.revenue / max) * 100)}%` }}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-text-faint">
        <span>{formatDayLabel(days[0].date)}</span>
        <span>{formatDayLabel(days[days.length - 1].date)}</span>
      </div>
    </div>
  );
}

function TopStationList({ stations }) {
  const max = Math.max(1, ...stations.map((station) => station.tripCount));
  return (
    <ol className="mt-4 space-y-3">
      {stations.map((station, index) => (
        <li key={station.stationId} className="flex items-center gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-surface-container-low text-xs font-bold text-navy-darkest">
            {index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-semibold text-on-surface">{station.stationName}</p>
              <span className="shrink-0 text-sm font-bold text-navy-darkest">{countFormatter.format(station.tripCount)}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-container-low">
              <div className="h-full rounded-full bg-navy-mid" style={{ width: `${(station.tripCount / max) * 100}%` }} />
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function coverageTone(count) {
  if (count === 0) return { bar: "bg-error", text: "text-error" };
  if (count < LOW_COVERAGE_THRESHOLD) return { bar: "bg-amber-400", text: "text-amber-600" };
  return { bar: "bg-navy-mid", text: "text-navy-darkest" };
}

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const canManagePlaces = hasAnyPermission(user, [ADMIN_PERMISSIONS.MANAGE_PLACES]);
  const canViewRevenue = hasAnyPermission(user, [ADMIN_PERMISSIONS.VIEW_REVENUE]);
  const quickActions = ADMIN_SECTIONS.filter((section) => hasAnyPermission(user, section.permissions));

  const [rangeDays, setRangeDays] = useState(RANGE_OPTIONS[0]);
  const range = useMemo(() => {
    const to = todayInVietnam();
    return { from: addDays(to, -(rangeDays - 1)), to };
  }, [rangeDays]);

  const loadSummary = useCallback(() => adminDashboardService.getSummary(range), [range]);
  const loadRevenueDaily = useCallback(() => adminDashboardService.getRevenueDaily(range), [range]);
  const loadTopStations = useCallback(() => adminDashboardService.getTopStations(range), [range]);

  const coverage = useDashboardData(loadStationCoverage, canManagePlaces);
  const placeSummary = useDashboardData(loadPlaceSummary, canManagePlaces);
  const summary = useDashboardData(loadSummary, canViewRevenue);
  const revenueDaily = useDashboardData(loadRevenueDaily, canViewRevenue);
  const topStations = useDashboardData(loadTopStations, canViewRevenue);

  const stations = coverage.data ?? [];
  const stationsWithData = stations.filter((station) => station.placeCount > 0).length;
  const totalPlaces = stations.reduce((sum, station) => sum + station.placeCount, 0);
  const lowStations = stations
    .filter((station) => station.placeCount < LOW_COVERAGE_THRESHOLD)
    .sort((a, b) => a.placeCount - b.placeCount || a.order - b.order);
  const maxCount = Math.max(1, ...stations.map((station) => station.placeCount));
  const isLoading = (source) => source.status === "loading";

  return (
    <div className="mx-auto max-w-[1440px] space-y-10">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold text-navy-mid">{getGreeting()}, {user?.fullName || "quản trị viên"}</p>
          <h1 className="mt-1 text-[28px] font-bold leading-tight tracking-tight text-navy-darkest sm:text-[32px]">
            Tổng quan vận hành
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-text-muted">
            Theo dõi độ phủ dữ liệu quanh 14 ga Metro số 1, việc cần xử lý và chỉ số kinh doanh của LocalMate.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-[#dde1ff] px-3.5 py-1.5 text-sm font-semibold text-navy-mid">
          <span className="material-symbols-outlined text-[18px]">calendar_today</span>
          {formatPlannedDate(todayInVietnam())}
        </span>
      </header>

      {canManagePlaces && (
        <section aria-labelledby="coverage-title" className="space-y-4">
          <SectionHeading
            id="coverage-title"
            title="Dữ liệu địa điểm quanh ga"
            description="Địa điểm trong bán kính 800 m, mỗi địa điểm tính cho ga gần nhất."
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
              caption={`Dưới ${LOW_COVERAGE_THRESHOLD} địa điểm, dễ không tạo được lịch trình`}
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
                  <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400" />Dưới {LOW_COVERAGE_THRESHOLD}</span>
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
                    const tone = coverageTone(station.placeCount);
                    return (
                      <li key={station.id} className="flex items-center gap-3 border-b border-[#f1f3f9] py-3">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-surface-container-low text-xs font-bold text-navy-darkest">
                          {String(station.order).padStart(2, "0")}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-semibold text-on-surface">{station.name}</p>
                            <span className={`shrink-0 text-sm font-bold ${tone.text}`}>{station.placeCount}</span>
                          </div>
                          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-container-low">
                            <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${(station.placeCount / maxCount) * 100}%` }} />
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
                    const tone = coverageTone(station.placeCount);
                    return (
                      <li key={station.id} className="flex items-center justify-between gap-3 rounded-[10px] bg-surface px-3.5 py-2.5">
                        <span className="min-w-0 truncate text-sm font-medium text-on-surface">
                          <span className="mr-2 text-xs font-bold text-text-faint">{String(station.order).padStart(2, "0")}</span>
                          {station.name}
                        </span>
                        <span className={`shrink-0 text-xs font-semibold ${tone.text}`}>
                          {station.placeCount === 0 ? "Chưa có" : `${station.placeCount} địa điểm`}
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
            description={`${rangeDays} ngày gần nhất, từ ${formatDayLabel(range.from)} đến ${formatDayLabel(range.to)}.`}
            badge={summary.status === "unavailable" ? "Chờ API thống kê" : null}
            action={
              <div role="group" aria-label="Khoảng thời gian" className="inline-flex rounded-[10px] bg-surface-container-low p-1">
                {RANGE_OPTIONS.map((days) => (
                  <button
                    key={days}
                    type="button"
                    aria-pressed={rangeDays === days}
                    onClick={() => setRangeDays(days)}
                    className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${
                      rangeDays === days ? "bg-white text-navy-darkest shadow-sm" : "text-text-muted hover:text-navy-darkest"
                    }`}
                  >
                    {days} ngày
                  </button>
                ))}
              </div>
            }
          />

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
                  caption={summary.status === "unavailable" ? "Chờ API thống kê" : null}
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
              isEmpty={!revenueDaily.data?.length}
              pendingText="Biểu đồ doanh thu PayOS từng ngày sẽ hiển thị khi hệ thống có API thống kê."
              emptyText="Chưa có giao dịch trong khoảng này."
            >
              <RevenueChart days={revenueDaily.data ?? []} />
            </DataPanel>
            <DataPanel
              title="Ga được chọn nhiều nhất"
              icon="leaderboard"
              source={topStations}
              isEmpty={!topStations.data?.length}
              pendingText="Xếp hạng ga theo số lịch trình được tạo sẽ hiển thị khi hệ thống có API thống kê."
              emptyText="Chưa có lịch trình nào trong khoảng này."
            >
              <TopStationList stations={topStations.data ?? []} />
            </DataPanel>
          </div>
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
