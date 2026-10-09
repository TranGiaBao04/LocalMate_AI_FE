import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Draft from "../src/pages/trip/DraftItineraryPage";
import Finalized from "../src/pages/trip/FinalizedItineraryPage";
import { toParseBase } from "../src/services/tripService";
import { buildDirectionsUrl } from "../src/utils/googleMaps";
import { formatCurrencyShort } from "../src/utils/formatCurrency";

const mock = vi.hoisted(() => ({
  navigate: vi.fn(), auth: {}, trip: {}, refresh: vi.fn(),
  availability: vi.fn(), entitlements: vi.fn(), checkout: vi.fn(),
  assistantProps: null, paymentProps: null, directionProps: [],
}));
vi.mock("react-router-dom", async (original) => ({ ...(await original()), useNavigate: () => mock.navigate }));
vi.mock("../src/context/AuthContext", () => ({ useAuth: () => mock.auth }));
vi.mock("../src/context/TripContext", () => ({ useTrip: () => mock.trip }));
vi.mock("../src/context/SubscriptionContext", () => ({ useSubscription: () => ({ refreshSubscription: mock.refresh }) }));
vi.mock("../src/services/itineraryPurchaseService", async (original) => ({
  ...(await original()), itineraryPurchaseService: {
    getAvailability: mock.availability, getMyEntitlements: mock.entitlements, checkout: mock.checkout,
  },
}));
vi.mock("../src/components/trip/TripRequestAssistant", () => ({ default: (props) => {
  mock.assistantProps = props;
  return <section aria-label={props.title}>{props.placeholder}</section>;
} }));
vi.mock("../src/components/TimelineItemDirections", () => ({ default: (props) => {
  mock.directionProps.push(props);
  return <div>Directions {props.currentStop.placeName}</div>;
} }));
vi.mock("../src/components/itineraryPurchase/SingleItineraryPaymentModal", () => ({ default: (props) => {
  mock.paymentProps = props;
  return <div role="dialog" aria-label="Payment mock"><button onClick={props.onClose}>Close payment</button></div>;
} }));

const entitlement = { entitlementId: "owned-one", available: true, consumedAt: null, consumedTripId: null };
const availability = { productKind: "SingleItinerary", currency: "VND", price: 37000, purchaseAllowed: true,
  normalFinalizeAvailable: true, unusedEntitlementCount: 0, normalSavedTripsUsed: 1, normalSavedTripLimit: 2 };
const deferred = () => { let resolve; let reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const flush = async () => { await act(async () => {}); };
const mount = (Page = Draft) => render(<MemoryRouter><Page /></MemoryRouter>);
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
    explainTrip: vi.fn().mockResolvedValue({}), saveTrip: vi.fn().mockResolvedValue({}) };
  mock.refresh.mockResolvedValue({}); mock.availability.mockResolvedValue(availability);
  mock.entitlements.mockResolvedValue({ entitlements: [] });
  mock.assistantProps = null; mock.paymentProps = null; mock.directionProps = [];
});

