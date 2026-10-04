import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { searchService } from "../../services/searchService";
import { PLACE_CATEGORY_LABELS } from "../../constants";
import { formatDuration } from "../../utils/formatCurrency";

// Khớp SearchQuery của BE
const MIN_KEYWORD_LENGTH = 2;
const MAX_KEYWORD_LENGTH = 100;
const DEBOUNCE_MS = 300;

// Chuẩn hoá giống BE: cắt hai đầu, gộp khoảng trắng liền nhau
const normalizeKeyword = (value) => value.trim().split(/\s+/).join(" ");

function ResultGroup({ title, group, children }) {
  if (group.items.length === 0) return null;
  return (
    <div className="py-1.5">
      <div className="px-4 py-1 text-label-sm font-bold uppercase tracking-wider text-text-faint">
        {title}
      </div>
      <ul>{children}</ul>
      {group.hasMore && (
        <p className="px-4 py-1 text-label-sm text-text-faint">Còn kết quả khác, hãy gõ cụ thể hơn.</p>
      )}
    </div>
  );
}

function ResultRow({ icon, title, subtitle, onSelect }) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-surface-container-low focus-visible:bg-surface-container-low focus-visible:outline-none"
      >
        <span className="material-symbols-outlined flex-none text-[18px] text-navy">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body-md font-semibold text-on-surface">{title}</span>
          {subtitle && <span className="block truncate text-label-sm text-text-muted">{subtitle}</span>}
        </span>
      </button>
    </li>
  );
}

export default function HomeSearch() {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState(null); // { keyword, data } | { keyword, error: true }

  const keyword = normalizeKeyword(value);
  const searchable = keyword.length >= MIN_KEYWORD_LENGTH;
  // Đang tìm = kết quả hiện có chưa ứng với từ khoá hiện tại
  const loading = searchable && result?.keyword !== keyword;

  useEffect(() => {
    if (!searchable) return undefined;
    let active = true;
    const timer = setTimeout(() => {
      searchService
        .search(keyword)
        .then((data) => {
          if (active) setResult({ keyword, data });
        })
        .catch(() => {
          if (active) setResult({ keyword, error: true });
        });
    }, DEBOUNCE_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [keyword, searchable]);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const go = (path, options) => {
    setOpen(false);
    navigate(path, options);
  };

  const data = loading ? null : result?.data;
  const isEmpty =
    data &&
    data.stations.items.length + data.places.items.length + data.curatedItineraries.items.length === 0;

  return (
    <div ref={containerRef} className="relative order-last w-full sm:order-none sm:w-auto sm:max-w-[320px] sm:flex-1">
      <label className="soft-shadow flex min-w-0 items-center gap-2 rounded-full bg-white px-3.5 py-[9px] focus-within:ring-2 focus-within:ring-primary-container">
        <span className="material-symbols-outlined flex-none text-[15px] text-text-faint">search</span>
        <input
          type="search"
          value={value}
          maxLength={MAX_KEYWORD_LENGTH}
          onChange={(event) => {
            setValue(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Tìm ga, địa điểm, lịch trình mẫu..."
          aria-label="Tìm ga, địa điểm, lịch trình mẫu"
          className="min-w-0 flex-1 bg-transparent text-[12.5px] text-on-surface outline-none placeholder:text-text-faint"
        />
      </label>

      {open && searchable && (
        <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-[60vh] overflow-y-auto rounded-2xl border border-border-soft bg-white py-1.5 shadow-xl">
          {loading ? (
            <p role="status" className="px-4 py-3 text-body-md text-text-muted">Đang tìm...</p>
          ) : result.error ? (
            <p role="alert" className="px-4 py-3 text-body-md text-error">Không tìm được lúc này. Vui lòng thử lại.</p>
          ) : isEmpty ? (
            <p className="px-4 py-3 text-body-md text-text-muted">Không có kết quả cho "{keyword}".</p>
          ) : (
            <>
              <ResultGroup title="Ga Metro" group={data.stations}>
                {data.stations.items.map((station) => (
                  <ResultRow
                    key={station.id}
                    icon="train"
                    title={`Ga ${station.name}`}
                    subtitle={`${station.placeCount} địa điểm quanh ga`}
                    onSelect={() => go("/metro", { state: { stationOrder: station.order } })}
                  />
                ))}
              </ResultGroup>
              <ResultGroup title="Địa điểm" group={data.places}>
                {data.places.items.map((place) => (
                  <ResultRow
                    key={place.id}
                    icon="location_on"
                    title={place.name}
                    subtitle={[
                      PLACE_CATEGORY_LABELS[place.category] ?? place.category,
                      place.station && `Ga ${place.station.name}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    onSelect={() => go(`/place/${place.id}`)}
                  />
                ))}
              </ResultGroup>
              <ResultGroup title="Lịch trình mẫu" group={data.curatedItineraries}>
                {data.curatedItineraries.items.map((itinerary) => (
                  <ResultRow
                    key={itinerary.id}
                    icon="route"
                    title={itinerary.title}
                    subtitle={[
                      itinerary.stationName && `Ga ${itinerary.stationName}`,
                      formatDuration(itinerary.estimatedDurationMinutes),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    onSelect={() => go("/explore")}
                  />
                ))}
              </ResultGroup>
            </>
          )}
        </div>
      )}
    </div>
  );
}
