import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminSettingsPage from "../src/pages/admin/AdminSettingsPage";
import { ADMIN_SECTIONS } from "../src/components/admin/adminSections";
import { hasAnyPermission } from "../src/utils/adminAccess";

const api = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock("../src/api/adminApiClient", () => ({ adminApiClient: api }));

const setting = (overrides = {}) => ({
  key: "Ai.First", group: "Ai", name: "Thông số thứ nhất", description: "Mô tả do server cung cấp",
  valueType: "Integer", unit: "lần", value: 5, defaultValue: 5, minValue: 1, maxValue: 10,
  isDefault: true, updatedAt: null, updatedBy: null, ...overrides,
});
const first = setting();
const second = setting({ key: "Travel.Second", group: "Travel", name: "Thông số thứ hai" });
const customized = setting({ isDefault: false }); // Equality must not override server isDefault.
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};
async function mount(rows = [first, second]) {
  api.get.mockResolvedValueOnce(rows);
  render(<AdminSettingsPage />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Tải lại" })).toBeEnabled());
}
const input = (record = first) => screen.getByRole("textbox", { name: record.name });
const row = (record = first) => within(input(record).closest("li"));
const save = (record = first) => row(record).getByRole("button", { name: `Lưu ${record.name}` });
const edit = (value, record = first) => fireEvent.change(input(record), { target: { value } });
const openReset = () => {
  const trigger = screen.getByRole("button", { name: `Khôi phục mặc định ${first.name}` });
  trigger.focus();
  fireEvent.click(trigger);
  return trigger;
};

beforeEach(() => vi.resetAllMocks());
afterEach(() => vi.useRealTimers());

describe("A7 collection and grouping", () => {
  it("T01 performs one real service collection GET", async () => {
    await mount();
    expect(api.get).toHaveBeenCalledExactlyOnceWith("/admin/settings");
    expect(api.put).not.toHaveBeenCalled();
    expect(api.delete).not.toHaveBeenCalled();
  });
  it("T02 preserves returned item order inside each group", async () => {
    const last = setting({ key: "Ai.Z", name: "Trả về cuối" });
    await mount([last, second, first]);
    const group = screen.getByRole("region", { name: "AI" });
    expect(within(group).getAllByRole("textbox").map((node) => node.id)).toEqual(["setting-Ai.Z", "setting-Ai.First"]);
  });
  it("T03 uses group first occurrence, not alphabetic order", async () => {
    await mount([second, first]);
    expect(screen.getAllByRole("heading", { level: 2 }).map((node) => node.textContent)).toEqual(["Di chuyển", "AI"]);
  });
  it("T04 renders unknown group raw label and generic decorative icon", async () => {
    await mount([setting({ group: "FutureGroup" })]);
    const group = screen.getByRole("region", { name: "FutureGroup" });
    expect(within(group).getByText("settings").parentElement).toHaveAttribute("aria-hidden", "true");
    expect(within(group).getByRole("textbox")).toHaveValue("5");
  });
  it.each([[], null])("T05 honest empty collection %j, no invented defaults", async (records) => {
    await mount(records);
    expect(screen.getByText("Chưa có thông số cấu hình")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it("T06 load failure stays distinct from empty and loading", async () => {
    api.get.mockRejectedValueOnce(new Error("Không kết nối được"));
    render(<AdminSettingsPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Không kết nối được");
    expect(screen.queryByText("Chưa có thông số cấu hình")).not.toBeInTheDocument();
  });
  it("T07 retry uses same explicit reload path", async () => {
    api.get.mockRejectedValueOnce(new Error("Lỗi GET")).mockResolvedValueOnce([first]);
    render(<AdminSettingsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Thử lại" }));
    expect(await screen.findByRole("textbox")).toHaveValue("5");
    expect(api.get.mock.calls).toEqual([["/admin/settings"], ["/admin/settings"]]);
  });
  it("loading announces without fake counts/values and guards reload", async () => {
    api.get.mockReturnValueOnce(new Promise(() => {}));
    render(<AdminSettingsPage />);
    expect(screen.getByRole("status")).toHaveTextContent("Đang tải cấu hình...");
    expect(screen.getByRole("button", { name: "Tải lại" })).toBeDisabled();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByText(/thông số đã chỉnh/)).not.toBeInTheDocument();
  });
  it("reload retains draft for unchanged server value/timestamp, no duplicate request", async () => {
    await mount();
    edit("6");
    const pending = deferred(); api.get.mockReturnValueOnce(pending.promise);
    fireEvent.click(screen.getByRole("button", { name: "Tải lại" }));
    fireEvent.click(screen.getByRole("button", { name: "Tải lại" }));
    expect(input()).toHaveValue("6");
    expect(api.get).toHaveBeenCalledTimes(2);
    await act(async () => pending.resolve([first, second]));
    expect(input()).toHaveValue("6");
  });
  it("reload replaces changed server row only, preserving other draft", async () => {
    await mount(); edit("6"); edit("7", second);
    api.get.mockResolvedValueOnce([{ ...first, value: 8 }, second]);
    fireEvent.click(screen.getByRole("button", { name: "Tải lại" }));
    await waitFor(() => expect(input()).toHaveValue("8"));
    expect(input(second)).toHaveValue("7");
  });
});

describe("A7 existing parser through input UI", () => {
  it.each([
    ["T08", "  ", "Giá trị là bắt buộc."],
    ["T09", "abc", "Giá trị phải là số."],
    ["T11", "5.2", "Giá trị phải là số nguyên."],
    ["T15", "0", "Giá trị phải từ 1 đến 10."],
    ["T16", "11", "Giá trị phải từ 1 đến 10."],
    ["syntax", "1e1", "Giá trị phải là số."],
    ["syntax", "1,2,3", "Giá trị phải là số."],
  ])("%s rejects %s using record-owned validation", async (_, value, message) => {
    await mount(); edit(value);
    expect(row().getByRole("alert")).toHaveTextContent(message);
    expect(input()).toHaveAttribute("aria-invalid", "true");
    expect(save()).toBeDisabled();
    fireEvent.submit(input().closest("form"));
    expect(api.put).not.toHaveBeenCalled();
  });
  it.each([" 4,9 ", "4.9"])("T10/T12 accepts Decimal %s as numeric payload", async (value) => {
    const decimal = setting({ valueType: "Decimal", value: 4.8, minValue: 2, maxValue: 8 });
    await mount([decimal]); edit(value);
    expect(input()).toHaveAttribute("type", "text");
    expect(input()).toHaveAttribute("inputmode", "decimal");
    expect(row().getByText(/Giá trị mới: 4,9 lần/)).toBeInTheDocument();
    api.put.mockResolvedValueOnce({ ...decimal, value: 4.9 });
    fireEvent.click(save());
    await waitFor(() => expect(api.put).toHaveBeenCalledExactlyOnceWith("/admin/settings/Ai.First", { value: 4.9 }));
  });
  it.each([1, 10])("T13/T14 accepts inclusive boundary %s", async (value) => {
    await mount(); edit(String(value));
    expect(save()).toBeEnabled();
    expect(input()).toHaveAttribute("inputmode", "numeric");
    expect(row().queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("A7 independent per-key save", () => {
  it("T17 unchanged numeric value cannot save including comma/whitespace representation", async () => {
    await mount(); edit(" 5,0 ");
    expect(save()).toBeDisabled();
    fireEvent.submit(input().closest("form"));
    expect(api.put).not.toHaveBeenCalled();
  });
  it("T18 invalid row never submits", async () => {
    await mount(); edit("-"); fireEvent.click(save());
    expect(api.put).not.toHaveBeenCalled();
  });
  it("T19/T20 sends exactly own encoded key and {value}, not batch payload", async () => {
    const record = setting({ key: "Future/Key" });
    await mount([record, second]); edit("6", record);
    api.put.mockResolvedValueOnce({ ...record, value: 6 });
    fireEvent.click(save(record));
    await waitFor(() => expect(api.put).toHaveBeenCalledExactlyOnceWith("/admin/settings/Future%2FKey", { value: 6 }));
    expect(api.get).toHaveBeenCalledOnce();
  });
  it("T21 saving one row leaves other input/save independently usable", async () => {
    await mount(); edit("6"); edit("7", second);
    const pending = deferred(); api.put.mockReturnValueOnce(pending.promise);
    fireEvent.click(save());
    expect(input()).toBeDisabled();
    expect(row().getByRole("button")).toHaveTextContent("Đang lưu...");
    expect(input(second)).toBeEnabled(); expect(save(second)).toBeEnabled();
    await act(async () => pending.resolve({ ...first, value: 6 }));
  });
  it("T22/T23 server response replaces only its row and keeps unrelated draft", async () => {
    await mount(); edit("6"); edit("7", second);
    api.put.mockResolvedValueOnce({ ...first, value: 8, isDefault: false, updatedAt: "2026-10-07T02:00:00Z", updatedBy: { fullName: "Người sửa từ server", email: "not-exposed@example.test" } });
    fireEvent.click(save());
    await waitFor(() => expect(input()).toHaveValue("8"));
    expect(input(second)).toHaveValue("7");
    expect(row().getByText(/Người sửa từ server/)).toBeInTheDocument();
    expect(screen.queryByText(/not-exposed@example.test/)).not.toBeInTheDocument();
    expect(api.get).toHaveBeenCalledOnce();
  });
  it("T24 duplicate native submit prevented while saving", async () => {
    await mount(); edit("6");
    const pending = deferred(); api.put.mockReturnValueOnce(pending.promise);
    fireEvent.submit(input().closest("form"));
    fireEvent.submit(input().closest("form"));
    expect(api.put).toHaveBeenCalledOnce();
    await act(async () => pending.resolve({ ...first, value: 6 }));
  });
  it("save success preserves exact notice and 4500ms lifetime", async () => {
    await mount(); edit("6");
    api.put.mockResolvedValueOnce({ ...first, value: 6 });
    vi.useFakeTimers();
    await act(async () => fireEvent.click(save()));
    expect(screen.getByRole("status")).toHaveTextContent(`Đã lưu "${first.name}".`);
    act(() => vi.advanceTimersByTime(4499));
    expect(screen.getByRole("status")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("A7 one-setting reset", () => {
  it("T25 server isDefault true hides reset even if value differs from default", async () => {
    await mount([setting({ value: 6, isDefault: true })]);
    expect(screen.queryByRole("button", { name: /Khôi phục/ })).not.toBeInTheDocument();
  });
  it("T26 server non-default exposes reset even when values equal", async () => {
    await mount([customized]);
    expect(screen.getByRole("button", { name: /Khôi phục mặc định/ })).toBeEnabled();
  });
  it("T27 confirmation names own setting/default/immediate effect", async () => {
    await mount([customized]); openReset();
    expect(screen.getByRole("dialog")).toHaveAccessibleDescription(`"${first.name}" sẽ về 5 lần và có hiệu lực ngay.`);
    expect(api.delete).not.toHaveBeenCalled();
  });
  it("T28 cancel does not mutate and restores reset trigger focus", async () => {
    await mount([customized]); const trigger = openReset();
    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
    expect(api.delete).not.toHaveBeenCalled(); expect(api.put).not.toHaveBeenCalled();
    expect(trigger).toHaveFocus();
  });
  it("T29 confirm sends DELETE for target only", async () => {
    await mount([customized, second]); openReset();
    api.delete.mockResolvedValueOnce(first);
    fireEvent.click(screen.getByRole("button", { name: "Khôi phục", exact: true }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(api.delete).toHaveBeenCalledExactlyOnceWith("/admin/settings/Ai.First");
    expect(api.put).not.toHaveBeenCalled(); expect(api.get).toHaveBeenCalledOnce();
  });
  it("T30 loading blocks duplicate confirm and dismissal", async () => {
    await mount([customized]); openReset();
    const pending = deferred(); api.delete.mockReturnValueOnce(pending.promise);
    fireEvent.click(screen.getByRole("button", { name: "Khôi phục", exact: true }));
    fireEvent.click(screen.getByRole("button", { name: "Đang xử lý..." }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hủy" })).toBeDisabled();
    expect(api.delete).toHaveBeenCalledOnce();
    await act(async () => pending.resolve(first));
  });
  it("T31 reset uses server response for target only, other draft remains", async () => {
    await mount([customized, second]); edit("7", second); openReset();
    api.delete.mockResolvedValueOnce({ ...first, value: 4, defaultValue: 4 });
    fireEvent.click(screen.getByRole("button", { name: "Khôi phục", exact: true }));
    await waitFor(() => expect(input()).toHaveValue("4"));
    expect(input(second)).toHaveValue("7");
    expect(screen.queryByRole("button", { name: /Khôi phục mặc định/ })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(`Đã khôi phục mặc định "${first.name}".`);
  });
});

describe("A7 errors and contract boundaries", () => {
  it.each(["update", "reset"])("T32/T33 setting_not_found on %s reloads and removes obsolete row", async (action) => {
    await mount([customized, second]);
    api.get.mockResolvedValueOnce([second]);
    const missing = { code: "setting_not_found" };
    if (action === "update") {
      edit("6"); api.put.mockRejectedValueOnce(missing); fireEvent.click(save());
    } else {
      openReset(); api.delete.mockRejectedValueOnce(missing);
      fireEvent.click(screen.getByRole("button", { name: "Khôi phục", exact: true }));
    }
    await waitFor(() => expect(screen.queryByRole("textbox", { name: first.name })).not.toBeInTheDocument());
    expect(screen.getByRole("alert")).toHaveTextContent("Thông số này không còn tồn tại, danh sách đã được tải lại.");
    expect(api.get).toHaveBeenCalledTimes(2);
  });
  it("T34 general save error belongs to row and retains retryable draft", async () => {
    await mount(); edit("6"); api.put.mockRejectedValueOnce(new Error("Server từ chối giá trị"));
    fireEvent.click(save());
    expect(await row().findByRole("alert")).toHaveTextContent("Server từ chối giá trị");
    expect(row(second).queryByRole("alert")).not.toBeInTheDocument();
    expect(input()).toHaveValue("6"); expect(save()).toBeEnabled();
    edit("7"); expect(row().queryByRole("alert")).not.toBeInTheDocument();
    expect(api.get).toHaveBeenCalledOnce();
  });
  it("T35 reset error stays page-visible with dialog closed and value untouched", async () => {
    await mount([customized]); openReset(); api.delete.mockRejectedValueOnce(new Error("Không khôi phục được"));
    fireEvent.click(screen.getByRole("button", { name: "Khôi phục", exact: true }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Không khôi phục được");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); expect(input()).toHaveValue("5");
  });
  it.each([/save all|lưu tất cả|apply all|áp dụng tất cả/i, /reset all|khôi phục tất cả|factory reset/i])("T36/T37 no global action %s", async (name) => {
    await mount([customized, second]);
    expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    expect(screen.getAllByRole("form")).toHaveLength(2);
  });
  it("T38 two independent saves each send one value object, never batch", async () => {
    await mount(); edit("6"); edit("7", second);
    api.put.mockResolvedValueOnce({ ...first, value: 6 }).mockResolvedValueOnce({ ...second, value: 7 });
    fireEvent.click(save()); fireEvent.click(save(second));
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(2));
    expect(api.put.mock.calls).toEqual([["/admin/settings/Ai.First", { value: 6 }], ["/admin/settings/Travel.Second", { value: 7 }]]);
  });
  it("T39 one collection and single row per key survives parent rerender (no mobile copy)", async () => {
    api.get.mockResolvedValueOnce([first, second]);
    const view = render(<AdminSettingsPage />);
    await screen.findByRole("textbox", { name: first.name }); edit("6");
    view.rerender(<AdminSettingsPage />);
    expect(screen.getAllByRole("textbox")).toHaveLength(2);
    expect(input()).toHaveValue("6"); expect(api.get).toHaveBeenCalledOnce();
  });
  it("T40 customized count uses server isDefault, not draft or numeric equality", async () => {
    await mount([customized, setting({ ...second, value: 6, isDefault: true })]);
    expect(screen.getByText("1 / 2 thông số đã chỉnh")).toBeInTheDocument();
    edit("7"); expect(screen.getByText("1 / 2 thông số đã chỉnh")).toBeInTheDocument();
  });
  it("ManageSettings access remains exact; Admin role name alone grants nothing", () => {
    const section = ADMIN_SECTIONS.find((item) => item.path === "settings");
    expect(section.permissions).toEqual(["ManageSettings"]);
    expect(hasAnyPermission({ roleName: "Admin", permissions: [] }, section.permissions)).toBe(false);
    expect(hasAnyPermission({ permissions: ["ManageSettings"] }, section.permissions)).toBe(true);
  });
});

describe("A7 accessibility", () => {
  it("T41 every supplied setting input has its own associated name", async () => {
    await mount();
    expect(input()).toHaveAccessibleName(first.name);
    expect(input(second)).toHaveAccessibleName(second.name);
    expect(screen.getAllByRole("textbox")).toHaveLength(2);
  });
  it("T42/T43 error and range are separately connected to invalid input", async () => {
    await mount(); edit("11");
    expect(input()).toHaveAttribute("aria-describedby", "setting-Ai.First-hint setting-Ai.First-error");
    expect(input()).toHaveAccessibleDescription("Từ 1 lần đến 10 lần Giá trị phải từ 1 đến 10.");
    expect(input()).toHaveAttribute("aria-invalid", "true");
    edit("6");
    expect(input()).toHaveAttribute("aria-describedby", "setting-Ai.First-hint");
    expect(input()).toHaveAttribute("aria-invalid", "false");
  });
  it("T44 reset focus enters cancel, loops both ways and restores on Escape", async () => {
    await mount([customized]); const trigger = openReset();
    const cancel = screen.getByRole("button", { name: "Hủy" });
    const confirm = screen.getByRole("button", { name: "Khôi phục", exact: true });
    expect(cancel).toHaveFocus();
    fireEvent.keyDown(cancel, { key: "Tab", shiftKey: true }); expect(confirm).toHaveFocus();
    fireEvent.keyDown(confirm, { key: "Tab" }); expect(cancel).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(trigger).toHaveFocus(); expect(api.delete).not.toHaveBeenCalled();
  });
  it("T44 backdrop cancels and restores focus without mutation", async () => {
    await mount([customized]); const trigger = openReset();
    fireEvent.mouseDown(screen.getByRole("dialog").parentElement);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus(); expect(api.delete).not.toHaveBeenCalled();
  });
  it("T45 group headings label semantic sections under page h1", async () => {
    await mount();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Cấu hình hệ thống");
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(2);
    expect(screen.getByRole("region", { name: "AI" })).toContainElement(input());
  });
  it("T46 states are expressed with text and native disabled semantics", async () => {
    await mount([customized]);
    expect(row().getByText("Đã chỉnh")).toBeInTheDocument();
    expect(save()).toBeDisabled(); edit("6"); expect(save()).toBeEnabled();
    const pending = deferred(); api.put.mockReturnValueOnce(pending.promise); fireEvent.click(save());
    expect(save()).toHaveTextContent("Đang lưu...");
    expect(screen.getByRole("button", { name: /Khôi phục mặc định/ })).toBeDisabled();
    await act(async () => pending.resolve({ ...first, value: 6 }));
  });
});
