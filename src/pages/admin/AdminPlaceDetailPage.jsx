import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Edit2,
  MapPin,
  Clock,
  DollarSign,
  Building2,
  Train,
  CheckCircle2,
  XCircle,
  Star,
  Tag,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { adminPlaceService } from "../../services/adminPlaceService";
import { VerifiedBadge } from "../../components/admin/VerifiedBadge";

const DAYS_MAP = {
  Monday: "Thứ Hai",
  Tuesday: "Thứ Ba",
  Wednesday: "Thứ Tư",
  Thursday: "Thứ Năm",
  Friday: "Thứ Sáu",
  Saturday: "Thứ Bảy",
  Sunday: "Chủ Nhật",
};

export default function AdminPlaceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [place, setPlace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadPlace() {
      setLoading(true);
      setError(null);
      try {
        const res = await adminPlaceService.getPlaceById(id);
        setPlace(res?.data || res);
      } catch (err) {
        console.error("Lỗi tải chi tiết địa điểm:", err);
        setError(err.message || "Không thể tải thông tin địa điểm.");
      } finally {
        setLoading(false);
      }
    }
    if (id) {
      loadPlace();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50/50 p-6 flex flex-col items-center justify-center gap-3 text-gray-500">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
        <span className="text-sm font-medium">Đang tải chi tiết địa điểm...</span>
      </div>
    );
  }

  if (error || !place) {
    return (
      <div className="min-h-screen bg-gray-50/50 p-6">
        <div className="max-w-3xl mx-auto bg-white rounded-2xl p-8 border border-gray-100 shadow-sm text-center space-y-4">
          <XCircle className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="text-xl font-bold text-gray-900">Không tìm thấy địa điểm</h2>
          <p className="text-sm text-gray-500">{error || "Địa điểm không tồn tại hoặc đã bị xóa."}</p>
          <button
            onClick={() => navigate("/admin/places")}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Quay lại danh sách
          </button>
        </div>
      </div>
    );
  }

  const openingHours = place.openingHours || place.openingHoursList || [];

  return (
    <div className="min-h-screen bg-gray-50/50 p-4 md:p-8 space-y-6">
      {/* Top Bar Navigation & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/admin/places")}
            className="p-2 text-gray-600 hover:bg-white border border-gray-200 rounded-xl transition shadow-sm"
            title="Quay lại"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">{place.name}</h1>
              <VerifiedBadge isVerified={place.isVerified} />
            </div>
            <p className="text-xs text-gray-400 mt-0.5">ID: {place.id}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to={`/admin/places/edit/${place.id}`}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition shadow-sm"
          >
            <Edit2 className="w-4 h-4" />
            Chỉnh sửa địa điểm
          </Link>
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Key Info & Images (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Main Cover Image */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden p-4">
            <div className="relative h-64 md:h-80 w-full rounded-xl overflow-hidden bg-gray-100">
              <img
                src={place.imageUrl || "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&h=500&fit=crop"}
                alt={place.name}
                className="w-full h-full object-cover"
              />
              <span className="absolute top-3 left-3 px-3 py-1 bg-black/60 backdrop-blur-md text-white text-xs font-semibold rounded-full border border-white/20">
                {place.category || "Địa điểm"}
              </span>
              <span
                className={`absolute top-3 right-3 px-3 py-1 text-xs font-semibold rounded-full ${place.status === "Active"
                    ? "bg-emerald-500/90 text-white"
                    : "bg-gray-500/90 text-white"
                  }`}
              >
                {place.status || "Active"}
              </span>
            </div>
          </div>

          {/* Place Details & Attributes */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 border-b pb-3 border-gray-100">
              <Building2 className="w-5 h-5 text-teal-600" />
              Thông Tin Tổng Quan
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="p-4 bg-gray-50/80 rounded-xl space-y-1">
                <span className="text-xs font-medium text-gray-400 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-teal-600" /> Địa chỉ
                </span>
                <p className="font-semibold text-gray-800">{place.address || "Chưa cập nhật"}</p>
              </div>

              <div className="p-4 bg-gray-50/80 rounded-xl space-y-1">
                <span className="text-xs font-medium text-gray-400 flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-teal-600" /> Chi phí ước tính
                </span>
                <p className="font-semibold text-gray-800">
                  {place.estimatedCostMin || place.estimatedCostMax ? (
                    `${place.estimatedCostMin?.toLocaleString()}đ - ${place.estimatedCostMax?.toLocaleString()}đ`
                  ) : (
                    "Miễn phí / Tùy chọn"
                  )}
                </p>
              </div>

              <div className="p-4 bg-gray-50/80 rounded-xl space-y-1">
                <span className="text-xs font-medium text-gray-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-teal-600" /> Thời gian trải nghiệm
                </span>
                <p className="font-semibold text-gray-800">
                  {place.estimatedDurationMinutes
                    ? `${place.estimatedDurationMinutes} phút`
                    : "Chưa quy định"}
                </p>
              </div>

              <div className="p-4 bg-gray-50/80 rounded-xl space-y-1">
                <span className="text-xs font-medium text-gray-400 flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 text-amber-500" /> Đánh giá
                </span>
                <p className="font-semibold text-gray-800 flex items-center gap-1">
                  {place.rating ? `${place.rating} / 5` : "Chưa có đánh giá"}
                  {place.totalReviews ? ` (${place.totalReviews} lượt)` : ""}
                </p>
              </div>
            </div>

            {/* Description */}
            {place.description && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Mô tả địa điểm</h3>
                <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 p-4 rounded-xl border border-gray-100">
                  {place.description}
                </p>
              </div>
            )}

            {/* Tags */}
            {place.tags && place.tags.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5 text-teal-600" /> Thẻ phân loại (Tags)
                </h3>
                <div className="flex flex-wrap gap-2">
                  {place.tags.map((t, idx) => (
                    <span
                      key={t.id || idx}
                      className="px-3 py-1 bg-teal-50 text-teal-700 text-xs font-medium rounded-lg border border-teal-100"
                    >
                      {t.name || t}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Metro Station & Opening Hours (1 col) */}
        <div className="space-y-6">
          {/* Location & Coordinates Card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2 border-b pb-3 border-gray-100">
              <Train className="w-5 h-5 text-teal-600" />
              Kết Nối Ga Metro & Tọa Độ
            </h2>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center p-3 bg-teal-50/50 rounded-xl border border-teal-100">
                <span className="text-gray-600 font-medium">Ga Metro gần nhất:</span>
                <span className="font-bold text-teal-800">
                  {place.nearestStationName || place.stationName || "Chưa gán ga"}
                </span>
              </div>

              {place.distanceToStationMeters && (
                <div className="flex justify-between items-center px-1 text-gray-500">
                  <span>Khoảng cách đến ga:</span>
                  <span className="font-semibold text-gray-800">
                    {Math.round(place.distanceToStationMeters)}m
                  </span>
                </div>
              )}

              <div className="p-3 bg-gray-50 rounded-xl space-y-1 font-mono text-gray-600">
                <div className="flex justify-between">
                  <span>Vĩ độ (Lat):</span>
                  <span className="font-bold text-gray-800">{place.latitude || place.lat || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Kinh độ (Lng):</span>
                  <span className="font-bold text-gray-800">{place.longitude || place.lng || "N/A"}</span>
                </div>
              </div>

              {place.latitude && place.longitude && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-xl transition border border-teal-200"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Mở vị trí trên Google Maps
                </a>
              )}
            </div>
          </div>

          {/* Opening Hours Schedule Card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2 border-b pb-3 border-gray-100">
              <Clock className="w-5 h-5 text-teal-600" />
              Lịch Giờ Mở Cửa (Opening Hours)
            </h2>

            {openingHours.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">Chưa có thông tin giờ mở cửa</p>
            ) : (
              <div className="space-y-2 text-xs divide-y divide-gray-50">
                {openingHours.map((oh, idx) => {
                  const dayName = DAYS_MAP[oh.dayOfWeek] || oh.dayOfWeek;
                  const isClosed = oh.isClosed;
                  const timeText = isClosed
                    ? "Đóng cửa"
                    : `${oh.openTime || "08:00"} - ${oh.closeTime || "22:00"}`;

                  return (
                    <div key={idx} className="flex justify-between items-center pt-2">
                      <span className="font-medium text-gray-700">{dayName}</span>
                      <span
                        className={`font-semibold px-2 py-0.5 rounded-md ${isClosed
                            ? "bg-red-50 text-red-600"
                            : "bg-emerald-50 text-emerald-700"
                          }`}
                      >
                        {timeText}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
