export function scrollToTop({ smooth = true } = {}) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: smooth && !reduceMotion ? "smooth" : "auto" });
}

// Bấm logo: về trang gốc của khu vực; đang ở sẵn đó thì cuộn mượt lên đầu
export function goHomeOrScrollTop(navigate, pathname, homePath) {
  if (pathname === homePath) {
    scrollToTop();
    return;
  }
  navigate(homePath);
  scrollToTop({ smooth: false });
}
