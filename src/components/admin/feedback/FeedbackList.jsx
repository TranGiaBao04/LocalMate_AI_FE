import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DataTable, FilterBar, StatusBadge } from "../ui";
import RatingStars from "../../ui/RatingStars";
import { ADMIN_PERMISSIONS } from "../../../constants";
import { useAuth } from "../../../context/AuthContext";
import { adminFeedbackService } from "../../../services/adminFeedbackService";
import { hasAnyPermission } from "../../../utils/adminAccess";
import { formatDateTimeInVietnam } from "../../../utils/vnTime";

const PAGE_SIZE = 20;
const EMPTY_FILTERS = { from: "", to: "", hasComment: "", rating: "", quickTag: "", userId: "", placeId: "" };
const SELECT_CLASS = "h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100/60";
const DATE_BOX_CLASS = "flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 focus-within:border-blue-300 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-100/60";

function FilterButton({ label, onClick }) {
  return (
    <button type="button" title={label} aria-label={label} onClick={onClick} className="shrink-0 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-primary">
      <span className="material-symbols-outlined text-[16px]">filter_alt</span>
    </button>
  );
}

function ScopeChip({ label, onClear }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 py-1 pl-3 pr-1.5 text-xs font-semibold text-primary">
      {label}
      <button type="button" aria-label={`Bỏ lọc ${label}`} onClick={onClear} className="rounded-full p-0.5 hover:bg-blue-100">
        <span className="material-symbols-outlined text-[14px]">close</span>
      </button>
    </span>
  );
}

function SentAtCell({ row }) {
  return (
    <div className="whitespace-nowrap">
      <p>{formatDateTimeInVietnam(row.createdAt)}</p>
      {row.tripDeleted && <p className="mt-0.5 text-xs text-slate-400">Chuyến đi đã bị xoá</p>}
    </div>
  );
}

function AuthorCell({ author, canOpen, onFilter }) {
  return (
    <div className="flex items-start gap-1">
      <div className="min-w-0">
        {canOpen ? (
          <Link to={`/admin/users/${author.userId}`} className="font-semibold text-slate-900 hover:text-primary">{author.fullName}</Link>
        ) : (
          <p className="font-semibold text-slate-900">{author.fullName}</p>
        )}
        <p className="mt-0.5 break-all text-xs text-slate-500">{author.email}</p>
      </div>
      <FilterButton label={`Chỉ xem của ${author.fullName}`} onClick={() => onFilter(author)} />
    </div>
  );
}

function CommentCell({ comment, children }) {
  if (!comment && !children) return <span className="text-slate-400">—</span>;
  return (
    <div className="min-w-[220px] max-w-md space-y-1.5">
      {children}
      {comment && <p className="whitespace-pre-line break-words text-slate-700">{comment}</p>}
    </div>
  );
}

