import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminLayout from "../src/components/admin/AdminLayout";
import AdminPageHeader from "../src/components/admin/AdminPageHeader";
import { ADMIN_SECTIONS } from "../src/components/admin/adminSections";
import { ADMIN_API_EVENTS } from "../src/api/adminApiClient";

const auth = vi.hoisted(() => ({ user: null, logout: vi.fn(), refreshProfile: vi.fn() }));
vi.mock("../src/context/AuthContext", () => ({ useAuth: () => auth }));
const allPermissions = [...new Set(ADMIN_SECTIONS.flatMap((section) => section.permissions))];
let desktopChange;
let media;

function CurrentPage() {
  const { pathname, state } = useLocation();
  const navigate = useNavigate();
  return <>
    <p data-testid="page">{pathname}</p>
    {state?.message && <p>{state.message}</p>}
    <button onClick={() => navigate("/admin/settings")}>External navigation</button>
    <AdminPageHeader title="Current page" eyebrow="Current group" description="Existing description">
      <button onClick={() => {}}>Existing page action</button>
    </AdminPageHeader>
  </>;
}

function shell(path = "/admin", permissions = allPermissions) {
  auth.user = { fullName: "Nguyễn An", email: "admin@local.test", role: "Admin", permissions };
  return render(<MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<CurrentPage />} />
        <Route path="*" element={<CurrentPage />} />
      </Route>
      <Route path="/login" element={<CurrentPage />} />
      <Route path="/home" element={<CurrentPage />} />
    </Routes>
  </MemoryRouter>);
}

