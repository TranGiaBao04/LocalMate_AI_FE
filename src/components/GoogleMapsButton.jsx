import React from 'react';
import { openGoogleMapsApp } from '../utils/openGoogleMapsApp';

/**
 * SPEC-03 / FE-65: Nút bấm GoogleMapsButton mở ứng dụng Google Maps
 * Nút bấm thiết kế chuẩn Design System, nổi bật icon Google Maps, hỗ trợ responsive di động.
 */
export const GoogleMapsButton = ({
  lat,
  lng,
  placeName,
  destLat,
  destLng,
  destName,
  variant = 'primary', // 'primary' | 'outline' | 'text' | 'compact'
  size = 'md', // 'sm' | 'md' | 'lg'
  children,
  className = '',
  ...props
}) => {
  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    openGoogleMapsApp({
      lat,
      lng,
      query: placeName,
      destLat,
      destLng,
      destName,
    });
  };

  // Maps Pin Icon SVG
  const MapsIcon = () => (
    <svg
      className="w-4 h-4 mr-1.5 flex-shrink-0"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
    </svg>
  );

  const baseStyles =
    'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 active:scale-95 shadow-sm';

  const variantStyles = {
    primary:
      'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-emerald-200 hover:shadow-md',
    outline:
      'border-2 border-emerald-600 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40',
    text: 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 shadow-none',
    // Dùng trong thanh tiêu đề MapEmbedPreview: nút navy theo tông chung của app
    compact: 'bg-primary text-on-primary hover:opacity-90 px-3 py-1.5 rounded-full text-xs shadow-none',
  };

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-5 py-3 text-base',
  };

  const isCompact = variant === 'compact';
  const buttonStyle = `${baseStyles} ${variantStyles[variant] || variantStyles.primary} ${
    isCompact ? '' : sizeStyles[size] || sizeStyles.md
  } ${className}`;

  return (
    <button
      type="button"
      onClick={handleClick}
      className={buttonStyle}
      title={destLat ? 'Chỉ đường qua Google Maps' : 'Mở địa điểm trên Google Maps'}
      {...props}
    >
      <MapsIcon />
      <span>{children || (destLat ? 'Chỉ đường' : 'Mở Google Maps')}</span>
    </button>
  );
};

export default GoogleMapsButton;
