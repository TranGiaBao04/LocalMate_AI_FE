import { useEffect, useRef, useState } from "react";
import logo from "../../assets/logo.jpg";
import "./landingHeader.css";

const NAV_GROUPS = [
  {
    id: "product",
    label: "Sản phẩm",
    items: [
      { id: "van-de-giai-phap", label: "Vì sao LocalMate?", description: "Bớt lo kế hoạch, thêm vui hành trình.", icon: "sparkles" },
      { id: "tinh-nang", label: "Tính năng chính", description: "Tạo lịch, đổi điểm và xem chỉ đường.", icon: "features" },
    ],
  },
  {
    id: "explore",
    label: "Khám phá",
    items: [
      { id: "14-ga-metro", label: "Dọc 14 ga Metro", description: "Tìm điểm đến quanh tuyến Metro số 1.", icon: "train" },
      { id: "lich-trinh-mau", label: "Lịch trình gợi ý", description: "Một chút cảm hứng cho buổi xuống phố.", icon: "route" },
    ],
  },
];

const DIRECT_LINKS = [
  { id: "bang-gia", label: "Gói dịch vụ", icon: "ticket" },
  { id: "doi-ngu", label: "Đội ngũ", icon: "people" },
];

const ALL_LINKS = [...NAV_GROUPS.flatMap((group) => group.items), ...DIRECT_LINKS];

const ICON_PATHS = {
  chevron: "m8 10 4 4 4-4",
  arrow: "M5 12h14m-5-5 5 5-5 5",
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "m6 6 12 12M6 18 18 6",
  sparkles: "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z",
  features: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  train: "M7 17h10a2 2 0 0 0 2-2V6a3 3 0 0 0-3-3H8a3 3 0 0 0-3 3v9a2 2 0 0 0 2 2Zm-2-7h14M12 3v7M8 14h.01M16 14h.01M8 17l-2 4m10-4 2 4M7 20h10",
  route: "M6 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM8 5h7a4 4 0 0 1 0 8H9a4 4 0 0 0 0 8h7",
  ticket: "M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8Zm12-2v2m0 3v2m0 3v2",
  people: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
};

