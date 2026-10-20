import { useCallback, useSyncExternalStore } from "react";

// Khớp một media query và tự cập nhật khi đổi kích thước màn hình.
// Không có matchMedia (một số trình duyệt cũ, môi trường test) thì coi như không khớp.
export function useMediaQuery(query) {
  const subscribe = useCallback((onChange) => {
    const list = window.matchMedia?.(query);
    list?.addEventListener?.("change", onChange);
    return () => list?.removeEventListener?.("change", onChange);
  }, [query]);
  return useSyncExternalStore(subscribe, () => Boolean(window.matchMedia?.(query)?.matches), () => false);
}
