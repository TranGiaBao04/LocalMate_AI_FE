import { formatCurrency } from "../../../utils/formatCurrency";

export const CURATED_BASE_PATH = "/admin/curated-itineraries";
// Khớp AdminCuratedItineraryService của BE
export const CURATED_LIMITS = { title: 200, description: 1000, minPlaces: 2, maxPlaces: 10 };

export const formatCostRange = (min, max) => {
  if (!max) return "Miễn phí";
  return min === max ? formatCurrency(max) : `${min.toLocaleString("vi-VN")} – ${formatCurrency(max)}`;
};

// Chặng có địa điểm không còn Active thì user không thấy; không còn chặng nào thì cả lịch bị ẩn khỏi app
export function describeUnavailable(itinerary) {
  const count = itinerary.unavailablePlaceCount ?? 0;
  if (count === 0) return null;
  return count >= itinerary.items.length
    ? "Đang ẩn khỏi app: không còn địa điểm hoạt động"
    : `${count}/${itinerary.items.length} chặng không hiện với người dùng`;
}

const FIELD_BY_KEY = { title: "title", description: "description", coverimageurl: "coverImageUrl", placeids: "placeIds" };

// errors của 400 invalid_curated_itinerary: { Title: [...], PlaceIds: [...] } → { title, placeIds }
export function toFieldErrors(errors) {
  const result = {};
  Object.entries(errors ?? {}).forEach(([key, messages]) => {
    const field = FIELD_BY_KEY[key.toLowerCase()];
    if (field) result[field] = [].concat(messages).join(" ");
  });
  return result;
}
