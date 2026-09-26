import { buildDirectionsUrl, buildMapsSearchUrl } from './googleMaps';

/**
 * SPEC-03 / FE-67: Mobile Google Maps Deeplink Handler
 * Mở ứng dụng Google Maps trực tiếp trên thiết bị di động (iOS/Android)
 * Tự động fallback sang trình duyệt tab mới nếu không mở được app native.
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
 * Mở ứng dụng Google Maps di động với đường dẫn deeplink phù hợp
 * @param {Object} options
 * @param {number} [options.lat]
 * @param {number} [options.lng]
 * @param {string} [options.query]
 * @param {number} [options.destLat]
 * @param {number} [options.destLng]
 * @param {string} [options.destName]
 * @param {'walking'|'driving'} [options.travelMode='walking']
 */
export const openGoogleMapsApp = ({
  lat,
  lng,
  query,
  destLat,
  destLng,
  destName,
  travelMode = 'walking',
}) => {
  const isDirections = Boolean(destLat && destLng);
  const webUrl = isDirections
    ? buildDirectionsUrl({
        originLat: lat,
        originLng: lng,
        destLat,
        destLng,
        destName,
        travelMode,
      })
    : buildMapsSearchUrl({ lat, lng, query });

  const isMobile = isMobileDevice();

  if (!isMobile) {
    // Trên máy tính: mở tab mới tới Google Maps Web
    window.open(webUrl, '_blank', 'noopener,noreferrer');
    return;
  }

  // Trên Mobile: thử mở với URI Scheme Google Maps App
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

  let appSchemeUrl = '';
  if (isDirections) {
    appSchemeUrl = isIOS
      ? `comgooglemaps://?saddr=${lat},${lng}&daddr=${destLat},${destLng}&directionsmode=${travelMode}`
      : `geo:${destLat},${destLng}?q=${destLat},${destLng}(${encodeURIComponent(destName || 'Điểm đến')})`;
  } else {
    appSchemeUrl = isIOS
      ? `comgooglemaps://?q=${encodeURIComponent(query || `${lat},${lng}`)}&center=${lat},${lng}`
      : `geo:${lat},${lng}?q=${encodeURIComponent(query || `${lat},${lng}`)}`;
  }

  // Thử mở App, nếu sau 500ms không rời trang thì chuyển sang tab Web
  const start = Date.now();
  window.location.href = appSchemeUrl;

  setTimeout(() => {
    if (Date.now() - start < 1500) {
      window.open(webUrl, '_blank', 'noopener,noreferrer');
    }
  }, 500);
};