// kind: "reviews" (đánh giá địa điểm) | "tripFeedback" (feedback cả chuyến đi). Hai danh sách chung bộ lọc
// ngày gửi / có nhận xét / người gửi; khác ở cột và 1 bộ lọc riêng (số sao + địa điểm, hoặc nhãn).
// tagLabels: { mã: nhãn } từ master-data của đúng loại (12 quick tag đánh giá hoặc 7 nhãn feedback chuyến đi).
export default function FeedbackList({ kind, tagLabels = {}, preset = null }) {
  const isReviews = kind === "reviews";
  const { user } = useAuth();
  const canOpenUser = hasAnyPermission(user, [ADMIN_PERMISSIONS.MANAGE_USERS]);
  const canOpenPlace = hasAnyPermission(user, [ADMIN_PERMISSIONS.MANAGE_PLACES]);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filters, setFilters] = useState(() => ({
    ...EMPTY_FILTERS,
    placeId: preset?.placeId ?? "",
    from: preset?.from ?? "",
    to: preset?.to ?? "",
  }));
  // API chỉ nhận id, nên giữ tên để hiện ở nhãn bộ lọc
  const [scopeNames, setScopeNames] = useState({ user: "", place: preset?.placeName ?? "" });
  const [sort, setSort] = useState({ key: "createdAt", direction: "desc" });
  const [page, setPage] = useState(1);
  const [reloadCount, setReloadCount] = useState(0);
  const [response, setResponse] = useState({ key: null, data: null, error: "" });

  // Cùng luật với BE ("To không được trước From"); sai thì không gọi API
  const dateError = filters.from && filters.to && filters.from > filters.to
    ? "Ngày bắt đầu không được sau ngày kết thúc."
    : "";

  const query = useMemo(() => ({
    page,
    pageSize: PAGE_SIZE,
    sortBy: sort.key,
    sortDirection: sort.direction,
    search: debouncedSearch,
    ...filters,
  }), [page, sort, debouncedSearch, filters]);
  const queryKey = `${JSON.stringify(query)}#${reloadCount}`;
  const loading = !dateError && response.key !== queryKey;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (dateError) return undefined;
    let active = true;
    const load = isReviews ? adminFeedbackService.getReviews : adminFeedbackService.getTripFeedback;
    load(query)
      .then((data) => {
        if (active) setResponse({ key: queryKey, data, error: "" });
      })
      .catch((err) => {
        if (active) setResponse({ key: queryKey, data: null, error: err?.message || "Không tải được danh sách." });
      });
    return () => { active = false; };
  }, [query, queryKey, isReviews, dateError]);

  const changeFilter = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }, []);

  const filterByUser = useCallback((author) => {
    setScopeNames((prev) => ({ ...prev, user: author.fullName }));
    changeFilter("userId", author.userId);
  }, [changeFilter]);

  const filterByPlace = useCallback((place) => {
    setScopeNames((prev) => ({ ...prev, place: place.name }));
    changeFilter("placeId", place.id);
  }, [changeFilter]);

  const handleSort = (key) => {
    setSort((prev) => ({ key, direction: prev.key === key && prev.direction === "desc" ? "asc" : "desc" }));
    setPage(1);
  };

  const handleClearFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setFilters(EMPTY_FILTERS);
    setPage(1);
  };

  const hasFilters = Boolean(search) || Object.values(filters).some(Boolean);
  const rows = loading || dateError ? [] : response.data?.items ?? [];

  const columns = useMemo(() => {
    const sentAt = { key: "createdAt", header: "Ngày gửi", sortable: true, render: (row) => <SentAtCell row={row} /> };
    const author = {
      key: "user",
      header: "Người gửi",
      render: (row) => <AuthorCell author={row.user} canOpen={canOpenUser} onFilter={filterByUser} />,
    };

    if (!isReviews) {
      return [
        sentAt,
        author,
        {
          key: "quickTag",
          header: "Nhãn",
          render: (row) => (
            <StatusBadge
              status={row.quickTag === "Suitable" ? "success" : "warning"}
              label={tagLabels[row.quickTag] ?? row.quickTag}
            />
          ),
        },
        { key: "comment", header: "Nhận xét", render: (row) => <CommentCell comment={row.comment} /> },
      ];
    }

    return [
      sentAt,
      author,
      {
        key: "place",
        header: "Địa điểm",
        render: (row) => (
          <div className="flex items-start gap-1">
            <div className="min-w-0">
              {canOpenPlace ? (
                <Link to={`/admin/places/${row.place.id}`} className="font-semibold text-slate-900 hover:text-primary">{row.place.name}</Link>
              ) : (
                <p className="font-semibold text-slate-900">{row.place.name}</p>
              )}
              {!row.place.isVisible && <div className="mt-1"><StatusBadge status="inactive" label="Đã ẩn" /></div>}
            </div>
            <FilterButton label={`Chỉ xem đánh giá của ${row.place.name}`} onClick={() => filterByPlace(row.place)} />
          </div>
        ),
      },
      {
        key: "rating",
        header: "Số sao",
        sortable: true,
        render: (row) => (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <RatingStars value={row.rating} size={14} />
            <span className="font-semibold text-slate-900">{row.rating}</span>
          </span>
        ),
      },
      {
        key: "comment",
        header: "Nhận xét",
        render: (row) => (
          <CommentCell comment={row.comment}>
            {row.quickTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {row.quickTags.map((code) => (
                  <span key={code} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                    {tagLabels[code] ?? code}
                  </span>
                ))}
              </div>
            )}
          </CommentCell>
        ),
      },
    ];
  }, [isReviews, tagLabels, canOpenUser, canOpenPlace, filterByUser, filterByPlace]);

  return (
    <div className="space-y-4">
      <FilterBar
        searchValue={search}
        searchPlaceholder={isReviews
          ? "Tìm theo nhận xét, địa điểm, tên hoặc email (gõ không dấu được)"
          : "Tìm theo nhận xét, tên hoặc email (gõ không dấu được)"}
        onSearchChange={setSearch}
        onClear={handleClearFilters}
      >
        {isReviews ? (
          <select value={filters.rating} onChange={(event) => changeFilter("rating", event.target.value)} aria-label="Lọc theo số sao" className={SELECT_CLASS}>
            <option value="">Tất cả mức sao</option>
            {[5, 4, 3, 2, 1].map((star) => <option key={star} value={star}>{star} sao</option>)}
          </select>
        ) : Object.keys(tagLabels).length > 0 && (
          <select value={filters.quickTag} onChange={(event) => changeFilter("quickTag", event.target.value)} aria-label="Lọc theo nhãn" className={SELECT_CLASS}>
            <option value="">Tất cả nhãn</option>
            {Object.entries(tagLabels).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
          </select>
        )}
        <select value={filters.hasComment} onChange={(event) => changeFilter("hasComment", event.target.value)} aria-label="Lọc theo nhận xét" className={SELECT_CLASS}>
          <option value="">Có và không có nhận xét</option>
          <option value="true">Chỉ có nhận xét</option>
          <option value="false">Không có nhận xét</option>
        </select>
        <div className={DATE_BOX_CLASS}>
          <span className="text-xs font-semibold text-slate-400">Từ</span>
          <input type="date" value={filters.from} min="2000-01-01" max="2100-12-31" onChange={(event) => changeFilter("from", event.target.value)} aria-label="Gửi từ ngày" className="bg-transparent text-sm text-slate-700 outline-none" />
        </div>
        <div className={DATE_BOX_CLASS}>
          <span className="text-xs font-semibold text-slate-400">Đến</span>
          <input type="date" value={filters.to} min="2000-01-01" max="2100-12-31" onChange={(event) => changeFilter("to", event.target.value)} aria-label="Gửi đến ngày" className="bg-transparent text-sm text-slate-700 outline-none" />
        </div>
      </FilterBar>

      {(filters.userId || filters.placeId) && (
        <div className="flex flex-wrap gap-2">
          {filters.userId && <ScopeChip label={`Người gửi: ${scopeNames.user}`} onClear={() => changeFilter("userId", "")} />}
          {filters.placeId && <ScopeChip label={`Địa điểm: ${scopeNames.place}`} onClear={() => changeFilter("placeId", "")} />}
        </div>
      )}

      {dateError && (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{dateError}</p>
      )}

      {response.error && !loading && !dateError && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <span>{response.error}</span>
          <button type="button" onClick={() => setReloadCount((count) => count + 1)} className="shrink-0 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-700">
            Thử lại
          </button>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        sort={sort}
        onSort={handleSort}
        pagination={!dateError && response.data && {
          page: response.data.page,
          totalPages: response.data.totalPages,
          totalCount: response.data.totalCount,
        }}
        onPageChange={setPage}
        emptyState={{
          icon: isReviews ? "reviews" : "forum",
          title: hasFilters ? "Không có dòng nào phù hợp" : isReviews ? "Chưa có đánh giá" : "Chưa có feedback chuyến đi",
          description: hasFilters ? "Thử đổi từ khoá hoặc bộ lọc." : undefined,
          actionLabel: hasFilters ? "Xóa bộ lọc" : undefined,
          onAction: hasFilters ? handleClearFilters : undefined,
        }}
      />
    </div>
  );
}
