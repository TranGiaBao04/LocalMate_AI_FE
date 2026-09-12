import React, { useState } from 'react';
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
    <div className={`w-full overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 transition-all ${className}`}>
      {!isExpanded ? (
        <div className="p-3.5 flex items-center justify-between bg-emerald-50/60 dark:bg-emerald-950/20">
          <div className="flex items-center space-x-2 text-emerald-800 dark:text-emerald-300 text-xs font-medium truncate mr-2">
            <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="truncate">{placeName || address || 'Vị trí trên bản đồ'}</span>
          </div>

          <div className="flex items-center space-x-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/60 dark:text-emerald-200 rounded-lg transition-colors"
            >
              Xem bản đồ
            </button>
            <GoogleMapsButton lat={lat} lng={lng} placeName={placeName} variant="compact" />
          </div>
        </div>
      ) : (
        <div className="relative w-full">
          {/* Header Action Bar */}
          <div className="p-2.5 bg-slate-900 text-white flex items-center justify-between text-xs px-3">
            <span className="font-semibold text-emerald-400 truncate max-w-[60%]">
              📍 {placeName || 'Vị trí ghim'}
            </span>
            <div className="flex items-center space-x-2">
              <GoogleMapsButton lat={lat} lng={lng} placeName={placeName} variant="compact" className="bg-emerald-800 text-white hover:bg-emerald-700" />
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="text-slate-400 hover:text-white p-1 rounded-md"
                title="Thu gọn bản đồ"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Loading Skeleton */}
          {!isLoaded && (
            <div className="w-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-400 text-xs" style={{ height }}>
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 animate-spin text-emerald-500" fill="none" viewBox="0 0 24 24">
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
            height={height}
            src={embedUrl}
            onLoad={() => setIsLoaded(true)}
            style={{ border: 0, display: isLoaded ? 'block' : 'none' }}
            allowFullScreen=""
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      )}
    </div>
  );
};

export default MapEmbedPreview;
