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
  googlePlaceId,
  address,
  height = '240px',
  initExpanded = false,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(initExpanded);
  const [isLoaded, setIsLoaded] = useState(false);

  if (!lat || !lng) {
    return (
      <div className="w-full rounded-[8px] border border-border-soft bg-surface-container-low p-4 text-sm leading-6 text-text-muted">
        Chưa có tọa độ bản đồ cho địa điểm này.
      </div>
    );
  }

  const embedUrl = buildMapEmbedUrl(lat, lng, placeName);

  return (
    <div className={`min-w-0 w-full overflow-hidden rounded-[8px] border border-border-soft bg-white ${className}`}>
      {/* Thanh tiêu đề: cùng màu cho cả 2 trạng thái (theo tông navy của app), chỉ khác nút bên phải */}
      <div
        className={`flex flex-col items-start justify-between gap-3 bg-white p-4 sm:flex-row sm:items-center ${
          isExpanded ? 'border-b border-border-soft' : ''
        }`}
      >
        <div className="flex min-w-0 items-start gap-2 text-sm font-medium leading-6 text-navy-dark">
          <span className="material-symbols-outlined flex-shrink-0 text-[18px] text-primary" aria-hidden="true">
            location_on
          </span>
          <span title={placeName || address || 'Vị trí trên bản đồ'} className="min-w-0 break-words">{placeName || address || 'Vị trí trên bản đồ'}</span>
        </div>

        <div className="flex max-w-full flex-shrink-0 flex-wrap items-center gap-2">
          {!isExpanded && (
            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              aria-expanded={false}
              className="min-h-11 rounded-[8px] border border-border-soft px-3 py-2 text-sm font-semibold text-navy hover:bg-chip-bg-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
            >
              Xem bản đồ
            </button>
          )}
          <GoogleMapsButton
            lat={lat}
            lng={lng}
            placeName={placeName}
            placeId={googlePlaceId}
            variant="compact"
            className="min-h-11 !rounded-[8px] !px-3 !py-2 !text-sm focus-visible:!ring-navy motion-reduce:transition-none motion-reduce:transform-none"
          />
          {isExpanded && (
            <button
              type="button"
              onClick={() => {
                setIsExpanded(false);
                setIsLoaded(false);
              }}
              aria-label="Thu gọn bản đồ"
              title="Thu gọn bản đồ"
              aria-expanded={true}
              className="flex h-11 w-11 items-center justify-center rounded-[8px] text-text-muted hover:bg-chip-bg-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
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
            <div role="status" className="absolute inset-0 flex items-center justify-center bg-surface-container-low p-4 text-sm text-text-muted">
              <div className="flex items-center space-x-2">
                <svg aria-hidden="true" className="h-5 w-5 flex-none animate-spin text-primary motion-reduce:animate-none" fill="none" viewBox="0 0 24 24">
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
