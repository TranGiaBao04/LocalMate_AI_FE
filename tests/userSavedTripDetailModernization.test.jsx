import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Link, MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { TripProvider, useTrip } from "../src/context/TripContext";
import MyTripsPage from "../src/pages/trip/MyTripsPage";
import SavedTripDetailPage from "../src/pages/trip/SavedTripDetailPage";
import CreateTripPage from "../src/pages/trip/CreateTripPage";
import FinalizedItineraryPage from "../src/pages/trip/FinalizedItineraryPage";
import { mapMyTrip, mapTrip } from "../src/utils/tripMapper";

const boundary = vi.hoisted(() => ({
  auth: null,
  getTrips: vi.fn(),
  getTripById: vi.fn(),
  master: vi.fn(),
  generate: vi.fn(),
  visit: vi.fn(), save: vi.fn(), remove: vi.fn(),
  review: vi.fn(), submitReview: vi.fn(), deleteReview: vi.fn(),
  feedback: vi.fn(), submitFeedback: vi.fn(),
  pdf: vi.fn(), png: vi.fn(), calendar: vi.fn(), download: vi.fn(), share: vi.fn(),
}));
vi.mock("../src/context/AuthContext", () => ({ useAuth: () => boundary.auth }));
vi.mock("../src/context/NotificationContext", () => ({
  useNotifications: () => ({ refreshUnreadCount: vi.fn() }),
}));
vi.mock("../src/services/tripService", async (original) => ({
  ...(await original()),
  tripService: { getTrips: boundary.getTrips, getTripById: boundary.getTripById, generateTrip: boundary.generate,
    markVisited: boundary.visit, saveTrip: boundary.save, deleteTrip: boundary.remove },
}));
vi.mock("../src/services/reviewService", () => ({ reviewService: { getReview: boundary.review, submitReview: boundary.submitReview, deleteReview: boundary.deleteReview } }));
vi.mock("../src/services/feedbackService", () => ({ feedbackService: { getTripFeedback: boundary.feedback, submitTripFeedback: boundary.submitFeedback } }));
vi.mock("../src/components/trip/export/tripPdfGenerator", () => ({ generateTripPdfBlob: boundary.pdf }));
vi.mock("../src/components/trip/export/tripImageGenerator", () => ({ generateTripImageBlob: boundary.png }));
vi.mock("../src/components/trip/export/tripCalendarGenerator", () => ({ generateTripCalendarBlob: boundary.calendar }));
vi.mock("../src/utils/exportFiles", async (original) => ({ ...(await original()), canShareFile: () => true, downloadBlob: boundary.download, shareFile: boundary.share }));
vi.mock("../src/services/tagService", () => ({ tagService: { getTags: async () => [{ id: "coffee", name: "Cà phê", type: "Interest" }] } }));
vi.mock("../src/services/placeService", () => ({ placeService: { getMetroClusters: async () => [] } }));
vi.mock("../src/services/masterDataService", () => ({
  masterDataService: { getMasterData: boundary.master },
}));

const accountA = { user: { id: "account-a", fullName: "Account A" }, isLoggedIn: true, isDemo: false };
const accountB = { user: { id: "account-b", fullName: "Account B" }, isLoggedIn: true, isDemo: false };
const signedOut = { user: null, isLoggedIn: false, isDemo: false };
const rawTrip = (id, stationName) => ({
  id, stationName, status: "Draft", durationHours: 2, estimatedBudget: 100000,
  itemCount: 1, createdAt: "2026-10-09T00:00:00Z", items: [{
    itemId: `${id}-item`, placeId: `${id}-place`, placeName: stationName,
    orderIndex: 1, scheduledTime: "09:00:00", estimatedDurationMinutes: 60,
    estimatedBudget: 100000, isVisited: false,
  }],
});

function RouteEvidence() {
  const location = useLocation();
  return <><span data-testid="active-route">{location.pathname}</span><span data-testid="route-state">{JSON.stringify(location.state)}</span></>;
}

