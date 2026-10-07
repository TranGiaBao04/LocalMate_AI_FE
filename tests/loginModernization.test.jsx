import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import LoginPage from "../src/pages/auth/LoginPage";
import LoginTravelPanel from "../src/components/auth/LoginTravelPanel";

const auth = vi.hoisted(() => ({
  login: vi.fn(), loginWithGoogle: vi.fn(), loginDemo: vi.fn(),
  sessionNotice: "", clearSessionNotice: vi.fn(),
}));
vi.mock("../src/context/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("../src/components/auth/GoogleSignInButton", () => ({
  default: ({ onCredential, disabled }) => (
    <button type="button" disabled={disabled} onClick={() => onCredential("google-id-token")}>
      Đăng nhập bằng Google
    </button>
  ),
}));

function Destination() {
  const location = useLocation();
  return <div data-testid="destination">{location.pathname}|{location.state?.email}</div>;
}

function setup(state) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: "/login", state }]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Destination />} />
      </Routes>
    </MemoryRouter>,
  );
}

function fill(email = "  minh@example.vn  ", password = "form-only-password") {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Mật khẩu"), { target: { value: password } });
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.sessionNotice = "";
  auth.login.mockResolvedValue({ user: { permissions: [] } });
  auth.loginWithGoogle.mockResolvedValue({ user: { permissions: [] } });
  auth.loginDemo.mockResolvedValue({});
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => vi.unstubAllGlobals());

