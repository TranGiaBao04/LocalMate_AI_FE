import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import App from "../src/App";
import BottomNavigation, { NavigationItem, SideNavigation } from "../src/components/layout/BottomNavigation";
import PageHeader from "../src/components/layout/PageHeader";
import MobileLayout from "../src/components/layout/MobileLayout";
import { PLAN_CODES, PLAN_DISPLAY_NAMES } from "../src/utils/subscriptionUtils";

const state = vi.hoisted(() => ({ auth: {}, trip: {}, plan: {} }));
vi.mock("../src/context/AuthContext", () => ({ useAuth: () => state.auth }));
vi.mock("../src/context/TripContext", () => ({ useTrip: () => state.trip }));
vi.mock("../src/context/SubscriptionContext", () => ({ useSubscription: () => state.plan }));

// Real App controls shell visibility; page mocks isolate navigation from domain fetches.
vi.mock("../src/pages/auth/WelcomePage", () => ({ default: () => null }));
vi.mock("../src/pages/auth/LoginPage", () => ({ default: () => null }));
vi.mock("../src/pages/auth/RegisterPage", () => ({ default: () => null }));
vi.mock("../src/pages/auth/ForgotPasswordPage", () => ({ default: () => null }));
vi.mock("../src/pages/metro/MetroStationsPage", () => ({ default: () => null }));
vi.mock("../src/pages/home/HomePage", () => ({ default: () => null }));
vi.mock("../src/pages/profile/ProfilePage", () => ({ default: () => null }));
vi.mock("../src/pages/subscription/SubscriptionPage", () => ({ default: () => null }));
vi.mock("../src/pages/subscription/PaymentReturnPage", () => ({ default: () => null }));
vi.mock("../src/pages/trip/CreateTripPage", () => ({ default: () => null }));
vi.mock("../src/pages/trip/AiLoadingPage", () => ({ default: () => null }));
vi.mock("../src/pages/trip/DraftItineraryPage", () => ({ default: () => null }));
vi.mock("../src/pages/trip/PlacePreviewPage", () => ({ default: () => null }));
vi.mock("../src/pages/trip/ReplacePlacePage", () => ({ default: () => null }));
vi.mock("../src/pages/trip/FinalizedItineraryPage", () => ({ default: () => null }));
vi.mock("../src/pages/trip/MyTripsPage", () => ({ default: () => null }));
vi.mock("../src/pages/trip/SavedTripDetailPage", () => ({ default: () => null }));
vi.mock("../src/pages/trip/CuratedItinerariesPage", () => ({ default: () => null }));

const items = [
  ["Trang chủ", "Trang chủ", "/home"],
  ["Lịch trình", "Lịch trình", "/trips"],
  ["Ga Metro", "Metro", "/metro"],
  ["Khám phá", "Khám phá", "/explore"],
  ["Gói hội viên", "Hội viên", "/subscription"],
  ["Tài khoản", "Tài khoản", "/profile"],
];

function Location() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

function setup(element, path = "/home") {
  return render(<MemoryRouter initialEntries={[path]}>{element}<Location /></MemoryRouter>);
}

beforeEach(() => {
  state.auth = { user: { id: "existing-user", fullName: "Nguyễn Minh", permissions: [] }, isDemo: false, isLoggedIn: true, initializing: false };
  state.trip = { savedTrips: [{ id: "one" }, { id: "two" }] };
  state.plan = { subscription: { plan: PLAN_CODES.FREE } };
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
  vi.stubGlobal("scrollTo", vi.fn());
});
afterEach(() => vi.unstubAllGlobals());

