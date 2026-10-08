import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import MetroStationsPage from "../src/pages/metro/MetroStationsPage";
import { masterDataService } from "../src/services/masterDataService";
import { metroService } from "../src/services/metroService";
import PlacePreviewPage from "../src/pages/trip/PlacePreviewPage";
import { placeService } from "../src/services/placeService";
import * as mapsApp from "../src/utils/openGoogleMapsApp";
import MapEmbedPreview from "../src/components/MapEmbedPreview";
import PlaceReviews, { PlaceRatingSummary } from "../src/components/place/PlaceReviews";
import { buildDirectionsUrl, buildMapsSearchUrl, buildMapEmbedUrl } from "../src/utils/googleMaps";
import HomeSearch from "../src/components/home/HomeSearch";
import { searchService } from "../src/services/searchService";
import { formatVnDate } from "../src/utils/subscriptionUtils";

const stations = Array.from({ length: 14 }, (_, index) => ({ id: `s${index + 1}`, order: index + 1, name: index === 0 ? "Bến Thành" : index === 13 ? "Bến xe Suối Tiên" : `Ga số ${index + 1}` }));
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const journeyData = (extra = {}) => ({
  from: stations[0], to: stations[13], towardStationName: "Bến xe Suối Tiên",
  stopCount: 13, travelMinutes: 29, isEstimated: true, precision: "Headway", isWithinEffectivePeriod: true,
  trips: [{ departure: "10:00:00", arrival: "10:29:00" }, { departure: "10:10:00", arrival: "10:39:00" }, { departure: "10:20:00", arrival: "10:49:00" }],
  headways: [{ from: "05:00:00", to: "23:00:00", minutes: 10 }], ...extra,
});

describe("USER-A3 Maps contracts", () => {
  it("keeps collapsed state, expansion/load/collapse and iframe attributes", () => {
    render(<MapEmbedPreview lat={10.77} lng={106.69} placeName="Chợ Bến Thành" googlePlaceId="google-p1" height="300px" />);
    expect(screen.queryByTitle("Bản đồ Chợ Bến Thành")).not.toBeInTheDocument();
    const expand = screen.getByRole("button", { name: "Xem bản đồ" });
    expect(expand).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(expand);
    const iframe = screen.getByTitle("Bản đồ Chợ Bến Thành");
    expect(iframe).toHaveAttribute("src", buildMapEmbedUrl(10.77, 106.69, "Chợ Bến Thành"));
    expect(iframe).toHaveAttribute("loading", "lazy");
    expect(iframe).toHaveAttribute("allowfullscreen");
    expect(iframe).toHaveAttribute("referrerpolicy", "no-referrer-when-downgrade");
    expect(iframe.parentElement).toHaveStyle({ height: "300px" });
    expect(screen.getByRole("status")).toHaveTextContent("Đang tải Google Maps...");
    fireEvent.load(iframe);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Thu gọn bản đồ" }));
    expect(screen.queryByTitle("Bản đồ Chợ Bến Thành")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Xem bản đồ" }));
    expect(screen.getByRole("status")).toBeVisible();
  });
  it("preserves initExpanded and fallback title/address", () => {
    render(<MapEmbedPreview lat={10.77} lng={106.69} address="Địa chỉ từ API" initExpanded />);
    expect(screen.getByTitle("Bản đồ địa điểm")).toBeInTheDocument();
    expect(screen.getByText("Địa chỉ từ API")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Xem bản đồ" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mở Google Maps" }));
    expect(mapsApp.openGoogleMapsApp).toHaveBeenCalledWith(expect.objectContaining({ lat: 10.77, lng: 106.69, query: undefined, placeId: undefined }));
  });
  it.each([null, 0])("preserves existing missing-coordinate condition for %s", (lat) => {
    render(<MapEmbedPreview lat={lat} lng={106.69} initExpanded />);
    expect(screen.getByText("Chưa có tọa độ bản đồ cho địa điểm này.")).toBeVisible();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
  it("keeps long name and external search/deeplink without new geolocation", () => {
    const name = "Tên địa điểm dài ".repeat(15);
    mapsApp.openGoogleMapsApp.mockRestore();
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<MapEmbedPreview lat={10.77} lng={106.69} placeName={name} googlePlaceId="google-p1" />);
    expect(screen.getByText(name.trim())).toHaveAttribute("title", name);
    fireEvent.click(screen.getByRole("button", { name: "Mở Google Maps" }));
    expect(open).toHaveBeenCalledWith(buildMapsSearchUrl({ lat: 10.77, lng: 106.69, query: name, placeId: "google-p1" }), "_blank", "noopener,noreferrer");
    expect(buildDirectionsUrl({ destLat: 10.77, destLng: 106.69, destName: name, destPlaceId: "google-p1" })).toContain("destination_place_id=google-p1");
  });
});

