import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CreateTripPage from "../src/pages/trip/CreateTripPage";
import TripRequestAssistant from "../src/components/trip/TripRequestAssistant";
import AiLoadingPage from "../src/pages/trip/AiLoadingPage";
import * as Auth from "../src/context/AuthContext";
import * as Trip from "../src/context/TripContext";
import { masterDataService } from "../src/services/masterDataService";
import { tagService } from "../src/services/tagService";
import { placeService } from "../src/services/placeService";
import { tripService } from "../src/services/tripService";

const navigation = vi.hoisted(() => vi.fn());
vi.mock("react-router-dom", async (original) => ({ ...(await original()), useNavigate: () => navigation }));

const stations = [{ id: "s2", order: 2, name: "Nhà hát Thành phố" }, { id: "s1", order: 1, name: "Bến Thành" }];
const tags = [{ id: "coffee", name: "Cà phê", type: "Interest" }, { id: "photo", name: "Chụp ảnh", type: "Interest" }, { id: "calm", name: "Thư giãn", type: "TravelStyle" }];
const master = {
  metroStations: stations, travelModes: ["Auto", "Metro", "Walking", "Motorbike"],
  tripLimits: { minDurationHours: 1, maxDurationHours: 24 },
  timeSlots: [{ code: "morning", label: "Buổi sáng", startTime: "08:00:00", maxDurationHours: 12 }, { code: "afternoon", label: "Buổi chiều", startTime: "13:00:00", maxDurationHours: 8 }, { code: "evening", label: "Buổi tối", startTime: "18:00:00", maxDurationHours: 6 }],
};
const fields = { durationHours: 4, budgetMax: 300000, tagIds: ["coffee"], travelMode: "Auto", startStationOrder: 1, destinationStationOrder: null, plannedDate: "2026-10-09", startTime: "09:30:00", note: "Yên tĩnh" };
let context;
let demo;
const flush = async () => { await act(async () => {}); };
const tick = async (ms) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
const click = async (name) => { fireEvent.click(screen.getByRole("button", { name })); await flush(); };
const origin = () => within(screen.getByRole("group", { name: "Chọn ga xuất phát" }));
async function mount(state) {
  const view = render(<MemoryRouter initialEntries={[{ pathname: "/create", state }]}><CreateTripPage /></MemoryRouter>);
  await flush();
  return view;
}
async function timeStep() { await mount(); fireEvent.click(origin().getByRole("button", { name: "Bến Thành" })); await click("Tiếp tục"); }
async function interestsStep() { await timeStep(); await click("Tiếp tục"); }
async function finalStep() { await interestsStep(); await click("Cà phê"); await click("Tiếp tục"); }
function assistant(base) { const onParsed = vi.fn(); render(<TripRequestAssistant title="Yêu cầu AI" placeholder="Nhập yêu cầu" submitLabel="Điền giúp tôi" base={base} onParsed={onParsed} />); return onParsed; }
function typeAI(text) { fireEvent.change(screen.getByRole("textbox", { name: /Yêu cầu AI/ }), { target: { value: text } }); }

