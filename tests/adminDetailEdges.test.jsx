import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminUserDetailPage from "../src/pages/admin/AdminUserDetailPage";
import AdminSettingsPage from "../src/pages/admin/AdminSettingsPage";

const mocks = vi.hoisted(() => ({
  users: { getUser: vi.fn(), getUserPayments: vi.fn(), getUserTrips: vi.fn() },
  api: { get: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock("../src/context/AuthContext", () => ({ useAuth: () => ({ user: { id: "admin", permissions: [] } }) }));
vi.mock("../src/services/adminUserService", () => ({ adminUserService: mocks.users }));
vi.mock("../src/api/adminApiClient", () => ({ adminApiClient: mocks.api }));
const long = "UnbrokenDetailValue".repeat(25);
const account = {
  id: "u", fullName: long, email: long + "@example.test", status: "Locked",
  role: { name: long }, lockedAt: null, lockedBy: null, lockReason: long,
  createdAt: null, updatedAt: null, hasPassword: false, loginProviders: [],
  canLock: false, canUnlock: false, subscription: null, stats: {},
};
const setting = {
  key: long, group: long, name: long, description: long, unit: long,
  valueType: "Decimal", value: 0, defaultValue: 0, minValue: 0, maxValue: 10,
  isDefault: false, updatedBy: null, updatedAt: null,
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.users.getUser.mockResolvedValue(account);
  mocks.users.getUserPayments.mockResolvedValue({ items: [], page: 1, totalPages: 1, totalCount: 0 });
  mocks.users.getUserTrips.mockResolvedValue({ items: [], page: 1, totalPages: 1, totalCount: 0 });
  mocks.api.get.mockResolvedValue([setting]);
});
function userDetail() {
  render(<MemoryRouter initialEntries={["/admin/users/u"]}><Routes><Route path="/admin/users/:userId" element={<AdminUserDetailPage />} /></Routes></MemoryRouter>);
}
describe("A8 detail and Settings edges", () => {
  it("long identity/lock reason retain full text, neutral nulls and server-hidden actions", async () => {
    userDetail();
    const heading = await screen.findByRole("heading", { name: long });
    expect(heading.closest(".space-y-6")).toHaveClass("[overflow-wrap:anywhere]");
    expect(screen.getByText(account.email)).toBeInTheDocument();
    expect(screen.getByText(/Lý do \(ghi chú nội bộ\):/).parentElement).toHaveTextContent(long);
    expect(screen.getByText("Người khoá: Không rõ")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Khoá tài khoản|Mở khoá|Đổi role/ })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText("Chưa có giao dịch nào")).toHaveLength(2));
    expect(screen.queryByRole("button", { name: /Xem chi tiết đơn hàng/ })).not.toBeInTheDocument();
    expect(mocks.users.getUser).toHaveBeenCalledExactlyOnceWith("u");
    expect(mocks.users.getUserPayments).toHaveBeenCalledExactlyOnceWith("u", { page: 1, pageSize: 10, sortBy: "createdAt", sortDirection: "desc" });
  });
  it("zero and unlimited usage remain distinct; unknown status never enables an action", async () => {
    mocks.users.getUser.mockResolvedValue({ ...account, status: "FutureStatus", subscription: {
      plan: "FREE", usage: { generateUsed: 0, generateLimit: 0 }, savedTrips: { used: 0, limit: null },
    } });
    userDetail();
    await screen.findByRole("heading", { name: long });
    expect(screen.getByText("FutureStatus")).toBeInTheDocument();
    expect(screen.getByText("0/0")).toBeInTheDocument();
    expect(screen.getByText("0 · không giới hạn")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Khoá tài khoản|Mở khoá/ })).not.toBeInTheDocument();
  });
  it("long unknown setting group/key/unit stays accessible; reset cancel restores focus without mutation", async () => {
    render(<AdminSettingsPage />);
    const input = await screen.findByRole("textbox", { name: long });
    expect(input).toHaveValue("0");
    expect(screen.getByRole("region", { name: long })).toBeInTheDocument();
    const unit = screen.getByTitle(long);
    expect(unit).toHaveTextContent(long);
    expect(unit).toHaveClass("max-w-[40%]", "truncate");
    const hint = document.getElementById(input.getAttribute("aria-describedby"));
    expect(hint).toHaveTextContent(long);
    const trigger = screen.getByRole("button", { name: "Khôi phục mặc định " + long });
    trigger.focus(); fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAccessibleDescription('"' + long + '" sẽ về 0 ' + long + ' và có hiệu lực ngay.');
    fireEvent.keyDown(document, { key: "Escape" });
    expect(trigger).toHaveFocus();
    expect(mocks.api.get).toHaveBeenCalledExactlyOnceWith("/admin/settings");
    expect(mocks.api.put).not.toHaveBeenCalled();
    expect(mocks.api.delete).not.toHaveBeenCalled();
  });
  it("long Settings server error remains exact, empty/loading remain distinct and retry unchanged", async () => {
    mocks.api.get.mockRejectedValueOnce(new Error(long));
    render(<AdminSettingsPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent(long);
    expect(screen.queryByText("Chưa có thông số cấu hình")).not.toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("alert")).getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByRole("textbox", { name: long })).toHaveValue("0");
    expect(mocks.api.get.mock.calls).toEqual([["/admin/settings"], ["/admin/settings"]]);
    expect(mocks.api.put).not.toHaveBeenCalled();
    expect(mocks.api.delete).not.toHaveBeenCalled();
  });
});
