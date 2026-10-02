import { useEffect, useState } from "react";

// Thời điểm hiện tại, cập nhật mỗi intervalMs để UI tự đổi theo giờ thật
export function useClock(intervalMs) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
