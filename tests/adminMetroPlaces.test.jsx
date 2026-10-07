import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminStationsPage from "../src/pages/admin/AdminStationsPage";
import AdminPlaceListPage from "../src/pages/admin/AdminPlaceListPage";
import AdminPlaceDetailPage from "../src/pages/admin/AdminPlaceDetailPage";
import PlaceFilterBar from "../src/components/admin/PlaceFilterBar";
import { PlaceStatusToggle, VerifiedBadge } from "../src/components/admin/VerifiedBadge";
import DeletePlaceDialog from "../src/components/admin/DeletePlaceDialog";

const mocks = vi.hoisted(() => ({
  auth: { user: { permissions: ["ManagePlaces", "ManageSettings"] } },
  stations: { getStations: vi.fn() },
  places: { getPlaces: vi.fn(), getPlaceById: vi.fn(), updatePlaceStatus: vi.fn(), deletePlace: vi.fn() },
}));
vi.mock("../src/context/AuthContext", () => ({ useAuth: () => mocks.auth }));
vi.mock("../src/services/adminStationService", () => ({ adminStationService: mocks.stations }));
vi.mock("../src/services/adminPlaceService", () => ({ adminPlaceService: mocks.places }));
const station = (id, order, name) => ({ id, order, name, totals: { active: 5, pending: 2, inactive: 1, total: 8 }, categories: [{ category: "Food", active: 5, pending: 2 }], missingCategories: [], isUnderstocked: false });
const coverage = { radiusMeters: 800, minActivePlacesPerStation: 5, understockedStationCount: 0, outsideCoverage: { active: 1, pending: 2, inactive: 3, total: 6 }, stations: [station("s2", 9, "Ga đầu từ server"), station("s1", 1, "Bến Thành")] };
const place = { id: "existing-12345", name: "Địa điểm thật từ API", category: "Food", status: "Pending", isVerified: false, address: "25 Hoàng Sa", estimatedCostMin: 30000, estimatedCostMax: 50000 };
const defaults = { page: 1, pageSize: 10, search: "", category: "", status: "", stationId: "" };
const pending = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };
function Location() { return <output aria-label="Đường dẫn">{useLocation().pathname}</output>; }
const mount = (element, path = "/admin/places") => render(<MemoryRouter initialEntries={[path]}><Routes><Route path="*" element={element} /><Route path="/admin/places/:id" element={element} /></Routes><Location /></MemoryRouter>);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.user = { permissions: ["ManagePlaces", "ManageSettings"] };
  mocks.stations.getStations.mockResolvedValue(coverage);
  mocks.places.getPlaces.mockResolvedValue({ items: [place], page: 1, pageSize: 10, totalCount: 11, totalPages: 2 });
  mocks.places.getPlaceById.mockResolvedValue(place);
  mocks.places.updatePlaceStatus.mockResolvedValue({});
  mocks.places.deletePlace.mockResolvedValue({});
  vi.spyOn(window, "alert").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
