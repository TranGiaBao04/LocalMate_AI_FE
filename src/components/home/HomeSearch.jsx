import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { searchService } from "../../services/searchService";
import { PLACE_CATEGORY_LABELS } from "../../constants";
import { formatDuration } from "../../utils/formatCurrency";

// Khớp SearchQuery của BE
const MIN_KEYWORD_LENGTH = 2;
const MAX_KEYWORD_LENGTH = 100;
// Request có tìm theo nghĩa chậm hơn 0,5–0,9 giây nên chờ lâu hơn trước khi gọi
const DEBOUNCE_MS = 450;

// Chuẩn hoá giống BE: cắt hai đầu, gộp khoảng trắng liền nhau
const normalizeKeyword = (value) => value.trim().split(/\s+/).join(" ");

function ResultGroup({ title, group, children }) {
  if (group.items.length === 0) return null;
  return (
    <div className="border-t border-border-soft py-2 first:border-t-0">
      <div className="px-4 py-2 text-xs font-semibold text-text-muted">
        {title}
      </div>
      <ul>{children}</ul>
      {group.hasMore && (
        <p className="px-4 py-2 text-xs leading-5 text-text-muted">Còn kết quả khác, hãy gõ cụ thể hơn.</p>
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
        className="flex min-h-11 w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-container-low focus-visible:bg-surface-container-low focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-navy motion-reduce:transition-none"
      >
        <span aria-hidden="true" className="material-symbols-outlined mt-0.5 flex-none text-xl text-navy">{icon}</span>
        <span className="min-w-0 flex-1">
          <span title={title} className="block break-words text-sm font-semibold leading-6 text-on-surface">{title}</span>
          {" "}
          {subtitle && <span className="mt-1 block break-words text-xs leading-5 text-text-muted">{subtitle}</span>}
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
    // Huỷ request cũ khi người dùng gõ tiếp
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchService
        .search(keyword, { signal: controller.signal })
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
      controller.abort();
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

  // Giữ kết quả cũ trên màn hình trong lúc chờ kết quả của từ khoá mới
  const data = result?.data;
  const hasItems =
    data &&
    data.stations.items.length + data.places.items.length + data.curatedItineraries.items.length > 0;
  // Kết quả so chuỗi đứng trước; gợi ý theo nghĩa (matchedOn = "Semantic") tách thành cụm riêng
  const exactPlaces = data?.places.items.filter((place) => place.matchedOn !== "Semantic") ?? [];
  const relatedPlaces = data?.places.items.filter((place) => place.matchedOn === "Semantic") ?? [];
  const placeRow = (place) => (
    <ResultRow
      key={place.id}
      icon={place.matchedOn === "Semantic" ? "auto_awesome" : "location_on"}
      title={place.name}
      subtitle={[
        PLACE_CATEGORY_LABELS[place.category] ?? place.category,
        place.station && `Ga ${place.station.name}`,
      ]
        .filter(Boolean)
        .join(" · ")}
      onSelect={() => go(`/place/${place.id}`)}
    />
  );

  return (
    <div ref={containerRef} className="relative order-last min-w-0 w-full sm:order-none sm:w-auto sm:max-w-[320px] sm:flex-1">
      <label className="flex min-h-11 min-w-0 items-center gap-2 rounded-[8px] border border-border-soft bg-white px-3 py-2 focus-within:border-navy focus-within:ring-2 focus-within:ring-primary-container">
        <span aria-hidden="true" className="material-symbols-outlined flex-none text-xl text-text-muted">search</span>
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
          className="min-w-0 flex-1 bg-transparent text-sm leading-6 text-on-surface outline-none placeholder:text-text-muted"
        />
      </label>

      {open && searchable && (
        <div role="region" aria-label="Kết quả tìm kiếm" className="absolute left-0 right-0 top-full z-30 mt-2 max-h-[60vh] overflow-y-auto overscroll-contain rounded-[8px] border border-border-soft bg-white py-1 shadow-lg">
          {loading && (
            <p role="status" className="px-4 py-3 text-sm leading-6 text-text-muted">Đang tìm...</p>
          )}
          {hasItems ? (
            <div className={loading ? "opacity-60" : undefined}>
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
              <ResultGroup title="Địa điểm" group={{ items: exactPlaces, hasMore: data.places.hasMore }}>
                {exactPlaces.map(placeRow)}
              </ResultGroup>
              <ResultGroup title="Gợi ý liên quan" group={{ items: relatedPlaces, hasMore: false }}>
                {relatedPlaces.map(placeRow)}
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
            </div>
          ) : loading ? null : result.error ? (
            <p role="alert" className="break-words px-4 py-4 text-sm leading-6 text-error">Không tìm được lúc này. Vui lòng thử lại.</p>
          ) : (
            <p className="break-words px-4 py-4 text-sm leading-6 text-text-muted">Không có kết quả cho "{keyword}".</p>
          )}
        </div>
      )}
    </div>
  );
}
