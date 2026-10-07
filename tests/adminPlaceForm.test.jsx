import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import AdminPlaceFormPage from "../src/pages/admin/AdminPlaceFormPage";
import MapCoordinatePicker from "../src/components/admin/MapCoordinatePicker";
import OpenHoursEditor from "../src/components/admin/OpenHoursEditor";
import ImageUploadDropzone from "../src/components/admin/ImageUploadDropzone";
import MultiTagSelector from "../src/components/admin/MultiTagSelector";
const mocks = vi.hoisted(() => ({
  places: { getPlaceById: vi.fn(), createPlace: vi.fn(), updatePlace: vi.fn(), validateDistance: vi.fn(), uploadImage: vi.fn() },
  tags: { getTags: vi.fn() },
}));
vi.mock("../src/services/adminPlaceService", () => ({ adminPlaceService: mocks.places }));
vi.mock("../src/services/tagService", () => ({ tagService: mocks.tags }));
const saved = { name: "Tên cũ", address: "Địa chỉ cũ", category: "Cafe", latitude: 10.7885, longitude: 106.7025, estimatedCostMin: 0, estimatedCostMax: 40000, description: "Mô tả cũ", imageUrl: "/existing.jpg", openingHours: [{ dayOfWeek: "Monday", openTime: "09:00", closeTime: "18:00", isClosed: false }], tagIds: ["t1"] };
function Location() { return <output aria-label="Đường dẫn">{useLocation().pathname}</output>; }
const mount = (path = "/admin/places/create") => render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/admin/places/create" element={<AdminPlaceFormPage />} /><Route path="/admin/places/edit/:id" element={<AdminPlaceFormPage />} /><Route path="/admin/places" element={<h1>Danh sách đích</h1>} /></Routes><Location /></MemoryRouter>);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.places.getPlaceById.mockResolvedValue(saved);
  mocks.places.createPlace.mockResolvedValue({});
  mocks.places.updatePlace.mockResolvedValue({});
  mocks.places.validateDistance.mockResolvedValue({ hasWarning: false });
  mocks.places.uploadImage.mockResolvedValue({ url: "/uploaded.jpg" });
  mocks.tags.getTags.mockResolvedValue([{ id: "t1", name: "Yên tĩnh" }, { id: "t2", name: "Gia đình" }]);
  vi.spyOn(window, "alert").mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
