import { useState } from 'react';
import { buildMapEmbedUrl } from '../utils/googleMaps';
import { GoogleMapsButton } from './GoogleMapsButton';

/**
 * SPEC-03 / FE-68: MapEmbedPreview Component
 * Nhúng bản đồ xem trước (Google Maps Embed Preview) cho địa điểm
 * Tự động lazy load iframe, hiển thị vị trí ghim chuẩn tọa độ lat/lng tại TP.HCM.
 */
export const MapEmbedPreview = ({
  lat,
  lng,
  placeName,
  address,
  height = '240px',
  initExpanded = false,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(initExpanded);
  const [isLoaded, setIsLoaded] = useState(false);

  if (!lat || !lng) {
    return (
      <div className="w-full p-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-center text-slate-500 text-sm">
        Chưa có tọa độ bản đồ cho địa điểm này.
      </div>
    );
  }

  const embedUrl = buildMapEmbedUrl(lat, lng, placeName);

  return (
    <div className={`w-full overflow-hidden rounded-2xl border border-outline-variant/40 bg-white transition-all ${className}`}>
      {/* Thanh tiêu đề: cùng màu cho cả 2 trạng thái (theo tông navy của app), chỉ khác nút bên phải */}
      <div
        className={`flex items-center justify-between gap-2 bg-white px-3 py-2.5 ${
          isExpanded ? 'border-b border-outline-variant/30' : ''
        }`}
      >
        <div className="flex min-w-0 items-center gap-1.5 text-label-md font-semibold text-on-surface">
          <span className="material-symbols-outlined flex-shrink-0 text-[18px] text-primary" aria-hidden="true">
            location_on
          </span>
          <span className="truncate">{placeName || address || 'Vị trí trên bản đồ'}</span>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          {!isExpanded && (
            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              className="rounded-full border border-primary px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/5"
            >
              Xem bản đồ
            </button>
          )}
          <GoogleMapsButton lat={lat} lng={lng} placeName={placeName} variant="compact" />
          {isExpanded && (
            <button
              type="button"
              onClick={() => {
                setIsExpanded(false);
                setIsLoaded(false);
              }}
              aria-label="Thu gọn bản đồ"
              title="Thu gọn bản đồ"
              className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">close</span>
            </button>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="relative w-full" style={{ height }}>
          {/* Loading Skeleton: phủ lên iframe. Iframe phải luôn hiển thị, vì với loading="lazy"
              trình duyệt không bao giờ tải iframe đang display: none (onLoad không chạy, quay mãi). */}
          {!isLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-surface-container-low text-on-surface-variant text-xs">
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Đang tải Google Maps...</span>
              </div>
            </div>
          )}

          {/* Embedded Google Maps Iframe */}
          <iframe
            title={`Bản đồ ${placeName || 'địa điểm'}`}
            width="100%"
            height="100%"
            src={embedUrl}
            onLoad={() => setIsLoaded(true)}
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      )}
    </div>
  );
};

export default MapEmbedPreview;
