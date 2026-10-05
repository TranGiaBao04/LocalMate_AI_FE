import { buildDirectionsUrl, buildMapsSearchUrl } from './googleMaps';

/**
 * SPEC-03 / FE-67: Mobile Google Maps Deeplink Handler
 * Mở Google Maps bằng link https://www.google.com/maps/... (Maps URLs).
 * Trên Android/iOS đã cài app Google Maps, hệ điều hành tự mở link này bằng app; chưa cài thì mở trình duyệt.
 * Không dùng scheme riêng (geo:, comgooglemaps://): geo: bỏ mất điểm đi nên không chỉ đường được,
 * còn cách đoán "mở app thất bại" bằng setTimeout làm mở thêm tab web cả khi app đã mở.
 */

/**
 * Kiếm tra thiết bị hiện tại có phải mobile (iOS / Android) hay không
 */
export const isMobileDevice = () => {
  if (typeof window === 'undefined' || !window.navigator) return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
};

/**
 * Mở Google Maps: có điểm đến thì chỉ đường, không thì mở vị trí
 * @param {Object} options
 * @param {number} [options.lat] - điểm đi (khi chỉ đường) hoặc vị trí cần mở
 * @param {number} [options.lng]
 * @param {string} [options.query]
 * @param {string} [options.placeId] - googlePlaceId của điểm (lat, lng) ở trên
 * @param {number} [options.destLat]
 * @param {number} [options.destLng]
 * @param {string} [options.destName]
 * @param {string} [options.destPlaceId] - googlePlaceId của điểm đến
 * @param {'walking'|'driving'|'transit'} [options.travelMode] - bỏ trống thì Google Maps tự chọn
 */
export const openGoogleMapsApp = ({
  lat,
  lng,
  query,
  placeId,
  destLat,
  destLng,
  destName,
  destPlaceId,
  travelMode,
}) => {
  const isDirections = destLat != null && destLng != null;
  const url = isDirections
    ? buildDirectionsUrl({
        originLat: lat,
        originLng: lng,
        originName: query,
        originPlaceId: placeId,
        destLat,
        destLng,
        destName,
        destPlaceId,
        travelMode,
      })
    : buildMapsSearchUrl({ lat, lng, query, placeId });

  window.open(url, '_blank', 'noopener,noreferrer');
};