describe("USER-A5.2 authoritative finalize decision", () => {
  it("opening fetches availability and entitlements in parallel, disables unknown availability", async () => {
    const a = deferred(); const e = deferred(); mock.availability.mockReturnValue(a.promise); mock.entitlements.mockReturnValue(e.promise);
    mount(); const dialog = await openFinalize();
    expect(mock.availability).toHaveBeenCalledTimes(1); expect(mock.entitlements).toHaveBeenCalledTimes(1);
    expect(within(dialog).getByRole("status")).toHaveTextContent("Đang kiểm tra");
    expect(within(dialog).getByRole("button", { name: "Chốt lịch trình" })).toBeDisabled();
    await act(async () => { a.resolve(availability); e.resolve({ entitlements: [] }); });
    expect(within(dialog).getByRole("button", { name: "Chốt lịch trình" })).toBeEnabled();
  });
  it("Normal uses exact funding, duplicate lock, refresh and navigation", async () => {
    const pending = deferred(); mock.trip.finalizeTrip.mockReturnValue(pending.promise); mount(); const dialog = await openFinalize();
    const button = within(dialog).getByRole("button", { name: "Chốt lịch trình" }); fireEvent.click(button); fireEvent.click(button);
    expect(mock.trip.finalizeTrip).toHaveBeenCalledExactlyOnceWith("trip-one", { fundingSource: "Normal" });
    expect(button).toBeDisabled(); await act(async () => pending.resolve({}));
    expect(mock.refresh).toHaveBeenCalledTimes(1); expect(mock.availability).toHaveBeenCalledTimes(2);
    expect(mock.navigate).toHaveBeenCalledWith("/finalized"); expect(mock.paymentProps).toBeNull();
  });
  it("Normal failure retains error and retry without success navigation", async () => {
    mock.trip.finalizeTrip.mockRejectedValue({ code: "trip_finalized" }); mount(); const dialog = await openFinalize();
    fireEvent.click(within(dialog).getByRole("button", { name: "Chốt lịch trình" })); await flush();
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Lịch trình đã chốt"); expect(mock.navigate).not.toHaveBeenCalled();
  });
  it("quota failure refreshes authority and exposes exhausted purchase branch", async () => {
    mock.trip.finalizeTrip.mockRejectedValue({ code: "saved_trip_quota_exceeded" });
    mock.availability.mockResolvedValueOnce(availability).mockResolvedValue({ ...availability, normalFinalizeAvailable: false });
    mount(); const dialog = await openFinalize(); fireEvent.click(within(dialog).getByRole("button", { name: "Chốt lịch trình" })); await flush();
    expect(mock.availability).toHaveBeenCalledTimes(2); expect(screen.getByText("Đã đạt giới hạn lưu lịch trình")).toBeInTheDocument();
    expect(mock.trip.finalizeTrip).toHaveBeenCalledTimes(1);
  });
  it("availability failure retains explicit retry and no fallback purchase", async () => {
    mock.availability.mockRejectedValueOnce(new Error("offline")).mockResolvedValue(availability); mount(); const dialog = await openFinalize();
    expect(within(dialog).getByRole("status")).toHaveTextContent("Chưa thể tải");
    fireEvent.click(within(dialog).getByRole("button", { name: "Tải lại thông tin khả dụng" })); await flush();
    expect(mock.availability).toHaveBeenCalledTimes(2); expect(mock.checkout).not.toHaveBeenCalled();
  });
  it("newer availability generation wins over obsolete response", async () => {
    const old = deferred(); mock.availability.mockReturnValueOnce(old.promise).mockResolvedValue({ ...availability, normalFinalizeAvailable: false });
    mount(); let dialog = await openFinalize(); fireEvent.click(within(dialog).getByRole("button", { name: "Quay lại" }));
    dialog = await openFinalize(); await act(async () => old.resolve(availability));
    expect(within(dialog).getByText("Đã đạt giới hạn lưu lịch trình")).toBeInTheDocument();
    expect(mock.trip.finalizeTrip).not.toHaveBeenCalled();
  });
  it("unmount suppresses finalize navigation and refresh", async () => {
    const pending = deferred(); mock.trip.finalizeTrip.mockReturnValue(pending.promise); const view = mount(); const dialog = await openFinalize();
    fireEvent.click(within(dialog).getByRole("button", { name: "Chốt lịch trình" })); view.unmount();
    await act(async () => pending.resolve({})); expect(mock.navigate).not.toHaveBeenCalled(); expect(mock.refresh).not.toHaveBeenCalled();
  });
  it("Normal availability does not consume a spare entitlement", async () => {
    mock.availability.mockResolvedValue({ ...availability, unusedEntitlementCount: 2 }); mock.entitlements.mockResolvedValue({ entitlements: [entitlement] });
    mount(); const dialog = await openFinalize(); expect(within(dialog).getByText(/lượt mua lẻ dự phòng/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Chốt lịch trình" })); await flush();
    expect(mock.trip.finalizeTrip).toHaveBeenCalledWith("trip-one", { fundingSource: "Normal" });
  });
  it("Single branch filters used entitlements and re-fetches exact funding before use", async () => {
    mock.availability.mockResolvedValue({ ...availability, normalFinalizeAvailable: false, unusedEntitlementCount: 2 });
    mock.entitlements.mockResolvedValue({ entitlements: [{ ...entitlement, entitlementId: "used", consumedAt: "yesterday" }, entitlement] });
    mount(); const dialog = await openFinalize(); expect(within(dialog).getByText(/Bạn đang có 2 lượt/)).toBeInTheDocument();
    expect(mock.trip.finalizeTrip).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Dùng 1 lượt để chốt" })); await flush();
    expect(mock.entitlements).toHaveBeenCalledTimes(3);
    expect(mock.trip.finalizeTrip).toHaveBeenCalledExactlyOnceWith("trip-one", { fundingSource: "SingleEntitlement", entitlementId: "owned-one" });
    expect(mock.navigate).toHaveBeenCalledWith("/finalized");
  });
  it("server count without eligible evidence cannot enable consumption", async () => {
    mock.availability.mockResolvedValue({ ...availability, normalFinalizeAvailable: false, unusedEntitlementCount: 1 });
    mock.entitlements.mockResolvedValue({ entitlements: [{ ...entitlement, consumedTripId: "another-trip" }] }); mount(); const dialog = await openFinalize();
    expect(within(dialog).getByRole("button", { name: "Dùng 1 lượt để chốt" })).toBeDisabled(); expect(mock.trip.finalizeTrip).not.toHaveBeenCalled();
  });
  it("stale entitlement fails safely and refreshes without consumption", async () => {
    mock.availability.mockResolvedValue({ ...availability, normalFinalizeAvailable: false, unusedEntitlementCount: 1 });
    mock.entitlements.mockResolvedValueOnce({ entitlements: [entitlement] }).mockResolvedValue({ entitlements: [] });
    mount(); const dialog = await openFinalize(); fireEvent.click(within(dialog).getByRole("button", { name: "Dùng 1 lượt để chốt" })); await flush();
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Không tìm thấy lượt mua lẻ khả dụng");
    expect(mock.trip.finalizeTrip).not.toHaveBeenCalled(); expect(mock.availability).toHaveBeenCalledTimes(2);
  });
  it.each([{ purchaseAllowed: false }, { currency: "USD" }, { productKind: "Membership" }, { price: null }])("invalid purchase authority remains disabled (%j)", async (fields) => {
    mock.availability.mockResolvedValue({ ...availability, normalFinalizeAvailable: false, ...fields }); mount(); const dialog = await openFinalize();
    expect(within(dialog).getByRole("button", { name: /Mua thêm lịch trình chưa khả dụng/ })).toBeDisabled();
    expect(mock.paymentProps).toBeNull(); expect(mock.checkout).not.toHaveBeenCalled();
  });
  it("server price and exact payment props retained; close refreshes without checkout", async () => {
    const data = { ...availability, normalFinalizeAvailable: false }; mock.availability.mockResolvedValue(data);
    mount(); const dialog = await openFinalize(); fireEvent.click(within(dialog).getByRole("button", { name: /37.000/ }));
    expect(mock.paymentProps).toMatchObject({ isOpen: true, draftTripId: "trip-one", availability: data,
      onClose: expect.any(Function), onUseEntitlement: expect.any(Function) });
    expect(mock.checkout).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole("button", { name: "Close payment" })); await flush();
    expect(screen.queryByRole("dialog", { name: "Payment mock" })).not.toBeInTheDocument(); expect(mock.availability).toHaveBeenCalledTimes(2);
  });
  it("purchased entitlement callback must match authoritative owned evidence", async () => {
    mock.availability.mockResolvedValue({ ...availability, normalFinalizeAvailable: false });
    mount(); const dialog = await openFinalize(); fireEvent.click(within(dialog).getByRole("button", { name: /37.000/ }));
    mock.entitlements.mockResolvedValue({ entitlements: [entitlement, { ...entitlement, entitlementId: "chosen-two" }] });
    await act(async () => mock.paymentProps.onUseEntitlement({ ...entitlement, entitlementId: "chosen-two" }));
    expect(mock.trip.finalizeTrip).toHaveBeenCalledWith("trip-one", { fundingSource: "SingleEntitlement", entitlementId: "chosen-two" });
  });
  it("invalid purchased evidence returns to confirmation without finalize", async () => {
    mock.availability.mockResolvedValue({ ...availability, normalFinalizeAvailable: false }); mount(); const dialog = await openFinalize();
    fireEvent.click(within(dialog).getByRole("button", { name: /37.000/ }));
    await act(async () => mock.paymentProps.onUseEntitlement({ ...entitlement, available: false }));
    expect(screen.getByRole("dialog", { name: "Chốt lịch trình" })).toBeInTheDocument(); expect(mock.trip.finalizeTrip).not.toHaveBeenCalled();
  });
  it("subscription remains explicit destination and cancellation does not finalize", async () => {
    mock.availability.mockResolvedValue({ ...availability, normalFinalizeAvailable: false }); mount(); const dialog = await openFinalize();
    fireEvent.click(within(dialog).getByRole("button", { name: /Nâng cấp gói dịch vụ/ }));
    expect(mock.navigate).toHaveBeenCalledWith("/subscription"); expect(mock.trip.finalizeTrip).not.toHaveBeenCalled();
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
  it("saved quota keeps subscription action and no entitlement checkout", async () => {
    mock.trip.saveTrip.mockRejectedValue({ code: "saved_trip_quota_exceeded" }); mount(Finalized);
    fireEvent.click(screen.getByRole("button", { name: /Lưu lịch trình/ })); await flush();
    expect(screen.getByRole("alert")).toHaveTextContent("đạt giới hạn"); fireEvent.click(screen.getByRole("button", { name: "Nâng cấp" }));
    expect(mock.navigate).toHaveBeenCalledWith("/subscription"); expect(mock.checkout).not.toHaveBeenCalled();
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
    expect(screen.getByText(/Chưa tìm được địa điểm khớp/)).toBeInTheDocument();
    expect(screen.queryByText("Metro-friendly")).not.toBeInTheDocument(); expect(screen.queryByText(/Kết thúc dự kiến/)).not.toBeInTheDocument();
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
    fireEvent.click(screen.getAllByRole("button", { name: /Thay thế/ })[1]);
    expect(mock.navigate.mock.calls).toEqual([["/place/place-one"], ["/replace/item-two"]]);
    expect(mock.trip.deleteItem).not.toHaveBeenCalled(); expect(mock.trip.explainTrip).not.toHaveBeenCalled();
    expect(mock.trip.finalizeTrip).not.toHaveBeenCalled(); expect(mock.availability).not.toHaveBeenCalled();
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
    expect(screen.queryByRole("button", { name: /Nhờ AI/ })).not.toBeInTheDocument();
  });
  it("assistant no-change is a no-op, changed result preserves origin/base and original trip", () => {
    mount(); const original = JSON.stringify(mock.trip.currentTrip);
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
});