describe("A4 Stations", () => {
  it("keeps server order, exact metrics and one request across view changes", async () => {
    mount(<AdminStationsPage />, "/admin/stations");
    await screen.findByRole("heading", { name: "Ga Ga đầu từ server" });
    expect(screen.getAllByRole("article").slice(4).map((node) => within(node).getByRole("heading").textContent)).toEqual(["Ga Ga đầu từ server", "Ga Bến Thành"]);
    fireEvent.click(screen.getByRole("button", { name: "Dạng bảng" }));
    expect(screen.getAllByRole("row")[1]).toHaveTextContent("Ga đầu từ server");
    expect(screen.getByText(/Hiển thị 2 trên tổng số 2/)).toBeInTheDocument();
    expect(mocks.stations.getStations).toHaveBeenCalledTimes(1);
  });
  it("loading is owned by request, not zero metrics", async () => {
    const deferred = pending(); mocks.stations.getStations.mockReturnValue(deferred.promise);
    mount(<AdminStationsPage />);
    expect(screen.getByText("Đang tải nhà ga...")).toBeInTheDocument();
    await act(async () => deferred.resolve(coverage));
    expect(screen.queryByText("Đang tải nhà ga...")).not.toBeInTheDocument();
  });
  it("failed request displays unknown metrics, then retry", async () => {
    mocks.stations.getStations.mockRejectedValueOnce(new Error("Lỗi ga"));
    mount(<AdminStationsPage />);
    await screen.findByRole("alert");
    expect(screen.getAllByText("—")).toHaveLength(4);
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    await screen.findByRole("heading", { name: "Ga Bến Thành" });
  });
  it("client search does not fetch or reorder", async () => {
    mount(<AdminStationsPage />); await screen.findByRole("heading", { name: "Ga Bến Thành" });
    fireEvent.change(screen.getByLabelText("Tìm nhà ga"), { target: { value: " BẾN " } });
    expect(screen.queryByRole("heading", { name: "Ga Ga đầu từ server" })).not.toBeInTheDocument();
    expect(mocks.stations.getStations).toHaveBeenCalledTimes(1);
  });
  it("settings link retains its permission gate", async () => {
    mocks.auth.user = { permissions: ["ManagePlaces"] };
    mount(<AdminStationsPage />); await screen.findByRole("heading", { name: "Ga Bến Thành" });
    expect(screen.queryByRole("link", { name: /Đổi trong Cấu hình/ })).not.toBeInTheDocument();
  });
});
describe("A4 Places query and mutation contract", () => {
  it("same supplied rows drive table and cards; no second fetch or invented sort", async () => {
    mount(<AdminPlaceListPage />); await screen.findByRole("heading", { name: place.name });
    expect(within(screen.getByRole("table")).getByText(place.name)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: `Xem chi tiết ${place.name}` })).toHaveLength(2);
    expect(mocks.places.getPlaces).toHaveBeenCalledTimes(1);
    expect(mocks.places.getPlaces).toHaveBeenCalledWith(defaults);
    expect(screen.queryByRole("button", { name: /Sắp xếp/ })).not.toBeInTheDocument();
  });
  it("server page action changes only page", async () => {
    mount(<AdminPlaceListPage />); await screen.findByRole("heading", { name: place.name });
    fireEvent.click(screen.getByRole("button", { name: /Sau/ }));
    await waitFor(() => expect(mocks.places.getPlaces.mock.lastCall[0]).toEqual({ ...defaults, page: 2 }));
  });
  it.each([["Danh mục", "Cafe", "category"], ["Trạng thái", "Active", "status"], ["Ga Metro", "s1", "stationId"]])("preserves %s query and page reset", async (label, value, key) => {
    mount(<AdminPlaceListPage />); await screen.findByRole("heading", { name: place.name });
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
    await waitFor(() => expect(mocks.places.getPlaces.mock.lastCall[0]).toEqual({ ...defaults, [key]: value }));
  });
  it("search remains 300ms debounced, not client-filtered", async () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    render(<PlaceFilterBar filters={defaults} stations={[]} onChange={onChange} onReset={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Tìm địa điểm"), { target: { value: "Cà phê" } });
    act(() => vi.advanceTimersByTime(299)); expect(onChange).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1)); expect(onChange).toHaveBeenCalledWith({ search: "Cà phê", page: 1 });
  });
  it("empty result is distinct from API failure", async () => {
    mocks.places.getPlaces.mockResolvedValue({ items: [], totalCount: 0, totalPages: 0 });
    mount(<AdminPlaceListPage />);
    expect(await screen.findAllByText("Không tìm thấy địa điểm nào")).toHaveLength(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it("API failure is visible without fabricated rows", async () => {
    mocks.places.getPlaces.mockRejectedValueOnce(new Error("Máy chủ lỗi"));
    mount(<AdminPlaceListPage />); await screen.findByRole("alert");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    await screen.findByRole("heading", { name: place.name });
  });
  it("mobile view and edit actions preserve destinations", async () => {
    mount(<AdminPlaceListPage />); await screen.findByRole("heading", { name: place.name });
    const card = screen.getByRole("article");
    fireEvent.click(within(card).getByRole("button", { name: `Xem chi tiết ${place.name}` }));
    expect(screen.getByLabelText("Đường dẫn")).toHaveTextContent(`/admin/places/${place.id}`);
    fireEvent.click(within(card).getByRole("button", { name: `Chỉnh sửa ${place.name}` }));
    expect(screen.getByLabelText("Đường dẫn")).toHaveTextContent(`/admin/places/edit/${place.id}`);
  });
  it.each([["Active", "Inactive"], ["Inactive", "Active"], ["Pending", "Active"]])("status %s still mutates to %s and blocks duplicate while pending", async (status, target) => {
    mocks.places.getPlaces.mockResolvedValue({ items: [{ ...place, status }], page: 1, totalPages: 1 });
    const deferred = pending(); mocks.places.updatePlaceStatus.mockReturnValue(deferred.promise);
    mount(<AdminPlaceListPage />); await screen.findByRole("heading", { name: place.name });
    const toggle = within(screen.getByRole("article")).getByRole("switch");
    fireEvent.click(toggle); fireEvent.click(toggle);
    expect(toggle).toBeDisabled();
    expect(mocks.places.updatePlaceStatus).toHaveBeenCalledTimes(1);
    expect(mocks.places.updatePlaceStatus).toHaveBeenCalledWith(place.id, target);
    await act(async () => deferred.resolve({}));
  });
  it("delete confirms exact ID, prevents duplicate submission and retains server error", async () => {
    const deferred = pending(); mocks.places.deletePlace.mockReturnValue(deferred.promise);
    mount(<AdminPlaceListPage />); await screen.findByRole("heading", { name: place.name });
    fireEvent.click(within(screen.getByRole("article")).getByRole("button", { name: `Xóa mềm ${place.name}` }));
    const dialog = screen.getByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: "Xác nhận xóa" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(mocks.places.deletePlace).toHaveBeenCalledTimes(1);
    expect(mocks.places.deletePlace).toHaveBeenCalledWith(place.id);
    await act(async () => deferred.resolve({}));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("status server error remains existing alert behavior", async () => {
    mocks.places.updatePlaceStatus.mockRejectedValue(new Error("Xung đột"));
    mount(<AdminPlaceListPage />); await screen.findByRole("heading", { name: place.name });
    fireEvent.click(within(screen.getByRole("article")).getByRole("switch"));
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Xung đột"));
  });
  it("status and verification include text; switch semantics exact", () => {
    render(<><VerifiedBadge isVerified={true} /><VerifiedBadge isVerified={false} /><PlaceStatusToggle status="Pending" onToggle={vi.fn()} /></>);
    expect(screen.getByText("Đã xác thực")).toBeInTheDocument();
    expect(screen.getByText("Chưa xác thực")).toBeInTheDocument();
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  });
});
describe("A4 Detail and dialogs", () => {
  it("displays API facts, maps identity, back/edit links", async () => {
    mocks.places.getPlaceById.mockResolvedValue({ ...place, description: "Mô tả API", latitude: 10.78, longitude: 106.7, googlePlaceId: "google-fact", openingHours: [{ dayOfWeek: "Monday", openTime: "09:00", closeTime: "17:00", isClosed: false }], tags: [{ id: "t1", name: "Thẻ API" }] });
    mount(<AdminPlaceDetailPage />, `/admin/places/${place.id}`);
    await screen.findByRole("heading", { name: place.name });
    expect(screen.getByText("Mô tả API")).toBeInTheDocument();
    expect(screen.getByText("Thẻ API")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Chỉnh sửa địa điểm/ })).toHaveAttribute("href", `/admin/places/edit/${place.id}`);
    expect(screen.getByRole("link", { name: /Danh sách địa điểm/ })).toHaveAttribute("href", "/admin/places");
    expect(screen.getByRole("link", { name: /Google Maps/ })).toHaveAttribute("href", expect.stringContaining("google-fact"));
    expect(screen.getByText("09:00 - 17:00")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });
  it("missing optional values stay unknown, not stock facts", async () => {
    mount(<AdminPlaceDetailPage />, `/admin/places/${place.id}`);
    await screen.findByRole("heading", { name: place.name });
    expect(screen.getByText("Chưa có ảnh địa điểm")).toBeInTheDocument();
    expect(screen.getByText("Chưa có thông tin giờ mở cửa")).toBeInTheDocument();
    expect(screen.queryByText("08:00 - 22:00")).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
  it("delete confirmation focuses cancel, traps focus and restores opener", async () => {
    function Harness() {
      const [open, setOpen] = React.useState(false);
      return <><button onClick={() => setOpen(true)}>Mở xóa</button><DeletePlaceDialog isOpen={open} place={place} onClose={() => setOpen(false)} onConfirm={vi.fn()} /></>;
    }
    const React = await import("react");
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Mở xóa" }); opener.focus(); fireEvent.click(opener);
    await waitFor(() => expect(screen.getByRole("button", { name: /Hủy/ })).toHaveFocus());
    const buttons = within(screen.getByRole("dialog")).getAllByRole("button");
    buttons.at(-1).focus(); fireEvent.keyDown(document, { key: "Tab" });
    expect(buttons[0]).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(opener).toHaveFocus());
  });
});
