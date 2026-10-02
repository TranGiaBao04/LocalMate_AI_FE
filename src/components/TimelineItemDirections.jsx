import { openGoogleMapsApp } from '../utils/openGoogleMapsApp';

/**
 * SPEC-03 / FE-69: TimelineItemDirections Component
 * Nút chỉ đường tích hợp trên từng điểm dừng của Timeline chính thức.
 * Tự động tạo URL chỉ đường di chuyển từ điểm dừng trước đó đến điểm dừng hiện tại.
 */
export const TimelineItemDirections = ({
  prevStop,
  currentStop,
  travelMode = 'walking',
  estimatedTimeText,
  className = '',
}) => {
  if (!currentStop) return null;

  // Item timeline (tripMapper) dùng latitude/longitude/placeName
  const currentLat = currentStop.latitude ?? currentStop.lat;
  const currentLng = currentStop.longitude ?? currentStop.lng;
  const currentName = currentStop.placeName ?? currentStop.name ?? currentStop.title;

  const prevLat = prevStop ? (prevStop.latitude ?? prevStop.lat) : null;
  const prevLng = prevStop ? (prevStop.longitude ?? prevStop.lng) : null;
  const prevName = prevStop ? (prevStop.placeName ?? prevStop.name ?? prevStop.title) : null;

  const handleDirectionsClick = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (prevLat != null && prevLng != null) {
      // Điều hướng từ điểm trước đó đến điểm hiện tại
      openGoogleMapsApp({
        lat: prevLat,
        lng: prevLng,
        query: prevName,
        destLat: currentLat,
        destLng: currentLng,
        destName: currentName,
        travelMode,
      });
    } else {
      // Chỉ mở vị trí điểm hiện tại
      openGoogleMapsApp({
        lat: currentLat,
        lng: currentLng,
        query: currentName,
      });
    }
  };

  return (
    <div className={`flex items-center space-x-2 my-2 py-1.5 px-3 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/50 rounded-xl text-xs ${className}`}>
      {/* Route Direction Connector Line Icon */}
      <div className="flex items-center text-emerald-600 dark:text-emerald-400 font-medium">
        <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
        <span>
          {prevStop ? `Di chuyển từ ${prevName || 'điểm trước'}` : 'Vị trí điểm dừng'}
        </span>
      </div>

      {estimatedTimeText && (
        <span className="text-slate-500 dark:text-slate-400 font-normal">
          ({estimatedTimeText})
        </span>
      )}

      <div className="ml-auto">
        <button
          type="button"
          onClick={handleDirectionsClick}
          className="inline-flex items-center font-semibold text-emerald-700 hover:text-emerald-900 dark:text-emerald-300 dark:hover:text-white underline decoration-emerald-400 underline-offset-2 transition-colors"
        >
          <svg className="w-3.5 h-3.5 mr-1" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
          </svg>
          {prevStop ? 'Chỉ đường' : 'Mở Maps'}
        </button>
      </div>
    </div>
  );
};

export default TimelineItemDirections;
