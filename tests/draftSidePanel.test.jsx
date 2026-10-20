import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import DraftItineraryPage from "../src/pages/trip/DraftItineraryPage";
import { tripService } from "../src/services/tripService";

const mock = vi.hoisted(() => ({ auth: {}, trip: {}, subscription: null, refresh: vi.fn() }));
vi.mock("../src/context/AuthContext", () => ({ useAuth: () => mock.auth }));
vi.mock("../src/context/TripContext", () => ({ useTrip: () => mock.trip }));
vi.mock("../src/context/SubscriptionContext", () => ({
  useSubscription: () => ({ subscription: mock.subscription, plans: [], refreshSubscription: mock.refresh }),
}));
vi.mock("../src/components/TimelineItemDirections", () => ({ default: () => null }));

const trip = () => ({
  id: "trip-one", title: "Khám phá quanh ga Bến Thành", summary: "", durationHours: 4, estimatedBudget: 150000,
  startLatitude: 10.77, startLongitude: 106.7, travelMode: "Auto",
  items: [
    { id: "item-one", placeId: "place-one", placeName: "Cà phê ven sông", placeCategory: "Cafe", time: "09:00",
      durationMinutes: 60, estimatedCost: 50000, reason: null, latitude: 10.78, longitude: 106.71 },
    { id: "item-two", placeId: "place-two", placeName: "Bảo tàng", placeCategory: "Culture", time: "10:15",
      durationMinutes: 90, estimatedCost: 30000, reason: null, latitude: 10.77, longitude: 106.69 },
  ],
});

const alternative = (id, name, extra = {}) => ({
  placeId: id, name, address: "Quận 1", stationName: "Bến Thành", distanceFromStationMeters: 650,
  category: "Culture", estimatedCostMin: 40000, estimatedCostMax: 65000, openingStatus: "Open", ...extra,
});

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function Location() {
  const { pathname, search } = useLocation();
  return <span data-testid="location">{pathname + search}</span>;
}

function setDesktop(desktop) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: desktop, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }));
}

function mount(path = "/draft") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/draft" element={<><DraftItineraryPage /><Location /></>} />
        <Route path="*" element={<Location />} />
      </Routes>
    </MemoryRouter>
  );
}

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
const replaceButtons = () => screen.getAllByRole("button", { name: /Thay thế|Đang thay/ });

const originalMatchMedia = window.matchMedia;

beforeEach(() => {
  mock.auth = { user: { id: "user-one" }, isLoggedIn: true, isDemo: false };
  mock.trip = {
    currentTrip: trip(), savedTrips: [], explainingTripIds: [],
    replaceItem: vi.fn().mockResolvedValue({ warnings: [] }), deleteItem: vi.fn(), finalizeTrip: vi.fn(),
    explainTrip: vi.fn(), saveTrip: vi.fn(), noteAiError: vi.fn(),
  };
  mock.subscription = null;
  vi.spyOn(tripService, "getItemAlternatives").mockResolvedValue([
    alternative("alt-one", "Dinh Độc Lập"),
    alternative("alt-two", "Bảo tàng Áo dài", { openingStatus: "Closed" }),
  ]);
});

afterEach(() => {
  window.matchMedia = originalMatchMedia;
  vi.restoreAllMocks();
});