const reviewRow = (id, extra = {}) => ({ id, reviewerName: `Người ghé ${id}`, createdAt: "2026-10-07T03:00:00Z", rating: 4, comment: `Nhận xét ${id}`, quickTags: ["Friendly"], ...extra });
const renderReviews = (props = {}) => render(<PlaceReviews placeId="p1" averageRating={4.3} reviewCount={20} {...props} />);
describe("USER-A3 Reviews contracts", () => {
  it("keeps null aggregate distinct from zero and skips requests for no reviews", () => {
    renderReviews({ averageRating: null, reviewCount: 0 });
    expect(screen.getByText("Chưa có đánh giá")).toBeVisible();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(placeService.getPlaceReviews).not.toHaveBeenCalled();
    expect(masterDataService.getMasterData).not.toHaveBeenCalled();
  });
  it("displays a real zero aggregate without converting it to null", () => {
    render(<PlaceRatingSummary averageRating={0} reviewCount={1} />);
    expect(screen.getByText("0,0")).toBeVisible();
    expect(screen.getByRole("img", { name: "0 trên 5 sao" })).toBeVisible();
  });
  it("uses pageSize10, original sort options and master labels", async () => {
    masterDataService.getMasterData.mockResolvedValue({ reviewQuickTags: [{ code: "Friendly", label: "Thân thiện" }] });
    placeService.getPlaceReviews.mockResolvedValue({ items: [reviewRow("r1")], totalPages: 1 });
    renderReviews();
    await screen.findByText("Người ghé r1");
    expect(placeService.getPlaceReviews).toHaveBeenCalledWith("p1", { page: 1, pageSize: 10, sortBy: "createdAt", sortDirection: "desc", rating: "" });
    expect(within(screen.getByLabelText("Sắp xếp đánh giá")).getAllByRole("option").map(el => el.value)).toEqual(["createdAt:desc", "rating:desc", "rating:asc"]);
    expect(screen.getByText("Thân thiện")).toBeVisible();
    expect(screen.getByText(formatVnDate("2026-10-07T03:00:00Z"))).toBeVisible();
    expect(screen.getByRole("img", { name: "4 trên 5 sao" })).toBeVisible();
  });
  it("falls back to raw quick-tag code if master labels fail", async () => {
    masterDataService.getMasterData.mockRejectedValue(new Error("labels offline"));
    placeService.getPlaceReviews.mockResolvedValue({ items: [reviewRow("r1")], totalPages: 1 });
    renderReviews();
    expect(await screen.findByText("Friendly")).toBeVisible();
  });
  it("appends Load More with cross-page ID dedup and resets page on rating/sort", async () => {
    placeService.getPlaceReviews.mockImplementation((_id, query) => Promise.resolve({ items: query.page === 1 ? [reviewRow("r1")] : [reviewRow("r1"), reviewRow("r2")], totalPages: 2 }));
    renderReviews();
    await screen.findByText("Người ghé r1");
    fireEvent.click(screen.getByRole("button", { name: "Xem thêm đánh giá" }));
    await screen.findByText("Người ghé r2");
    expect(screen.getAllByText("Người ghé r1")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Xem thêm đánh giá" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Lọc theo số sao"), { target: { value: "5" } });
    await waitFor(() => expect(placeService.getPlaceReviews).toHaveBeenLastCalledWith("p1", { page: 1, pageSize: 10, sortBy: "createdAt", sortDirection: "desc", rating: "5" }));
    fireEvent.change(screen.getByLabelText("Sắp xếp đánh giá"), { target: { value: "rating:asc" } });
    await waitFor(() => expect(placeService.getPlaceReviews).toHaveBeenLastCalledWith("p1", { page: 1, pageSize: 10, sortBy: "rating", sortDirection: "asc", rating: "5" }));
    expect(screen.getByText("4,3")).toBeVisible();
    expect(screen.getByText("(20 đánh giá)")).toBeVisible();
  });
  it("retains previous rows while loading next page and disables repeated load", async () => {
    const next = deferred();
    placeService.getPlaceReviews.mockResolvedValueOnce({ items: [reviewRow("r1")], totalPages: 3 }).mockReturnValueOnce(next.promise);
    renderReviews();
    await screen.findByText("Người ghé r1");
    fireEvent.click(screen.getByRole("button", { name: "Xem thêm đánh giá" }));
    expect(screen.getByRole("button", { name: "Xem thêm đánh giá" })).toBeDisabled();
    expect(screen.getByText("Đang tải đánh giá...")).toHaveAttribute("role", "status");
    expect(screen.getByText("Người ghé r1")).toBeVisible();
    await act(async () => next.resolve({ items: [reviewRow("r2")], totalPages: 3 }));
    expect(screen.getByText("Người ghé r2")).toBeVisible();
  });
  it("ignores stale results after filters change", async () => {
    const obsolete = deferred();
    placeService.getPlaceReviews.mockReturnValueOnce(obsolete.promise).mockResolvedValue({ items: [reviewRow("new")], totalPages: 1 });
    renderReviews();
    fireEvent.change(screen.getByLabelText("Lọc theo số sao"), { target: { value: "2" } });
    await screen.findByText("Người ghé new");
    await act(async () => obsolete.resolve({ items: [reviewRow("old")], totalPages: 1 }));
    expect(screen.queryByText("Người ghé old")).not.toBeInTheDocument();
    expect(screen.getByText("4,3")).toBeVisible();
  });
  it("keeps error/retry distinct from empty result", async () => {
    placeService.getPlaceReviews.mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ items: [], totalPages: 0 });
    renderReviews();
    expect(await screen.findByRole("alert")).toHaveTextContent("Không tải được đánh giá.");
    expect(screen.queryByText("Chưa có đánh giá.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByText("Chưa có đánh giá.")).toBeVisible();
    fireEvent.change(screen.getByLabelText("Lọc theo số sao"), { target: { value: "1" } });
    expect(await screen.findByText("Chưa có đánh giá 1 sao.")).toBeVisible();
    expect(placeService.getPlaceReviews).toHaveBeenCalledTimes(3);
  });
  it("keeps long text, raw unknown tags and review controls read-only", async () => {
    const comment = "Bình luận rất dài\n".repeat(50);
    const name = "Người dùng với tên dài ".repeat(12);
    const code = "UnknownQuickTag".repeat(15);
    placeService.getPlaceReviews.mockResolvedValue({ items: [reviewRow("long", { reviewerName: name, comment, quickTags: [code] })], totalPages: 1 });
    renderReviews();
    expect(await screen.findByText(name.trim())).toBeVisible();
    expect(screen.getByText(code)).toBeVisible();
    expect(screen.getByText(comment.trim().replace(/\s+/g, " "))).toBeVisible();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    screen.getByLabelText("Lọc theo số sao").focus();
    expect(screen.getByLabelText("Lọc theo số sao")).toHaveFocus();
  });
});