describe("LocalMate login behavior", () => {
  it("keeps canonical logo, visible labels and password-manager autocomplete", () => {
    setup();
    expect(screen.getByAltText("LocalMate AI").getAttribute("src")).toContain("logo.jpg");
    expect(screen.getByLabelText("Email")).toHaveAttribute("name", "email");
    expect(screen.getByLabelText("Email")).toHaveAttribute("autocomplete", "username");
    expect(screen.getByLabelText("Mật khẩu")).toHaveAttribute("name", "password");
    expect(screen.getByLabelText("Mật khẩu")).toHaveAttribute("autocomplete", "current-password");
    expect(screen.getByRole("checkbox", { name: "Ghi nhớ đăng nhập" })).not.toBeChecked();
  });

  it.each([
    [[], "/home"],
    [["ManageUsers"], "/admin"],
  ])("preserves redirect using current permission snapshot %j", async (permissions, path) => {
    auth.login.mockResolvedValue({ user: { role: permissions.length ? "Admin" : "User", permissions } });
    setup();
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Đăng nhập", exact: true }));
    await waitFor(() => expect(screen.getByTestId("destination")).toHaveTextContent(path));
    expect(auth.login).toHaveBeenCalledWith("minh@example.vn", "form-only-password", false);
  });

  it("Admin role without permissions keeps existing normal-user redirect", async () => {
    auth.login.mockResolvedValue({ user: { role: "Admin", permissions: [] } });
    setup();
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Đăng nhập", exact: true }));
    await waitFor(() => expect(screen.getByTestId("destination")).toHaveTextContent("/home"));
  });

  it("remember label toggles checkbox and forwards true", async () => {
    setup();
    fill();
    fireEvent.click(screen.getByText("Ghi nhớ đăng nhập"));
    expect(screen.getByRole("checkbox")).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Đăng nhập", exact: true }));
    await waitFor(() => expect(auth.login).toHaveBeenCalledWith("minh@example.vn", "form-only-password", true));
  });

  it.each([false, true])("Google preserves remember selection %s and registered redirect", async (remember) => {
    auth.loginWithGoogle.mockResolvedValue({ user: { permissions: ["ManageUsers"] } });
    setup();
    if (remember) fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Đăng nhập bằng Google" }));
    await waitFor(() => expect(screen.getByTestId("destination")).toHaveTextContent("/admin"));
    expect(auth.loginWithGoogle).toHaveBeenCalledWith("google-id-token", remember);
  });

  it("show/hide keeps password value and does not write browser storage", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem");
    setup();
    fill();
    expect(screen.getByLabelText("Mật khẩu")).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: "Hiện mật khẩu" }));
    expect(screen.getByLabelText("Mật khẩu")).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("Mật khẩu")).toHaveValue("form-only-password");
    fireEvent.click(screen.getByRole("button", { name: "Ẩn mật khẩu" }));
    expect(screen.getByLabelText("Mật khẩu")).toHaveAttribute("type", "password");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("forgot password forwards trimmed current email", () => {
    setup();
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Quên mật khẩu?" }));
    expect(screen.getByTestId("destination")).toHaveTextContent("/forgot-password|minh@example.vn");
  });

  it("Demo stays independent of remember and navigates home", async () => {
    setup();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Trải nghiệm nhanh (Demo)" }));
    await waitFor(() => expect(screen.getByTestId("destination")).toHaveTextContent("/home"));
    expect(auth.loginDemo).toHaveBeenCalledWith();
    expect(auth.login).not.toHaveBeenCalled();
  });

  it.each([
    ["", "password", "Vui lòng nhập địa chỉ email."],
    ["bad-email", "password", "Định dạng email không hợp lệ."],
    ["valid@example.vn", "", "Vui lòng nhập mật khẩu."],
  ])("preserves input validation for %s", (email, password, message) => {
    setup();
    fill(email, password);
    fireEvent.click(screen.getByRole("button", { name: "Đăng nhập", exact: true }));
    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(auth.login).not.toHaveBeenCalled();
  });

  it.each([
    [{ code: "invalid_credentials", status: 401 }, "Email hoặc mật khẩu không chính xác."],
    [{ code: "account_locked", status: 403, message: "Tài khoản đã bị khoá." }, "Tài khoản đã bị khoá."],
    [{ code: "account_not_found", status: 401 }, "Email hoặc mật khẩu không chính xác."],
    [{ message: "Không kết nối được máy chủ." }, "Không kết nối được máy chủ."],
  ])("preserves error mapping for %j", async (error, message) => {
    auth.login.mockRejectedValue(error);
    setup();
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Đăng nhập", exact: true }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(message));
  });

  it("retains registration/reset success message and prefilled email", () => {
    setup({ registeredEmail: "registered@example.vn", message: "Mật khẩu đã được cập nhật." });
    expect(screen.getByRole("status")).toHaveTextContent("Mật khẩu đã được cập nhật.");
    expect(screen.getByLabelText("Email")).toHaveValue("registered@example.vn");
  });

  it("sessionNotice takes precedence and is retained as an accessible alert", () => {
    auth.sessionNotice = "Phiên đã kết thúc.";
    setup({ message: "old success" });
    expect(screen.getByRole("alert")).toHaveTextContent("Phiên đã kết thúc.");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(auth.clearSessionNotice).toHaveBeenCalled();
  });

  it("disables form and alternate login while email login is pending", async () => {
    let resolve;
    auth.login.mockReturnValue(new Promise((r) => { resolve = r; }));
    setup();
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Đăng nhập", exact: true }));
    expect(screen.getByRole("button", { name: "Đang đăng nhập..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Đăng nhập bằng Google" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Trải nghiệm nhanh (Demo)" })).toBeDisabled();
    expect(screen.getByLabelText("Email")).toBeDisabled();
    resolve({ user: { permissions: [] } });
    await waitFor(() => expect(screen.getByTestId("destination")).toHaveTextContent("/home"));
  });

  it.each([
    ["Đăng ký", "/register"],
    ["Quay lại trang chủ", "/"],
    ["LocalMate AI - Trang chủ", "/"],
  ])("preserves navigation from %s", (button, target) => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: button }));
    expect(screen.getByTestId("destination").textContent).toBe(target + "|");
  });
});

describe("Local travel media safety", () => {
  it("does not request video on mobile or with reduced motion", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    const { container } = render(<LoginTravelPanel />);
    expect(container.querySelector("video")).toBeNull();
    expect(screen.getByText("Khám phá thành phố theo nhịp Metro.")).toBeInTheDocument();
  });

  it("desktop video is local, silent, inline and falls back safely on error", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    const { container } = render(<LoginTravelPanel />);
    const video = container.querySelector("video");
    expect(video).toHaveAttribute("src", "/landing/hero.mp4");
    expect(video.muted).toBe(true);
    expect(video).toHaveAttribute("playsinline");
    fireEvent.error(video);
    expect(container.querySelector("video")).toBeNull();
    expect(screen.getByText("Khám phá thành phố theo nhịp Metro.")).toBeInTheDocument();
  });
});