describe("A4 Place form frozen payload", () => {
  it("create initial fields and blank hours remain original", async () => {
    mount(); await screen.findByRole("button", { name: "Yên tĩnh" });
    expect(screen.getByLabelText("Tên địa điểm *")).toHaveValue("");
    expect(screen.getByLabelText("Danh mục *")).toHaveValue("Food");
    expect(screen.getByLabelText("Vĩ độ (Latitude)")).toHaveValue(10.7769);
    expect(mocks.places.getPlaceById).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Hủy bỏ" })).toHaveAttribute("href", "/admin/places");
  });
  it("edit initializes persisted values, tags and hours", async () => {
    mount("/admin/places/edit/old-id");
    await waitFor(() => expect(screen.getByLabelText("Tên địa điểm *")).toHaveValue(saved.name));
    expect(screen.getByLabelText("Danh mục *")).toHaveValue("Cafe");
    expect(screen.getByLabelText("Giá từ (VNĐ)")).toHaveValue(0);
    expect(screen.getByLabelText("Giờ mở cửa Thứ Hai")).toHaveValue("09:00");
    expect(await screen.findByRole("button", { name: "Yên tĩnh" })).toHaveAttribute("aria-pressed", "true");
    expect(mocks.places.getPlaceById).toHaveBeenCalledWith("old-id");
  });
  it("required validation retains wording and associates error with controls", async () => {
    mount(); fireEvent.click(screen.getByRole("button", { name: /Tạo địa điểm/ }));
    expect(screen.getByLabelText("Tên địa điểm *")).toHaveAttribute("aria-describedby", "place-name-error");
    expect(screen.getByText("Tên địa điểm không được để trống.")).toHaveAttribute("id", "place-name-error");
    expect(screen.getByLabelText("Địa chỉ chi tiết *")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Ảnh đại diện địa điểm")).toHaveAttribute("aria-describedby", "place-image-error");
    expect(mocks.places.createPlace).not.toHaveBeenCalled();
    await screen.findByRole("button", { name: "Yên tĩnh" });
  });
  it("create exact trim/number/null payload still omits selected tags", async () => {
    mount(); await screen.findByRole("button", { name: "Yên tĩnh" });
    fireEvent.change(screen.getByLabelText("Tên địa điểm *"), { target: { value: "  Tên mới  " } });
    fireEvent.change(screen.getByLabelText("Địa chỉ chi tiết *"), { target: { value: "  Địa chỉ mới  " } });
    fireEvent.click(screen.getByRole("button", { name: "Yên tĩnh" }));
    const file = new File(["image"], "photo.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Ảnh đại diện địa điểm"), { target: { files: [file] } });
    await screen.findByAltText("Preview địa điểm");
    fireEvent.click(screen.getByRole("button", { name: /Tạo địa điểm/ }));
    await screen.findByText("Danh sách đích");
    expect(mocks.places.createPlace).toHaveBeenCalledWith({ name: "Tên mới", address: "Địa chỉ mới", category: "Food", latitude: 10.7769, longitude: 106.7009, estimatedCostMin: 0, estimatedCostMax: 0, description: null, imageUrl: "/uploaded.jpg", openingHours: [] });
  });
  it("edit exact payload retains old terms and does not persist changed tag selections", async () => {
    mount("/admin/places/edit/old-id"); await screen.findByDisplayValue(saved.name);
    fireEvent.click(await screen.findByRole("button", { name: "Gia đình" }));
    fireEvent.click(screen.getByRole("button", { name: /Cập nhật địa điểm/ }));
    await screen.findByText("Danh sách đích");
    const expected = { ...saved };
    delete expected.tagIds;
    expect(mocks.places.updatePlace).toHaveBeenCalledWith("old-id", expected);
  });
  it("price validation stays conditional and prevents inverted nonzero range", async () => {
    mount("/admin/places/edit/old-id"); await screen.findByDisplayValue(saved.name);
    fireEvent.change(screen.getByLabelText("Giá từ (VNĐ)"), { target: { value: "60000" } });
    fireEvent.click(screen.getByRole("button", { name: /Cập nhật địa điểm/ }));
    expect(screen.getByText("Giá tối thiểu không được lớn hơn giá tối đa.")).toBeInTheDocument();
    expect(mocks.places.updatePlace).not.toHaveBeenCalled();
  });
  it("409 retains conflict reload, no new mutation", async () => {
    mocks.places.updatePlace.mockRejectedValue({ status: 409 });
    mount("/admin/places/edit/old-id"); await screen.findByDisplayValue(saved.name);
    fireEvent.click(screen.getByRole("button", { name: /Cập nhật địa điểm/ }));
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: /Tải lại/ }));
    await waitFor(() => expect(mocks.places.getPlaceById).toHaveBeenCalledTimes(2));
    expect(mocks.places.updatePlace).toHaveBeenCalledTimes(1);
  });
  it("non-conflict server validation remains existing message alert, not new field mapping", async () => {
    mocks.places.updatePlace.mockRejectedValue({ status: 400, message: "Trường từ server không hợp lệ", errors: { name: "Server field" } });
    mount("/admin/places/edit/old-id"); await screen.findByDisplayValue(saved.name);
    fireEvent.click(screen.getByRole("button", { name: /Cập nhật địa điểm/ }));
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Trường từ server không hợp lệ"));
    expect(screen.queryByText("Server field")).not.toBeInTheDocument();
  });
});
describe("A4 domain editors", () => {
  it("manual coordinates preserve bounds and shared error association", () => {
    const onChange = vi.fn(); render(<MapCoordinatePicker latitude={10.78} longitude={106.7} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Vĩ độ (Latitude)"), { target: { value: "9" } });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Kinh độ (Longitude)")).toHaveAttribute("aria-describedby", "place-latitude-error");
    fireEvent.change(screen.getByLabelText("Vĩ độ (Latitude)"), { target: { value: "10.8" } });
    expect(onChange).toHaveBeenCalledWith(10.8, 106.7);
    fireEvent.click(screen.getByRole("button", { name: "Ga Ba Son" }));
    expect(onChange).toHaveBeenLastCalledWith(10.7885, 106.7025);
  });
  it("opening hours edit emits all seven days with original defaults", () => {
    const onChange = vi.fn(); render(<OpenHoursEditor value={[]} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Giờ mở cửa Thứ Hai"), { target: { value: "10:00" } });
    const hours = onChange.mock.lastCall[0];
    expect(hours).toHaveLength(7);
    expect(hours[0]).toEqual({ dayOfWeek: "Monday", openTime: "10:00", closeTime: "22:00", isClosed: false });
    expect(hours[6]).toEqual({ dayOfWeek: "Sunday", openTime: "08:00", closeTime: "22:00", isClosed: false });
  });
  it("closed day retains times and original payload", () => {
    const onChange = vi.fn(); render(<OpenHoursEditor value={saved.openingHours} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Đóng cửa Thứ Hai"));
    expect(onChange.mock.lastCall[0][0]).toEqual({ ...saved.openingHours[0], isClosed: true });
  });
  it.each([["bad.svg", 10, /Định dạng ảnh/], ["large.png", 6 * 1024 * 1024, /vượt quá 5MB/]])("image restriction %s remains, no upload", (name, size, message) => {
    render(<ImageUploadDropzone onChange={vi.fn()} />);
    const file = new File(["x"], name); Object.defineProperty(file, "size", { value: size });
    fireEvent.change(screen.getByLabelText("Ảnh đại diện địa điểm"), { target: { files: [file] } });
    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(mocks.places.uploadImage).not.toHaveBeenCalled();
  });
  it("image immediately uploads and remove clears URL only", async () => {
    const onChange = vi.fn();
    const { rerender } = render(<ImageUploadDropzone onChange={onChange} />);
    const file = new File(["png"], "photo.png");
    fireEvent.change(screen.getByLabelText("Ảnh đại diện địa điểm"), { target: { files: [file] } });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("/uploaded.jpg"));
    expect(mocks.places.uploadImage).toHaveBeenCalledWith(file);
    rerender(<ImageUploadDropzone value="/uploaded.jpg" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /Xóa ảnh/ }));
    expect(onChange).toHaveBeenLastCalledWith("");
  });
  it("tag toggles stay local and do not introduce persistence calls", async () => {
    const onChange = vi.fn(); render(<MultiTagSelector selectedTagIds={["t1"]} onChange={onChange} />);
    fireEvent.click(await screen.findByRole("button", { name: "Yên tĩnh" }));
    expect(onChange).toHaveBeenCalledWith([]);
    fireEvent.click(screen.getByRole("button", { name: "Gia đình" }));
    expect(onChange).toHaveBeenLastCalledWith(["t1", "t2"]);
  });
  it("distance warning remains debounced 400ms using existing coordinates", async () => {
    vi.useFakeTimers();
    mount();
    await act(async () => {});
    act(() => vi.advanceTimersByTime(399)); expect(mocks.places.validateDistance).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(1));
    expect(mocks.places.validateDistance).toHaveBeenCalledWith({ latitude: 10.7769, longitude: 106.7009 });
  });
});
