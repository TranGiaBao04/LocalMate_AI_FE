import boldFont from "../../../assets/fonts/be-vietnam-pro/BeVietnamPro-Bold.ttf";
import regularFont from "../../../assets/fonts/be-vietnam-pro/BeVietnamPro-Regular.ttf";
import semiBoldFont from "../../../assets/fonts/be-vietnam-pro/BeVietnamPro-SemiBold.ttf";

export const TRIP_INFOGRAPHIC_WIDTH = 1080;

const COLORS = {
  border: "#dce2ee",
  ink: "#121c2a",
  muted: "#5c6b8a",
  primary: "#1d3e82",
  primaryDark: "#142b5c",
  primarySoft: "#e8eefb",
  surface: "#f4f6fa",
  white: "#ffffff",
};

const styles = {
  root: {
    backgroundColor: COLORS.surface,
    color: COLORS.ink,
    fontFamily: '"Be Vietnam Pro Export", sans-serif',
    overflow: "hidden",
    width: TRIP_INFOGRAPHIC_WIDTH,
  },
  header: {
    backgroundColor: COLORS.primaryDark,
    color: COLORS.white,
    padding: "68px 72px 62px",
  },
  brand: {
    color: "#a9c2f5",
    fontSize: 24,
    fontWeight: 700,
    margin: 0,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 54,
    fontWeight: 700,
    lineHeight: 1.22,
    margin: "22px 0 20px",
  },
  headerMeta: {
    color: "#eaf1ff",
    display: "flex",
    flexWrap: "wrap",
    fontSize: 28,
    gap: "14px 28px",
    lineHeight: 1.45,
  },
  body: { padding: "58px 72px 64px" },
  sectionTitle: {
    color: COLORS.primary,
    fontSize: 34,
    fontWeight: 700,
    margin: 0,
  },
  sectionHint: {
    color: COLORS.muted,
    fontSize: 24,
    lineHeight: 1.45,
    margin: "8px 0 0",
  },
  summaryGrid: {
    display: "grid",
    gap: 18,
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    marginTop: 28,
  },
  summaryCard: {
    backgroundColor: COLORS.white,
    border: `2px solid ${COLORS.border}`,
    borderRadius: 24,
    minHeight: 154,
    padding: "28px 30px",
  },
  summaryLabel: {
    color: COLORS.muted,
    fontSize: 21,
    fontWeight: 600,
    margin: 0,
    textTransform: "uppercase",
  },
  summaryValue: {
    color: COLORS.ink,
    fontSize: 34,
    fontWeight: 700,
    lineHeight: 1.3,
    margin: "12px 0 0",
  },
  summaryNote: {
    color: COLORS.primary,
    fontSize: 22,
    lineHeight: 1.4,
    margin: "8px 0 0",
  },
  timelineHeader: { marginTop: 58 },
  timeline: {
    backgroundColor: COLORS.white,
    border: `2px solid ${COLORS.border}`,
    borderRadius: 24,
    marginTop: 28,
    overflow: "hidden",
  },
  stop: {
    display: "grid",
    gap: 26,
    gridTemplateColumns: "70px minmax(0, 1fr)",
    padding: "32px 34px",
  },
  stopDivider: { borderTop: `2px solid ${COLORS.border}` },
  stopNumber: {
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 35,
    color: COLORS.white,
    display: "flex",
    fontSize: 27,
    fontWeight: 700,
    height: 70,
    justifyContent: "center",
    width: 70,
  },
  stopTime: {
    color: "#a86600",
    fontSize: 25,
    fontWeight: 700,
    margin: 0,
  },
  stopName: {
    color: COLORS.ink,
    fontSize: 32,
    fontWeight: 700,
    lineHeight: 1.35,
    margin: "7px 0 0",
    overflowWrap: "anywhere",
  },
  stopMeta: {
    color: COLORS.muted,
    display: "flex",
    flexWrap: "wrap",
    fontSize: 25,
    gap: "7px 18px",
    lineHeight: 1.5,
    marginTop: 13,
  },
  metro: {
    backgroundColor: COLORS.primarySoft,
    borderRadius: 16,
    color: COLORS.primary,
    display: "inline-flex",
    fontSize: 23,
    fontWeight: 600,
    lineHeight: 1.4,
    marginTop: 16,
    padding: "9px 16px",
  },
  empty: {
    color: COLORS.muted,
    fontSize: 26,
    margin: 0,
    padding: 36,
    textAlign: "center",
  },
  footer: {
    alignItems: "center",
    backgroundColor: COLORS.primaryDark,
    color: "#eaf1ff",
    display: "flex",
    fontSize: 21,
    justifyContent: "space-between",
    padding: "30px 72px",
  },
  footerBrand: { fontWeight: 700 },
};

const formatPlannedDate = (value) => {
  if (!value) return "Chưa có ngày dự kiến";
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "Chưa có ngày dự kiến";

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
    weekday: "long",
    year: "numeric",
  }).format(date);
};