function GenerationSession() {
  const fields = { durationHours: 4, budgetMax: 300000, tagIds: ["coffee"], travelMode: "Auto",
    startStationOrder: 1, destinationStationOrder: null, plannedDate: "2026-10-10", startTime: "09:30:00", note: "" };
  return (
    <MemoryRouter initialEntries={[{ pathname: "/create", state: { prefill: { fields, changed: [], missing: [], base: fields, origin: {} } } }]}>
      <RouteEvidence />
      <Link to="/subscription">Open B subscription</Link>
      <TripProvider>
        <ContextEvidence />
        <Routes>
          <Route path="/create" element={<CreateTripPage />} />
          <Route path="/loading" element={<p>Generation pending</p>} />
          <Route path="/subscription" element={<p>B subscription destination</p>} />
          <Route path="/draft" element={<p>Generated draft destination</p>} />
        </Routes>
      </TripProvider>
    </MemoryRouter>
  );
}

describe("actual A4 consumer with inherited B03 account boundary", () => {
  it.each(["resolve", "reject"])("old A generation %s must not redirect B away from B's chosen route", async (outcome) => {
    boundary.auth = accountA;
    boundary.master.mockResolvedValue({ reviewQuickTags: [], metroStations: [{ id: "s1", order: 1, name: "Bến Thành" }],
      travelModes: ["Auto"], timeSlots: [], tripLimits: { minDurationHours: 1, maxDurationHours: 24 } });
    const pending = deferred();
    boundary.generate.mockReturnValueOnce(pending.promise);
    const view = render(<GenerationSession />);
    fireEvent.click(await screen.findByRole("button", { name: "Tạo lịch mới" }));
    await waitFor(() => expect(boundary.generate).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId("active-route")).toHaveTextContent("/loading");
    boundary.auth = accountB;
    view.rerender(<GenerationSession />);
    fireEvent.click(screen.getByRole("link", { name: "Open B subscription" }));
    expect(screen.getByTestId("active-route")).toHaveTextContent("/subscription");
    await act(async () => outcome === "resolve" ? pending.resolve(detailA) : pending.reject(new Error("Old A failure")));
    expect(screen.getByTestId("active-route"), "A's stale generation must not change B's navigation").toHaveTextContent("/subscription");
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(JSON.parse(screen.getByTestId("context-state").textContent)).toMatchObject({ current: null, saved: ["trip-b"] });
  });
  it.each(["success", "quota-error"])("same-account generation retains %s navigation and metadata", async (outcome) => {
    boundary.auth = accountA;
    const pending = deferred(); boundary.generate.mockReturnValueOnce(pending.promise);
    render(<GenerationSession />);
    expect(boundary.generate).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Tạo lịch mới" }));
    await waitFor(() => expect(boundary.generate).toHaveBeenCalledTimes(1));
    const metadata = { remaining: 0 };
    await act(async () => outcome === "success" ? pending.resolve(detailA) : pending.reject(Object.assign(new Error("Quota"), {
      code: "generate_quota_exceeded", data: { extensions: metadata, suggestedStations: [{ order: 2 }] },
    })));
    expect(screen.getByTestId("active-route")).toHaveTextContent(outcome === "success" ? "/draft" : "/create");
    if (outcome === "success") expect(JSON.parse(screen.getByTestId("context-state").textContent).current).toBe("trip-a");
    else expect(JSON.parse(screen.getByTestId("route-state").textContent)).toMatchObject({ errorCode: "generate_quota_exceeded", quotaMetadata: metadata, suggestedStations: [{ order: 2 }] });
    expect(boundary.generate).toHaveBeenCalledTimes(1); expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
const rawA = rawTrip("trip-a", "PRIVATE_ACCOUNT_A");
const rawB = rawTrip("trip-b", "ACCOUNT_B");
const detailA = mapTrip(rawA);
const detailB = mapTrip(rawB);

function deferred() {
  let resolve, reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function ContextEvidence() {
  const trip = useTrip();
  return (
    <>
      <span data-testid="context-state">{JSON.stringify({
        account: boundary.auth.user?.id ?? null,
        saved: trip.savedTrips.map((record) => record.id),
        current: trip.currentTrip?.id ?? null,
      })}</span>
      <button onClick={() => trip.setCurrentTrip(detailA)}>Set test-only current Trip A</button>
    </>
  );
}

function Session({ account }) {
  return (
    <MemoryRouter initialEntries={["/trips/trip-a"]}>
      <TripProvider>
        <ContextEvidence />
        {account.isLoggedIn && (
          <>
            <Link to="/trips/trip-b">Open B detail</Link>
            <Link to="/trips">Open saved list</Link>
            <Routes>
              <Route path="/trips" element={<MyTripsPage />} />
              <Route path="/trips/:tripId" element={<SavedTripDetailPage />} />
            </Routes>
          </>
        )}
      </TripProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unmocked network is forbidden in B03"); }));
  boundary.master.mockResolvedValue({ reviewQuickTags: [] });
  boundary.getTrips.mockImplementation(async () => [mapMyTrip(boundary.auth.user?.id === "account-a" ? rawA : rawB)]);
  boundary.auth = accountA;
  boundary.review.mockRejectedValue(Object.assign(new Error("Absent"), { status: 404, code: "review_not_found" }));
  boundary.feedback.mockRejectedValue(Object.assign(new Error("Absent"), { code: "feedback_not_found" }));
  boundary.master.mockResolvedValue({ reviewQuickTags: [1, 2, 3, 4].map((n) => ({ code: `tag${n}`, label: `Review tag ${n}` })), feedbackQuickTags: [{ code: "great", label: "Trip good" }, { code: "fair", label: "Trip fair" }] });
  boundary.pdf.mockResolvedValue(new Blob(["mock pdf"], { type: "application/pdf" }));
  boundary.png.mockResolvedValue(new Blob(["mock png"], { type: "image/png" }));
  boundary.calendar.mockResolvedValue({ valid: true, blob: new Blob(["mock calendar"], { type: "text/calendar" }) });
});
afterEach(() => {
  expect(globalThis.fetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});

describe("B03 baseline security gate - actual TripProvider and pages", () => {
  it("must not expose A's stale detail or saved Trip to directly switched account B", async () => {
    const pendingA = deferred();
    boundary.getTripById.mockImplementation((id) => id === "trip-a"
      ? boundary.auth.user?.id === "account-a" ? pendingA.promise : Promise.reject(Object.assign(new Error("Forbidden"), { status: 403 }))
      : Promise.resolve(detailB));
    boundary.auth = accountA;
    const view = render(<Session account={accountA} />);
    await waitFor(() => expect(screen.getByTestId("context-state")).toHaveTextContent('"saved":["trip-a"]'));
    expect(boundary.getTripById).toHaveBeenCalledWith("trip-a");
    boundary.auth = accountB;
    view.rerender(<Session account={accountB} />);
    fireEvent.click(screen.getByRole("link", { name: "Open B detail" }));
    await screen.findByRole("heading", { level: 1, name: detailB.title });
    await act(async () => pendingA.resolve(detailA));
    expect(screen.getByRole("heading", { level: 1, name: detailB.title })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Open saved list" }));
    await screen.findByText(detailB.title);
    const state = JSON.parse(screen.getByTestId("context-state").textContent);
    console.info("B03_DIRECT_SWITCH", JSON.stringify(state));
    expect(state.account).toBe("account-b");
    expect(screen.queryByText(detailA.title), "Account B must not see A-owned Trip in actual MyTripsPage").not.toBeInTheDocument();
    expect(state.saved).not.toContain("trip-a");
  });

  it("must not expose late A detail or current Trip after logout/session-ended boundary and B login", async () => {
    const pendingA = deferred();
    boundary.getTripById.mockImplementation((id) => id === "trip-a"
      ? boundary.auth.user?.id === "account-a" ? pendingA.promise : Promise.reject(Object.assign(new Error("Forbidden"), { status: 403 }))
      : Promise.resolve(detailB));
    boundary.auth = accountA;
    const view = render(<Session account={accountA} />);
    await waitFor(() => expect(boundary.getTripById).toHaveBeenCalledWith("trip-a"));
    fireEvent.click(screen.getByRole("button", { name: "Set test-only current Trip A" }));
    boundary.auth = signedOut;
    view.rerender(<Session account={signedOut} />);
    await waitFor(() => expect(screen.getByTestId("context-state")).toHaveTextContent('"saved":[]'));
    boundary.auth = accountB;
    view.rerender(<Session account={accountB} />);
    await waitFor(() => expect(screen.getByTestId("context-state")).toHaveTextContent('"saved":["trip-b"]'));
    fireEvent.click(screen.getByRole("link", { name: "Open B detail" }));
    await screen.findByRole("heading", { level: 1, name: detailB.title });
    await act(async () => pendingA.resolve(detailA));
    fireEvent.click(screen.getByRole("link", { name: "Open saved list" }));
    await screen.findByText(detailB.title);
    const state = JSON.parse(screen.getByTestId("context-state").textContent);
    console.info("B03_LOGOUT_LOGIN", JSON.stringify(state));
    expect(state.account).toBe("account-b");
    expect(screen.queryByText(detailA.title), "Late A response must not become visible in B's actual saved list").not.toBeInTheDocument();
    expect(state.saved).not.toContain("trip-a");
    expect(state.current).not.toBe("trip-a");
  });
});

const finalized = (visited = false) => mapTrip({ ...rawA, status: "Finalized", plannedDate: "2026-10-10", startTime: "09:00:00",
  items: [{ ...rawA.items[0], isVisited: visited, latitude: 10.77, longitude: 106.7, stationName: "Bến Thành", reasoning: "Một điểm dừng dễ tiếp cận" }] });

function DetailSession({ initial = "/trips/trip-a" }) {
  return <MemoryRouter initialEntries={[initial]}><RouteEvidence /><TripProvider><ContextEvidence />
    <Link to="/trips/trip-b">Change detail route</Link>
    <Routes><Route path="/trips/:tripId" element={<SavedTripDetailPage />} /><Route path="/trips" element={<MyTripsPage />} /></Routes>
  </TripProvider></MemoryRouter>;
}
async function openDetail(trip = detailA) {
  boundary.getTripById.mockResolvedValue(trip);
  const view = render(<DetailSession />);
  await screen.findByRole("heading", { level: 1, name: trip.title });
  return view;
}
async function openReview() {
  await openDetail(finalized(true));
  fireEvent.click(await screen.findByRole("button", { name: /Đánh giá nhanh/ }));
  return screen.getByRole("dialog", { name: "Bạn thấy địa điểm này thế nào?" });
}

describe("actual Saved Detail and protected consumers", () => {
  it("characterizes B01 Delete removing list membership but not currentTrip using the real Provider", async () => {
    boundary.remove.mockResolvedValue(); await openDetail();
    fireEvent.click(screen.getByRole("button", { name: "Set test-only current Trip A" }));
    fireEvent.click(screen.getByRole("button", { name: "Về lịch trình cá nhân" }));
    fireEvent.click(await screen.findByRole("button", { name: `Xóa lịch trình ${detailA.title}` }));
    fireEvent.click(screen.getByRole("button", { name: "Xoá lịch trình", exact: true }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(JSON.parse(screen.getByTestId("context-state").textContent)).toMatchObject({ current: "trip-a", saved: [] });
    expect(boundary.remove.mock.calls).toEqual([["trip-a"]]);
  });
  it("characterizes B05 in-flight Review GET cannot overwrite the newly POSTed local review", async () => {
    const pending = deferred(); boundary.review.mockReturnValueOnce(pending.promise);
    boundary.visit.mockResolvedValue(); await openDetail(finalized());
    boundary.getTripById.mockResolvedValue(finalized(true));
    fireEvent.click(screen.getByRole("button", { name: /Đã ghé/ }));
    await screen.findByRole("dialog"); boundary.submitReview.mockResolvedValue({ rating: 4 });
    fireEvent.click(screen.getByRole("button", { name: "4 sao" })); fireEvent.click(screen.getByRole("button", { name: "Gửi đánh giá" }));
    await screen.findByText("Cảm ơn bạn!"); fireEvent.click(screen.getByRole("button", { name: "Quay lại lịch trình" }));
    await act(async () => pending.resolve({ rating: 1 }));
    expect(screen.getByText("Đã đánh giá 4/5")).toBeInTheDocument(); expect(screen.queryByText("Đã đánh giá 1/5")).not.toBeInTheDocument();
  });
  it("Finalized without planned date cannot gain Calendar eligibility; PDF/PNG stay available", async () => {
    await openDetail({ ...finalized(), plannedDate: null }); fireEvent.click(screen.getByRole("button", { name: "Xuất lịch trình" }));
    expect(screen.getByRole("button", { name: "Tạo file lịch" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Tạo PDF" })).toBeEnabled(); expect(screen.getByRole("button", { name: "Tạo ảnh" })).toBeEnabled();
  });
  it("Review rejects programmatic oversized comments before any POST", async () => {
    const ui = within(await openReview()); fireEvent.click(ui.getByRole("button", { name: "2 sao" }));
    fireEvent.change(ui.getByRole("textbox", { name: "Nhận xét thêm" }), { target: { value: "x".repeat(1001) } });
    fireEvent.click(ui.getByRole("button", { name: "Gửi đánh giá" }));
    expect(ui.getByRole("alert")).toHaveTextContent("1000"); expect(boundary.submitReview).not.toHaveBeenCalled();
  });
  it("Feedback errors remain separate and retry reloads its read-only consumer", async () => {
    boundary.feedback.mockRejectedValueOnce(new Error("Read failure")); await openDetail(finalized());
    const section = screen.getByRole("heading", { name: "Chuyến đi này thế nào?" }).closest("section"); const ui = within(section);
    fireEvent.click(await ui.findByRole("button", { name: "Thử lại" }));
    fireEvent.click(await ui.findByRole("button", { name: "Trip good" }));
    boundary.submitFeedback.mockRejectedValue(Object.assign(new Error("Denied"), { status: 403 }));
    fireEvent.click(ui.getByRole("button", { name: "Gửi phản hồi" })); expect(await ui.findByRole("alert")).toHaveTextContent("Phiên đăng nhập");
    expect(boundary.feedback).toHaveBeenCalledTimes(2); expect(boundary.submitReview).not.toHaveBeenCalled();
  });
  it("keeps loading until detail GET replaces the summary and upserts without duplicate IDs (B02)", async () => {
    const pending = deferred(); boundary.getTripById.mockReturnValue(pending.promise);
    render(<DetailSession />);
    expect(screen.getByRole("status")).toHaveTextContent("Đang tải");
    await act(async () => pending.resolve(detailA));
    await screen.findByRole("heading", { level: 3, name: "PRIVATE_ACCOUNT_A" });
    expect(JSON.parse(screen.getByTestId("context-state").textContent).saved).toEqual(["trip-a"]);
    expect(boundary.getTripById).toHaveBeenCalledTimes(1);
  });
  it.each([404, 401, 403, 500])("maps detail error %s and retries the exact route ID", async (status) => {
    boundary.getTripById.mockRejectedValueOnce(Object.assign(new Error("Unavailable"), { status })).mockResolvedValue(detailA);
    render(<DetailSession />);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(status === 404 ? "Không tìm thấy" : status === 500 ? "Không thể tải" : "không có quyền");
    fireEvent.click(within(alert).getByRole("button", { name: "Thử lại" }));
    await screen.findByRole("heading", { level: 1, name: detailA.title });
    expect(boundary.getTripById.mock.calls).toEqual([["trip-a"], ["trip-a"]]);
  });
  it("shows missing record when GET returns no data rather than fabricating a Trip", async () => {
    boundary.getTrips.mockResolvedValue([]);
    boundary.getTripById.mockRejectedValue(Object.assign(new Error("Missing"), { status: 404 }));
    render(<DetailSession />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Không tìm thấy lịch trình này.");
  });
  it("ignores old route completion in the visible detail while retaining existing fetch-upsert semantics", async () => {
    const pending = deferred(); boundary.getTripById.mockImplementation((id) => id === "trip-a" ? pending.promise : Promise.resolve(detailB));
    render(<DetailSession />);
    fireEvent.click(screen.getByRole("link", { name: "Change detail route" }));
    await screen.findByRole("heading", { level: 1, name: detailB.title });
    await act(async () => pending.resolve(detailA));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(detailB.title);
    expect(screen.queryByRole("heading", { level: 3, name: "PRIVATE_ACCOUNT_A" })).not.toBeInTheDocument();
  });
  it("preserves mapped item ordering, optional fields, honest metadata and Maps URLs", async () => {
    const trip = mapTrip({ ...rawA, items: [{ ...rawA.items[0], itemId: "second", placeName: "Tên rất dài ".repeat(12), orderIndex: 2 },
      { ...rawA.items[0], itemId: "first", placeName: "First stop", orderIndex: 1, latitude: 10.77, longitude: 106.7 }] });
    await openDetail(trip);
    const stops = screen.getAllByRole("heading", { level: 3 }).filter((node) => node.textContent !== "Tóm tắt");
    expect(stops[0]).toHaveTextContent("First stop"); expect(stops[1]).toHaveTextContent("Tên rất dài");
    expect(screen.getByText(/Ngày ghi nhận:/)).toBeInTheDocument();
    expect(screen.getByText("Thời gian tại các điểm")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Maps/ })[0].href).toContain("destination=10.77");
    expect(screen.queryByAltText("First stop")).not.toBeInTheDocument();
    expect(screen.queryByText("Metro-friendly")).not.toBeInTheDocument();
  });
  it("Draft has no Visit mutation or Feedback; Back returns to the real list", async () => {
    await openDetail();
    expect(screen.getByText("Chốt lịch trình để đánh dấu")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Đã ghé/ })).not.toBeInTheDocument();
    expect(boundary.feedback).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Về lịch trình cá nhân" }));
    expect(await screen.findByRole("link", { name: detailA.title })).toHaveAttribute("href", "/trips/trip-a");
    expect(boundary.visit).not.toHaveBeenCalled();
  });
  it("Finalized Visit locks duplicate clicks, refreshes the exact Trip and only then opens Review", async () => {
    const pending = deferred(); const trip = finalized(); boundary.visit.mockReturnValue(pending.promise);
    await openDetail(trip);
    const button = screen.getByRole("button", { name: /Đã ghé/ }); fireEvent.click(button); fireEvent.click(button);
    expect(boundary.visit.mock.calls).toEqual([["trip-a-item"]]);
    expect(screen.getByRole("button", { name: /Đang cập nhật/ })).toBeDisabled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    boundary.getTripById.mockResolvedValue(finalized(true));
    await act(async () => pending.resolve());
    expect(await screen.findByRole("dialog", { name: "Bạn thấy địa điểm này thế nào?" })).toBeInTheDocument();
    expect(boundary.getTripById.mock.calls).toEqual([["trip-a"], ["trip-a"]]);
    expect(screen.getAllByText("1/1").length).toBeGreaterThan(0);
  });
  it.each([404, 401, 403, 500])("Visit error %s keeps original state and no Review", async (status) => {
    boundary.visit.mockRejectedValue(Object.assign(new Error("Visit failed"), { status }));
    await openDetail(finalized()); fireEvent.click(screen.getByRole("button", { name: /Đã ghé/ }));
    await screen.findByRole("alert"); expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(boundary.getTripById).toHaveBeenCalledTimes(1);
  });
  it("characterizes B04 PUT success followed by failed GET without optimistic Visit or Review", async () => {
    boundary.visit.mockResolvedValue(); await openDetail(finalized());
    boundary.getTripById.mockRejectedValue(new Error("Refresh failed"));
    fireEvent.click(screen.getByRole("button", { name: /Đã ghé/ }));
    await screen.findByText("Không thể đánh dấu đã ghé lúc này. Vui lòng thử lại.");
    expect(boundary.visit).toHaveBeenCalledTimes(1); expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Đã ghé/ })).toBeEnabled();
  });
  it("Review lookup loading/error/retry is explicit and not-found enables the form", async () => {
    const pending = deferred(); boundary.review.mockReturnValueOnce(pending.promise);
    await openDetail(finalized(true));
    expect(screen.getByRole("button", { name: "Đang kiểm tra đánh giá..." })).toBeDisabled();
    await act(async () => pending.reject(new Error("Lookup failed")));
    fireEvent.click(await screen.findByRole("button", { name: "Thử tải đánh giá" }));
    expect(await screen.findByRole("button", { name: /Đánh giá nhanh/ })).toBeEnabled();
    expect(boundary.review.mock.calls).toEqual([["trip-a-item"], ["trip-a-item"]]);
  });
  it("Review requires rating, limits tags to three/comment to 1000, locks POST and preserves payload", async () => {
    const dialog = await openReview(); const ui = within(dialog);
    expect(ui.getByRole("button", { name: "Gửi đánh giá" })).toBeDisabled();
    fireEvent.click(ui.getByRole("button", { name: "4 sao" }));
    for (const n of [1, 2, 3, 4]) fireEvent.click(ui.getByRole("button", { name: `Review tag ${n}` }));
    expect(ui.getByRole("button", { name: "Review tag 4" })).toHaveAttribute("aria-pressed", "false");
    const comment = ui.getByRole("textbox", { name: "Nhận xét thêm" }); expect(comment).toHaveAttribute("maxlength", "1000");
    fireEvent.change(comment, { target: { value: " Nice place " } });
    const pending = deferred(); boundary.submitReview.mockReturnValue(pending.promise);
    const send = ui.getByRole("button", { name: "Gửi đánh giá" }); fireEvent.click(send); fireEvent.click(send);
    expect(boundary.submitReview.mock.calls).toEqual([["trip-a-item", { rating: 4, quickTags: ["tag1", "tag2", "tag3"], comment: " Nice place " }]]);
    expect(ui.getByRole("button", { name: "Để sau" })).toBeDisabled();
    await act(async () => pending.resolve({ rating: 4 }));
    fireEvent.click(screen.getByRole("button", { name: "Quay lại lịch trình" }));
    expect(screen.getByText("Đã đánh giá 4/5")).toBeInTheDocument();
  });
  it.each(["item_not_visited", "review_already_exists", "review_requires_persisted_user"])("keeps Review server error %s without success", async (code) => {
    const ui = within(await openReview()); boundary.submitReview.mockRejectedValue(Object.assign(new Error("Denied"), { code }));
    fireEvent.click(ui.getByRole("button", { name: "3 sao" })); fireEvent.click(ui.getByRole("button", { name: "Gửi đánh giá" }));
    expect(await ui.findByRole("alert")).not.toBeEmptyDOMElement(); expect(screen.queryByText("Cảm ơn bạn!")).not.toBeInTheDocument();
  });
  it.each(["success", "review_not_found", "error"])("Review DELETE %s preserves confirmation, exact item and recovery", async (result) => {
    boundary.review.mockResolvedValue({ rating: 5 }); await openDetail(finalized(true));
    fireEvent.click(await screen.findByRole("button", { name: "Xoá đánh giá PRIVATE_ACCOUNT_A" }));
    fireEvent.click(screen.getByRole("button", { name: "Giữ lại" })); expect(boundary.deleteReview).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Xoá đánh giá PRIVATE_ACCOUNT_A" }));
    const pending = deferred(); boundary.deleteReview.mockReturnValue(pending.promise);
    fireEvent.click(screen.getByRole("button", { name: "Xoá đánh giá", exact: true }));
    expect(screen.getByRole("button", { name: "Giữ lại" })).toBeDisabled();
    await act(async () => result === "success" ? pending.resolve() : pending.reject(Object.assign(new Error("Delete failed"), { code: result, status: 403 })));
    expect(boundary.deleteReview.mock.calls).toEqual([["trip-a-item"]]);
    if (result === "error") expect(within(screen.getByRole("dialog")).getByRole("alert")).toHaveTextContent("Phiên đăng nhập");
    else expect(await screen.findByRole("button", { name: /Đánh giá nhanh/ })).toBeInTheDocument();
  });
  it("whole-Trip Feedback remains one tag, no stars, independent from Place Review", async () => {
    await openDetail(finalized());
    const section = screen.getByRole("heading", { name: "Chuyến đi này thế nào?" }).closest("section"); const ui = within(section);
    await ui.findByRole("button", { name: "Trip good" });
    expect(ui.queryByRole("button", { name: "5 sao" })).not.toBeInTheDocument();
    expect(ui.getByRole("button", { name: "Gửi phản hồi" })).toBeDisabled();
    fireEvent.click(ui.getByRole("button", { name: "Trip good" })); fireEvent.click(ui.getByRole("button", { name: "Trip fair" }));
    expect(ui.getByRole("button", { name: "Trip good" })).toHaveAttribute("aria-pressed", "false");
    boundary.submitFeedback.mockResolvedValue({ quickTag: "fair", createdAt: "2026-10-09" });
    fireEvent.click(ui.getByRole("button", { name: "Gửi phản hồi" })); await ui.findByText(/Bạn đã gửi phản hồi ngày/);
    expect(boundary.submitFeedback.mock.calls).toEqual([[{ tripId: "trip-a", quickTag: "fair", comment: "" }]]);
    expect(boundary.submitReview).not.toHaveBeenCalled();
  });
  it("Feedback duplicate reloads authoritative GET instead of adding edit/delete workflow", async () => {
    await openDetail(finalized());
    fireEvent.click(await screen.findByRole("button", { name: "Trip good" }));
    boundary.submitFeedback.mockRejectedValue(Object.assign(new Error("Duplicate"), { code: "feedback_already_exists" }));
    boundary.feedback.mockResolvedValue({ quickTag: "great", comment: "Already recorded", createdAt: "2026-10-09" });
    fireEvent.click(screen.getByRole("button", { name: "Gửi phản hồi" }));
    await screen.findByText("Already recorded"); expect(boundary.feedback).toHaveBeenCalledTimes(2);
  });
  it.each(["draft", "finalized"])("actual Export opens without generation; %s PDF/PNG remain enabled and ICS eligibility preserved", async (status) => {
    await openDetail(status === "draft" ? detailA : finalized());
    const entry = screen.getByRole("button", { name: "Xuất lịch trình" }); entry.focus(); fireEvent.click(entry);
    const ui = within(screen.getByRole("dialog", { name: "Xuất lịch trình" }));
    expect(ui.getByRole("button", { name: "Tạo PDF" })).toBeEnabled(); expect(ui.getByRole("button", { name: "Tạo ảnh" })).toBeEnabled();
    expect(ui.getByRole("button", { name: "Tạo file lịch" }).disabled).toBe(status === "draft");
    expect(boundary.pdf).not.toHaveBeenCalled(); expect(boundary.png).not.toHaveBeenCalled(); expect(boundary.calendar).not.toHaveBeenCalled();
    expect(ui.getByRole("button", { name: "Đóng cửa sổ xuất lịch trình" })).toHaveFocus();
    fireEvent.keyDown(window, { key: "Escape" }); expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); expect(entry).toHaveFocus();
  });
  it.each(["PDF", "ảnh", "file lịch"])("actual Export %s uses mock generator and browser download boundary only", async (format) => {
    await openDetail(finalized()); fireEvent.click(screen.getByRole("button", { name: "Xuất lịch trình" }));
    const ui = within(screen.getByRole("dialog")); fireEvent.click(ui.getByRole("button", { name: `Tạo ${format}` }));
    const label = format === "PDF" ? /Tải PDF/ : format === "ảnh" ? /Tải ảnh/ : /Tải lịch .ics/;
    fireEvent.click(await ui.findByRole("button", { name: label })); expect(boundary.download).toHaveBeenCalledTimes(1);
    expect(boundary.download.mock.calls[0][1]).toMatch(format === "PDF" ? /\.pdf$/ : format === "ảnh" ? /\.png$/ : /\.ics$/);
    const generator = format === "PDF" ? boundary.pdf : format === "ảnh" ? boundary.png : boundary.calendar;
    expect(generator).toHaveBeenCalledTimes(1); expect(generator.mock.calls[0][0].tripId).toBe("trip-a");
  });
  it("Export generation guard blocks parallel generation and Escape, then recovers error/retry", async () => {
    const pending = deferred(); boundary.pdf.mockReturnValueOnce(pending.promise);
    await openDetail(); fireEvent.click(screen.getByRole("button", { name: "Xuất lịch trình" }));
    fireEvent.click(screen.getByRole("button", { name: "Tạo PDF" }));
    expect(screen.getByRole("button", { name: "Tạo ảnh" })).toBeDisabled(); fireEvent.keyDown(window, { key: "Escape" });
    await act(async () => pending.reject(new Error("Generator failed")));
    expect(await screen.findByRole("alert")).toHaveTextContent("Không thể tạo PDF");
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" })); expect(await screen.findByRole("button", { name: /Tải PDF/ })).toBeEnabled();
    expect(boundary.png).not.toHaveBeenCalled();
  });
});

function SaveJourney() {
  const { setCurrentTrip } = useTrip();
  return <><button onClick={() => setCurrentTrip(finalized())}>Load in-memory finalized fixture</button>
    <Routes><Route path="/finalized" element={<FinalizedItineraryPage />} /><Route path="/trips" element={<MyTripsPage />} /><Route path="/trips/:tripId" element={<SavedTripDetailPage />} /></Routes></>;
}
it("actual A5 Save reaches actual A6 list and detail with one ID and no duplicate/phantom records", async () => {
  boundary.getTrips.mockResolvedValue([]); boundary.save.mockResolvedValue(finalized()); boundary.getTripById.mockResolvedValue(finalized());
  render(<MemoryRouter initialEntries={["/finalized"]}><TripProvider><SaveJourney /><ContextEvidence /></TripProvider></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Load in-memory finalized fixture" }));
  await waitFor(() => expect(screen.getByTestId("context-state")).toHaveTextContent('"current":"trip-a"'));
  fireEvent.click(screen.getByRole("button", { name: /Lưu lịch trình/ }));
  fireEvent.click(await screen.findByRole("button", { name: "Xem My Trips" }));
  fireEvent.click(await screen.findByRole("link", { name: finalized().title }));
  await screen.findByRole("heading", { level: 1, name: finalized().title });
  expect(boundary.save.mock.calls).toEqual([["trip-a"]]); expect(boundary.getTripById.mock.calls).toEqual([["trip-a"]]);
  expect(JSON.parse(screen.getByTestId("context-state").textContent).saved).toEqual(["trip-a"]);
});
