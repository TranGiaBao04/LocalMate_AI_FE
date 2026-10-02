/**
 * SPEC-03 / FE-66: Google Maps Deeplink & URL Utility
 * Utility xây dựng URL tìm kiếm và điều hướng Google Maps theo chuẩn URL Spec.
 *
 * Luôn ưu tiên toạ độ "lat,lng": đây là cách chính xác nhất Google Maps URL hỗ trợ khi chưa có place_id.
 * Không ghép "Tên@lat,lng" vì spec không hỗ trợ, Google sẽ coi cả chuỗi là từ khoá tìm kiếm và dễ ra sai chỗ.
 */

const hasCoords = (lat, lng) => lat != null && lng != null;

/**
 * Tạo URL Google Maps Search theo tọa độ hoặc tên địa điểm
 * @param {Object} params
 * @param {number} params.lat - Vĩ độ
 * @param {number} params.lng - Kinh độ
 * @param {string} [params.query] - Tên địa điểm hoặc địa chỉ (chỉ dùng khi không có toạ độ)
 * @returns {string} Google Maps Search URL
 */
export const buildMapsSearchUrl = ({ lat, lng, query }) => {
  const queryParam = hasCoords(lat, lng) ? `${lat},${lng}` : query;
  if (!queryParam) return 'https://www.google.com/maps';

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(queryParam)}`;
};

/**
 * Tạo URL Google Maps Directions điều hướng giữa 2 điểm
 * @param {Object} params
 * @param {number} [params.originLat] - Vĩ độ điểm xuất phát
 * @param {number} [params.originLng] - Kinh độ điểm xuất phát
 * @param {string} [params.originName] - Tên điểm xuất phát (chỉ dùng khi không có toạ độ)
 * @param {number} params.destLat - Vĩ độ điểm đến
 * @param {number} params.destLng - Kinh độ điểm đến
 * @param {string} [params.destName] - Tên điểm đến (chỉ dùng khi không có toạ độ)
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
  const originParam = hasCoords(originLat, originLng) ? `${originLat},${originLng}` : originName;
  const destParam = hasCoords(destLat, destLng)
    ? `${destLat},${destLng}`
    : destName || 'Thành phố Hồ Chí Minh';

  const validMode = ['walking', 'driving', 'bicycling', 'transit'].includes(travelMode)
    ? travelMode
    : 'walking';

  let url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destParam)}&travelmode=${validMode}`;
  // Không có điểm đi thì Google Maps tự lấy vị trí hiện tại của người dùng
  if (originParam) {
    url += `&origin=${encodeURIComponent(originParam)}`;
  }

  return url;
};

/**
 * Sinh iframe Embed URL cho Google Maps xem trước
 * @param {number} lat
 * @param {number} lng
 * @param {string} [placeName] - chỉ dùng khi không có toạ độ
 * @returns {string} Embed URL
 */
export const buildMapEmbedUrl = (lat, lng, placeName) => {
  const q = hasCoords(lat, lng) ? `${lat},${lng}` : placeName;
  return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
};
