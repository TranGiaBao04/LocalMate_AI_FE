import { useEffect, useState } from "react";
import { useTrip } from "../context/TripContext";

// Số giây còn phải chờ trước khi gọi AI lại (0 = gọi được), tự giảm mỗi giây
export function useAiCooldown() {
  const { aiCooldownUntil = 0 } = useTrip();
  const [now, setNow] = useState(() => Date.now());
  const active = now < aiCooldownUntil;

  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);

  return active ? Math.ceil((aiCooldownUntil - now) / 1000) : 0;
}
