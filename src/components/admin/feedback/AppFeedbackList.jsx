import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AdminErrorState,
  AdminPagination,
  AdminRecordCard,
  DataTable,
  EmptyState,
  FilterBar,
  LoadingState,
  StatusBadge,
} from "../ui";
import { ADMIN_SELECT, ADMIN_ICON_BUTTON } from "../adminStyles";
import RatingStars from "../../ui/RatingStars";
import { ADMIN_PERMISSIONS } from "../../../constants";
import { useAuth } from "../../../context/AuthContext";
import { adminFeedbackService } from "../../../services/adminFeedbackService";
import { hasAnyPermission } from "../../../utils/adminAccess";
import { formatDateTimeInVietnam } from "../../../utils/vnTime";

const PAGE_SIZE = 20;
const EMPTY_FILTERS = { from: "", to: "", type: "", rating: "", userId: "" };
const SELECT_CLASS = ADMIN_SELECT + " sm:w-auto";
const DATE_BOX_CLASS =
  "flex min-h-11 min-w-0 items-center gap-1.5 rounded-[12px] border border-[#DCE2EE] bg-[#F8FAFC] px-3 py-1.5 focus-within:border-blue-300 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-100/60";

const TYPE_CONFIG = {
  1: { label: "Báo lỗi", variant: "error", icon: "bug_report" },
  2: { label: "Góp ý", variant: "info", icon: "lightbulb" },
  3: { label: "Khen ngợi", variant: "success", icon: "thumb_up" },
  4: { label: "Khác", variant: "neutral", icon: "chat_bubble" },
};

function FilterButton({ label, onClick }) {
  return (
    <button type="button" title={label} aria-label={label} onClick={onClick} className={ADMIN_ICON_BUTTON}>
      <span className="material-symbols-outlined text-[16px]">filter_alt</span>
    </button>
  );
}

function ScopeChip({ label, onClear }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 py-1 pl-3 pr-1.5 text-xs font-semibold text-primary">
      {label}
      <button type="button" aria-label={`Bỏ lọc ${label}`} onClick={onClear} className={ADMIN_ICON_BUTTON + " ml-1"}>
        <span className="material-symbols-outlined text-[14px]">close</span>
      </button>
    </span>
  );
}

function SentAtCell({ createdAt }) {
  return (
    <div className="whitespace-nowrap">
      <p className="text-sm text-[#0F2148]">{formatDateTimeInVietnam(createdAt)}</p>
    </div>
  );
}

function AuthorCell({ author, canOpen, onFilter }) {
  return (
    <div className="flex items-start gap-1">
      <div className="min-w-0">
        {canOpen ? (
          <Link to={`/admin/users/${author.userId}`} className="font-semibold text-[#0F2148] hover:text-primary">
            {author.fullName}
          </Link>
        ) : (
          <p className="font-semibold text-[#0F2148]">{author.fullName}</p>
        )}
        <p className="mt-0.5 break-all text-xs text-[#5C6B8A]">{author.email}</p>
      </div>
      <FilterButton label={`Chỉ xem của ${author.fullName}`} onClick={() => onFilter(author)} />
    </div>
  );
}

function ContentCell({ row }) {
  return (
    <div className="min-w-0 max-w-md">
      <p className="whitespace-pre-line break-words text-sm text-[#0F2148]">{row.content}</p>
    </div>
  );
}