describe("Trang Nháp từ 1280px: hai cột", () => {
  beforeEach(() => setDesktop(true));

  it("khung phải có 2 tab, chưa chọn chặng thì hiện hướng dẫn", () => {
    mount();
    const aside = screen.getByRole("complementary", { name: "Chỉnh lịch trình" });
    expect(within(aside).getAllByRole("tab").map((t) => t.textContent)).toEqual(["Thay địa điểm", "Hỏi AI"]);
    expect(within(aside).getByText(/để xem các địa điểm gợi ý thay thế/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Hỏi AI" })).not.toBeInTheDocument();
  });

  it("bấm Thay thế: làm nổi bật chặng, lưu trên URL, gợi ý hiện ở khung phải, không chuyển trang", async () => {
    mount();
    fireEvent.click(replaceButtons()[1]);
    await flush();
    expect(screen.getByTestId("location")).toHaveTextContent("/draft?thay=item-two");
    expect(screen.getByRole("button", { name: /Đang thay/ })).toHaveAttribute("aria-pressed", "true");
    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveTextContent('Thay "Bảo tàng"');
    expect(within(panel).getByText("Dinh Độc Lập")).toBeInTheDocument();
    expect(tripService.getItemAlternatives).toHaveBeenCalledWith("trip-one", "item-two", 5);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("chọn gợi ý: gọi thay địa điểm, báo kèm cảnh báo, bỏ chọn chặng", async () => {
    mock.trip.replaceItem.mockResolvedValue({ warnings: ["higher_cost"] });
    mount("/draft?thay=item-two");
    await flush();
    fireEvent.click(screen.getAllByRole("button", { name: "Chọn địa điểm này" })[0]);
    await flush();
    expect(mock.trip.replaceItem).toHaveBeenCalledWith("trip-one", "item-two", "alt-one");
    expect(screen.getByText("Đã thay thế địa điểm (Chi phí cao hơn điểm cũ)")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent(/^\/draft$/);
    expect(screen.getByRole("tabpanel")).toHaveTextContent(/để xem các địa điểm gợi ý thay thế/);
  });

  it("lỗi thay địa điểm hiện ngay trong khung", async () => {
    mock.trip.replaceItem.mockRejectedValue({ code: "replacement_too_long" });
    mount("/draft?thay=item-one");
    await flush();
    fireEvent.click(screen.getAllByRole("button", { name: "Chọn địa điểm này" })[0]);
    await flush();
    expect(within(screen.getByRole("tabpanel")).getByRole("alert")).toHaveTextContent("dài quá 24 giờ");
    expect(screen.getByTestId("location")).toHaveTextContent("/draft?thay=item-one");
  });

  it("mở trang có sẵn ?thay= thì khung mở đúng chặng", async () => {
    mount("/draft?thay=item-one");
    await flush();
    expect(screen.getByRole("tabpanel")).toHaveTextContent('Thay "Cà phê ven sông"');
  });

  it("chặng trên URL không còn trong lịch thì hiện hướng dẫn", () => {
    mount("/draft?thay=item-gone");
    expect(screen.getByRole("tabpanel")).toHaveTextContent(/để xem các địa điểm gợi ý thay thế/);
  });

  it("tab Hỏi AI: khung Muốn đổi gì? kèm ghi chú tạo lịch mới, không còn ở cuối trang", () => {
    mount();
    fireEvent.click(screen.getByRole("tab", { name: "Hỏi AI" }));
    const panel = screen.getByRole("tabpanel");
    expect(within(panel).getByText("Muốn đổi gì?")).toBeInTheDocument();
    expect(within(panel).getByText(/AI sẽ tạo một lịch mới theo thay đổi của bạn/)).toBeInTheDocument();
    expect(screen.getAllByText("Muốn đổi gì?")).toHaveLength(1);
  });

  it("phiên demo: chỉ có tab Thay địa điểm", () => {
    mock.auth.isDemo = true;
    mount();
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Thay địa điểm"]);
  });
});

describe("ReplacePlacePanel", () => {
  beforeEach(() => setDesktop(true));

  it("đổi chặng giữa chừng: bỏ kết quả của chặng cũ", async () => {
    const first = deferred();
    const second = deferred();
    tripService.getItemAlternatives.mockImplementation((_, itemId) => (itemId === "item-one" ? first.promise : second.promise));
    mount();
    fireEvent.click(replaceButtons()[0]);
    fireEvent.click(replaceButtons()[1]);
    await act(async () => second.resolve([alternative("alt-two", "Gợi ý cho Bảo tàng")]));
    await act(async () => first.resolve([alternative("alt-one", "Gợi ý cho Cà phê")]));
    const panel = screen.getByRole("tabpanel");
    expect(within(panel).getByText("Gợi ý cho Bảo tàng")).toBeInTheDocument();
    expect(within(panel).queryByText("Gợi ý cho Cà phê")).not.toBeInTheDocument();
  });

  it("tải gợi ý lỗi: báo lỗi và cho thử lại", async () => {
    tripService.getItemAlternatives.mockRejectedValueOnce(new Error("offline"));
    mount("/draft?thay=item-one");
    await flush();
    const panel = screen.getByRole("tabpanel");
    expect(within(panel).getByText("Chưa tải được gợi ý thay thế.")).toBeInTheDocument();
    expect(within(panel).queryByText("Không tìm thấy gợi ý phù hợp.")).not.toBeInTheDocument();
    fireEvent.click(within(panel).getByRole("button", { name: "Thử lại" }));
    await flush();
    expect(within(panel).getByText("Dinh Độc Lập")).toBeInTheDocument();
    expect(tripService.getItemAlternatives).toHaveBeenCalledTimes(2);
  });
});

describe("Trang Nháp dưới 1280px: ngăn kéo", () => {
  beforeEach(() => setDesktop(false));

  it("không có khung bên phải; bấm Thay thế mở ngăn kéo, Esc đóng và trả focus", async () => {
    mount();
    expect(screen.queryByRole("complementary", { name: "Chỉnh lịch trình" })).not.toBeInTheDocument();
    const button = replaceButtons()[1];
    button.focus();
    fireEvent.click(button);
    await flush();
    const sheet = screen.getByRole("dialog", { name: "Thay địa điểm" });
    expect(sheet).toHaveTextContent('Thay "Bảo tàng"');
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent(/^\/draft$/);
    expect(replaceButtons()[1]).toHaveFocus();
  });

  it("bấm ra ngoài thì đóng ngăn kéo", async () => {
    mount("/draft?thay=item-one");
    await flush();
    fireEvent.click(screen.getByTestId("bottom-sheet-backdrop"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("nút nổi Hỏi AI mở ngăn kéo có khung Muốn đổi gì? và nút đóng", () => {
    mount();
    expect(screen.queryByText("Muốn đổi gì?")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Hỏi AI" }));
    const sheet = screen.getByRole("dialog", { name: "Hỏi AI" });
    expect(within(sheet).getByText("Muốn đổi gì?")).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole("button", { name: "Đóng Hỏi AI" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("phiên demo không có nút nổi Hỏi AI", () => {
    mock.auth.isDemo = true;
    mount();
    expect(screen.queryByRole("button", { name: "Hỏi AI" })).not.toBeInTheDocument();
  });
});