const formatDuration = (minutes) => {
  if (minutes === null || minutes === undefined) return "Chưa cập nhật";
  if (minutes < 60) return `${minutes} phút`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} giờ ${remainder} phút` : `${hours} giờ`;
};

const formatMoney = (amount) => {
  if (amount === null || amount === undefined) return "Chưa cập nhật";
  if (amount === 0) return "Miễn phí";
  return `${new Intl.NumberFormat("vi-VN").format(amount)} đ`;
};

const formatTravelMode = (travelMode) => {
  const labels = {
    Auto: "Tự động",
    Motorbike: "Xe máy",
    Walking: "Đi bộ",
  };
  return labels[travelMode] ?? travelMode ?? "Chưa cập nhật";
};

export default function TripInfographic({ trip }) {
  const metroStopCount = trip.stops.filter(
    (stop) => stop.nearestMetroStation,
  ).length;
  const timeRange = [trip.startTime, trip.endTime].filter(Boolean).join(" - ");

  return (
    <div data-trip-infographic style={styles.root}>
      <style>{`
        @font-face {
          font-family: "Be Vietnam Pro Export";
          src: url("${regularFont}") format("truetype");
          font-style: normal;
          font-weight: 400;
        }
        @font-face {
          font-family: "Be Vietnam Pro Export";
          src: url("${semiBoldFont}") format("truetype");
          font-style: normal;
          font-weight: 600;
        }
        @font-face {
          font-family: "Be Vietnam Pro Export";
          src: url("${boldFont}") format("truetype");
          font-style: normal;
          font-weight: 700;
        }
        [data-trip-infographic], [data-trip-infographic] * {
          box-sizing: border-box;
          letter-spacing: 0;
        }
      `}</style>

      <header style={styles.header}>
        <p style={styles.brand}>LocalMate AI</p>
        <h1 style={styles.title}>{trip.title ?? "Lịch trình chưa có tên"}</h1>
        <div style={styles.headerMeta}>
          {trip.area && <span>{trip.area}</span>}
          <span>{formatPlannedDate(trip.plannedDate)}</span>
          {timeRange && <span>{timeRange}</span>}
        </div>
      </header>

      <main style={styles.body}>
        <section>
          <h2 style={styles.sectionTitle}>Tổng quan chuyến đi</h2>
          <div style={styles.summaryGrid}>
            <div style={styles.summaryCard}>
              <p style={styles.summaryLabel}>Điểm đến</p>
              <p style={styles.summaryValue}>{trip.summary.stopCount} điểm</p>
            </div>
            <div style={styles.summaryCard}>
              <p style={styles.summaryLabel}>Tổng thời gian</p>
              <p style={styles.summaryValue}>
                {formatDuration(trip.summary.durationMinutes)}
              </p>
            </div>
            <div style={styles.summaryCard}>
              <p style={styles.summaryLabel}>Ngân sách dự kiến</p>
              <p style={styles.summaryValue}>
                {formatMoney(trip.summary.estimatedBudget)}
              </p>
            </div>
            <div style={styles.summaryCard}>
              <p style={styles.summaryLabel}>Di chuyển</p>
              <p style={styles.summaryValue}>
                {formatTravelMode(trip.summary.travelMode)}
              </p>
              {metroStopCount > 0 && (
                <p style={styles.summaryNote}>
                  {metroStopCount} điểm gần ga Metro
                </p>
              )}
            </div>
          </div>
        </section>

        <section style={styles.timelineHeader}>
          <h2 style={styles.sectionTitle}>Lịch trình chi tiết</h2>
          <p style={styles.sectionHint}>
            Các điểm đến được sắp xếp theo thứ tự chuyến đi.
          </p>

          <div style={styles.timeline}>
            {trip.stops.length ? (
              trip.stops.map((stop, index) => (
                <article
                  key={stop.order}
                  style={{
                    ...styles.stop,
                    ...(index > 0 ? styles.stopDivider : {}),
                  }}
                >
                  <div style={styles.stopNumber}>{stop.order}</div>
                  <div>
                    <p style={styles.stopTime}>
                      {stop.time ?? "Chưa có giờ dự kiến"}
                    </p>
                    <h3 style={styles.stopName}>
                      {stop.placeName ?? "Địa điểm chưa có tên"}
                    </h3>
                    <div style={styles.stopMeta}>
                      <span>
                        Tham quan: {formatDuration(stop.durationMinutes)}
                      </span>
                      <span>Chi phí: {formatMoney(stop.estimatedCost)}</span>
                    </div>
                    {stop.nearestMetroStation && (
                      <span style={styles.metro}>
                        Metro gần nhất: {stop.nearestMetroStation}
                      </span>
                    )}
                  </div>
                </article>
              ))
            ) : (
              <p style={styles.empty}>Lịch trình chưa có điểm đến.</p>
            )}
          </div>
        </section>
      </main>

      <footer style={styles.footer}>
        <span style={styles.footerBrand}>Generated by LocalMate AI</span>
        <span>{trip.summary.stopCount} điểm đến</span>
      </footer>
    </div>
  );
}
