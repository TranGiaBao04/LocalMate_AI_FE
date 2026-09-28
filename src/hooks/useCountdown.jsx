import { useEffect, useState } from "react";

// Đếm ngược theo giây: const [remaining, start] = useCountdown(); start(60)
export function useCountdown() {
  const [endsAt, setEndsAt] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const running = endsAt != null && now < endsAt;

  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  const start = (seconds) => {
    const t = Date.now();
    setNow(t);
    setEndsAt(t + seconds * 1000);
  };

  return [running ? Math.ceil((endsAt - now) / 1000) : 0, start];
}

// 125 -> "2:05"
export const formatClock = (seconds) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
