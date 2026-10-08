import { act, fireEvent, render, screen, within, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import HomePage from "../src/pages/home/HomePage";
import GuestTourCard from "../src/components/home/GuestTourCard";
import CuratedItinerariesPage from "../src/pages/trip/CuratedItinerariesPage";
import CuratedItineraryCard from "../src/components/trip/CuratedItineraryCard";
import { formatCurrencyShort, formatDuration } from "../src/utils/formatCurrency";
import * as Auth from "../src/context/AuthContext";
import * as Curated from "../src/hooks/useCuratedItineraries";
import * as Notifications from "../src/context/NotificationContext";
import { placeService } from "../src/services/placeService";
import { notificationService } from "../src/services/notificationService";
import { STORAGE_KEYS } from "../src/constants";
import HomeSearch from "../src/components/home/HomeSearch";
import { searchService } from "../src/services/searchService";
import { itineraryService } from "../src/services/itineraryService";
import * as Trip from "../src/context/TripContext";
import * as VietnamTime from "../src/utils/vnTime";

const itinerary = (id = "curated-a", extra = {}) => ({
  id, title: `Lịch trình ${id}`, description: "Khám phá văn hóa và cà phê quanh Metro",
  stationName: "Bến Thành", coverImageUrl: "/existing-cover.jpg", estimatedDurationMinutes: 90,
  estimatedCostMin: 100000, estimatedCostMax: 250000, items: [{ id: "one" }, { id: "two" }], ...extra,
});

describe("USER-A2.2 Explore and shared curated cards", () => {
  it.each(["loading", "empty", "error"])("preserves Explore %s and retry", (state) => {
    curatedState = { ...curatedState, curated: [], loading: state === "loading", error: state === "error" };
    mount(<CuratedItinerariesPage />, "/explore");
    const text = { loading: "Đang tải lịch trình mẫu...", empty: "Chưa có lịch trình mẫu.", error: "Không thể tải lịch trình mẫu." };
    expect(screen.getByText(text[state])).toBeInTheDocument();
    if (state === "error") { fireEvent.click(screen.getByRole("button", { name: "Thử lại" })); expect(curatedState.retry).toHaveBeenCalledTimes(1); }
    expect(placeService.getMetroClusters).not.toHaveBeenCalled();
  });
  it("keeps server ordering, shared apply props and Explore create CTA", () => {
    curatedState.curated = [itinerary("z"), itinerary("b")];
    mount(<CuratedItinerariesPage />, "/explore");
    expect(screen.getAllByRole("heading", { level: 4 }).map((h) => h.textContent)).toEqual(["Lịch trình z", "Lịch trình b"]);
    fireEvent.click(screen.getByRole("button", { name: /Lịch trình b/ }));
    expect(curatedState.apply).toHaveBeenCalledExactlyOnceWith(curatedState.curated[1]);
    fireEvent.click(screen.getByRole("button", { name: "Tự tạo lịch trình" }));
    expect(screen.getByLabelText("current route")).toHaveTextContent("/create|");
  });
  it.each([0, 90, 125])("preserves duration %s, item count and estimated cost formatting", (minutes) => {
    const data = itinerary("format", { estimatedDurationMinutes: minutes, estimatedCostMin: 0, estimatedCostMax: 1500000 });
    mount(<CuratedItineraryCard itinerary={data} applyingId={null} onApply={vi.fn()} />);
    expect(screen.getByText(`${formatDuration(minutes)} · 2 điểm`)).toBeInTheDocument();
    expect(screen.getByText(`~${formatCurrencyShort(0)} – ${formatCurrencyShort(1500000)}/người`)).toBeInTheDocument();
    expect(screen.getByText("Chi phí ước tính")).toBeInTheDocument();
    expect(screen.getByAltText("")).toHaveAttribute("src", "/existing-cover.jpg");
  });
  it("disables all cards during application and marks only the applying card busy", () => {
    curatedState.curated.push(itinerary("second")); curatedState.applyingId = "curated-a";
    mount(<CuratedItinerariesPage />);
    const first = screen.getByRole("button", { name: /Lịch trình curated-a/ });
    const second = screen.getByRole("button", { name: /Lịch trình second/ });
    expect(first).toBeDisabled(); expect(first).toHaveAttribute("aria-busy", "true");
    expect(second).toBeDisabled(); expect(second).toHaveAttribute("aria-busy", "false");
    expect(first).toHaveTextContent("Đang tạo bản nháp...");
    fireEvent.click(second); expect(curatedState.apply).not.toHaveBeenCalled();
  });
  it.each([false, true])("keeps per-card error and Demo=%s login restriction", (isDemo) => {
    auth.isDemo = isDemo; curatedState.curated.push(itinerary("second"));
    curatedState.applyError = { id: "second", message: "Không thể lưu bản nháp hiện tại." };
    mount(<CuratedItinerariesPage />);
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getByRole("alert")).toHaveTextContent(curatedState.applyError.message);
    if (isDemo) { fireEvent.click(screen.getByRole("button", { name: "Đăng nhập", exact: true })); expect(screen.getByLabelText("current route")).toHaveTextContent("/login|"); }
    else expect(screen.queryByRole("button", { name: "Đăng nhập", exact: true })).not.toBeInTheDocument();
  });
  it("retains long server text, missing optional media and description without invented data", () => {
    const title = "Hành trình khám phá thành phố Hồ Chí Minh và các trải nghiệm văn hóa rất dài ".repeat(4);
    mount(<CuratedItineraryCard itinerary={itinerary("long", { title, description: null, coverImageUrl: null, stationName: null })} applyingId={null} onApply={vi.fn()} />);
    expect(screen.getByRole("heading", { level: 4 })).toHaveTextContent(title.trim());
    expect(screen.getByRole("heading", { level: 4 })).toHaveAttribute("title", title);
    expect(screen.queryByAltText("")).not.toBeInTheDocument();
    expect(screen.queryByText(/^Ga /)).not.toBeInTheDocument();
  });
});
const place = (id) => ({ id, name: `Địa điểm ${id}`, imageUrl: "/existing-place.jpg" });
const cluster = (id, order, count = 5) => ({ stationId: id, stationOrder: order, stationName: `Trạm ${id}`, places: Array.from({ length: count }, (_, i) => place(`${id}-${i}`)) });
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
function RouteProbe() {
  const location = useLocation();
  return <output aria-label="current route">{location.pathname}|{JSON.stringify(location.state)}</output>;
}
function mount(children, route = "/home") { return render(<MemoryRouter initialEntries={[route]}>{children}<RouteProbe /></MemoryRouter>); }
let curatedState;
let auth;
beforeEach(() => {
  localStorage.clear();
  auth = { user: { id: "user-real", fullName: "Nguyễn Văn Minh" }, isDemo: false };
  vi.spyOn(Auth, "useAuth").mockImplementation(() => auth);
  curatedState = { curated: [itinerary()], loading: false, error: false, retry: vi.fn(), applyingId: null, applyError: null, apply: vi.fn() };
  vi.spyOn(Curated, "useCuratedItineraries").mockImplementation(() => curatedState);
  vi.spyOn(Notifications, "useNotifications").mockReturnValue({ enabled: true, userId: "user-real", unreadCount: 2, refreshUnreadCount: vi.fn() });
  vi.spyOn(notificationService, "getNotifications").mockResolvedValue({ items: [], page: 1, totalPages: 0 });
  vi.spyOn(placeService, "getMetroClusters").mockResolvedValue([cluster("a", 1), cluster("b", 2), cluster("empty", 3, 0), cluster("c", 4), cluster("d", 5), cluster("e", 6)]);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); localStorage.clear(); });

