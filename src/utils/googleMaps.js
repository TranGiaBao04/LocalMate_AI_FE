/**
 * SPEC-03 / FE-66: Google Maps Deeplink & URL Utility
 * Utility xây dựng URL tìm kiếm và điều hướng Google Maps theo chuẩn URL Spec.
 */

/**
 * Tạo URL Google Maps Search theo tọa độ hoặc tên địa điểm
 * @param {Object} params
 * @param {number} params.lat - Vĩ độ
 * @param {number} params.lng - Kinh độ
 * @param {string} [params.query] - Tên địa điểm hoặc địa chỉ
 * @returns {string} Google Maps Search URL
 */
export const buildMapsSearchUrl = ({ lat, lng, query }) => {
  const baseUrl = 'https://www.google.com/maps/search/?api=1';
  if (!lat && !lng && !query) return 'https://www.google.com/maps';

  let queryParam = '';
  if (query && lat && lng) {
    queryParam = `${query}@${lat},${lng}`;
  } else if (query) {
    queryParam = query;
  } else {
    queryParam = `${lat},${lng}`;
  }

  return `${baseUrl}&query=${encodeURIComponent(queryParam)}`;
};

/**
 * Tạo URL Google Maps Directions điều hướng giữa 2 điểm
 * @param {Object} params
 * @param {number} [params.originLat] - Vĩ độ điểm xuất phát
 * @param {number} [params.originLng] - Kinh độ điểm xuất phát
 * @param {string} [params.originName] - Tên điểm xuất phát
 * @param {number} params.destLat - Vĩ độ điểm đến
 * @param {number} params.destLng - Kinh độ điểm đến
 * @param {string} [params.destName] - Tên điểm đến
 * @param {'walking'|'driving'|'bicycling'|'transit'} [params.travelMode='walking'] - Phương tiện
 * @returns {string} Google Maps Directions URL
 */
export const buildDirectionsUrl = ({
  originLat,
  originLng,
  originName,
  destLat,
  destLng,
  destName,
  travelMode = 'walking',
}) => {
  const baseUrl = 'https://www.google.com/maps/dir/?api=1';

  let originParam = '';
  if (originLat && originLng) {
    originParam = originName ? `${originName}@${originLat},${originLng}` : `${originLat},${originLng}`;
  } else if (originName) {
    originParam = originName;
  }

  let destParam = '';
  if (destLat && destLng) {
    destParam = destName ? `${destName}@${destLat},${destLng}` : `${destLat},${destLng}`;
  } else if (destName) {
    destParam = destName;
  } else {
    destParam = 'Thành phố Hồ Chí Minh';
  }

  const validMode = ['walking', 'driving', 'bicycling', 'transit'].includes(travelMode)
    ? travelMode
    : 'walking';

  let url = `${baseUrl}&destination=${encodeURIComponent(destParam)}&travelmode=${validMode}`;
  if (originParam) {
    url += `&origin=${encodeURIComponent(originParam)}`;
  }

  return url;
};

/**
 * Sinh iframe Embed URL cho Google Maps xem trước
 * @param {number} lat
 * @param {number} lng
 * @param {string} [placeName]
 * @returns {string} Embed URL
 */
export const buildMapEmbedUrl = (lat, lng, placeName) => {
  const q = placeName ? `${placeName}@${lat},${lng}` : `${lat},${lng}`;
  return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
};
