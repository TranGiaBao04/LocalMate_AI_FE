const toHHmm = (time) => (time ? time.slice(0, 5) : "");

// stationName là ga gần điểm xuất phát (ga lên). Có chọn ga muốn chơi thì địa điểm nằm quanh ga đó.
const playAreaName = (trip) => trip.destinationStation?.name ?? trip.stationName;

const buildTripTitle = (trip) =>
  playAreaName(trip)
    ? `Khám phá quanh ga ${playAreaName(trip)} · ${trip.durationHours} giờ`
    : `Lịch trình ${trip.durationHours} giờ`;

// BE: "Draft" | "Finalized" -> FE: "draft" | "finalized"
const toStatus = (status) => status?.toLowerCase();

export function mapTripItem(item) {
  return {
    id: item.itemId,
    placeId: item.placeId,
    placeName: item.placeName,
    placeCategory: item.category,
    placeImageUrl: item.imageUrl,
    latitude: item.latitude,
    longitude: item.longitude,
    // Mã địa điểm Google Maps; null thì mở bản đồ theo toạ độ
    googlePlaceId: item.googlePlaceId ?? null,
    nearestMetroStation: item.stationName,
    orderIndex: item.orderIndex,
    time: toHHmm(item.scheduledTime),
    durationMinutes: item.estimatedDurationMinutes,
    estimatedCost: item.estimatedBudget,
    reason: item.reasoning,
    isVisited: item.isVisited,
    visitedAt: item.visitedAt,
    // Chặng đầu là null. walkingMinutes/motorbikeMinutes chỉ là ước tính đi thẳng, trip Metro hiển thị theo leg.
    travelMinutesFromPrevious: item.travelMinutesFromPrevious,
    distanceMetersFromPrevious: item.distanceMetersFromPrevious,
    walkingMinutes: item.walkingMinutes,
    motorbikeMinutes: item.motorbikeMinutes,
    // Cách đi tới chặng này: { mode: "Walking"|"Motorbike"|"Metro", totalMinutes, fallback, ...field tàu }.
    // null ở chặng đầu của trip cũ chưa đặt giờ hoặc trip từ lịch mẫu.
    leg: item.leg ?? null,
  };
}

// GET /trips/{id}
export function mapTrip(trip) {
  const items = [...(trip.items ?? [])]
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map(mapTripItem);

  return {
    id: trip.id,
    status: toStatus(trip.status),
    title: buildTripTitle(trip),
    summary: "",
    mainArea: playAreaName(trip),
    startLatitude: trip.startLatitude,
    startLongitude: trip.startLongitude,
    durationHours: trip.durationHours,
    budgetMin: trip.budgetMin,
    budgetMax: trip.budgetMax,
    estimatedBudget: trip.estimatedBudget,
    totalDurationMinutes: trip.totalDurationMinutes,
    travelMode: trip.travelMode,
    totalVisitMinutes: trip.totalVisitMinutes,
    totalTravelMinutes: trip.totalTravelMinutes,
    totalMinutes: trip.totalMinutes,
    endTime: toHHmm(trip.endTime),
    // Trip cũ trả null cho 3 field này
    plannedDate: trip.plannedDate,
    startTime: toHHmm(trip.startTime),
    // Thời gian đi từ điểm xuất phát tới chặng đầu (chặng đầu có travelMinutesFromPrevious = null)
    travelMinutesFromOrigin: trip.travelMinutesFromOrigin,
    // { order, name } | null: ga người dùng chọn xuất phát / chọn để chơi
    startStation: trip.startStation ?? null,
    destinationStation: trip.destinationStation ?? null,
    tagIds: trip.tagIds ?? [],
    // Ghi chú lúc tạo lịch; noteApplied = true khi ghi chú đã được dùng để ưu tiên địa điểm
    note: trip.note ?? null,
    noteApplied: trip.noteApplied ?? false,
    // Lần gần nhất AI viết lý do cho các chặng; null = lý do mặc định
    aiExplainedAt: trip.aiExplainedAt ?? null,
    createdAt: trip.createdAt,
    updatedAt: trip.updatedAt,
    finalizedAt: trip.finalizedAt,
    items,
  };
}

// GET /trips/my-trips: bản tóm tắt, không có items
export function mapMyTrip(trip) {
  const status = toStatus(trip.status);
  return {
    id: trip.id,
    status,
    title: buildTripTitle(trip),
    summary: "",
    mainArea: trip.stationName,
    durationHours: trip.durationHours,
    budgetMin: trip.budgetMin,
    budgetMax: trip.budgetMax,
    estimatedBudget: trip.estimatedBudget,
    plannedDate: trip.plannedDate,
    createdAt: trip.createdAt,
    updatedAt: trip.updatedAt,
    // BE: trip chốt từ trước khi có field này thì null, dùng updatedAt làm dự phòng
    finalizedAt:
      trip.finalizedAt ?? (status === "finalized" ? trip.updatedAt : null),
    itemCount: trip.itemCount,
    items: [],
  };
}
