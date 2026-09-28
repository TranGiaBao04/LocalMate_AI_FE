import {
  Document,
  Font,
  Link,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

const resolveFontSource = (fontUrl) => {
  if (typeof window !== "undefined") return fontUrl.href;

  const decodedPath = decodeURIComponent(fontUrl.pathname);
  return decodedPath.replace(/^\/([a-zA-Z]:\/)/, "$1").replaceAll("/", "\\");
};

const regularFont = resolveFontSource(
  new URL(
    "../../../assets/fonts/be-vietnam-pro/BeVietnamPro-Regular.ttf",
    import.meta.url,
  ),
);
const semiBoldFont = resolveFontSource(
  new URL(
    "../../../assets/fonts/be-vietnam-pro/BeVietnamPro-SemiBold.ttf",
    import.meta.url,
  ),
);
const boldFont = resolveFontSource(
  new URL(
    "../../../assets/fonts/be-vietnam-pro/BeVietnamPro-Bold.ttf",
    import.meta.url,
  ),
);

Font.register({
  family: "Be Vietnam Pro",
  fonts: [
    { src: regularFont, fontWeight: 400 },
    { src: semiBoldFont, fontWeight: 600 },
    { src: boldFont, fontWeight: 700 },
  ],
});
Font.registerHyphenationCallback((word) => [word]);

const COLORS = {
  ink: "#121c2a",
  muted: "#5c6b8a",
  primary: "#1d3e82",
  primarySoft: "#e8eefb",
  accent: "#e08e10",
  line: "#dce2ee",
  surface: "#f4f6fa",
  white: "#ffffff",
};

const styles = StyleSheet.create({
  page: {
    backgroundColor: COLORS.white,
    color: COLORS.ink,
    fontFamily: "Be Vietnam Pro",
    fontSize: 11,
    lineHeight: 1.45,
    paddingTop: 42,
    paddingRight: 42,
    paddingBottom: 58,
    paddingLeft: 42,
    position: "relative",
  },
  brand: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 10,
  },
  title: {
    color: COLORS.ink,
    fontSize: 23,
    fontWeight: 700,
    lineHeight: 1.25,
    marginBottom: 8,
  },
  headerMeta: {
    color: COLORS.muted,
    fontSize: 11,
    marginBottom: 4,
  },
  sectionTitle: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: 700,
    marginBottom: 10,
    marginTop: 22,
  },
  summary: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.line,
    borderRadius: 8,
    borderWidth: 1,
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 12,
  },
  summaryItem: {
    marginBottom: 10,
    paddingRight: 12,
    width: "50%",
  },
  summaryLabel: {
    color: COLORS.muted,
    fontSize: 9,
    marginBottom: 3,
    textTransform: "uppercase",
  },
  summaryValue: {
    color: COLORS.ink,
    fontSize: 12,
    fontWeight: 600,
  },
  metroNote: {
    backgroundColor: COLORS.primarySoft,
    borderRadius: 6,
    color: COLORS.primary,
    fontSize: 10,
    marginTop: 10,
    padding: 8,
  },
  stop: {
    borderBottomColor: COLORS.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    paddingBottom: 14,
    paddingTop: 14,
  },
  stopNumber: {
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 13,
    display: "flex",
    height: 26,
    justifyContent: "center",
    marginRight: 12,
    width: 26,
  },
  stopNumberText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: 700,
  },
  stopBody: {
    flexGrow: 1,
    flexShrink: 1,
  },
  stopTime: {
    color: COLORS.accent,
    fontSize: 10,
    fontWeight: 700,
    marginBottom: 3,
  },
  stopTitle: {
    color: COLORS.ink,
    fontSize: 13,
    fontWeight: 700,
    lineHeight: 1.3,
    marginBottom: 5,
  },
  stopMeta: {
    color: COLORS.muted,
    fontSize: 10,
    marginBottom: 3,
  },
  reason: {
    color: COLORS.ink,
    fontSize: 10.5,
    marginTop: 6,
  },
  mapLink: {
    color: COLORS.primary,
    fontSize: 10,
    marginTop: 7,
    textDecoration: "none",
  },
  empty: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    color: COLORS.muted,
    padding: 16,
  },
  footer: {
    color: COLORS.muted,
    fontSize: 8,
    left: 42,
    position: "absolute",
    right: 42,
    textAlign: "center",
    top: 804,
  },
});

