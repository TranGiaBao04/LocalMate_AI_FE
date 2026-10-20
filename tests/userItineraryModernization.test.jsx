import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Draft from "../src/pages/trip/DraftItineraryPage";
import Finalized from "../src/pages/trip/FinalizedItineraryPage";
import { toParseBase, tripService } from "../src/services/tripService";
import { buildDirectionsUrl } from "../src/utils/googleMaps";
import { formatCurrencyShort } from "../src/utils/formatCurrency";
import { todayInVietnam } from "../src/utils/vnTime";

const mock = vi.hoisted(() => ({
  navigate: vi.fn(), auth: {}, trip: {}, refresh: vi.fn(), subscription: null,
  assistantProps: null, directionProps: [],
}));
vi.mock("react-router-dom", async (original) => ({ ...(await original()), useNavigate: () => mock.navigate }));
vi.mock("../src/context/AuthContext", () => ({ useAuth: () => mock.auth }));
vi.mock("../src/context/TripContext", () => ({ useTrip: () => mock.trip }));
vi.mock("../src/context/SubscriptionContext", () => ({ useSubscription: () => ({ subscription: mock.subscription, refreshSubscription: mock.refresh }) }));
vi.mock("../src/components/trip/TripRequestAssistant", () => ({ default: (props) => {
  mock.assistantProps = props;
  return <section aria-label={props.title}>{props.placeholder}</section>;
} }));
vi.mock("../src/components/TimelineItemDirections", () => ({ default: (props) => {
  mock.directionProps.push(props);
  return <div>Directions {props.currentStop.placeName}</div>;
} }));

const deferred = () => { let resolve; let reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const flush = async () => { await act(async () => {}); };
const mount = (Page = Draft) => render(<MemoryRouter><Page /></MemoryRouter>);
// Màn hẹp (jsdom không có matchMedia): khung "Muốn đổi gì?" nằm trong ngăn kéo mở từ nút nổi "Hỏi AI"
const openAi = () => fireEvent.click(screen.getByRole("button", { name: "Hỏi AI" }));
const openFinalize = async () => { fireEvent.click(screen.getByRole("button", { name: /Chốt lịch trình/ })); await flush(); return screen.getByRole("dialog", { name: "Chốt lịch trình" }); };
function realShapeTrip() {
  return { id: "trip-one", title: "Một ngày quanh Bến Thành", summary: "Cà phê và văn hoá", mainArea: "Bến Thành",
    durationHours: 4, estimatedBudget: 180000, budgetMax: 200000, plannedDate: "2026-10-09", startTime: "09:00", endTime: "12:00",
    totalTravelMinutes: 22, totalMinutes: 170, travelMode: "Metro", metroFriendly: true,
    note: "Yên tĩnh", noteApplied: true, startLatitude: 10.77, startLongitude: 106.7, tagIds: ["coffee"],
    items: [{ id: "item-one", placeId: "place-one", placeName: "Cà phê ven sông", placeCategory: "Food", time: "09:20",
      latitude: 10.78, longitude: 106.71, googlePlaceId: "google-one", durationMinutes: 60, estimatedCost: 50000,
      reason: "Phù hợp sở thích cà phê", travelNote: "Giờ tàu dự kiến", isVisited: false,
      leg: { mode: "Metro", boardStation: { name: "Bến Thành" }, alightStation: { name: "Ba Son" }, totalMinutes: 22,
        toStationMode: "Walking", toStationMinutes: 3, waitMinutes: 4, rideMinutes: 10, stopCount: 2, walkMinutes: 5 } },
    { id: "item-two", placeId: "place-two", placeName: "Bảo tàng", placeCategory: "Culture", time: "10:40", durationMinutes: 40,
      estimatedCost: 30000, travelMinutesFromPrevious: 10, walkingMinutes: 10, motorbikeMinutes: 4, reason: null, isVisited: true }] };
}
beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers();
  mock.auth = { user: { id: "user-one" }, isLoggedIn: true, isDemo: false };
  mock.trip = { currentTrip: realShapeTrip(), savedTrips: [], explainingTripIds: [],
    finalizeTrip: vi.fn().mockResolvedValue({}), deleteItem: vi.fn().mockResolvedValue([]),
    explainTrip: vi.fn().mockResolvedValue({}), saveTrip: vi.fn().mockResolvedValue({}), noteAiError: vi.fn() };
  mock.refresh.mockResolvedValue({});
  mock.assistantProps = null; mock.directionProps = []; mock.subscription = null;
});

