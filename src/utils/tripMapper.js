const toHHmm = (time) => (time ? time.slice(0, 5) : "");

const buildTripTitle = ({ stationName, durationHours }) =>
  stationName
    ? `Khám phá quanh ga ${stationName} · ${durationHours} giờ`
    : `Lịch trình ${durationHours} giờ`;

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
    nearestMetroStation: item.stationName,
    orderIndex: item.orderIndex,
    time: toHHmm(item.scheduledTime),
    durationMinutes: item.estimatedDurationMinutes,
    estimatedCost: item.estimatedBudget,
    reason: item.reasoning,
    isVisited: item.isVisited,
    visitedAt: item.visitedAt,
    // Chặng đầu là null. Sau replace, travelMinutesFromPrevious có thể chưa đúng,
    // walkingMinutes/motorbikeMinutes thì luôn đúng.
    travelMinutesFromPrevious: item.travelMinutesFromPrevious,
    distanceMetersFromPrevious: item.distanceMetersFromPrevious,
    walkingMinutes: item.walkingMinutes,
    motorbikeMinutes: item.motorbikeMinutes,
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
    mainArea: trip.stationName,
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
    tagIds: trip.tagIds ?? [],
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
