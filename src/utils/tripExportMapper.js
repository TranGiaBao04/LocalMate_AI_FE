import { buildMapsSearchUrl } from "./googleMaps";

const toOptionalText = (value) => {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text || null;
};

const toOptionalNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const firstNumber = (...values) => {
  for (const value of values) {
    const number = toOptionalNumber(value);
    if (number !== null) return number;
  }
  return null;
};

export function normalizeTripForExport(trip) {
  if (!trip || typeof trip !== "object") {
    throw new TypeError("A trip is required for export.");
  }

  const sortedItems = (Array.isArray(trip.items) ? trip.items : [])
    .map((item, originalIndex) => ({
      item: item ?? {},
      originalIndex,
      orderIndex: toOptionalNumber(item?.orderIndex),
    }))
    .sort((left, right) => {
      const leftOrder = left.orderIndex ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = right.orderIndex ?? Number.MAX_SAFE_INTEGER;
      return leftOrder - rightOrder || left.originalIndex - right.originalIndex;
    });

  const stops = sortedItems.map(({ item }, index) => {
    const latitude = toOptionalNumber(item.latitude);
    const longitude = toOptionalNumber(item.longitude);
    const hasCoordinates = latitude !== null && longitude !== null;
    const placeName = toOptionalText(item.placeName);

    return {
      order: index + 1,
      time: toOptionalText(item.time),
      placeName,
      category: toOptionalText(item.placeCategory),
      durationMinutes: toOptionalNumber(item.durationMinutes),
      estimatedCost: toOptionalNumber(item.estimatedCost),
      nearestMetroStation: toOptionalText(item.nearestMetroStation),
      reason: toOptionalText(item.reason),
      latitude,
      longitude,
      mapUrl: hasCoordinates
        ? buildMapsSearchUrl({
            lat: latitude,
            lng: longitude,
            query: placeName,
            placeId: toOptionalText(item.googlePlaceId),
          })
        : null,
    };
  });

  return {
    tripId: trip.id ?? null,
    title: toOptionalText(trip.title),
    area: toOptionalText(trip.mainArea),
    plannedDate: toOptionalText(trip.plannedDate),
    startTime: toOptionalText(trip.startTime),
    endTime: toOptionalText(trip.endTime),
    summary: {
      stopCount: stops.length,
      durationMinutes: firstNumber(
        trip.totalMinutes,
        trip.totalDurationMinutes,
      ),
      visitMinutes: toOptionalNumber(trip.totalVisitMinutes),
      travelMinutes: toOptionalNumber(trip.totalTravelMinutes),
      estimatedBudget: toOptionalNumber(trip.estimatedBudget),
      travelMode: toOptionalText(trip.travelMode),
    },
    stops,
  };
}