function sidebar() { return within(screen.getByRole("complementary", { name: "Điều hướng desktop" })); }
function openDrawer() {
  const trigger = screen.getByRole("button", { name: "Mở menu quản trị" });
  fireEvent.click(trigger);
  return { trigger, dialog: screen.getByRole("dialog", { name: "Menu quản trị" }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.refreshProfile.mockResolvedValue(undefined);
  media = { matches: false, addEventListener: vi.fn((event, listener) => { desktopChange = listener; }), removeEventListener: vi.fn() };
  vi.stubGlobal("matchMedia", vi.fn(() => media));
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("Admin A1 grouped navigation and preserved access", () => {
  it("T01 full permissions retain all nine sections plus overview", () => {
    shell();
    const links = sidebar().getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/admin", ...ADMIN_SECTIONS.map((section) => `/admin/${section.path}`)]);
    expect(sidebar().getAllByRole("heading").map((heading) => heading.textContent)).toEqual(["Tổng quan", "Dữ liệu Metro", "Kinh doanh", "Người dùng", "Hệ thống"]);
  });
  it("T02 partial permissions keep the exact permission-filtered menu", () => {
    shell("/admin", ["ManagePlaces", "ViewRevenue"]);
    expect(sidebar().getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["/admin", "/admin/stations", "/admin/places", "/admin/import", "/admin/transactions"]);
    expect(sidebar().queryByRole("link", { name: "Gói thành viên" })).not.toBeInTheDocument();
  });
  it("T03 empty groups are omitted even for an Admin role label", () => {
    shell("/admin", []);
    expect(sidebar().getAllByRole("heading")).toHaveLength(1);
    expect(sidebar().getAllByRole("link")).toHaveLength(1);
    expect(sidebar().queryByRole("region", { name: "Kinh doanh" })).not.toBeInTheDocument();
  });
  it.each(["/admin/places/123", "/admin/places/edit/123", "/admin/places/create", "/admin/places/import"])("T04 deep route %s retains Places as active parent", (path) => {
    shell(path);
    expect(sidebar().getByRole("link", { name: "Địa điểm", exact: true })).toHaveAttribute("aria-current", "page");
    expect(sidebar().getByRole("link", { name: "Tổng quan", exact: true })).not.toHaveAttribute("aria-current");
  });
  it.each(ADMIN_SECTIONS)("all existing section paths still render their outlet: $path", (section) => {
    shell(`/admin/${section.path}`);
    expect(screen.getByTestId("page")).toHaveTextContent(`/admin/${section.path}`);
    expect(sidebar().getByRole("link", { name: section.navLabel, exact: true })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Existing page action" })).toBeInTheDocument();
  });
  it("T10 overview only matches the index and account context is retained", () => {
    shell();
    expect(sidebar().getByRole("link", { name: "Tổng quan", exact: true })).toHaveAttribute("aria-current", "page");
    expect(sidebar().getByText("Admin Portal")).toBeInTheDocument();
    expect(sidebar().getByText("admin@local.test")).toBeInTheDocument();
    expect(sidebar().getByText(/9 khu vực quản trị/)).toBeInTheDocument();
    expect(sidebar().getByRole("img", { name: "LocalMate AI" }).getAttribute("src")).toContain("logo.jpg");
  });
  it("T11 logout preserves its call and replace-login destination", () => {
    shell();
    fireEvent.click(sidebar().getByRole("button", { name: "Đăng xuất" }));
    expect(auth.logout).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("page")).toHaveTextContent("/login");
  });
  it("T12 return-to-user preserves /home", () => {
    shell();
    fireEvent.click(sidebar().getByRole("button", { name: "Về giao diện người dùng" }));
    expect(screen.getByTestId("page")).toHaveTextContent("/home");
    expect(auth.logout).not.toHaveBeenCalled();
  });
  it("T13 global topbar has no place CRUD/import actions", () => {
    shell("/admin/plans");
    const topbar = within(screen.getByRole("banner", { name: "Thanh công cụ quản trị" }));
    expect(topbar.queryByText("Thêm địa điểm")).not.toBeInTheDocument();
    expect(topbar.queryByText("Import")).not.toBeInTheDocument();
  });
  it("unauthorized event retains logout and session message", () => {
    shell();
    act(() => window.dispatchEvent(new CustomEvent(ADMIN_API_EVENTS.UNAUTHORIZED, { detail: { message: "Session ended" } })));
    expect(auth.logout).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("page")).toHaveTextContent("/login");
    expect(screen.getByText("Session ended")).toBeInTheDocument();
  });
  it("forbidden event retains notice/profile refresh without logout and updates filtered nav", async () => {
    const view = shell();
    await act(async () => window.dispatchEvent(new CustomEvent(ADMIN_API_EVENTS.FORBIDDEN, { detail: { message: "No permission" } })));
    expect(auth.refreshProfile).toHaveBeenCalledTimes(1);
    expect(auth.logout).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("No permission");
    auth.user = { ...auth.user, permissions: ["ViewFeedback"] };
    view.rerender(<MemoryRouter initialEntries={["/admin"]}><AdminLayout /></MemoryRouter>);
    expect(sidebar().getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["/admin", "/admin/feedback"]);
  });
});

describe("Admin A1 accessible drawer and account interactions", () => {
  it.each([390, 768, 1024])("T05 menu trigger opens the shared drawer at %ipx mobile/tablet", (width) => {
    vi.stubGlobal("innerWidth", width);
    shell();
    const { trigger, dialog } = openDrawer();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(within(dialog).getAllByRole("link")).toHaveLength(10);
  });
  it("T06 Escape closes and restores previous body overflow", () => {
    document.body.style.overflow = "auto";
    shell();
    openDrawer();
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("auto");
    document.body.style.overflow = "";
  });
  it("T07 backdrop closes without triggering route actions", () => {
    shell();
    const { dialog } = openDrawer();
    fireEvent.click(dialog.previousElementSibling);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByTestId("page")).toHaveTextContent("/admin");
  });
  it("T08 route selection closes and keeps the destination", () => {
    shell();
    const { dialog } = openDrawer();
    fireEvent.click(within(dialog).getByRole("link", { name: "Giao dịch", exact: true }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByTestId("page")).toHaveTextContent("/admin/transactions");
  });
  it("T09 focus enters the drawer and returns to the menu trigger", () => {
    shell();
    const { trigger, dialog } = openDrawer();
    expect(within(dialog).getByRole("button", { name: "Đóng menu quản trị" })).toHaveFocus();
    fireEvent.click(within(dialog).getByRole("button", { name: "Đóng menu quản trị" }));
    expect(trigger).toHaveFocus();
    expect(document.documentElement.style.overflow).toBe("");
  });
  it("focus wraps in both directions and cannot enter background content", () => {
    shell();
    const { dialog } = openDrawer();
    const first = within(dialog).getByRole("button", { name: "LocalMate AI, về Tổng quan" });
    const last = within(dialog).getByRole("button", { name: "Đăng xuất" });
    act(() => last.focus());
    fireEvent.keyDown(last, { key: "Tab" });
    expect(first).toHaveFocus();
    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();
    expect(document.querySelector("[inert]")).toBeTruthy();
  });
  it("changing to desktop closes drawer and unlocks the page", () => {
    shell();
    openDrawer();
    act(() => desktopChange({ matches: true }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
  });
  it("drawer and account dropdown cannot overlap", () => {
    shell();
    fireEvent.click(screen.getByRole("button", { name: "Tài khoản" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    openDrawer();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
  it("account Escape and arrow keys work, return-to-user is retained", () => {
    shell();
    const trigger = screen.getByRole("button", { name: "Tài khoản" });
    fireEvent.click(trigger);
    const menu = screen.getByRole("menu");
    const items = within(menu).getAllByRole("menuitem");
    expect(items[0]).toHaveFocus();
    fireEvent.keyDown(items[0], { key: "ArrowDown" });
    expect(items[1]).toHaveFocus();
    fireEvent.keyDown(items[1], { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("menuitem", { name: "Xem giao diện người dùng" }));
    expect(screen.getByTestId("page")).toHaveTextContent("/home");
  });
  it("external route changes dismiss account dropdown", () => {
    shell();
    fireEvent.click(screen.getByRole("button", { name: "Tài khoản" }));
    fireEvent.click(screen.getByRole("button", { name: "External navigation" }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});

describe("Admin A1 page header compatibility", () => {
  it("T14 retains back/badge/description/children and existing action handlers", () => {
    const action = vi.fn();
    render(<MemoryRouter><AdminPageHeader back={{ to: "/admin/places", label: "Back" }} eyebrow="Metro" title="Place title" badge={<span>Verified</span>} description={<span>Detail description</span>}>
      <button disabled>Loading action</button><button onClick={action}>Edit</button>
    </AdminPageHeader></MemoryRouter>);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Place title");
    expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute("href", "/admin/places");
    expect(screen.getByText("Verified")).toBeInTheDocument();
    expect(screen.getByText("Detail description")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Loading action" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(action).toHaveBeenCalledTimes(1);
  });
});