function HeaderIcon({ name, className = "" }) {
  return (
    <svg aria-hidden="true" className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}

export default function LandingHeader({ isLoggedIn, contentReady, onNavigate, onSectionSelect, onBackToTop }) {
  const [openMenu, setOpenMenu] = useState(null);
  const [activeSection, setActiveSection] = useState(null);
  const headerRef = useRef(null);
  const triggerRefs = useRef({});
  const panelRefs = useRef({});
  const initialHashHandled = useRef(false);

  useEffect(() => {
    function followHash() {
      const id = window.location.hash.slice(1);
      if (ALL_LINKS.some((item) => item.id === id)) {
        document.getElementById(id)?.scrollIntoView({ behavior: "auto", block: "start" });
      }
    }
    const frame = requestAnimationFrame(() => {
      if (contentReady && !initialHashHandled.current) {
        initialHashHandled.current = true;
        followHash();
      }
    });
    window.addEventListener("hashchange", followHash);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", followHash);
    };
  }, [contentReady]);

  useEffect(() => {
    if (!openMenu) return undefined;

    function handleOutside(event) {
      if (!headerRef.current?.contains(event.target)) setOpenMenu(null);
    }
    function handleEscape(event) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpenMenu(null);
      triggerRefs.current[openMenu]?.focus();
    }

    document.addEventListener("pointerdown", handleOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [openMenu]);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const closeOnResize = () => setOpenMenu(null);
    media.addEventListener("change", closeOnResize);
    return () => media.removeEventListener("change", closeOnResize);
  }, []);

  useEffect(() => {
    const sections = ALL_LINKS.map((link) => document.getElementById(link.id)).filter(Boolean);
    if (!sections.length) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (window.scrollY < sections[0].offsetTop - 150) {
        setActiveSection(null);
        return;
      }
      const visible = entries.filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActiveSection(visible[0].target.id);
    }, { rootMargin: "-90px 0px -55% 0px", threshold: 0 });
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  function selectSection(event, id) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    initialHashHandled.current = true;
    setOpenMenu(null);
    setActiveSection(id);
    onSectionSelect(id);
    const section = document.getElementById(id);
    const heading = section?.querySelector("h2");
    if (heading) {
      heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
    }
  }

  function openWithKeyboard(event, id) {
    if (event.key !== "ArrowDown") return;
    event.preventDefault();
    setOpenMenu(id);
    requestAnimationFrame(() => panelRefs.current[id]?.querySelector("a")?.focus());
  }

  function renderSectionLink(item, className) {
    return (
      <a
        key={item.id}
        href={`#${item.id}`}
        aria-current={activeSection === item.id ? "location" : undefined}
        className={className}
        onClick={(event) => selectSection(event, item.id)}
      >
        <span className="lm-header-link-icon"><HeaderIcon name={item.icon} /></span>
        <span className="lm-header-link-copy">
          <span className="lm-header-link-title">{item.label}</span>
          {item.description && <span className="lm-header-link-description">{item.description}</span>}
        </span>
        <HeaderIcon name="arrow" className="lm-header-link-arrow" />
      </a>
    );
  }

  return (
    <header className="lm-header" ref={headerRef} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpenMenu(null);
    }}>
      <div className="lm-header-bar">
        <button type="button" className="lm-header-brand" aria-label="LocalMate AI, lên đầu trang" onClick={() => {
          initialHashHandled.current = true;
          setOpenMenu(null);
          setActiveSection(null);
          onBackToTop();
        }}>
          <img src={logo} alt="" width="42" height="42" />
          <span className="lm-header-wordmark">
            <span>LocalMate <span className="lm-header-ai">AI</span></span>
            <span className="lm-header-tagline">Sài Gòn · Metro số 1</span>
          </span>
        </button>

        <nav className="lm-header-desktop" aria-label="Điều hướng landing page">
          {NAV_GROUPS.map((group) => (
            <div key={group.id} className="lm-header-group">
              <button
                ref={(node) => { triggerRefs.current[group.id] = node; }}
                type="button"
                className="lm-header-nav-item"
                data-active={group.items.some((item) => item.id === activeSection)}
                aria-expanded={openMenu === group.id}
                aria-controls={`lm-header-${group.id}-panel`}
                onClick={() => setOpenMenu((current) => current === group.id ? null : group.id)}
                onKeyDown={(event) => openWithKeyboard(event, group.id)}
              >
                {group.label}<HeaderIcon name="chevron" className="lm-header-chevron" />
              </button>
              <div
                id={`lm-header-${group.id}-panel`}
                ref={(node) => { panelRefs.current[group.id] = node; }}
                className="lm-header-dropdown"
                hidden={openMenu !== group.id}
              >
                <p className="lm-header-dropdown-label">{group.id === "product" ? "Làm quen với LocalMate" : "Lên ý tưởng cho chuyến đi"}</p>
                {group.items.map((item) => renderSectionLink(item, "lm-header-dropdown-link"))}
              </div>
            </div>
          ))}
          {DIRECT_LINKS.map((item) => (
            <a key={item.id} className="lm-header-nav-item" href={`#${item.id}`} aria-current={activeSection === item.id ? "location" : undefined} onClick={(event) => selectSection(event, item.id)}>{item.label}</a>
          ))}
        </nav>

        <div className="lm-header-actions">
          {!isLoggedIn && <a href="/login" className="lm-header-login" onClick={(event) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            setOpenMenu(null);
            onNavigate("/login");
          }}>Đăng nhập</a>}
          <button type="button" className="lm-header-primary" onClick={() => {
            setOpenMenu(null);
            onNavigate(isLoggedIn ? "/home" : "/login");
          }}>
            <span className="lm-header-cta-full">{isLoggedIn ? "Vào ứng dụng" : "Tạo lịch trình"}</span>
            <span className="lm-header-cta-short">{isLoggedIn ? "Vào app" : "Bắt đầu"}</span>
            <HeaderIcon name="arrow" />
          </button>
          <button
            ref={(node) => { triggerRefs.current.mobile = node; }}
            type="button"
            id="landing-menu-toggle"
            className="lm-header-mobile-toggle"
            aria-label={openMenu === "mobile" ? "Đóng menu điều hướng" : "Mở menu điều hướng"}
            aria-expanded={openMenu === "mobile"}
            aria-controls="landing-mobile-nav"
            onClick={() => setOpenMenu((current) => current === "mobile" ? null : "mobile")}
          ><HeaderIcon name={openMenu === "mobile" ? "close" : "menu"} /></button>
        </div>
      </div>

      <nav id="landing-mobile-nav" className="lm-header-mobile-panel" aria-label="Điều hướng landing page trên điện thoại" hidden={openMenu !== "mobile"}>
        {NAV_GROUPS.map((group) => (
          <div key={group.id} className="lm-header-mobile-group">
            <p className="lm-header-dropdown-label">{group.label}</p>
            <div className="lm-header-mobile-grid">{group.items.map((item) => renderSectionLink(item, "lm-header-mobile-link"))}</div>
          </div>
        ))}
        <div className="lm-header-mobile-direct">{DIRECT_LINKS.map((item) => renderSectionLink(item, "lm-header-mobile-link"))}</div>
        {!isLoggedIn && <button type="button" className="lm-header-mobile-login" onClick={() => {
          setOpenMenu(null);
          onNavigate("/login");
        }}>Đã có tài khoản? <span>Đăng nhập <HeaderIcon name="arrow" /></span></button>}
      </nav>
    </header>
  );
}