describe("USER-A3 Search/Metro integration", () => {
  it("uses actual Home Search station route state to open selected Metro station", async () => {
    const station = { id: "s5", order: 5, name: "Ga số 5" };
    vi.spyOn(searchService, "search").mockResolvedValue({ stations: { items: [station], hasMore: false }, places: { items: [], hasMore: false }, curatedItineraries: { items: [], hasMore: false }, semanticPlaces: { items: [], hasMore: false } });
    render(<MemoryRouter initialEntries={["/home"]}><Routes><Route path="/home" element={<HomeSearch />} /><Route path="/metro" element={<MetroStationsPage />} /></Routes><LocationValue /></MemoryRouter>);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Ga số" } });
    fireEvent.click(await screen.findByRole("button", { name: /Ga số 5/ }));
    expect(await screen.findByRole("button", { name: "05 · Ga số 5" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("tab", { name: "Theo ga" })).toHaveAttribute("aria-selected", "true");
    await waitFor(() => expect(metroService.getDepartures).toHaveBeenCalledWith("5", "2026-10-08"));
  });
});
const departureData = (directions = [1, 2]) => ({
  isWithinEffectivePeriod: true, precision: "Headway", notice: "Thông báo lịch từ máy chủ",
  directions: directions.map((direction) => ({ direction, towardStationName: direction === 1 ? "Bến Thành" : "Bến xe Suối Tiên", departures: ["10:00:00", "10:10:00"], headways: [{ from: "05:00:00", to: "23:00:00", minutes: 10 }] })),
});
function LocationValue() { const location = useLocation(); return <output aria-label="Route">{location.pathname}</output>; }
function renderMetro(state) {
  return render(<MemoryRouter initialEntries={[{ pathname: "/metro", state }]}><MetroStationsPage /><LocationValue /></MemoryRouter>);
}
function placeData(extra = {}) {
  return { id: "p1", name: "Chợ Bến Thành", category: "Culture", imageUrl: "https://example.test/place.jpg", matchScore: 85,
    address: "Quận 1, TP.HCM", area: "Bến Thành", latitude: 10.77, longitude: 106.69, googlePlaceId: "google-p1",
    estimatedCostMin: 0, estimatedCostMax: 0, suggestedDurationMinutes: 90, bestTimeToVisit: "Buổi sáng",
    tags: [{ id: "tag1", name: "Văn hóa" }], description: "Thông tin thật từ API", insights: ["Gần ga Metro"], notes: ["Kiểm tra giờ mở cửa"],
    nearestStation: { stationName: "Bến Thành", distanceMeters: 200 }, isVerified: true, averageRating: 4.3, reviewCount: 0, ...extra };
}
function renderPlace(id = "p1") {
  return render(<MemoryRouter initialEntries={["/previous", `/place/${id}`]} initialIndex={1}><Routes>
    <Route path="/place/:placeId" element={<PlacePreviewPage />} />
    <Route path="/previous" element={<h1>Previous timeline</h1>} />
  </Routes><LocationValue /></MemoryRouter>);
}
beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(new Date("2026-10-08T02:55:00Z").getTime());
  vi.spyOn(masterDataService, "getMasterData").mockResolvedValue({ metroStations: [...stations].reverse(), reviewQuickTags: [] });
  vi.spyOn(metroService, "getJourney").mockResolvedValue(journeyData());
  vi.spyOn(metroService, "getDepartures").mockResolvedValue(departureData());
  vi.spyOn(placeService, "getPlaceById").mockResolvedValue(placeData());
  vi.spyOn(placeService, "getPlaceReviews").mockResolvedValue({ items: [], totalPages: 0 });
  vi.spyOn(mapsApp, "openGoogleMapsApp").mockImplementation(() => {});
});