// Chốt lịch chỉ theo lượt lưu của gói (savedTrips từ /subscription/me); đã gỡ mua lẻ
describe("USER-A5.2 finalize by plan saved-trip quota", () => {
  it("opening reloads the plan and locks Finalize until it answers", async () => {
    const pending = deferred(); mock.refresh.mockReturnValue(pending.promise);
    mount(); const dialog = await openFinalize();
    expect(mock.refresh).toHaveBeenCalledTimes(1);
    expect(within(dialog).getByRole("status")).toHaveTextContent("Đang kiểm tra lượt lưu");
    expect(within(dialog).getByRole("button", { name: "Chốt lịch trình" })).toBeDisabled();
    await act(async () => pending.resolve({}));
    expect(within(dialog).getByRole("button", { name: "Chốt lịch trình" })).toBeEnabled();
  });
  it("finalizes with the trip id only, guards double clicks, reloads the plan and navigates", async () => {
    mock.subscription = { plan: "Free", savedTrips: { used: 0, limit: 1 } };
    const pending = deferred(); mock.trip.finalizeTrip.mockReturnValue(pending.promise); mount(); const dialog = await openFinalize();
    const button = within(dialog).getByRole("button", { name: "Chốt lịch trình" }); fireEvent.click(button); fireEvent.click(button);
    expect(mock.trip.finalizeTrip).toHaveBeenCalledExactlyOnceWith("trip-one");
    expect(button).toBeDisabled(); await act(async () => pending.resolve({}));
    expect(mock.refresh).toHaveBeenCalledTimes(2);
    expect(mock.navigate).toHaveBeenCalledWith("/finalized");
  });
  it("Normal failure retains error and retry without success navigation", async () => {
    mock.trip.finalizeTrip.mockRejectedValue({ code: "trip_finalized" }); mount(); const dialog = await openFinalize();
    fireEvent.click(within(dialog).getByRole("button", { name: "Chốt lịch trình" })); await flush();
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Lịch trình đã chốt"); expect(mock.navigate).not.toHaveBeenCalled();
  });
  it("BE quota refusal switches to the upgrade card, reloads the plan, never offers a single purchase", async () => {
    mock.trip.finalizeTrip.mockRejectedValue({ code: "saved_trip_quota_exceeded" });
    mount(); const dialog = await openFinalize(); fireEvent.click(within(dialog).getByRole("button", { name: "Chốt lịch trình" })); await flush();
    expect(within(dialog).getByText("Đã đạt giới hạn lưu lịch trình")).toBeInTheDocument();
    expect(within(dialog).getByRole("region", { name: "Muốn lưu thêm lịch trình?" })).toBeInTheDocument();
    expect(within(dialog).queryByText(/Mua thêm|mua lẻ/)).not.toBeInTheDocument();
    expect(mock.refresh).toHaveBeenCalledTimes(2); expect(mock.trip.finalizeTrip).toHaveBeenCalledTimes(1);
  });
  it("a full plan shows the upgrade card up front and sends nothing", async () => {
    mock.subscription = { plan: "Free", savedTrips: { used: 1, limit: 1 } };
    mount(); const dialog = await openFinalize();
    expect(within(dialog).getByRole("region", { name: "Muốn lưu thêm lịch trình?" })).toHaveTextContent("Bạn đã lưu 1/1 lịch");
    expect(within(dialog).queryByRole("button", { name: "Chốt lịch trình" })).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Xem các gói" }));
    expect(mock.navigate).toHaveBeenCalledWith("/subscription"); expect(mock.trip.finalizeTrip).not.toHaveBeenCalled();
  });
  it("unlimited saving never blocks", async () => {
    mock.subscription = { plan: "Membership", savedTrips: { used: 40, limit: null } };
    mount(); const dialog = await openFinalize();
    expect(within(dialog).getByRole("button", { name: "Chốt lịch trình" })).toBeEnabled();
  });
  it("a failed plan reload still lets the server decide", async () => {
    mock.refresh.mockRejectedValue(new Error("offline"));
    mount(); const dialog = await openFinalize();
    fireEvent.click(within(dialog).getByRole("button", { name: "Chốt lịch trình" })); await flush();
    expect(mock.trip.finalizeTrip).toHaveBeenCalledExactlyOnceWith("trip-one");
  });
  it("unmount suppresses finalize navigation and refresh", async () => {
    const pending = deferred(); mock.trip.finalizeTrip.mockReturnValue(pending.promise); const view = mount(); const dialog = await openFinalize();
    fireEvent.click(within(dialog).getByRole("button", { name: "Chốt lịch trình" })); view.unmount();
    await act(async () => pending.resolve({})); expect(mock.navigate).not.toHaveBeenCalled(); expect(mock.refresh).toHaveBeenCalledTimes(1);
  });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("USER-A5.3 Finalized save/share contracts", () => {
  it("empty finalized state does not invent a trip", () => {
    mock.trip.currentTrip = null; mount(Finalized); expect(screen.getByText("Không có lịch trình.")).toBeInTheDocument();
    expect(mock.trip.saveTrip).not.toHaveBeenCalled();
  });
  it("renders exact finalized values and ordered stops without mutations", () => {
    mount(Finalized); expect(screen.getByText("✓ Finalized")).toBeInTheDocument();
    expect(screen.getByText(`~${formatCurrencyShort(180000)}/người`)).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 3 }).map((n) => n.textContent)).toEqual(["Cà phê ven sông", "Bảo tàng"]);
    expect(screen.getByText("check")).toBeInTheDocument(); expect(screen.getByText("2 địa điểm")).toBeInTheDocument();
    expect(mock.trip.saveTrip).not.toHaveBeenCalled(); expect(mock.trip.finalizeTrip).not.toHaveBeenCalled();
  });
  it("Maps props and coordinate truthiness preserved; visit action navigates, not mutates", () => {
    mount(Finalized); const link = screen.getByRole("link", { name: /Mở Maps/ });
    expect(link).toHaveAttribute("href", buildDirectionsUrl({ destLat: 10.78, destLng: 106.71, destName: "Cà phê ven sông", destPlaceId: "google-one" }));
    expect(screen.getAllByRole("link")).toHaveLength(1);
    fireEvent.click(screen.getAllByRole("button", { name: /Đã ghé/ })[1]); expect(mock.navigate).toHaveBeenCalledWith("/trips/trip-one");
    expect(mock.trip.saveTrip).not.toHaveBeenCalled();
  });
  it("marks next-day stops and closed places without offering edits", () => {
    Object.assign(mock.trip.currentTrip.items[1], { time: "00:18", isNextDay: true, openingStatus: "Closed" });
    mount(Finalized);
    expect(screen.getByText("00:18 (hôm sau)")).toBeInTheDocument();
    expect(screen.getAllByText(/có thể đã đóng cửa vào giờ này/)).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /Thay thế/ })).not.toBeInTheDocument();
  });
  it("zero coordinate retains baseline hidden Maps condition", () => {
    mock.trip.currentTrip.items[0].latitude = 0; mount(Finalized); expect(screen.queryByRole("link", { name: /Mở Maps/ })).not.toBeInTheDocument();
  });
  it("save passes exact currentTrip, locks duplicates and opens original success modal", async () => {
    const pending = deferred(); mock.trip.saveTrip.mockReturnValue(pending.promise); mount(Finalized);
    const button = screen.getByRole("button", { name: /Lưu lịch trình/ }); fireEvent.click(button); fireEvent.click(button);
    expect(button).toBeDisabled(); expect(mock.trip.saveTrip).toHaveBeenCalledExactlyOnceWith(mock.trip.currentTrip);
    await act(async () => pending.resolve({})); expect(screen.getByRole("dialog", { name: "Đã lưu vào My Trips!" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Đã lưu/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Ở lại lịch trình" })); expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mock.trip.saveTrip).toHaveBeenCalledTimes(1);
  });
  it("success modal My Trips navigates without an additional save", async () => {
    mount(Finalized); fireEvent.click(screen.getByRole("button", { name: /Lưu lịch trình/ })); await flush();
    fireEvent.click(screen.getByRole("button", { name: "Xem My Trips" })); expect(mock.navigate).toHaveBeenCalledWith("/trips");
    expect(mock.trip.saveTrip).toHaveBeenCalledTimes(1);
  });
  it("already-saved context disables save", () => {
    mock.trip.savedTrips = [{ id: "trip-one" }]; mount(Finalized); const button = screen.getByRole("button", { name: /Đã lưu/ });
    fireEvent.click(button); expect(button).toBeDisabled(); expect(mock.trip.saveTrip).not.toHaveBeenCalled();
  });
  it("Demo save retains login notice and no persistence", () => {
    mock.auth.isDemo = true; mount(Finalized); fireEvent.click(screen.getByRole("button", { name: /Lưu lịch trình/ }));
    expect(screen.getByRole("alert")).toHaveTextContent("Đăng nhập bằng tài khoản");
    fireEvent.click(screen.getByRole("button", { name: "Đăng nhập" })); expect(mock.navigate).toHaveBeenCalledWith("/login");
    expect(mock.trip.saveTrip).not.toHaveBeenCalled();
  });
  it("unauthenticated save navigates to login", () => {
    mock.auth.isLoggedIn = false; mount(Finalized); fireEvent.click(screen.getByRole("button", { name: /Lưu lịch trình/ }));
    expect(mock.navigate).toHaveBeenCalledWith("/login"); expect(mock.trip.saveTrip).not.toHaveBeenCalled();
  });
  it("saved quota points to the plans page only", async () => {
    mock.trip.saveTrip.mockRejectedValue({ code: "saved_trip_quota_exceeded" }); mount(Finalized);
    fireEvent.click(screen.getByRole("button", { name: /Lưu lịch trình/ })); await flush();
    expect(screen.getByRole("alert")).toHaveTextContent("đạt giới hạn"); fireEvent.click(screen.getByRole("button", { name: "Xem các gói" }));
    expect(mock.navigate).toHaveBeenCalledWith("/subscription"); expect(screen.queryByText(/Mua thêm|mua lẻ/)).not.toBeInTheDocument();
  });
  it.each([[404, "Không tìm thấy lịch trình"], [401, "Phiên đăng nhập"], [403, "Phiên đăng nhập"], [500, "Không thể lưu"]])("save HTTP %s error retains baseline mapping", async (status, text) => {
    mock.trip.saveTrip.mockRejectedValue({ status }); mount(Finalized); fireEvent.click(screen.getByRole("button", { name: /Lưu lịch trình/ })); await flush();
    expect(screen.getByRole("alert")).toHaveTextContent(text); expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("share copies exact current URL and clears copied after 2000ms", async () => {
    const writeText = vi.fn().mockResolvedValue(); vi.stubGlobal("navigator", { clipboard: { writeText } });
    mount(Finalized); fireEvent.click(screen.getByRole("button", { name: /Chia sẻ/ })); await flush();
    expect(writeText).toHaveBeenCalledExactlyOnceWith(window.location.href); expect(screen.getByRole("button", { name: /Đã sao chép/ })).toBeInTheDocument();
    await act(async () => vi.advanceTimersByTime(2000)); expect(screen.getByRole("button", { name: /Chia sẻ/ })).toBeInTheDocument();
    expect(mock.trip.saveTrip).not.toHaveBeenCalled();
  });
  it("home and long-name containment preserve full critical text", () => {
    const title = "Lịch trình khám phá Thành phố Hồ Chí Minh ".repeat(12);
    mock.trip.currentTrip.title = title; mock.trip.currentTrip.items[0].placeCategory = "Danh mục rất dài ".repeat(10);
    mount(Finalized); expect(screen.getByRole("heading", { name: title.trim() })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Về trang chủ" })); expect(mock.navigate).toHaveBeenCalledWith("/home");
  });
});

describe("USER-A5.1 Draft presentation preserves contracts", () => {
  it("honest empty state retains create destination", () => {
    mock.trip.currentTrip = null; mount(); fireEvent.click(screen.getByRole("button", { name: "Tạo lịch trình" }));
    expect(mock.navigate).toHaveBeenCalledWith("/create");
  });
  it("renders server overview, per-person budget, times, notes and shorter-trip context", () => {
    mount(); expect(screen.getByText(mock.trip.currentTrip.title)).toBeInTheDocument();
    expect(screen.getByText(`${formatCurrencyShort(180000)}/người`)).toBeInTheDocument();
    expect(screen.getByText(/xuất phát 09:00/)).toBeInTheDocument();
    expect(screen.getByText(/Kết thúc dự kiến 12:00/)).toHaveTextContent("22 phút");
    expect(screen.getByText(/Đã ưu tiên theo ghi chú/)).toBeInTheDocument();
    expect(screen.getByText(/Lịch ngắn hơn/)).toBeInTheDocument(); expect(screen.getByText("Metro-friendly")).toBeInTheDocument();
    expect(screen.getByText("2 điểm")).toBeInTheDocument();
  });
  it("retains false note match and hides unsupported optional sections", () => {
    Object.assign(mock.trip.currentTrip, { noteApplied: false, metroFriendly: false, plannedDate: null, endTime: null }); mount();
    expect(screen.getByText(/chưa áp dụng được ghi chú/)).toBeInTheDocument();
    expect(screen.queryByText("Metro-friendly")).not.toBeInTheDocument(); expect(screen.queryByText(/Kết thúc dự kiến/)).not.toBeInTheDocument();
  });
  it("marks next-day stops, the overnight end time and closed stops", () => {
    Object.assign(mock.trip.currentTrip, { endTime: "01:18", endsNextDay: true });
    Object.assign(mock.trip.currentTrip.items[1], { time: "00:18", isNextDay: true, openingStatus: "Closed" });
    mount();
    expect(screen.getByText(/Kết thúc dự kiến 01:18 \(hôm sau\)/)).toBeInTheDocument();
    expect(screen.getByText("00:18 (hôm sau)")).toBeInTheDocument();
    expect(screen.getByText(/Sang ngày .*10\/10/)).toBeInTheDocument();
    expect(screen.getByText(/1 địa điểm có thể đã đóng cửa vào giờ ghé/)).toBeInTheDocument();
    expect(screen.getAllByText(/có thể đã đóng cửa vào giờ này/)).toHaveLength(1);
    expect(screen.getByText("09:20")).toBeInTheDocument();
  });
  it("keeps timeline order and Maps component source props", () => {
    mount(); expect(screen.getAllByRole("heading", { level: 3 }).map((n) => n.textContent)).toEqual(["Cà phê ven sông", "Bảo tàng"]);
    expect(mock.directionProps[0]).toMatchObject({ currentStop: mock.trip.currentTrip.items[0], travelMode: "transit",
      prevStop: { latitude: 10.77, longitude: 106.7, placeName: "điểm xuất phát" } });
    expect(mock.directionProps[1].prevStop).toBe(mock.trip.currentTrip.items[0]);
    expect(screen.getByText(/Gồm:.*chờ tàu 4 phút/)).toHaveTextContent("Giờ tàu là dự kiến");
    expect(screen.getByText(/Đi 10 phút/)).toBeInTheDocument(); expect(screen.getByText(/Phù hợp sở thích/)).toBeInTheDocument();
  });
  it("retains unavailable Metro fallback and origin-leg handling", () => {
    mock.trip.currentTrip.items[0].leg = { mode: "Motorbike", totalMinutes: 12, fallback: "metro_unavailable" }; mount();
    expect(screen.getByText(/đã hết chuyến tàu nên tính theo xe máy/)).toHaveTextContent("từ điểm xuất phát");
    expect(mock.directionProps[0].travelMode).toBe("driving");
  });
  it.each(["Walking", "Motorbike", "Auto"])("legacy %s transport remains unchanged", (mode) => {
    mock.trip.currentTrip.travelMode = mode; mock.trip.currentTrip.items[0].leg = null;
    mock.trip.currentTrip.travelMinutesFromOrigin = 8; mount();
    expect(screen.getByText(/Đi 8 phút từ điểm xuất phát/)).toBeInTheDocument();
    expect(mock.directionProps[1].travelMode).toBe(mode === "Motorbike" ? "driving" : "walking");
  });
  it("view/replace retain exact item destinations; no mutation on render", () => {
    mount(); fireEvent.click(screen.getAllByRole("button", { name: /Xem thông tin/ })[0]);
    vi.spyOn(tripService, "getItemAlternatives").mockResolvedValue([]);
    fireEvent.click(screen.getAllByRole("button", { name: /Thay thế/ })[1]);
    // Thay ngay trong trang: không chuyển sang /replace, mở ngăn kéo của đúng chặng
    expect(mock.navigate.mock.calls).toEqual([["/place/place-one", { state: { fromTimeline: true } }]]);
    expect(screen.getByRole("dialog", { name: "Thay địa điểm" })).toHaveTextContent('Thay "Bảo tàng"');
    expect(tripService.getItemAlternatives).toHaveBeenCalledWith("trip-one", "item-two", 5);
    expect(mock.trip.deleteItem).not.toHaveBeenCalled(); expect(mock.trip.explainTrip).not.toHaveBeenCalled();
    expect(mock.trip.finalizeTrip).not.toHaveBeenCalled();
  });
  it("delete retains trip/item arguments, busy guard and success toast timeout", async () => {
    const pending = deferred(); mock.trip.deleteItem.mockReturnValue(pending.promise); mount();
    const button = screen.getAllByRole("button", { name: "Xoá địa điểm" })[0]; fireEvent.click(button);
    expect(button).toBeDisabled(); expect(mock.trip.deleteItem).toHaveBeenCalledWith("trip-one", "item-one");
    await act(async () => pending.resolve([])); expect(screen.getByRole("status")).toHaveTextContent("Đã xoá địa điểm");
    await act(async () => vi.advanceTimersByTime(2600)); expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
  it("Backend last-item guard surfaces original error and leaves order intact", async () => {
    mock.trip.deleteItem.mockRejectedValue({ code: "cannot_delete_last_item" }); mount();
    fireEvent.click(screen.getAllByRole("button", { name: "Xoá địa điểm" })[0]); await flush();
    expect(screen.getByRole("alert")).toHaveTextContent("không xoá được chặng cuối cùng");
    expect(mock.trip.currentTrip.items).toHaveLength(2);
  });
  it("explicit explain calls once and quota locks without deleting original reasoning", async () => {
    mock.trip.explainTrip.mockRejectedValue({ code: "ai_trip_limit_reached" }); mount();
    expect(screen.getByText(/Mỗi lần tính 1 lượt AI/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Nhờ AI viết lý do/ })); await flush();
    expect(mock.trip.explainTrip).toHaveBeenCalledWith("trip-one");
    expect(screen.getByRole("button", { name: /Nhờ AI viết lý do/ })).toBeDisabled();
    expect(screen.getByText(/Phù hợp sở thích/)).toBeInTheDocument();
  });
  it("context explaining state disables repeat and hides reason until completed", () => {
    mock.trip.explainingTripIds = ["trip-one"]; mount();
    expect(screen.getByRole("button", { name: /AI đang viết/ })).toBeDisabled();
    expect(screen.queryByText(/Phù hợp sở thích/)).not.toBeInTheDocument();
  });
  it("Demo hides explanation and parse assistant", () => {
    mock.auth.isDemo = true; mount(); expect(mock.assistantProps).toBeNull();
    expect(screen.queryByRole("button", { name: "Hỏi AI" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Nhờ AI/ })).not.toBeInTheDocument();
  });
  it("assistant no-change is a no-op, changed result preserves origin/base and original trip", () => {
    mount(); openAi(); const original = JSON.stringify(mock.trip.currentTrip);
    expect(mock.assistantProps.base).toEqual(toParseBase(mock.trip.currentTrip));
    mock.assistantProps.onParsed({ changed: [] }); expect(mock.navigate).not.toHaveBeenCalled();
    const result = { changed: ["durationHours"], fields: { durationHours: 3, note: null }, missing: ["startTime"] };
    mock.assistantProps.onParsed(result);
    expect(mock.navigate).toHaveBeenCalledWith("/create", { state: { prefill: { ...result,
      base: toParseBase(mock.trip.currentTrip), origin: { latitude: 10.77, longitude: 106.7 } } } });
    expect(JSON.stringify(mock.trip.currentTrip)).toBe(original);
  });
  it("long Vietnamese place names and reasons remain complete accessible text", () => {
    const name = "Địa điểm ven sông dành cho chuyến đi khám phá ".repeat(12);
    mock.trip.currentTrip.items[0].placeName = name; mount();
    expect(screen.getByRole("heading", { name: name.trim() })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Quay lại" })).toBeInTheDocument();
  });
  it("daily AI quota shows remaining calls, reloads after a call and locks at zero", async () => {
    const ai = (dailyUsed) => ({ plan: "Free", ai: { dailyUsed, dailyLimit: 3, resetAt: "2999-01-01T00:00:00Z" } });
    mock.subscription = ai(2); mount(); openAi();
    expect(screen.getAllByText(/Còn 1\/3 lượt hôm nay/).length).toBeGreaterThan(0);
    expect(mock.assistantProps.aiQuota).toMatchObject({ used: 2, limit: 3, remaining: 1 });
    fireEvent.click(screen.getByRole("button", { name: /Nhờ AI viết lý do/ })); await flush();
    expect(mock.trip.explainTrip).toHaveBeenCalledExactlyOnceWith("trip-one"); expect(mock.refresh).toHaveBeenCalledTimes(1);
    cleanup(); mock.subscription = ai(3); mount();
    expect(screen.getByRole("button", { name: /Nhờ AI viết lý do/ })).toBeDisabled();
    expect(screen.getByText(/Bạn đã dùng hết lượt AI hôm nay/)).toBeInTheDocument();
  });
  it("AI cooldown locks the explain button, counts down and reaches the change assistant", () => {
    mock.trip.aiCooldownUntil = Date.now() + 16000; mount(); openAi();
    expect(screen.getByRole("button", { name: /Nhờ AI viết lý do/ })).toBeDisabled();
    expect(screen.getByText(/AI vừa gặp lỗi\. Thử lại sau 16 giây\./)).toBeInTheDocument();
    expect(mock.assistantProps.cooldownSeconds).toBe(16);
    act(() => vi.advanceTimersByTime(16000));
    expect(screen.getByRole("button", { name: /Nhờ AI viết lý do/ })).toBeEnabled();
    expect(mock.assistantProps.cooldownSeconds).toBe(0);
    expect(mock.trip.explainTrip).not.toHaveBeenCalled();
  });
  it("a failed change-assistant call is reported to the Trip context before the plan reloads", () => {
    mount(); openAi(); const error = { code: "ai_cooldown", data: { retryAfterSeconds: 16 } };
    mock.assistantProps.onSettled(error);
    expect(mock.trip.noteAiError).toHaveBeenCalledExactlyOnceWith(error); expect(mock.refresh).toHaveBeenCalledTimes(1);
    mock.assistantProps.onSettled(undefined);
    expect(mock.trip.noteAiError).toHaveBeenCalledTimes(1); expect(mock.refresh).toHaveBeenCalledTimes(2);
  });
  it("used-up generate quota blocks the change assistant, otherwise it stays open", () => {
    mount(); openAi(); expect(mock.assistantProps.blockedReason).toBe("");
    cleanup(); mock.subscription = { plan: "Free", usage: { generateUsed: 1, generateLimit: 1, resetAt: "2999-01-01T00:00:00Z" } }; mount(); openAi();
    expect(mock.assistantProps.blockedReason).toMatch(/hết lượt tạo lịch trình/);
  });
});

describe("Dải nhắc nâng cấp sau khi chốt lịch", () => {
  const STRIP = /Muốn có thêm phương án cho lần đi sau\?/;
  beforeEach(() => {
    try { localStorage.clear(); } catch { /* bỏ qua */ }
    mock.subscription = { plan: "Free", usage: { generateUsed: 1, generateLimit: 1 } };
  });

  it("gói Miễn phí: hiện một lần trong ngày, ghi lại ngày đã hiện", () => {
    mount(Finalized);
    expect(screen.getByText(STRIP)).toBeInTheDocument();
    expect(localStorage.getItem("localmate_upgrade_strip_shown:user-one")).toBe(todayInVietnam());
    cleanup(); mount(Finalized);
    expect(screen.queryByText(STRIP)).not.toBeInTheDocument();
  });

  it("đóng được và nút Xem các gói mở trang Gói", () => {
    mount(Finalized);
    fireEvent.click(screen.getByRole("button", { name: "Xem các gói" }));
    expect(mock.navigate).toHaveBeenCalledWith("/subscription");
    fireEvent.click(screen.getByRole("button", { name: "Đóng lời nhắc" }));
    expect(screen.queryByText(STRIP)).not.toBeInTheDocument();
  });

  it.each([
    ["gói trả phí", { plan: "TripPass", effectiveUntil: "2099-01-01T00:00:00Z" }],
    ["đang dùng thử", { plan: "TripPass", isTrial: true, effectiveUntil: "2099-01-01T00:00:00Z" }],
  ])("không hiện với %s", (_, subscription) => {
    mock.subscription = subscription;
    mount(Finalized);
    expect(screen.queryByText(STRIP)).not.toBeInTheDocument();
  });

  it("không hiện với phiên demo", () => {
    mock.auth = { ...mock.auth, isDemo: true };
    mount(Finalized);
    expect(screen.queryByText(STRIP)).not.toBeInTheDocument();
  });

  it("trình duyệt chặn localStorage thì vẫn hiện bình thường", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    mount(Finalized);
    expect(screen.getByText(STRIP)).toBeInTheDocument();
  });
});
