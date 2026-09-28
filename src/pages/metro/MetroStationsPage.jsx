import { useEffect, useState } from "react";
import MobileLayout from "../../components/layout/MobileLayout";
import { masterDataService } from "../../services/masterDataService";
import { metroService } from "../../services/metroService";
import { useClock } from "../../hooks/useClock";
import {
  currentHeadway,
  isBeforeFirstTrip,
  toHHmm,
  upcomingTrips,
} from "../../utils/metroSchedule";
import { addDays, minutesNowInVietnam, todayInVietnam } from "../../utils/vnTime";

const CLOCK_TICK_MS = 30000;
const MODES = [
  { id: "journey", label: "Ga đi → Ga đến" },
  { id: "station", label: "Theo ga" },
];

// Gọi load(...args) khi args đổi; enabled = false thì không gọi.
// load phải là hàm cố định (method của service), không tạo mới mỗi lần render.
function useRequest(load, args, enabled = true) {
  const key = enabled ? args.join("|") : null;
  const [result, setResult] = useState(null); // { key, data } | { key, error }
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!key) return undefined;
    let active = true;
    load(...key.split("|"))
      .then((data) => {
        if (active) setResult({ key, data });
      })
      .catch((err) => {
        if (active) setResult({ key, error: err.message });
      });
    return () => {
      active = false;
    };
  }, [load, key, attempt]);

  const current = result?.key === key ? result : null;
  return {
    data: current?.data ?? null,
    error: current?.error ?? "",
    loading: key != null && !current,
    retry: () => setAttempt((n) => n + 1),
  };
}

const leftText = (minutesLeft) => (minutesLeft === 0 ? "tàu sắp tới" : `sau ${minutesLeft} phút`);

// Banner chung: thông báo của team, lịch có thể cũ, chú thích độ tin cậy
function ScheduleNotices({ data }) {
  return (
    <>
      {data.notice && (
        <p role="status" className="rounded-lg bg-tertiary-container/30 px-4 py-3 text-body-md text-on-surface">
          📢 {data.notice}
        </p>
      )}
      {!data.isWithinEffectivePeriod && (
        <p role="status" className="rounded-lg bg-error-container/20 px-4 py-3 text-body-md text-error">
          Lịch có thể đã thay đổi, hãy kiểm tra lại với thông báo chính thức.
        </p>
      )}
      {data.precision === "Headway" && (
        <p className="text-label-md text-on-surface-variant">
          Giờ ước tính theo tần suất chạy tàu, có thể lệch thực tế vài phút.
        </p>
      )}
    </>
  );
}

function RequestState({ request }) {
  if (request.loading) {
    return <p role="status" className="text-body-md text-on-surface-variant">Đang tải lịch tàu...</p>;
  }
  return (
    <div role="alert" className="flex items-center gap-3 text-body-md text-error">
      <span>{request.error}</span>
      <button type="button" onClick={request.retry} className="font-bold underline">
        Thử lại
      </button>
    </div>
  );
}

function StationSelect({ id, label, icon, value, onChange, stations, excludeOrder }) {
  return (
    <div className="min-w-0 flex-1">
      <label htmlFor={id} className="mb-1.5 ml-1 block text-label-md font-semibold text-on-surface">
        {label}
      </label>
      <div className="relative">
        <span
          className="material-symbols-outlined pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-primary"
          aria-hidden="true"
        >
          {icon}
        </span>
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full cursor-pointer appearance-none truncate rounded-[14px] border-2 border-outline-variant/60 bg-white py-3 pl-11 pr-10 text-body-md font-semibold text-on-surface transition-colors hover:border-primary focus:border-primary focus:outline-none"
        >
          {stations
            .filter((s) => s.order !== excludeOrder)
            .map((s) => (
              <option key={s.id} value={s.order}>
                {String(s.order).padStart(2, "0")} · {s.name}
              </option>
            ))}
        </select>
        <span
          className="material-symbols-outlined pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
          aria-hidden="true"
        >
          expand_more
        </span>
      </div>
    </div>
  );
}

