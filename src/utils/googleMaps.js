/**
 * SPEC-03 / FE-66: Google Maps Deeplink & URL Utility
 * Utility xây dựng URL tìm kiếm và điều hướng Google Maps theo chuẩn URL Spec.
 *
 * Có googlePlaceId (BE trả, có thể null): gửi tên địa điểm kèm mã, Google mở đúng trang của địa điểm đó.
 * Không có mã: dùng toạ độ "lat,lng".
 * Không ghép "Tên@lat,lng" vì spec không hỗ trợ, Google sẽ coi cả chuỗi là từ khoá tìm kiếm và dễ ra sai chỗ.
 */

const hasCoords = (lat, lng) => lat != null && lng != null;

const TRAVEL_MODES = ['walking', 'driving', 'bicycling', 'transit'];

// Giá trị cho query / origin / destination: tham số này vẫn bắt buộc kể cả khi đã có place id
const toPointParam = ({ lat, lng, name, placeId }) => {
  const coords = hasCoords(lat, lng) ? `${lat},${lng}` : null;
  return placeId ? name || coords : coords || name;
};

/**
 * Tạo URL Google Maps Search theo tọa độ hoặc tên địa điểm
 * @param {Object} params
 * @param {number} params.lat - Vĩ độ
 * @param {number} params.lng - Kinh độ
 * @param {string} [params.query] - Tên địa điểm hoặc địa chỉ (dùng khi có placeId hoặc không có toạ độ)
 * @param {string} [params.placeId] - googlePlaceId của địa điểm
 * @returns {string} Google Maps Search URL
 */
export const buildMapsSearchUrl = ({ lat, lng, query, placeId }) => {
  const queryParam = toPointParam({ lat, lng, name: query, placeId });
  if (!queryParam) return 'https://www.google.com/maps';

  let url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(queryParam)}`;
  if (placeId) url += `&query_place_id=${encodeURIComponent(placeId)}`;

  return url;
};

/**
 * Tạo URL Google Maps Directions điều hướng giữa 2 điểm
 * @param {Object} params
 * @param {number} [params.originLat] - Vĩ độ điểm xuất phát
 * @param {number} [params.originLng] - Kinh độ điểm xuất phát
 * @param {string} [params.originName] - Tên điểm xuất phát (dùng khi có originPlaceId hoặc không có toạ độ)
 * @param {string} [params.originPlaceId] - googlePlaceId của điểm xuất phát (khi điểm đi là một địa điểm)
 * @param {number} params.destLat - Vĩ độ điểm đến
 * @param {number} params.destLng - Kinh độ điểm đến
 * @param {string} [params.destName] - Tên điểm đến (dùng khi có destPlaceId hoặc không có toạ độ)
 * @param {string} [params.destPlaceId] - googlePlaceId của điểm đến
 * @param {'walking'|'driving'|'bicycling'|'transit'} [params.travelMode] - Phương tiện; bỏ trống thì Google Maps tự chọn
 * @returns {string} Google Maps Directions URL
 */
export const buildDirectionsUrl = ({
  originLat,
  originLng,
  originName,
  originPlaceId,
  destLat,
  destLng,
  destName,
  destPlaceId,
  travelMode,
}) => {
  const originParam = toPointParam({
    lat: originLat,
    lng: originLng,
    name: originName,
    placeId: originPlaceId,
  });
  const destParam =
    toPointParam({ lat: destLat, lng: destLng, name: destName, placeId: destPlaceId }) ||
    'Thành phố Hồ Chí Minh';

  let url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destParam)}`;
  if (destPlaceId) url += `&destination_place_id=${encodeURIComponent(destPlaceId)}`;
  if (TRAVEL_MODES.includes(travelMode)) url += `&travelmode=${travelMode}`;
  // Không có điểm đi thì Google Maps tự lấy vị trí hiện tại của người dùng
  if (originParam) {
    url += `&origin=${encodeURIComponent(originParam)}`;
    if (originPlaceId) url += `&origin_place_id=${encodeURIComponent(originPlaceId)}`;
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