beforeEach(() => {
  vi.restoreAllMocks(); navigation.mockReset(); vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-08T03:07:00Z"));
  demo = false;
  context = { request: null, setRequest: vi.fn(), generateTrip: vi.fn().mockResolvedValue({ id: "new-trip" }), setCurrentTrip: vi.fn() };
  vi.spyOn(Auth, "useAuth").mockImplementation(() => ({ isDemo: demo }));
  vi.spyOn(Trip, "useTrip").mockImplementation(() => context);
  vi.spyOn(masterDataService, "getMasterData").mockResolvedValue(master);
  vi.spyOn(tagService, "getTags").mockResolvedValue(tags);
  vi.spyOn(placeService, "getMetroClusters").mockResolvedValue([{ stationId: "s1", placeCount: 4 }, { stationId: "s2", placeCount: 0 }]);
  vi.spyOn(tripService, "checkFeasibility").mockResolvedValue({ isFeasible: true });
  vi.spyOn(tripService, "parseTripRequest").mockResolvedValue({ isTripRequest: true, fields, message: "Đã đọc yêu cầu" });
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Unexpected request")));
  Object.defineProperty(navigator, "geolocation", { configurable: true, value: undefined });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("USER-A4.1 wizard, origin and VN time contracts", () => {
  it("has four noninteractive ordered steps and original initial progress", async () => {
    await mount();
    expect(within(screen.getByRole("list", { name: "Các bước tạo lịch trình" })).getAllByRole("listitem").map((item) => item.textContent)).toEqual(["1Vị trí", "2Thời gian", "3Sở thích", "4Phong cách"]);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "4");
    expect(screen.getByRole("heading", { name: "Bạn đang ở đâu?" })).toBeInTheDocument();
    expect(tripService.parseTripRequest).not.toHaveBeenCalled();
    expect(context.generateTrip).not.toHaveBeenCalled();
  });
  it("exits only at first step and requires an origin", async () => {
    await mount(); await click("Thoát tạo lịch trình"); expect(navigation).toHaveBeenCalledWith(-1);
    await click("Tiếp tục"); expect(screen.getByRole("alert")).toHaveTextContent("Vui lòng dùng vị trí hiện tại");
    expect(context.setRequest).not.toHaveBeenCalled();
  });
  it("sorts stations, saves existing origin fields and focuses next heading", async () => {
    await timeStep();
    expect(context.setRequest).toHaveBeenCalledWith(expect.objectContaining({ startStationOrder: 1, startLatitude: null, startLongitude: null, destinationStationOrder: null, travelMode: "Auto" }));
    expect(screen.getByRole("heading", { name: "Bạn có bao nhiêu thời gian?" })).toHaveFocus();
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
    await click("Quay lại bước trước");
    expect(origin().getAllByRole("button").map((b) => b.textContent)).toEqual(["Bến Thành", "Nhà hát Thành phố"]);
    expect(screen.getByRole("heading", { name: "Bạn đang ở đâu?" })).toHaveFocus();
  });
  it("preserves destination and travel-mode choices, including nearby null", async () => {
    await mount(); fireEvent.click(origin().getByRole("button", { name: "Bến Thành" }));
    fireEvent.click(within(screen.getByRole("group", { name: "Chọn ga muốn chơi" })).getByRole("button", { name: "Nhà hát Thành phố" }));
    await click("Metro"); await click("Tiếp tục");
    expect(context.setRequest).toHaveBeenLastCalledWith(expect.objectContaining({ destinationStationOrder: 2, travelMode: "Metro" }));
    await click("Quay lại"); await click("Gần tôi"); await click("Tiếp tục");
    expect(context.setRequest).toHaveBeenLastCalledWith(expect.objectContaining({ destinationStationOrder: null }));
  });
  it("uses GPS only on click, exactly once, with the existing 10-second option", async () => {
    const gps = vi.fn(); Object.defineProperty(navigator, "geolocation", { value: { getCurrentPosition: gps } });
    await mount(); expect(gps).not.toHaveBeenCalled();
    fireEvent.click(origin().getByRole("button", { name: "Bến Thành" })); await click("Dùng vị trí hiện tại");
    expect(gps).toHaveBeenCalledTimes(1); expect(gps.mock.calls[0][2]).toEqual({ timeout: 10000 });
    expect(screen.getByRole("button", { name: /Đang định vị/ })).toBeDisabled();
    await act(async () => gps.mock.calls[0][0]({ coords: { latitude: 10.8, longitude: 106.7 } }));
    expect(origin().getByRole("button", { name: "Bến Thành" })).toHaveAttribute("aria-pressed", "false");
    await click("Tiếp tục"); expect(context.setRequest).toHaveBeenLastCalledWith(expect.objectContaining({ startStationOrder: null, startLatitude: 10.8, startLongitude: 106.7 }));
    await click("Quay lại"); fireEvent.click(origin().getByRole("button", { name: "Bến Thành" })); await click("Tiếp tục");
    expect(context.setRequest).toHaveBeenLastCalledWith(expect.objectContaining({ startStationOrder: 1, startLatitude: null, startLongitude: null }));
  });
  it.each(["unsupported", "denied"])("preserves %s geolocation feedback and station fallback", async (kind) => {
    if (kind === "denied") Object.defineProperty(navigator, "geolocation", { value: { getCurrentPosition: (_, fail) => fail() } });
    await mount(); await click("Dùng vị trí hiện tại"); expect(screen.getByRole("alert")).toHaveTextContent(/Hãy/);
    fireEvent.click(origin().getByRole("button", { name: "Bến Thành" })); await click("Tiếp tục"); expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "2");
  });
  it("keeps VN date, tomorrow, 90-day bound and 15-minute start rounding", async () => {
    await timeStep(); const date = screen.getByLabelText("Chọn ngày khác");
    expect(date).toHaveValue("2026-10-08"); expect(date).toHaveAttribute("max", "2027-01-06");
    expect(screen.getByText(/Xuất phát 10:15/)).toBeInTheDocument();
    await click("Ngày mai"); expect(date).toHaveValue("2026-10-09"); expect(screen.getByText(/Xuất phát 08:00/)).toBeInTheDocument();
    await click("Hôm nay"); expect(date).toHaveValue("2026-10-08");
  });
  it("clamps an expired stored date and moves expired slots without network polling", async () => {
    context.request = { startStationOrder: 1, plannedDate: "2026-10-01", timeSlotCode: "morning" };
    await mount(); await click("Tiếp tục"); expect(screen.getByLabelText("Chọn ngày khác")).toHaveValue("2026-10-08");
    await tick(3 * 60 * 60 * 1000);
    expect(screen.getByRole("button", { name: /Buổi sáng/ })).toBeDisabled();
    expect(screen.getByText(/Buổi bạn chọn đã qua/)).toBeInTheDocument();
    expect(masterDataService.getMasterData).toHaveBeenCalledTimes(1);
    expect(placeService.getMetroClusters).toHaveBeenCalledTimes(1);
    expect(tripService.checkFeasibility).not.toHaveBeenCalled(); expect(globalThis.fetch).not.toHaveBeenCalled();
  });
  it("preserves late-day duration fit, disabled slots and next-day recovery", async () => {
    vi.setSystemTime(new Date("2026-10-08T15:07:00Z")); await timeStep();
    expect(screen.getByText(/Xuất phát 22:15, dự kiến xong trước 23:15/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "4 giờ" })).toBeDisabled();
    await tick(90 * 60 * 1000); expect(screen.getByRole("button", { name: "Tiếp tục" })).toBeDisabled();
    await click("Ngày mai"); expect(screen.getByRole("button", { name: "Tiếp tục" })).toBeEnabled();
  });
  it("uses only master-data travel modes and fails master-data honestly", async () => {
    masterDataService.getMasterData.mockResolvedValue({ ...master, travelModes: ["Walking"] });
    const view = await mount(); expect(screen.getByRole("group", { name: "Chọn phương tiện" }).textContent).toContain("Đi bộ");
    expect(screen.queryByRole("button", { name: "Metro" })).not.toBeInTheDocument();
    view.unmount(); masterDataService.getMasterData.mockRejectedValue(new Error("Unavailable")); await mount();
    expect(origin().queryAllByRole("button")).toHaveLength(0);
  });
});