function JourneyPanel({ stations, today, tomorrowDate, nowMinutes }) {
  const [fromOrder, setFromOrder] = useState(1);
  const [toOrder, setToOrder] = useState(14);

  const journey = useRequest(metroService.getJourney, [fromOrder, toOrder, today]);
  const data = journey.data;
  const trips = data?.trips ?? [];
  const upcoming = upcomingTrips(trips, nowMinutes);
  const ended = trips.length > 0 && upcoming.length === 0;
  const notStarted = isBeforeFirstTrip(trips[0]?.departure, nowMinutes);
  // Hết chuyến hôm nay thì lấy lịch ngày mai để báo chuyến đầu
  const tomorrow = useRequest(metroService.getJourney, [fromOrder, toOrder, tomorrowDate], ended);
  const firstTomorrow = tomorrow.data?.trips[0];
  const headway = data ? currentHeadway(data.headways, nowMinutes) : null;

  // Ga đến không được trùng ga đi: đổi ga đi trùng ga đến thì dời ga đến sang ga kế bên
  const changeFrom = (order) => {
    setFromOrder(order);
    if (order === toOrder) setToOrder(order < stations.length ? order + 1 : order - 1);
  };
  const swap = () => {
    setFromOrder(toOrder);
    setToOrder(fromOrder);
  };

  return (
    <div className="space-y-4">
      <div className="card flex items-end gap-3 shadow-md">
        <StationSelect
          id="metro-from"
          label="Ga đi"
          icon="trip_origin"
          value={fromOrder}
          onChange={changeFrom}
          stations={stations}
        />
        <button
          type="button"
          onClick={swap}
          aria-label="Đổi chiều ga đi và ga đến"
          title="Đổi chiều"
          className="mb-0.5 flex h-12 w-12 flex-none items-center justify-center rounded-full bg-primary text-on-primary shadow-md transition-transform hover:opacity-90 active:scale-95"
        >
          <span className="material-symbols-outlined" aria-hidden="true">swap_horiz</span>
        </button>
        <StationSelect
          id="metro-to"
          label="Ga đến"
          icon="location_on"
          value={toOrder}
          onChange={setToOrder}
          stations={stations}
          excludeOrder={fromOrder}
        />
      </div>

      {!data ? (
        <RequestState request={journey} />
      ) : (
        <section className="card space-y-2">
          <h2 className="text-title-md font-bold text-on-surface">
            {data.from.name} → {data.to.name}
          </h2>
          <p className="flex items-center gap-1.5 text-body-md text-on-surface-variant">
            <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">train</span>
            Lên tàu hướng <strong className="text-on-surface">{data.towardStationName}</strong>
          </p>

          {ended ? (
            <>
              <p className="text-body-lg font-semibold text-primary">Đã hết chuyến hôm nay</p>
              {firstTomorrow && (
                <p className="text-body-md text-on-surface-variant">
                  Chuyến đầu ngày mai {toHHmm(firstTomorrow.departure)} → {toHHmm(firstTomorrow.arrival)} (dự kiến)
                </p>
              )}
            </>
          ) : (
            upcoming.length > 0 && (
              <>
                <p className="text-body-lg font-semibold text-primary">
                  {notStarted ? "Chuyến đầu" : "Chuyến kế"} {upcoming[0].departure} → tới {upcoming[0].arrival} (dự kiến)
                  {!notStarted && ` · ${leftText(upcoming[0].minutesLeft)}`}
                </p>
                {upcoming.length > 1 && (
                  <p className="text-body-md text-on-surface-variant">
                    Tiếp theo: {upcoming.slice(1).map((t) => `${t.departure} → ${t.arrival}`).join(" · ")}
                  </p>
                )}
              </>
            )
          )}

          <p className="text-body-md text-on-surface-variant">
            {data.stopCount} ga · khoảng {data.travelMinutes} phút
            {headway != null && ` · khoảng ${headway} phút/chuyến`}
          </p>
          {trips.length > 0 && (
            <p className="text-label-md text-on-surface-variant">
              Chuyến đầu {toHHmm(trips[0].departure)} · chuyến cuối {toHHmm(trips.at(-1).departure)} (dự kiến)
            </p>
          )}
          <ScheduleNotices data={data} />
        </section>
      )}
    </div>
  );
}