const formatDate = (value) => {
  if (!value) return "Chưa có ngày dự kiến";
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;

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

const joinMeta = (values) => values.filter(Boolean).join("  •  ");

export default function TripPdfDocument({ trip }) {
  const hasMetroStops = trip.stops.some((stop) => stop.nearestMetroStation);
  const timeRange = [trip.startTime, trip.endTime].filter(Boolean).join(" - ");

  return (
    <Document
      author="LocalMate AI"
      subject="Lịch trình du lịch"
      title={trip.title ?? "Lịch trình LocalMate"}
    >
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.brand}>LOCALMATE AI</Text>
        <Text style={styles.title}>{trip.title ?? "Lịch trình chưa có tên"}</Text>
        {trip.area && <Text style={styles.headerMeta}>Khu vực: {trip.area}</Text>}
        <Text style={styles.headerMeta}>Ngày đi: {formatDate(trip.plannedDate)}</Text>
        {timeRange && <Text style={styles.headerMeta}>Thời gian: {timeRange}</Text>}

        <Text style={styles.sectionTitle}>Tổng quan</Text>
        <View style={styles.summary}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Điểm đến</Text>
            <Text style={styles.summaryValue}>{trip.summary.stopCount} điểm</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Tổng thời gian</Text>
            <Text style={styles.summaryValue}>
              {formatDuration(trip.summary.durationMinutes)}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Ngân sách dự kiến</Text>
            <Text style={styles.summaryValue}>
              {formatMoney(trip.summary.estimatedBudget)}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Di chuyển</Text>
            <Text style={styles.summaryValue}>
              {formatTravelMode(trip.summary.travelMode)}
            </Text>
          </View>
          {(trip.summary.visitMinutes !== null ||
            trip.summary.travelMinutes !== null) && (
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Phân bổ thời gian</Text>
              <Text style={styles.summaryValue}>
                {joinMeta([
                  trip.summary.visitMinutes !== null
                    ? `Tham quan ${formatDuration(trip.summary.visitMinutes)}`
                    : null,
                  trip.summary.travelMinutes !== null
                    ? `Di chuyển ${formatDuration(trip.summary.travelMinutes)}`
                    : null,
                ])}
              </Text>
            </View>
          )}
        </View>
        {hasMetroStops && (
          <Text style={styles.metroNote}>
            Lịch trình có các điểm kết nối gần ga Metro.
          </Text>
        )}

        <Text style={styles.sectionTitle}>Lịch trình chi tiết</Text>
        {trip.stops.length ? (
          trip.stops.map((stop) => (
            <View key={stop.order} style={styles.stop} wrap={false}>
              <View style={styles.stopNumber}>
                <Text style={styles.stopNumberText}>{stop.order}</Text>
              </View>
              <View style={styles.stopBody}>
                {stop.time && <Text style={styles.stopTime}>{stop.time}</Text>}
                <Text style={styles.stopTitle}>
                  {stop.placeName ?? "Địa điểm chưa có tên"}
                </Text>
                <Text style={styles.stopMeta}>
                  {joinMeta([
                    stop.category,
                    stop.durationMinutes !== null
                      ? formatDuration(stop.durationMinutes)
                      : null,
                    stop.estimatedCost !== null
                      ? formatMoney(stop.estimatedCost)
                      : null,
                  ]) || "Chưa có thông tin chi tiết"}
                </Text>
                {stop.nearestMetroStation && (
                  <Text style={styles.stopMeta}>
                    Ga Metro gần nhất: {stop.nearestMetroStation}
                  </Text>
                )}
                {stop.reason && <Text style={styles.reason}>{stop.reason}</Text>}
                {stop.mapUrl && (
                  <Link src={stop.mapUrl} style={styles.mapLink}>
                    Mở địa điểm trên Google Maps
                  </Link>
                )}
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.empty}>Lịch trình chưa có điểm đến.</Text>
        )}

        <Text
          fixed
          render={({ pageNumber, totalPages }) =>
            `Generated by LocalMate AI  •  Trang ${pageNumber}/${totalPages}`
          }
          style={styles.footer}
        />
      </Page>
    </Document>
  );
}