describe("USER-A1 preserved navigation contracts", () => {
  it.each(["side", "bottom"])("preserves six labels, ordering and destinations: %s", (variant) => {
    setup(variant === "side" ? <SideNavigation /> : <BottomNavigation />);
    const nav = screen.getByRole("navigation", { name: variant === "side" ? "Điều hướng chính" : "Điều hướng di động" });
    const buttons = within(nav).getAllByRole("button");
    expect(buttons).toHaveLength(6);
    items.forEach(([label, shortLabel, path], index) => {
      expect(buttons[index]).toHaveAccessibleName(variant === "side" && index === 1 ? `${label} 2 đã lưu` : variant === "side" ? label : shortLabel);
      expect(buttons[index]).toHaveAttribute("type", "button");
      fireEvent.click(buttons[index]);
      expect(screen.getByTestId("location")).toHaveTextContent(path);
    });
  });

  it.each([
    ["/trips", "Lịch trình"], ["/trips/real-id", "Lịch trình"],
    ["/draft", "Lịch trình"], ["/replace/item-id", "Lịch trình"],
    ["/finalized", "Lịch trình"], ["/create", "Khám phá"],
    ["/create/step", "Khám phá"], ["/explore", "Khám phá"],
  ])("preserves desktop parent selection at %s", (path, label) => {
    setup(<SideNavigation />, path);
    const selected = screen.getByRole("navigation", { name: "Điều hướng chính" }).querySelectorAll('[aria-current="page"]');
    expect(selected).toHaveLength(1);
    expect(selected[0]).toHaveAccessibleName(new RegExp(label));
  });

  it.each(["/trips-extra", "/explorer", "/subscription-extra"])("does not broaden desktop matching at %s", (path) => {
    setup(<SideNavigation />, path);
    expect(screen.getByRole("navigation").querySelector('[aria-current="page"]')).toBeNull();
  });

  it.each(items)("preserves exact mobile selection for %s", (_label, shortLabel, path) => {
    setup(<BottomNavigation />, path);
    const selected = screen.getByRole("navigation").querySelectorAll('[aria-current="page"]');
    expect(selected).toHaveLength(1);
    expect(selected[0]).toHaveAccessibleName(shortLabel);
  });

  it.each(["/trips/real-id", "/create", "/draft", "/replace/item-id", "/finalized"])("does not introduce nested mobile matching at %s", (path) => {
    setup(<BottomNavigation />, path);
    expect(screen.getByRole("navigation").querySelector('[aria-current="page"]')).toBeNull();
  });

  it.each(items)("real App retains bottom nav at %s", (_label, _shortLabel, path) => {
    setup(<App />, path);
    expect(screen.getByRole("navigation", { name: "Điều hướng di động" })).toBeInTheDocument();
  });

  it.each(["/create", "/draft", "/replace/item-id", "/finalized", "/trips/real-id", "/place/place-id", "/loading", "/payment/success", "/payment/cancel", "/login", "/register", "/forgot-password", "/about"])("real App retains hidden bottom nav at %s", (path) => {
    setup(<App />, path);
    expect(screen.queryByRole("navigation", { name: "Điều hướng di động" })).not.toBeInTheDocument();
  });

  it("does not expose User shell during an unauthenticated session", () => {
    state.auth.isLoggedIn = false;
    state.auth.user = null;
    setup(<App />);
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/login");
  });

  it.each([[], undefined, "ManageUsers"])("Admin role alone cannot expose Admin entry: %j", (permissions) => {
    state.auth.user = { ...state.auth.user, role: "Admin", permissions };
    setup(<SideNavigation />);
    expect(screen.queryByRole("button", { name: "Về giao diện quản trị" })).not.toBeInTheDocument();
  });

  it("uses the actual permission snapshot for Admin entry and destination", () => {
    state.auth.user.permissions = ["ManageUsers"];
    setup(<SideNavigation />);
    fireEvent.click(screen.getByRole("button", { name: "Về giao diện quản trị" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/admin");
  });

  it.each([0, 2, 103])("uses savedTrips count without fetching or changing context: %i", (count) => {
    state.trip.savedTrips = Array.from({ length: count }, (_, id) => ({ id }));
    const snapshot = structuredClone(state);
    setup(<SideNavigation />);
    expect(screen.getByRole("button", { name: `Lịch trình ${count} đã lưu` })).toBeInTheDocument();
    expect(state).toEqual(snapshot);
  });

  it.each([PLAN_CODES.FREE, PLAN_CODES.TRIP_PASS, PLAN_CODES.MEMBERSHIP])("retains server plan presentation and navigation: %s", (plan) => {
    state.plan.subscription = { plan };
    setup(<SideNavigation />);
    const badge = plan === PLAN_CODES.FREE ? "Mặc định" : "Đang dùng";
    const panel = screen.getByRole("button", { name: new RegExp(`${PLAN_DISPLAY_NAMES[plan]} ${badge}`) });
    panel.focus();
    expect(panel).toHaveFocus();
    fireEvent.click(panel);
    expect(screen.getByTestId("location")).toHaveTextContent("/subscription");
  });

  it("retains the existing Free fallback when subscription is unavailable", () => {
    state.plan.subscription = null;
    setup(<SideNavigation />);
    expect(screen.getByText("Mặc định")).toBeInTheDocument();
  });

  it("preserves Demo plan, profile and avatar fallback", () => {
    state.auth = { ...state.auth, user: null, isDemo: true };
    state.plan.subscription = null;
    setup(<SideNavigation />);
    expect(screen.getByText("Demo")).toBeInTheDocument();
    expect(screen.getByText("Đăng ký để sử dụng đầy đủ")).toBeInTheDocument();
    const profile = screen.getByRole("button", { name: "Khách Phiên Demo" });
    expect(within(profile).getByText("K")).toBeInTheDocument();
    profile.focus();
    expect(profile).toHaveFocus();
    fireEvent.click(profile);
    expect(screen.getByTestId("location")).toHaveTextContent("/profile");
  });

  it("keeps full long identity and unknown plan available without replacing data", () => {
    const name = "Nguyễn Thị Minh Hương với tên tiếng Việt rất dài";
    const plan = "GóiHộiViênCóTênRấtDàiKhôngCóKhoảngTrắng";
    state.auth.user.fullName = name;
    state.plan.subscription = { plan };
    setup(<SideNavigation />);
    expect(screen.getByRole("button", { name: `${name} ${plan}` })).toBeInTheDocument();
    expect(screen.getByText(name)).toHaveAttribute("title", name);
    expect(screen.getAllByText(plan)).toHaveLength(2);
    expect(screen.getByAltText("LocalMate AI").getAttribute("src")).toContain("logo.jpg");
  });

  it.each([false, true])("home logo scroll behavior respects reduced motion: %s", (reduced) => {
    window.matchMedia.mockReturnValue({ matches: reduced });
    setup(<SideNavigation />);
    fireEvent.click(screen.getByRole("button", { name: "LocalMate AI, về Trang chủ" }));
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: reduced ? "auto" : "smooth" });
    expect(screen.getByTestId("location")).toHaveTextContent("/home");
  });

  it("home logo navigates from another route before immediate scrolling", () => {
    setup(<SideNavigation />, "/trips");
    fireEvent.click(screen.getByRole("button", { name: "LocalMate AI, về Trang chủ" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/home");
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "auto" });
  });
});

describe("USER-A1 shared presentation contracts", () => {
  it("preserves full long header title and existing child actions and handlers", () => {
    const title = "Khám phá thành phố Hồ Chí Minh theo nhịp Metro với hành trình rất dài";
    const action = vi.fn();
    render(<PageHeader title={title}><div><input aria-label="Tìm kiếm" /></div><button onClick={action}>Làm mới</button></PageHeader>);
    expect(screen.getByRole("heading", { name: title, level: 1 })).toHaveAttribute("title", title);
    expect(screen.getByRole("textbox", { name: "Tìm kiếm" })).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Làm mới" });
    button.focus();
    expect(button).toHaveFocus();
    fireEvent.click(button);
    expect(action).toHaveBeenCalledOnce();
  });

  it("preserves non-string header titles and child-free rendering", () => {
    render(<PageHeader title={<span>Ga Metro</span>} />);
    expect(screen.getByRole("heading", { name: "Ga Metro" })).toBeInTheDocument();
  });

  it("preserves layout children and caller-owned content classes/offsets", () => {
    render(<MobileLayout className="custom-layout"><main className="pt-20 pb-28">Nội dung hiện có</main></MobileLayout>);
    const content = screen.getByText("Nội dung hiện có");
    expect(content.parentElement).toHaveClass("app-shell", "custom-layout");
    expect(content).toHaveClass("pt-20", "pb-28");
  });

  it("navigation remains keyboard-focusable and hides decorative icon names", () => {
    const click = vi.fn();
    render(<NavigationItem item={{ label: "Khám phá", icon: "explore" }} isActive onClick={click} />);
    const button = screen.getByRole("button", { name: "Khám phá" });
    button.focus();
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("explore")).toHaveAttribute("aria-hidden", "true");
    fireEvent.click(button);
    expect(click).toHaveBeenCalledOnce();
  });
});