function StationPanel({ stations, today, tomorrowDate, nowMinutes }) {
  const [stationOrder, setStationOrder] = useState(1);
  const schedule = useRequest(metroService.getDepartures, [stationOrder, today]);
  const data = schedule.data;

  const directions = (data?.directions ?? []).map((d) => {
    const upcoming = upcomingTrips(
      d.departures.map((departure) => ({ departure })),
      nowMinutes,
    );
    return {
      ...d,
      upcoming,
      ended: d.departures.length > 0 && upcoming.length === 0,
      notStarted: isBeforeFirstTrip(d.departures[0], nowMinutes),
      headway: currentHeadway(d.headways, nowMinutes),
    };
  });
  const anyEnded = directions.some((d) => d.ended);
  // Hết chuyến hôm nay thì lấy lịch ngày mai để báo chuyến đầu
  const tomorrow = useRequest(metroService.getDepartures, [stationOrder, tomorrowDate], anyEnded);
  const firstTomorrow = (direction) =>
    tomorrow.data?.directions.find((d) => d.direction === direction)?.departures[0];

  return (
    <div className="space-y-4">
      {/* Mobile: vuốt ngang. Desktop: xuống dòng cho đủ 14 ga (chuột không cuộn ngang được khi ẩn thanh cuộn) */}
      <div
        role="group"
        aria-label="Chọn ga Metro"
        className="hide-scrollbar flex w-full min-w-0 gap-2 overflow-x-auto pb-1 lg:flex-wrap lg:overflow-visible"
      >
        {stations.map((station) => (
          <button
            key={station.id}
            type="button"
            aria-pressed={station.order === stationOrder}
            onClick={() => setStationOrder(station.order)}
            className={`flex-none whitespace-nowrap rounded-full px-3.5 py-2 text-label-md font-semibold transition-colors ${
              station.order === stationOrder
                ? "bg-primary text-on-primary"
                : "border border-outline-variant text-on-surface-variant hover:border-primary"
            }`}
          >
            {String(station.order).padStart(2, "0")} · {station.name}
          </button>
        ))}
      </div>

      {!data ? (
        <RequestState request={schedule} />
      ) : (
        <>
          <ScheduleNotices data={data} />
          <div className="grid gap-4 lg:grid-cols-2">
            {directions.map((d) => (
              <section key={d.direction} className="card space-y-2">
                <h2 className="flex items-center gap-2 text-title-md font-bold text-on-surface">
                  <span className="material-symbols-outlined text-primary" aria-hidden="true">train</span>
                  Hướng {d.towardStationName}
                </h2>
                {d.ended ? (
                  <>
                    <p className="text-body-lg font-semibold text-primary">Đã hết chuyến hôm nay</p>
                    {firstTomorrow(d.direction) && (
                      <p className="text-body-md text-on-surface-variant">
                        Chuyến đầu ngày mai lúc {toHHmm(firstTomorrow(d.direction))} (dự kiến)
                      </p>
                    )}
                  </>
                ) : (
                  d.upcoming.length > 0 && (
                    <>
                      <p className="text-body-lg font-semibold text-primary">
                        {d.notStarted ? "Chuyến đầu" : "Chuyến kế"} {d.upcoming[0].departure} (dự kiến)
                        {!d.notStarted && ` · ${leftText(d.upcoming[0].minutesLeft)}`}
                      </p>
                      {d.upcoming.length > 1 && (
                        <p className="text-body-md text-on-surface-variant">
                          Tiếp theo: {d.upcoming.slice(1).map((t) => t.departure).join(" · ")}
                        </p>
                      )}
                    </>
                  )
                )}
                {d.headway != null && (
                  <p className="text-body-md text-on-surface-variant">Khoảng {d.headway} phút/chuyến</p>
                )}
                {d.departures.length > 0 && (
                  <p className="text-label-md text-on-surface-variant">
                    Chuyến đầu {toHHmm(d.departures[0])} · chuyến cuối {toHHmm(d.departures.at(-1))} (dự kiến)
                  </p>
                )}
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function MetroStationsPage() {
  const now = useClock(CLOCK_TICK_MS); // tính lại chuyến kế mỗi 30 giây, không gọi lại API
  const today = todayInVietnam(now);
  const panelProps = {
    today,
    tomorrowDate: addDays(today, 1),
    nowMinutes: minutesNowInVietnam(now),
  };

  const [mode, setMode] = useState("journey");
  const [stations, setStations] = useState([]);
  const [stationsError, setStationsError] = useState(false);

  useEffect(() => {
    masterDataService
      .getMasterData()
      .then((data) => setStations([...data.metroStations].sort((a, b) => a.order - b.order)))
      .catch(() => setStationsError(true));
  }, []);

  return (
    <MobileLayout>
      <main className="content-shell flex flex-1 flex-col gap-5 px-container-margin pb-28 pt-6 lg:px-8 lg:pb-12">
        <div>
          <h1 className="text-headline-lg-mobile font-bold text-on-surface">Lịch tàu Metro số 1</h1>
          <p className="text-body-md text-on-surface-variant">
            Giờ tàu dự kiến, theo giờ Việt Nam. Lịch ước tính, không phải giờ tàu chạy thật.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Cách xem lịch tàu"
          className="flex w-fit gap-1 rounded-full bg-surface-container-high p-1"
        >
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={mode === m.id}
              onClick={() => setMode(m.id)}
              className={`rounded-full px-4 py-2 text-label-md font-semibold transition-colors ${
                mode === m.id ? "bg-primary text-on-primary" : "text-on-surface-variant"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {stationsError ? (
          <p role="alert" className="text-body-md text-error">Không tải được danh sách ga.</p>
        ) : stations.length === 0 ? (
          <p role="status" className="text-body-md text-on-surface-variant">Đang tải danh sách ga...</p>
        ) : mode === "journey" ? (
          <JourneyPanel stations={stations} {...panelProps} />
        ) : (
          <StationPanel stations={stations} {...panelProps} />
        )}
      </main>
    </MobileLayout>
  );
}
