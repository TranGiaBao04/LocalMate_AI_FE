export const formatCurrency = (amount) => {
  if (amount === 0) return "Miễn phí";

  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatCurrencyShort = (amount) => {
  if (amount === 0) return "Miễn phí";
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}tr`;
  if (amount >= 1000) return `${Math.round(amount / 1000)}k`;

  return `${amount}đ`;
};

export const formatDuration = (minutes) => {
  if (minutes < 60) return `${minutes} phút`;

  const h = Math.floor(minutes / 60);
  const m = minutes % 60;

  if (m === 0) return `${h} tiếng`;

  return `${h}h${m}p`;
};

export const buildGoogleMapsUrl = (lat, lng) => {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
};

export const buildGoogleMapsDirectionUrl = (lat, lng) => {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
};

export const formatDate = (dateStr) => {
  const date = new Date(dateStr);

  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

export const formatRelativeTime = (dateStr) => {
  const date = new Date(dateStr);
  const now = new Date();

  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / 86400000);

  if (days === 0) return "Hôm nay";
  if (days === 1) return "Hôm qua";
  if (days < 7) return `${days} ngày trước`;

  return formatDate(dateStr);
};