export default function AppFeedbackList() {
  const { user } = useAuth();
  const canOpenUser = hasAnyPermission(user, [ADMIN_PERMISSIONS.MANAGE_USERS]);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [scopeUserName, setScopeUserName] = useState("");
  const [sort, setSort] = useState({ key: "createdAt", direction: "desc" });
  const [page, setPage] = useState(1);
  const [reloadCount, setReloadCount] = useState(0);
  const [response, setResponse] = useState({ key: null, data: null, error: "" });

  const dateError =
    filters.from && filters.to && filters.from > filters.to
      ? "Ngày bắt đầu không được sau ngày kết thúc."
      : "";

  const query = useMemo(
    () => ({
      page,
      pageSize: PAGE_SIZE,
      sortBy: sort.key,
      sortDirection: sort.direction,
      search: debouncedSearch,
      ...filters,
    }),
    [page, sort, debouncedSearch, filters]
  );

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

    adminFeedbackService
      .getAppFeedback(query)
      .then((data) => {
        if (active) setResponse({ key: queryKey, data, error: "" });
      })
      .catch((err) => {
        if (active)
          setResponse({
            key: queryKey,
            data: null,
            error: err?.message || "Không tải được danh sách góp ý ứng dụng.",
          });
      });

    return () => {
      active = false;
    };
  }, [query, queryKey, dateError]);

  const changeFilter = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }, []);

  const filterByUser = useCallback(
    (author) => {
      setScopeUserName(author.fullName);
      changeFilter("userId", author.userId);
    },
    [changeFilter]
  );

  const handleSort = (key) => {
    setSort((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "desc" ? "asc" : "desc",
    }));
    setPage(1);
  };

  const handleClearFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setFilters(EMPTY_FILTERS);
    setScopeUserName("");
    setPage(1);
  };

  const hasFilters = Boolean(search) || Object.values(filters).some(Boolean);
  const rows = loading || dateError ? [] : response.data?.items ?? [];

  const columns = useMemo(() => {
    return [
      {
        key: "createdAt",
        header: "Ngày gửi",
        sortable: true,
        render: (row) => <SentAtCell createdAt={row.createdAt} />,
      },
      {
        key: "user",
        header: "Người gửi",
        render: (row) => (
          <AuthorCell author={row.user} canOpen={canOpenUser} onFilter={filterByUser} />
        ),
      },
      {
        key: "type",
        header: "Loại ý kiến",
        render: (row) => {
          const cfg = TYPE_CONFIG[row.type] || {
            label: row.typeName || "Khác",
            variant: "neutral",
            icon: "chat_bubble",
          };
          return <StatusBadge variant={cfg.variant} label={cfg.label} icon={cfg.icon} />;
        },
      },
      {
        key: "rating",
        header: "Đánh giá",
        sortable: true,
        render: (row) =>
          row.rating ? (
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <RatingStars value={row.rating} size={14} />
              <span className="font-semibold text-[#0F2148]">{row.rating}</span>
            </span>
          ) : (
            <span className="text-[#8993AC]">—</span>
          ),
      },
      {
        key: "content",
        header: "Nội dung & Thông tin",
        render: (row) => <ContentCell row={row} />,
      },
    ];
  }, [canOpenUser, filterByUser]);

  return (
    <div className="space-y-4">
      <FilterBar
        searchValue={search}
        searchPlaceholder="Tìm theo nội dung, tên người gửi hoặc email (gõ không dấu được)"
        onSearchChange={setSearch}
        onClear={handleClearFilters}
      >
        <select
          value={filters.type}
          onChange={(e) => changeFilter("type", e.target.value)}
          aria-label="Lọc theo loại góp ý"
          className={SELECT_CLASS}
        >
          <option value="">Tất cả loại góp ý</option>
          <option value="1">Báo lỗi</option>
          <option value="2">Góp ý tính năng</option>
          <option value="3">Khen ngợi</option>
          <option value="4">Khác</option>
        </select>

        <select
          value={filters.rating}
          onChange={(e) => changeFilter("rating", e.target.value)}
          aria-label="Lọc theo mức sao"
          className={SELECT_CLASS}
        >
          <option value="">Tất cả mức sao</option>
          {[5, 4, 3, 2, 1].map((star) => (
            <option key={star} value={star}>
              {star} sao
            </option>
          ))}
        </select>

        <div className={DATE_BOX_CLASS}>
          <span className="text-xs font-semibold text-[#8993AC]">Từ</span>
          <input
            type="date"
            value={filters.from}
            min="2000-01-01"
            max="2100-12-31"
            onChange={(e) => changeFilter("from", e.target.value)}
            aria-label="Gửi từ ngày"
            className="min-w-0 max-w-full bg-transparent text-sm text-[#5C6B8A] outline-none"
          />
        </div>

        <div className={DATE_BOX_CLASS}>
          <span className="text-xs font-semibold text-[#8993AC]">Đến</span>
          <input
            type="date"
            value={filters.to}
            min="2000-01-01"
            max="2100-12-31"
            onChange={(e) => changeFilter("to", e.target.value)}
            aria-label="Gửi đến ngày"
            className="bg-transparent text-sm text-[#5C6B8A] outline-none"
          />
        </div>
      </FilterBar>

      {filters.userId && (
        <div className="flex flex-wrap gap-2">
          <ScopeChip
            label={`Người gửi: ${scopeUserName || filters.userId}`}
            onClear={() => changeFilter("userId", "")}
          />
        </div>
      )}

      {dateError && (
        <p
          role="alert"
          className="rounded-[12px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
        >
          {dateError}
        </p>
      )}

      {response.error && !loading && !dateError && (
        <AdminErrorState
          message={response.error}
          onRetry={() => setReloadCount((c) => c + 1)}
        />
      )}

      {!loading && !response.error && !dateError && response.data && (
        <p className="text-sm text-[#5C6B8A]">
          {response.data.totalCount} kết quả · Trang {response.data.page} /{" "}
          {Math.max(1, response.data.totalPages)}
        </p>
      )}

      {!response.error && !dateError && (
        <>
          <div className="hidden md:block [&_table]:w-full [&_table]:min-w-[900px]">
            <DataTable
              columns={columns}
              rows={rows}
              loading={loading}
              sort={sort}
              onSort={handleSort}
              emptyState={{
                icon: "rate_review",
                title: hasFilters ? "Không có ý kiến nào phù hợp" : "Chưa có góp ý về ứng dụng",
                description: hasFilters ? "Thử đổi từ khoá hoặc bộ lọc." : undefined,
                actionLabel: hasFilters ? "Xóa bộ lọc" : undefined,
                onAction: hasFilters ? handleClearFilters : undefined,
              }}
            />
          </div>

          {/* Mobile view */}
          <div aria-label="Góp ý ứng dụng trên di động" className="space-y-3 md:hidden">
            {loading ? (
              <LoadingState label="Đang tải danh sách góp ý" />
            ) : rows.length ? (
              rows.map((row) => {
                const cfg = TYPE_CONFIG[row.type] || {
                  label: row.typeName || "Khác",
                  variant: "neutral",
                  icon: "chat_bubble",
                };
                return (
                  <AdminRecordCard
                    key={row.id}
                    title={
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[#0F2148]">{row.user.fullName}</span>
                        <StatusBadge variant={cfg.variant} label={cfg.label} icon={cfg.icon} />
                      </div>
                    }
                    status={
                      row.rating ? (
                        <span className="inline-flex items-center gap-1">
                          <RatingStars value={row.rating} size={14} />
                          <span className="font-semibold text-xs text-[#0F2148]">{row.rating}</span>
                        </span>
                      ) : null
                    }
                  >
                    <dl className="space-y-2.5 text-xs">
                      <div>
                        <dt className="text-[#8993AC]">Email</dt>
                        <dd className="text-[#5C6B8A] break-all">{row.user.email}</dd>
                      </div>
                      <div>
                        <dt className="text-[#8993AC]">Nội dung</dt>
                        <dd className="mt-0.5 whitespace-pre-line text-sm text-[#0F2148]">
                          {row.content}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[#8993AC]">Ngày gửi</dt>
                        <dd className="text-[#5C6B8A]">{formatDateTimeInVietnam(row.createdAt)}</dd>
                      </div>
                    </dl>
                  </AdminRecordCard>
                );
              })
            ) : (
              <EmptyState
                icon="rate_review"
                title={hasFilters ? "Không có ý kiến nào phù hợp" : "Chưa có góp ý về ứng dụng"}
                actionLabel={hasFilters ? "Xóa bộ lọc" : undefined}
                onAction={hasFilters ? handleClearFilters : undefined}
              />
            )}
          </div>

          {response.data && (
            <AdminPagination {...response.data} onPageChange={setPage} disabled={loading} />
          )}
        </>
      )}
    </div>
  );
}