const searchData = () => ({
  stations: { items: [{ id: "station-real", name: "Bến Thành", order: 1, placeCount: 5 }], hasMore: true },
  places: { items: [
    { id: "semantic-real", name: "Quán cà phê yên tĩnh", category: "Cafe", matchedOn: "Semantic", station: { name: "Thảo Điền" } },
    { id: "exact-real", name: "Bảo tàng Thành phố", category: "Culture", matchedOn: "Name" },
  ], hasMore: true },
  curatedItineraries: { items: [{ id: "tour-real", title: "Lịch trình trung tâm", stationName: "Bến Thành", estimatedDurationMinutes: 120 }], hasMore: false },
});
const emptySearch = () => ({ stations: { items: [], hasMore: false }, places: { items: [], hasMore: false }, curatedItineraries: { items: [], hasMore: false } });
async function typeAndSearch(value = "metro") {
  fireEvent.change(screen.getByRole("searchbox"), { target: { value } });
  await act(async () => { await vi.advanceTimersByTimeAsync(450); });
}
describe("USER-A2.3 Search presentation with frozen request contracts", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.spyOn(searchService, "search").mockResolvedValue(searchData()); });
  it("keeps normalization and exactly 450ms debounce", async () => {
    mount(<HomeSearch />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "  Bến   Thành  " } });
    expect(screen.getByRole("status", { name: "" })).toHaveTextContent("Đang tìm...");
    await act(async () => { await vi.advanceTimersByTimeAsync(449); });
    expect(searchService.search).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(searchService.search).toHaveBeenCalledExactlyOnceWith("Bến Thành", { signal: expect.any(AbortSignal) });
  });
  it.each(["", " ", " a "])("normalized keyword %j below 2 sends no request", async (value) => {
    mount(<HomeSearch />); await typeAndSearch(value);
    expect(searchService.search).not.toHaveBeenCalled();
    expect(screen.queryByRole("region", { name: "Kết quả tìm kiếm" })).not.toBeInTheDocument();
  });
  it("retains the native 100-character input limit and searches a two-character keyword", async () => {
    mount(<HomeSearch />);
    expect(screen.getByRole("searchbox")).toHaveAttribute("maxlength", "100");
    await typeAndSearch("ga"); expect(searchService.search).toHaveBeenCalledTimes(1);
    await typeAndSearch("x".repeat(100)); expect(searchService.search.mock.calls[1][0]).toHaveLength(100);
  });
  it("cancels obsolete requests and ignores late successful responses", async () => {
    const old = deferred(), next = deferred(); searchService.search.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
    mount(<HomeSearch />); await typeAndSearch("old");
    const signal = searchService.search.mock.calls[0][1].signal;
    await typeAndSearch("next"); expect(signal.aborted).toBe(true);
    await act(async () => next.resolve(emptySearch()));
    await act(async () => old.resolve(searchData()));
    expect(screen.getByText('Không có kết quả cho "next".')).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ga Bến Thành/ })).not.toBeInTheDocument();
  });
  it("cancels pending debounce and request on unmount", async () => {
    const view = mount(<HomeSearch />); fireEvent.change(screen.getByRole("searchbox"), { target: { value: "ga" } });
    view.unmount(); await act(async () => { await vi.advanceTimersByTimeAsync(450); });
    expect(searchService.search).not.toHaveBeenCalled();
    const second = mount(<HomeSearch />); await typeAndSearch();
    const signal = searchService.search.mock.calls[0][1].signal; second.unmount(); expect(signal.aborted).toBe(true);
  });
  it("keeps previous results while a new normalized keyword loads", async () => {
    const next = deferred(); searchService.search.mockResolvedValueOnce(searchData()).mockReturnValueOnce(next.promise);
    mount(<HomeSearch />); await typeAndSearch();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "other" } });
    expect(screen.getByText("Đang tìm...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Bảo tàng Thành phố/ })).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(450); next.resolve(emptySearch()); });
    expect(screen.getByText('Không có kết quả cho "other".')).toBeInTheDocument();
  });
  it("preserves group ordering, semantic separation, raw category fallback and hasMore", async () => {
    const data = searchData(); data.places.items[0].category = "UnknownServerCategory"; searchService.search.mockResolvedValue(data);
    mount(<HomeSearch />); await typeAndSearch();
    const panel = screen.getByRole("region", { name: "Kết quả tìm kiếm" });
    expect(within(panel).getAllByRole("button").map((b) => b.textContent)).toEqual([
      expect.stringContaining("Ga Bến Thành"), expect.stringContaining("Bảo tàng Thành phố"),
      expect.stringContaining("Quán cà phê yên tĩnh"), expect.stringContaining("Lịch trình trung tâm"),
    ]);
    expect(screen.getByText("Gợi ý liên quan")).toBeInTheDocument();
    expect(screen.getByText("UnknownServerCategory · Ga Thảo Điền")).toBeInTheDocument();
    expect(screen.getAllByText("Còn kết quả khác, hãy gõ cụ thể hơn.")).toHaveLength(2);
  });
  it.each([
    [/Ga Bến Thành 5 địa điểm quanh ga/, "/metro|{\"stationOrder\":1}"],
    [/Bảo tàng Thành phố/, "/place/exact-real|null"],
    [/Quán cà phê yên tĩnh/, "/place/semantic-real|null"],
    [/Lịch trình trung tâm/, "/explore|null"],
  ])("keeps destination for %s and closes the panel", async (name, destination) => {
    mount(<HomeSearch />); await typeAndSearch(); fireEvent.click(screen.getByRole("button", { name }));
    expect(screen.getByLabelText("current route")).toHaveTextContent(destination);
    expect(screen.queryByRole("region", { name: "Kết quả tìm kiếm" })).not.toBeInTheDocument();
    expect(curatedState.apply).not.toHaveBeenCalled();
  });
  it.each(["Escape", "outside"])("keeps %s dismissal without intercepting inside pointer", async (method) => {
    mount(<HomeSearch />); await typeAndSearch();
    fireEvent.mouseDown(screen.getByRole("searchbox")); expect(screen.getByRole("region", { name: "Kết quả tìm kiếm" })).toBeInTheDocument();
    if (method === "Escape") fireEvent.keyDown(document, { key: "Escape" }); else fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("region", { name: "Kết quả tìm kiếm" })).not.toBeInTheDocument();
  });
  it("announces request failure and preserves empty rather than fabricated success", async () => {
    searchService.search.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(emptySearch());
    mount(<HomeSearch />); await typeAndSearch();
    expect(screen.getByRole("alert")).toHaveTextContent("Không tìm được lúc này. Vui lòng thử lại.");
    await typeAndSearch("nothing");
    expect(screen.getByText('Không có kết quả cho "nothing".')).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it("keeps native search/button semantics and full long server text without combobox behavior", async () => {
    const data = searchData(); const long = "Địa điểm có tên tiếng Việt rất dài ".repeat(8);
    data.places.items[1].name = long; searchService.search.mockResolvedValue(data);
    mount(<HomeSearch />); await typeAndSearch();
    expect(screen.getByRole("searchbox", { name: "Tìm ga, địa điểm, lịch trình mẫu" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByTitle(long.trim())).toHaveTextContent(long.trim());
    expect(screen.getByTitle(long.trim())).toHaveAttribute("title", long);
    const button = screen.getByRole("button", { name: /Bến Thành 5 địa điểm/ });
    button.focus(); expect(button).toHaveFocus();
    expect(button).toHaveAccessibleName("Ga Bến Thành 5 địa điểm quanh ga");
  });
});

describe("USER-A2 integrates the untouched curated hook", () => {
  beforeEach(() => {
    Curated.useCuratedItineraries.mockRestore();
    vi.spyOn(Trip, "useTrip").mockReturnValue({ setCurrentTrip: vi.fn() });
    vi.spyOn(itineraryService, "getCuratedItineraries").mockResolvedValue([itinerary()]);
    vi.spyOn(itineraryService, "applyCuratedItinerary").mockResolvedValue({ id: "server-draft" });
    vi.spyOn(VietnamTime, "minutesNowInVietnam").mockReturnValue(607);
  });
  it.each(["Home", "Explore"])("%s still applies using rounded Vietnam time, Trip context and /draft", async (page) => {
    mount(page === "Home" ? <HomePage /> : <CuratedItinerariesPage />);
    fireEvent.click(await screen.findByRole("button", { name: /Lịch trình curated-a/ }));
    await waitFor(() => expect(screen.getByLabelText("current route")).toHaveTextContent("/draft|"));
    expect(itineraryService.applyCuratedItinerary).toHaveBeenCalledExactlyOnceWith("curated-a", { startTime: "10:15" });
    expect(Trip.useTrip().setCurrentTrip).toHaveBeenCalledExactlyOnceWith({ id: "server-draft" });
    expect(itineraryService.getCuratedItineraries).toHaveBeenCalledTimes(1);
    expect(placeService.getMetroClusters).toHaveBeenCalledTimes(page === "Home" ? 1 : 0);
  });
  it("Demo uses the existing restriction without an apply request or context mutation", async () => {
    auth.isDemo = true; mount(<CuratedItinerariesPage />);
    fireEvent.click(await screen.findByRole("button", { name: /Lịch trình curated-a/ }));
    expect(screen.getByRole("alert")).toHaveTextContent("Đăng nhập bằng tài khoản đã đăng ký để dùng lịch trình mẫu.");
    expect(itineraryService.applyCuratedItinerary).not.toHaveBeenCalled();
    expect(Trip.useTrip().setCurrentTrip).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Đăng nhập", exact: true }));
    expect(screen.getByLabelText("current route")).toHaveTextContent("/login|");
  });
  it("preserves processing cleanup and server-error mapping", async () => {
    const pending = deferred(); itineraryService.applyCuratedItinerary.mockReturnValueOnce(pending.promise);
    mount(<CuratedItinerariesPage />); const button = await screen.findByRole("button", { name: /Lịch trình curated-a/ });
    fireEvent.click(button); expect(button).toBeDisabled(); expect(button).toHaveAttribute("aria-busy", "true");
    await act(async () => pending.reject({ code: "curated_itinerary_unavailable", message: "server" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Các địa điểm của lịch trình này đã ngừng hoạt động.");
    expect(button).not.toBeDisabled(); expect(button).toHaveAttribute("aria-busy", "false");
    expect(Trip.useTrip().setCurrentTrip).not.toHaveBeenCalled();
  });
});

describe("USER-A2.1 Home and guest guide", () => {
  it("keeps the personalized greeting and static examples out of a planning form", async () => {
    mount(<HomePage />);
    const planner = screen.getByRole("region", { name: "Xin chào, Minh" });
    expect(within(planner).getByText("Ví dụ hành trình")).toBeInTheDocument();
    expect(within(planner).getByText("Ga Bến Thành (Trung tâm Quận 1)")).toBeInTheDocument();
    expect(within(planner).getByText("Nửa ngày (4 – 5 tiếng)")).toBeInTheDocument();
    expect(within(planner).getByText("Cà phê view đẹp & Chill")).toBeInTheDocument();
    expect(planner.querySelectorAll("input, select, [role=combobox]")).toHaveLength(0);
    expect(within(planner).getByRole("link", { name: "Lịch trình mẫu" })).toHaveAttribute("href", "#sample-itineraries");
    await screen.findByText("Địa điểm a-0");
  });
  it.each(["Thiết kế lịch trình với AI", "Tự thiết kế lịch trình ›", "Tạo lịch trình"])("preserves %s → /create", async (name) => {
    mount(<HomePage />); fireEvent.click(screen.getByRole("button", { name, exact: true }));
    expect(screen.getByLabelText("current route")).toHaveTextContent("/create|");
    await screen.findByText("Địa điểm a-0");
  });
  it("keeps both search instances, profile action and actual NotificationBell", async () => {
    mount(<HomePage />);
    expect(screen.getAllByRole("searchbox", { name: "Tìm ga, địa điểm, lịch trình mẫu" })).toHaveLength(2);
    const header = screen.getByRole("banner");
    expect(within(header).getByRole("searchbox")).toBeInTheDocument();
    expect(within(screen.getByRole("main")).getByRole("searchbox")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Thông báo, 2 chưa đọc" }));
    expect(await screen.findByRole("dialog", { name: "Thông báo" })).toBeInTheDocument();
    expect(notificationService.getNotifications).toHaveBeenCalledExactlyOnceWith({ page: 1, pageSize: 10 });
    fireEvent.click(screen.getByRole("button", { name: "Xem hồ sơ" }));
    expect(screen.getByLabelText("current route")).toHaveTextContent("/profile|");
  });
  it("renders ordered server itineraries without changing the shared apply handler", async () => {
    curatedState.curated = [itinerary("z"), itinerary("a")];
    mount(<HomePage />);
    expect(screen.getAllByRole("heading", { level: 4 }).map((h) => h.textContent)).toEqual(["Lịch trình z", "Lịch trình a"]);
    fireEvent.click(screen.getByRole("button", { name: /Lịch trình z/ }));
    expect(curatedState.apply).toHaveBeenCalledExactlyOnceWith(curatedState.curated[0]);
    expect(placeService.getMetroClusters).toHaveBeenCalledTimes(1);
    await screen.findByText("Địa điểm a-0");
  });
  it.each(["loading", "empty", "error"])("keeps featured %s distinct", async (state) => {
    curatedState = { ...curatedState, curated: [], loading: state === "loading", error: state === "error" };
    mount(<HomePage />);
    const expected = { loading: "Đang tải lịch trình mẫu...", empty: "Chưa có lịch trình mẫu.", error: "Không thể tải lịch trình mẫu." };
    expect(screen.getByText(expected[state])).toBeInTheDocument();
    if (state === "error") { fireEvent.click(within(screen.getByRole("alert")).getByRole("button", { name: "Thử lại" })); expect(curatedState.retry).toHaveBeenCalledTimes(1); }
    await screen.findByText("Địa điểm a-0");
  });
  it("preserves station order, nonempty station derivation, four-place limit and all-stations fallback", async () => {
    mount(<HomePage />);
    const group = screen.getByRole("group", { name: "Lọc theo ga Metro" });
    await screen.findByText("Địa điểm a-0");
    expect(within(group).getAllByRole("button").map((b) => b.textContent)).toEqual(["Tất cả ga", "Ga 01 Trạm a", "Ga 02 Trạm b", "Ga 04 Trạm c", "Ga 05 Trạm d", "Ga 06 Trạm e"]);
    expect(screen.queryByText("Địa điểm e-0")).not.toBeInTheDocument();
    fireEvent.click(within(group).getByRole("button", { name: "Ga 01 Trạm a" }));
    expect(within(group).getByRole("button", { name: "Ga 01 Trạm a" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Địa điểm a-3")).toBeInTheDocument();
    expect(screen.queryByText("Địa điểm a-4")).not.toBeInTheDocument();
    fireEvent.click(within(group).getByRole("button", { name: "Tất cả ga" }));
    expect(screen.getByText("Địa điểm b-0")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Địa điểm b-0/ }));
    expect(screen.getByLabelText("current route")).toHaveTextContent("/place/b-0|");
  });
  it("keeps Metro loading, failure, retry and honest empty states", async () => {
    const pending = deferred(); placeService.getMetroClusters.mockReturnValueOnce(pending.promise).mockResolvedValueOnce([]);
    mount(<HomePage />);
    expect(screen.getByText("Đang tải địa điểm gần ga...")).toHaveAttribute("role", "status");
    await act(async () => pending.reject(new Error("offline")));
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Không thể tải địa điểm gần ga.");
    fireEvent.click(within(alert).getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByText("Chưa có địa điểm ở cụm ga này.")).toBeInTheDocument();
    expect(placeService.getMetroClusters).toHaveBeenCalledTimes(2);
  });
  it.each(["Để sau", "Đóng hướng dẫn nhanh"])("%s persists dismissal and does not reopen after remount", async (name) => {
    const view = mount(<HomePage />); fireEvent.click(screen.getByRole("button", { name }));
    expect(localStorage.getItem(STORAGE_KEYS.GUEST_TOUR_DISMISSED)).toBe("true");
    expect(screen.queryByRole("region", { name: "Khám phá TP.HCM cùng LocalMate AI" })).not.toBeInTheDocument();
    view.unmount(); mount(<HomePage />);
    expect(screen.queryByRole("button", { name: "Để sau" })).not.toBeInTheDocument();
    await screen.findByText("Địa điểm a-0");
  });
  it("keeps storage exceptions harmless for guest dismissal", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    mount(<HomePage />); fireEvent.click(screen.getByRole("button", { name: "Để sau" }));
    expect(screen.queryByRole("button", { name: "Để sau" })).not.toBeInTheDocument();
    await screen.findByText("Địa điểm a-0");
  });
  it("keeps three guide steps and the create action independent from dismissal", () => {
    const dismiss = vi.fn(); mount(<GuestTourCard onDismiss={dismiss} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu tạo lịch trình" }));
    expect(dismiss).not.toHaveBeenCalled();
    expect(screen.getByLabelText("current route")).toHaveTextContent("/create|");
  });
});