describe("USER-A4.2 preferences, feasibility, generation and prefill", () => {
  it("requires Interest, preserves tag IDs and feasibility note override", async () => {
    context.request = { note: "Existing note" }; await interestsStep();
    expect(screen.getByRole("button", { name: "Tiếp tục" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Thư giãn" })).not.toBeInTheDocument();
    await click("Cà phê"); await click("Tiếp tục");
    expect(tripService.checkFeasibility).toHaveBeenCalledTimes(1);
    expect(tripService.checkFeasibility).toHaveBeenCalledWith({ startStationOrder: 1, durationHours: 4, budgetMin: 0, budgetMax: 300000, tagIds: ["coffee"], plannedDate: "2026-10-08", startTime: "10:15:00", travelMode: "Auto" });
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "4");
    expect(screen.getByRole("heading", { name: "Phong cách chuyến đi?" })).toHaveFocus();
    expect(screen.getByLabelText(/Ghi chú thêm/)).toHaveValue("Existing note");
    expect(screen.getByLabelText(/Ghi chú thêm/)).toHaveAttribute("maxlength", "300");
  });
  it.each([
    ["OutOfServiceArea", "Chọn lại điểm xuất phát", "1"],
    ["DurationTooShort", "Chỉnh thời lượng", "2"],
  ])("keeps %s correction step without extra feasibility requests", async (reason, action, next) => {
    tripService.checkFeasibility.mockResolvedValue({ isFeasible: false, reason });
    await interestsStep(); await click("Cà phê"); await click("Tiếp tục"); expect(screen.getByRole("alert")).toBeInTheDocument();
    await click(action); expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", next);
    expect(tripService.checkFeasibility).toHaveBeenCalledTimes(1);
  });
  it.each([
    ["InsufficientCandidates", "Ga gợi ý", { destinationStationOrder: 2 }],
    ["TooFarFromStationForMetro", "Đổi sang Xe máy", { travelMode: "Motorbike" }],
  ])("preserves %s explicit correction and immediate retry DTO", async (reason, action, changed) => {
    tripService.checkFeasibility.mockResolvedValueOnce({ isFeasible: false, reason, suggestedStations: [{ order: 2, name: "Ga gợi ý", placeCount: 5 }] });
    await interestsStep(); await click("Cà phê"); await click("Tiếp tục");
    await click(new RegExp(action)); expect(tripService.checkFeasibility).toHaveBeenCalledTimes(2);
    expect(tripService.checkFeasibility).toHaveBeenLastCalledWith(expect.objectContaining(changed));
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "4");
  });
  it("preserves feasibility loading lock, unknown reason fallback and network error retry", async () => {
    let resolve; tripService.checkFeasibility.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
    await interestsStep(); await click("Cà phê"); await click("Tiếp tục");
    expect(screen.getByRole("button", { name: "Đang kiểm tra..." })).toBeDisabled();
    await act(async () => resolve({ isFeasible: false, reason: "Unknown" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Yêu cầu hiện chưa khả thi");
    tripService.checkFeasibility.mockRejectedValueOnce(new Error("Máy chủ chưa sẵn sàng")); await click("Tiếp tục");
    expect(screen.getByRole("alert")).toHaveTextContent("Máy chủ chưa sẵn sàng");
    await click("Tiếp tục"); expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "4");
  });
  it("keeps group estimate separate from per-person generate DTO and context", async () => {
    await timeStep(); await click("Nhóm lớn"); await click("Dưới 150k/người");
    await click("Tiếp tục"); await click("Cà phê"); await click("Tiếp tục"); await click("Thư giãn");
    fireEvent.change(screen.getByLabelText(/Ghi chú thêm/), { target: { value: "  Yên tĩnh  " } });
    expect(screen.getByText(/tổng nhóm tối đa/)).toHaveTextContent(/1\.500\.000/);
    await click("Tạo lịch trình");
    expect(context.generateTrip).toHaveBeenCalledTimes(1);
    expect(context.generateTrip).toHaveBeenCalledWith(expect.objectContaining({ budgetMax: 150000, tagIds: ["coffee", "calm"], note: "Yên tĩnh" }));
    expect(context.generateTrip.mock.calls[0][0]).not.toHaveProperty("peopleCount");
    expect(context.setRequest).toHaveBeenLastCalledWith(expect.objectContaining({ budgetPerPerson: 150000, peopleCount: 10 }));
    expect(navigation.mock.calls).toEqual([["/loading"], ["/draft", { replace: true }]]);
    expect(context.setCurrentTrip).toHaveBeenCalledWith({ id: "new-trip" });
  });
  it("keeps Demo assistant hidden and final CTA login-only", async () => {
    demo = true; await finalStep(); expect(screen.queryByRole("textbox", { name: /Kể cho/ })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Phiên demo"); await click("Đăng nhập để tạo");
    expect(navigation).toHaveBeenCalledWith("/login"); expect(context.generateTrip).not.toHaveBeenCalled();
  });
  it("propagates generation failure code, suggestions and quota metadata via replace", async () => {
    const data = { extensions: { limit: 1, used: 1 }, suggestedStations: [{ order: 2 }] };
    context.generateTrip.mockRejectedValue(Object.assign(new Error("Quota"), { code: "generate_quota_exceeded", data }));
    await finalStep(); await click("Tạo lịch trình");
    expect(navigation).toHaveBeenLastCalledWith("/create", { replace: true, state: { error: "Bạn đã dùng hết lượt tạo lịch trình miễn phí trong tháng này.", errorCode: "generate_quota_exceeded", quotaMetadata: data.extensions, suggestedStations: data.suggestedStations } });
    expect(context.setCurrentTrip).not.toHaveBeenCalled();
  });
  it("displays original server quota/reset data and preserves subscription route", async () => {
    await mount({ error: "Hết lượt", errorCode: "generate_quota_exceeded", quotaMetadata: { limit: 3, used: 3, resetAt: "2026-11-01T00:00:00Z" } });
    expect(screen.getByRole("alert")).toHaveTextContent("3 / 3 lượt"); expect(screen.getByRole("alert")).toHaveTextContent(/07:00/);
    await click("Nâng cấp gói dịch vụ"); expect(navigation).toHaveBeenCalledWith("/subscription");
    expect(context.generateTrip).not.toHaveBeenCalled();
  });
  it("preserves generate-error corrective actions and retry overrides", async () => {
    await mount({ error: "Xa ga", errorCode: "too_far_from_station_for_metro" }); await click("Đổi sang Tự động");
    expect(context.generateTrip).toHaveBeenCalledTimes(1); expect(context.generateTrip).toHaveBeenCalledWith(expect.objectContaining({ travelMode: "Auto" }));
  });
  it("keeps prefill step four, changed fields, custom time and original object immutable", async () => {
    const prefill = { fields: { ...fields, durationHours: 5, budgetMax: 350000 }, changed: ["budgetMax"], missing: [], base: fields, origin: { latitude: 10.8, longitude: 106.7 } };
    const before = structuredClone(prefill); await mount({ prefill });
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "4");
    expect(screen.getByText("Thay đổi so với lịch cũ")).toBeInTheDocument();
    expect(screen.getByText(/Lịch cũ vẫn được giữ nguyên/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Ghi chú thêm/)).toHaveValue("Yên tĩnh");
    await click("Quay lại"); await click("Quay lại"); expect(screen.getByText(/Xuất phát 09:30, dự kiến xong trước 14:30/)).toBeInTheDocument();
    await click("Tiếp tục"); await click("Tiếp tục"); await click("Tạo lịch mới");
    expect(context.generateTrip).toHaveBeenCalledWith(expect.objectContaining({ startStationOrder: 1, budgetMax: 350000, durationHours: 5, startTime: "09:30:00" }));
    expect(prefill).toEqual(before);
  });
  it("keeps missing prefill date/duration warnings and coordinate-origin fallback", async () => {
    const prefill = { fields: { ...fields, plannedDate: null, durationHours: null, startStationOrder: null }, changed: [], missing: ["plannedDate"], base: fields, origin: { latitude: 10.8, longitude: 106.7 } };
    await mount({ prefill }); expect(screen.getByText(/Ngày đi của lịch cũ đã qua/)).toBeInTheDocument();
    expect(screen.getByText(/Số giờ cũ không còn vừa/)).toBeInTheDocument(); expect(screen.getByText(/Điểm xuất phát của lịch cũ/)).toBeInTheDocument();
    await click("Tạo lịch mới"); expect(context.generateTrip.mock.calls[0][0]).toEqual(expect.objectContaining({ startLatitude: 10.8, startLongitude: 106.7, plannedDate: "2026-10-08" }));
    expect(context.generateTrip.mock.calls[0][0]).not.toHaveProperty("startStationOrder");
  });
  it("allows zero budget without fabricating an unlimited DTO", async () => {
    context.request = { startStationOrder: 1, budgetPerPerson: 0, tagIds: ["coffee"] }; await mount({ error: "Try again" });
    await click("Tạo lịch trình"); expect(context.generateTrip.mock.calls[0][0].budgetMax).toBe(0);
  });
});

describe("USER-A4.3 assistant and illustrative loading contracts", () => {
  it("keeps five trimmed characters, 500 max and direct submission only", async () => {
    const base = { budgetMax: 150000 }; const parsed = assistant(base);
    expect(screen.getByRole("textbox")).toHaveAttribute("maxlength", "500");
    expect(screen.getByRole("textbox")).toHaveAccessibleDescription("Mỗi lần gửi tính 1 lượt AI trong ngày.");
    typeAI("    abc    "); expect(screen.getByRole("button", { name: "Điền giúp tôi" })).toBeDisabled();
    await tick(1000); expect(tripService.parseTripRequest).not.toHaveBeenCalled();
    typeAI("  Đi chơi  "); fireEvent.blur(screen.getByRole("textbox")); expect(tripService.parseTripRequest).not.toHaveBeenCalled();
    await click("Điền giúp tôi"); expect(tripService.parseTripRequest).toHaveBeenCalledTimes(1);
    expect(tripService.parseTripRequest).toHaveBeenCalledWith("Đi chơi", base);
    expect(parsed).toHaveBeenCalledWith(expect.objectContaining({ fields }));
    expect(screen.getByRole("status")).toHaveTextContent("Đã đọc yêu cầu");
  });
  it("preserves Shift+Enter and IME guard but submits on regular Enter", async () => {
    assistant(); typeAI("Muốn đi chơi"); const input = screen.getByRole("textbox");
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true }); await flush();
    fireEvent.keyDown(input, { key: "Enter", isComposing: true }); await flush();
    expect(tripService.parseTripRequest).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Enter" }); await flush(); expect(tripService.parseTripRequest).toHaveBeenCalledTimes(1);
  });
  it("blocks repeat parse while pending and exposes busy state", async () => {
    let resolve; tripService.parseTripRequest.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
    assistant(); typeAI("Đi cà phê"); await click("Điền giúp tôi");
    expect(screen.getByRole("button", { name: "AI đang đọc…" })).toBeDisabled();
    expect(screen.getByRole("textbox").closest("form")).toHaveAttribute("aria-busy", "true");
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" }); await flush(); expect(tripService.parseTripRequest).toHaveBeenCalledTimes(1);
    await act(async () => resolve({ message: "Không phải yêu cầu", isTripRequest: false }));
    expect(screen.getByRole("textbox").closest("form")).toHaveAttribute("aria-busy", "false");
    expect(screen.getByRole("status")).toHaveTextContent("Không phải yêu cầu");
  });
  it.each([
    ["ai_unavailable", "AI đang bận, bạn điền form giúp nhé."],
    ["ai_daily_limit_reached", "Bạn đã dùng hết lượt AI của hôm nay."],
    ["other", "Lỗi từ máy chủ"],
  ])("preserves %s error mapping and returns to enabled submit", async (code, message) => {
    tripService.parseTripRequest.mockRejectedValue(Object.assign(new Error("Lỗi từ máy chủ"), { code, data: { resetAt: "2026-10-08T17:00:00Z" } }));
    assistant(); typeAI("Đi cà phê"); await click("Điền giúp tôi");
    expect(screen.getByRole("alert")).toHaveTextContent(message);
    if (code === "ai_daily_limit_reached") expect(screen.getByRole("alert")).toHaveTextContent(/00:00 09\/10\/2026/);
    expect(screen.getByRole("button", { name: "Điền giúp tôi" })).toBeEnabled();
  });
  it("does not overwrite wizard fields for a non-trip AI reply", async () => {
    context.request = { startStationOrder: 1, note: "Giữ nguyên", budgetPerPerson: 150000, tagIds: ["coffee"] };
    tripService.parseTripRequest.mockResolvedValue({ isTripRequest: false, message: "Chưa phải yêu cầu" });
    await mount(); fireEvent.change(screen.getByRole("textbox"), { target: { value: "Xin chào bạn" } }); await click("Điền giúp tôi");
    expect(screen.getByRole("status")).toHaveTextContent("Chưa phải yêu cầu");
    await click("Tiếp tục"); expect(screen.getByRole("button", { name: "Dưới 150k/người" })).toHaveAttribute("aria-pressed", "true");
    await click("Tiếp tục"); expect(screen.getByRole("button", { name: "Cà phê" })).toHaveAttribute("aria-pressed", "true");
    await click("Tiếp tục"); expect(screen.getByLabelText(/Ghi chú thêm/)).toHaveValue("Giữ nguyên");
  });
  it("preserves unrelated fields on partial AI parse and clears GPS on station update", async () => {
    context.request = { startLatitude: 10.8, startLongitude: 106.7, startArea: "GPS", budgetPerPerson: 150000, tagIds: ["coffee"], note: "Giữ nguyên" };
    const partial = { ...Object.fromEntries(Object.keys(fields).map((key) => [key, null])), tagIds: [], startStationOrder: 2, startTime: "11:45:00" };
    tripService.parseTripRequest.mockResolvedValue({ isTripRequest: true, fields: partial, message: "Đã đọc" });
    await mount(); fireEvent.change(screen.getByRole("textbox"), { target: { value: "Từ Nhà hát" } }); await click("Điền giúp tôi");
    expect(screen.getByText(/Chưa đọc được/)).toHaveTextContent("thời lượng, ngân sách");
    await click("Tiếp tục"); expect(context.setRequest).toHaveBeenCalledWith(expect.objectContaining({ startStationOrder: 2, startLatitude: null, startLongitude: null }));
    expect(screen.getByText(/Xuất phát 11:45/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dưới 150k/người" })).toHaveAttribute("aria-pressed", "true");
    await click("Tiếp tục"); await click("Tiếp tục"); expect(screen.getByLabelText(/Ghi chú thêm/)).toHaveValue("Giữ nguyên");
    expect(tripService.parseTripRequest).toHaveBeenCalledTimes(1);
  });
  it("accepts all existing nonnull AI fields, including custom budget, time and tag IDs", async () => {
    tripService.parseTripRequest.mockResolvedValue({ isTripRequest: true, fields: { ...fields, budgetMax: 350000, durationHours: 5, destinationStationOrder: 2, travelMode: "Walking" } });
    await mount(); fireEvent.change(screen.getByRole("textbox"), { target: { value: "Ngày mai đi bộ 5 giờ" } }); await click("Điền giúp tôi");
    await click("Tiếp tục"); expect(screen.getByLabelText("Chọn ngày khác")).toHaveValue("2026-10-09");
    expect(screen.getByText(/Xuất phát 09:30, dự kiến xong trước 14:30/)).toBeInTheDocument();
    await click("Tiếp tục"); await click("Tiếp tục"); await click("Tạo lịch trình");
    expect(context.generateTrip).toHaveBeenCalledWith(expect.objectContaining({ budgetMax: 350000, durationHours: 5, tagIds: ["coffee"], destinationStationOrder: 2, travelMode: "Walking", note: "Yên tĩnh" }));
  });
  it("contains long server names, AI messages and notes without losing critical values", async () => {
    const long = "Địa điểm bên sông rất yên tĩnh ".repeat(12);
    masterDataService.getMasterData.mockResolvedValue({ ...master, metroStations: [{ id: "long", order: 1, name: long }] });
    tagService.getTags.mockResolvedValue([{ ...tags[0], name: long }]);
    await mount(); fireEvent.click(origin().getByRole("button", { name: long.trim() })); await click("Tiếp tục"); await click("Tiếp tục"); await click(long.trim()); await click("Tiếp tục");
    fireEvent.change(screen.getByLabelText(/Ghi chú thêm/), { target: { value: "a".repeat(300) } });
    expect(screen.getByText("300/300")).toBeInTheDocument(); expect(screen.getByText(/📍 Xuất phát/)).toHaveTextContent(long.trim());
  });
  it("keeps the loading strings/order, 600ms progress and cleanup without network/navigation", async () => {
    const view = render(<AiLoadingPage />);
    const steps = screen.getByLabelText("Các bước xử lý minh hoạ");
    expect([...steps.children].map((node) => node.textContent.replace("check", ""))).toEqual([
      "Đang phân tích vị trí xuất phát...", "Đang tìm cụm địa điểm gần tuyến Metro số 1...", "Đang lọc địa điểm theo ngân sách và sở thích...", "Đang sắp xếp timeline nháp...",
    ]);
    const progress = view.container.querySelector('[style*="width"]'); expect(progress.style.width).toBe("25%");
    await tick(599); expect(progress.style.width).toBe("25%");
    await tick(1); expect(progress.style.width).toBe("50%"); await tick(1200); expect(progress.style.width).toBe("100%");
    await tick(3000); expect(navigation).not.toHaveBeenCalled(); expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(context.generateTrip).not.toHaveBeenCalled(); expect(screen.getByText(/Tiến trình minh hoạ/)).toBeInTheDocument();
    view.unmount(); expect(vi.getTimerCount()).toBe(0);
  });
});
