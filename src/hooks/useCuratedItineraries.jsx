import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTrip } from "../context/TripContext";
import { itineraryService } from "../services/itineraryService";
import {
  DAY_MINUTES,
  minutesNowInVietnam,
  minutesToTime,
  roundUpMinutes,
} from "../utils/vnTime";

const APPLY_ERROR_MESSAGES = {
  apply_requires_persisted_user: "Đăng nhập bằng tài khoản đã đăng ký để dùng lịch trình mẫu.",
  curated_itinerary_unavailable: "Các địa điểm của lịch trình này đã ngừng hoạt động.",
  curated_itinerary_not_found: "Lịch trình mẫu này không còn nữa.",
};

// Giờ rời điểm xuất phát: giờ Việt Nam hiện tại làm tròn 15 phút
function currentStartTime() {
  return minutesToTime(Math.min(roundUpMinutes(minutesNowInVietnam()), DAY_MINUTES - 15));
}

// Tải lịch trình mẫu và áp dụng một lịch thành trip nháp (hôm nay, từ giờ hiện tại)
export function useCuratedItineraries() {
  const navigate = useNavigate();
  const { isDemo } = useAuth();
  const { setCurrentTrip } = useTrip();
  const [curated, setCurated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [applyingId, setApplyingId] = useState(null);
  const [applyError, setApplyError] = useState(null); // { id, message }

  useEffect(() => {
    let active = true;
    itineraryService
      .getCuratedItineraries()
      .then((data) => {
        if (active) setCurated(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [retryKey]);

  const retry = () => {
    setLoading(true);
    setError(false);
    setRetryKey((key) => key + 1);
  };

  // Demo bị BE chặn nên báo trước
  const apply = async (itinerary) => {
    if (applyingId) return;
    if (isDemo) {
      setApplyError({ id: itinerary.id, message: APPLY_ERROR_MESSAGES.apply_requires_persisted_user });
      return;
    }
    setApplyError(null);
    setApplyingId(itinerary.id);
    try {
      const trip = await itineraryService.applyCuratedItinerary(itinerary.id, {
        startTime: currentStartTime(),
      });
      setCurrentTrip(trip);
      navigate("/draft");
    } catch (err) {
      setApplyError({ id: itinerary.id, message: APPLY_ERROR_MESSAGES[err.code] ?? err.message });
    } finally {
      setApplyingId(null);
    }
  };

  return { curated, loading, error, retry, applyingId, applyError, apply };
}