describe("USER-A3 Place detail contracts", () => {
  it("keeps placeId fetch, real identity/media, static metadata and badges", async () => {
    renderPlace();
    expect(screen.getByText("Đang tải...")).toHaveAttribute("role", "status");
    expect(await screen.findByRole("heading", { level: 1, name: "Chợ Bến Thành" })).toBeVisible();
    expect(placeService.getPlaceById).toHaveBeenCalledWith("p1");
    expect(screen.getByRole("img", { name: "Chợ Bến Thành" })).toHaveAttribute("src", "https://example.test/place.jpg");
    for (const text of ["Culture", "85% phù hợp", "Quận 1, TP.HCM", "Miễn phí", "1h30p", "Buổi sáng", "Thông tin thật từ API", "Văn hóa", "LocalMate Verified"]) expect(screen.getByText(text)).toBeVisible();
    expect(screen.getByText(/Bến Thành · 200m/)).toBeVisible();
    expect(screen.getByText("Gần ga Metro")).toBeVisible();
    expect(screen.getByText(/Kiểm tra giờ mở cửa/)).toBeVisible();
    expect(screen.getAllByRole("img", { name: "4.3 trên 5 sao" })).toHaveLength(2);
    expect(screen.getByTitle("Bản đồ Chợ Bến Thành")).toHaveAttribute("src", expect.stringContaining("q=10.77%2C106.69"));
  });
  it.each([null, "rejection"])("keeps missing/error fallback for %s without new requests", async (kind) => {
    if (kind === null) placeService.getPlaceById.mockResolvedValue(null);
    else placeService.getPlaceById.mockRejectedValue(new Error("404"));
    renderPlace("absent");
    expect(await screen.findByText("Không tìm thấy địa điểm.")).toBeVisible();
    expect(placeService.getPlaceReviews).not.toHaveBeenCalled();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
  it("keeps image/match/optional field conditions and neutral unrated state", async () => {
    placeService.getPlaceById.mockResolvedValue(placeData({ imageUrl: null, matchScore: null, address: null, suggestedDurationMinutes: null, bestTimeToVisit: null, description: null, tags: [], insights: [], notes: [], nearestStation: null, isVerified: false, averageRating: null }));
    renderPlace();
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByText(/phù hợp/)).not.toBeInTheDocument();
    for (const text of ["Địa chỉ", "Thời gian", "Nên đến", "Vì sao LocalMate đề xuất?", "Lưu ý", "LocalMate Verified"]) expect(screen.queryByText(text)).not.toBeInTheDocument();
    expect(screen.getAllByText("Chưa có đánh giá")).toHaveLength(2);
    expect(screen.getByText("Miễn phí")).toBeVisible();
  });
  it("preserves nonzero cost format and full long server content", async () => {
    const long = "Địa điểm với tên tiếng Việt rất dài ".repeat(8);
    placeService.getPlaceById.mockResolvedValue(placeData({ name: long, address: long, description: long, category: "DanhMụcRấtDài".repeat(8), tags: [{ id: "long", name: long }], estimatedCostMin: 35000, estimatedCostMax: 1500000 }));
    renderPlace();
    expect(await screen.findByRole("heading", { level: 2 })).toHaveTextContent(long.trim());
    expect(screen.getByRole("heading", { level: 1 })).toHaveAttribute("title", long);
    expect(screen.getByText("35k–1.5tr")).toBeVisible();
    expect(screen.getAllByText(long.trim())).toHaveLength(6);
  });
  it("retains Maps directions and preview search destination identities", async () => {
    renderPlace();
    await screen.findByRole("heading", { level: 1 });
    fireEvent.click(screen.getByRole("button", { name: "Mở Google Maps chỉ đường" }));
    expect(mapsApp.openGoogleMapsApp).toHaveBeenLastCalledWith(expect.objectContaining({ destLat: 10.77, destLng: 106.69, destName: "Chợ Bến Thành", destPlaceId: "google-p1" }));
    fireEvent.click(screen.getByRole("button", { name: "Mở Google Maps", exact: true }));
    expect(mapsApp.openGoogleMapsApp).toHaveBeenLastCalledWith(expect.objectContaining({ lat: 10.77, lng: 106.69, query: "Chợ Bến Thành", placeId: "google-p1", destLat: undefined }));
  });
  it.each(["Quay lại", "Giữ trong lịch trình", "Quay lại timeline"])("%s remains history back only", async (name) => {
    renderPlace();
    await screen.findByRole("heading", { level: 1 });
    fireEvent.click(screen.getByRole("button", { name, exact: true }));
    expect(await screen.findByRole("heading", { name: "Previous timeline" })).toBeVisible();
    expect(screen.getByLabelText("Route")).toHaveTextContent("/previous");
    expect(mapsApp.openGoogleMapsApp).not.toHaveBeenCalled();
  });
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("USER-A3 Metro contracts", () => {
  it("keeps both modes and default journey arguments in Vietnam date", async () => {
    renderMetro();
    expect(screen.getByRole("tab", { name: "Ga đi → Ga đến" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Theo ga" })).toHaveAttribute("aria-selected", "false");
    await screen.findByLabelText("Ga đi");
    expect(screen.getByLabelText("Ga đi")).toHaveValue("1");
    expect(screen.getByLabelText("Ga đến")).toHaveValue("14");
    expect(metroService.getJourney).toHaveBeenCalledWith("1", "14", "2026-10-08");
    expect(screen.getByText(/không phải giờ tàu chạy thật/)).toBeVisible();
  });
  it("sorts master stations, excludes origin, preserves collision fallback and swap", async () => {
    renderMetro();
    const origin = await screen.findByLabelText("Ga đi");
    expect(within(origin).getAllByRole("option").map(el => el.value)).toEqual(stations.map(s => String(s.order)));
    expect(within(screen.getByLabelText("Ga đến")).queryByRole("option", { name: "01 · Bến Thành" })).not.toBeInTheDocument();
    fireEvent.change(origin, { target: { value: "14" } });
    expect(screen.getByLabelText("Ga đến")).toHaveValue("13");
    await waitFor(() => expect(metroService.getJourney).toHaveBeenLastCalledWith("14", "13", "2026-10-08"));
    fireEvent.click(screen.getByRole("button", { name: "Đổi chiều ga đi và ga đến" }));
    await waitFor(() => expect(metroService.getJourney).toHaveBeenLastCalledWith("13", "14", "2026-10-08"));
  });
  it("opens station mode from Home Search route state and retains station selection", async () => {
    renderMetro({ stationOrder: 5 });
    expect(screen.getByRole("tab", { name: "Theo ga" })).toHaveAttribute("aria-selected", "true");
    const chip = await screen.findByRole("button", { name: "05 · Ga số 5" });
    expect(chip).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(metroService.getDepartures).toHaveBeenCalledWith("5", "2026-10-08"));
    fireEvent.click(screen.getByRole("button", { name: "01 · Bến Thành" }));
    await waitFor(() => expect(metroService.getDepartures).toHaveBeenLastCalledWith("1", "2026-10-08"));
    expect(metroService.getJourney).not.toHaveBeenCalled();
  });
  it("switches modes and renders server directions including terminals", async () => {
    metroService.getDepartures.mockResolvedValue(departureData([2]));
    renderMetro();
    await screen.findByLabelText("Ga đi");
    fireEvent.click(screen.getByRole("tab", { name: "Theo ga" }));
    await screen.findByRole("heading", { name: /Hướng Bến xe Suối Tiên/ });
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(1);
    fireEvent.click(screen.getByRole("tab", { name: "Ga đi → Ga đến" }));
    expect(await screen.findByLabelText("Ga đi")).toHaveValue("1");
  });
  it("retains upcoming, duration, stop count, headway and schedule warnings", async () => {
    metroService.getJourney.mockResolvedValue(journeyData({ notice: "Lịch mẫu đã cập nhật", isWithinEffectivePeriod: false }));
    renderMetro();
    expect(await screen.findByText(/Chuyến đầu 10:00 → tới 10:29/)).toBeVisible();
    expect(screen.getByText(/13 ga · khoảng 29 phút · khoảng 10 phút\/chuyến/)).toBeVisible();
    expect(screen.getByText(/Tiếp theo: 10:10 → 10:39 · 10:20 → 10:49/)).toBeVisible();
    expect(screen.getByText(/Chuyến đầu 10:00 · chuyến cuối 10:20/)).toBeVisible();
    expect(screen.getByText(/Lịch mẫu đã cập nhật/)).toBeVisible();
    expect(screen.getByText(/Lịch có thể đã thay đổi/)).toBeVisible();
    expect(screen.getByText(/Giờ ước tính theo tần suất/)).toBeVisible();
  });
  it("shows next rather than first after service starts without adding tomorrow fetch", async () => {
    Date.now.mockReturnValue(new Date("2026-10-08T03:01:00Z").getTime());
    renderMetro();
    expect(await screen.findByText(/Chuyến kế 10:10 → tới 10:39.*sau 9 phút/)).toBeVisible();
    expect(metroService.getJourney).toHaveBeenCalledTimes(1);
  });
  it("requests next-day journey after last trip and formats the first tomorrow", async () => {
    Date.now.mockReturnValue(new Date("2026-10-08T16:00:00Z").getTime());
    metroService.getJourney.mockImplementation((_from, _to, date) => Promise.resolve(date === "2026-10-09" ? journeyData({ trips: [{ departure: "05:00:00", arrival: "05:29:00" }] }) : journeyData()));
    renderMetro();
    expect(await screen.findByText("Đã hết chuyến hôm nay")).toBeVisible();
    expect(await screen.findByText(/Chuyến đầu ngày mai 05:00 → 05:29/)).toBeVisible();
    expect(metroService.getJourney).toHaveBeenCalledWith("1", "14", "2026-10-09");
  });
  it("requests next-day station directions only after end of service", async () => {
    Date.now.mockReturnValue(new Date("2026-10-08T16:00:00Z").getTime());
    metroService.getDepartures.mockImplementation((_station, date) => Promise.resolve(date === "2026-10-09" ? { ...departureData([2]), directions: [{ direction: 2, towardStationName: "Bến xe Suối Tiên", departures: ["05:10:00"], headways: [] }] } : departureData([2])));
    renderMetro({ stationOrder: 1 });
    expect(await screen.findByText(/Chuyến đầu ngày mai lúc 05:10/)).toBeVisible();
    expect(metroService.getDepartures).toHaveBeenCalledWith("1", "2026-10-09");
  });
  it("preserves loading, server-error retry, and master-data error", async () => {
    const pending = deferred();
    metroService.getJourney.mockReturnValueOnce(pending.promise);
    renderMetro();
    expect(await screen.findByText("Đang tải lịch tàu...")).toHaveAttribute("role", "status");
    await act(async () => pending.reject(new Error("Lịch tạm thời không sẵn sàng")));
    expect(screen.getByRole("alert")).toHaveTextContent("Lịch tạm thời không sẵn sàng");
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByText(/Chuyến đầu 10:00 →/)).toBeVisible();
    expect(metroService.getJourney).toHaveBeenCalledTimes(2);
  });
  it("does not invent stations when master-data request fails", async () => {
    masterDataService.getMasterData.mockRejectedValue(new Error("offline"));
    renderMetro();
    expect(await screen.findByRole("alert")).toHaveTextContent("Không tải được danh sách ga.");
    expect(metroService.getJourney).not.toHaveBeenCalled();
  });
  it("ignores obsolete journey results after selector changes", async () => {
    const old = deferred();
    metroService.getJourney.mockReturnValueOnce(old.promise);
    renderMetro();
    fireEvent.change(await screen.findByLabelText("Ga đi"), { target: { value: "2" } });
    await screen.findByText(/Chuyến đầu 10:00 →/);
    await act(async () => old.resolve(journeyData({ notice: "OBSOLETE" })));
    expect(screen.queryByText(/OBSOLETE/)).not.toBeInTheDocument();
  });
  it("updates at 30 seconds without API polling, using Vietnam date even across UTC boundary", async () => {
    Date.now.mockRestore();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-07T17:00:00Z"));
    renderMetro();
    await act(async () => {});
    expect(metroService.getJourney).toHaveBeenCalledWith("1", "14", "2026-10-08");
    await act(async () => vi.advanceTimersByTime(90000));
    expect(metroService.getJourney).toHaveBeenCalledTimes(1);
    expect(masterDataService.getMasterData).toHaveBeenCalledTimes(1);
  });
});
