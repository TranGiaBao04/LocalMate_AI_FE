import { StrictMode, useLayoutEffect } from "react";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TripProvider, useTrip } from "../src/context/TripContext";
import MyTripsPage from "../src/pages/trip/MyTripsPage";
import SavedTripDetailPage from "../src/pages/trip/SavedTripDetailPage";
import { mapMyTrip, mapTrip } from "../src/utils/tripMapper";
import { STORAGE_KEYS } from "../src/constants";

const mock = vi.hoisted(() => ({ auth: null, refresh: vi.fn(), service: {
  getTrips: vi.fn(), getTripById: vi.fn(), generateTrip: vi.fn(), explainTrip: vi.fn(),
  saveTrip: vi.fn(), deleteTrip: vi.fn(), finalizeTrip: vi.fn(), replaceItem: vi.fn(),
  deleteItem: vi.fn(), markVisited: vi.fn(),
} }));
vi.mock("../src/context/AuthContext", () => ({ useAuth: () => mock.auth }));
vi.mock("../src/context/NotificationContext", () => ({ useNotifications: () => ({ refreshUnreadCount: mock.refresh }) }));
vi.mock("../src/services/tripService", () => ({ tripService: mock.service }));
vi.mock("../src/services/masterDataService", () => ({ masterDataService: {
  getMasterData: async () => ({ reviewQuickTags: [] }),
} }));

const A = { user: { id: "owner-a" }, isLoggedIn: true, isDemo: false, initializing: false };
const B = { ...A, user: { id: "owner-b" } };
const OUT = { user: null, isLoggedIn: false, isDemo: false, initializing: false };
const DEMO = { user: { id: "demo" }, isLoggedIn: true, isDemo: true, initializing: false };
const raw = (id, stationName) => ({ id, stationName, status: "Draft", durationHours: 2,
  itemCount: 1, estimatedBudget: 0, createdAt: "2026-10-09T00:00:00Z", items: [{
    itemId: `${id}-item`, placeId: `${id}-place`, placeName: stationName, orderIndex: 1,
    scheduledTime: "09:00:00", estimatedDurationMinutes: 60, estimatedBudget: 0, isVisited: false,
  }] });
const rawA = raw("trip-a", "PRIVATE_A");
const rawB = raw("trip-b", "OWN_B");
const tripA = mapTrip(rawA);
const tripB = mapTrip(rawB);
const requestA = { note: "PRIVATE_REQUEST_A", durationHours: 2 };
let current;
let observed;
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function Probe({ detail = false }) {
  const value = useTrip();
  const state = { owner: mock.auth.user?.id, saved: value.savedTrips.map((t) => t.id),
    current: value.currentTrip?.id ?? null, request: value.request, loading: value.tripsLoading,
    loaded: value.tripsLoaded, error: value.tripsError, explaining: value.explainingTripIds };
  observed.push(state);
  useLayoutEffect(() => { current = value; });
  return <><output data-testid="trip-state">{JSON.stringify(state)}</output>{detail
    ? <Routes><Route path="/trips/:tripId" element={<SavedTripDetailPage />} /></Routes>
    : <MyTripsPage />}</>;
}
function Shell({ detail = false }) {
  return <MemoryRouter initialEntries={["/trips/trip-a"]}><TripProvider><Probe detail={detail} /></TripProvider></MemoryRouter>;
}
const state = () => JSON.parse(screen.getByTestId("trip-state").textContent);
const settled = async () => { await act(async () => {}); };
function mount(auth = A) {
  mock.auth = auth;
  const view = render(<Shell auth={auth} />);
  return { ...view, switchTo: async (next) => { mock.auth = next; view.rerender(<Shell auth={next} />); await settled(); } };
}
const consume = (promise) => promise.then((value) => ({ value }), (error) => ({ error }));

beforeEach(() => {
  current = null; observed = [];
  localStorage.clear(); sessionStorage.clear();
  vi.resetAllMocks();
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected live network forbidden"); }));
  mock.service.getTrips.mockImplementation(async () => [mapMyTrip(mock.auth.user?.id === A.user.id ? rawA : rawB)]);
  mock.service.getTripById.mockImplementation(async (id) => id === tripA.id ? tripA : tripB);
});

describe("owner generations, storage and normal Trip contracts", () => {
  it.each(["resolve", "reject"])("stale A list %s cannot change B loading/error or storage", async (outcome) => {
    const a = deferred(), b = deferred();
    mock.service.getTrips.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    const view = mount(); await settled(); await view.switchTo(B);
    const before = { ...localStorage };
    await act(async () => outcome === "resolve" ? a.resolve([mapMyTrip(rawA)]) : a.reject(new Error("A private failure")));
    expect(state()).toMatchObject({ saved: [], loading: true, loaded: false, error: false });
    expect({ ...localStorage }).toEqual(before);
    await act(async () => b.resolve([mapMyTrip(rawB)]));
    expect(state()).toMatchObject({ saved: [tripB.id], loading: false, loaded: true, error: false });
  });
  it("stale detail rejection is isolated while B detail resolves normally", async () => {
    const a = deferred(); mock.service.getTripById.mockReturnValueOnce(a.promise);
    const view = mount(); await settled(); const old = consume(current.fetchTrip(tripA.id));
    await view.switchTo(B);
    await act(async () => { await current.fetchTrip(tripB.id); });
    let result; await act(async () => { a.reject(new Error("Private A error")); result = await old; });
    expect(result.error.code).toBe("trip_session_changed");
    expect(state()).toMatchObject({ saved: [tripB.id], current: null, request: null, error: false });
  });
  it("logout then A login resumes A storage but rejects its previous session completion", async () => {
    const view = mount(); await settled();
    act(() => { current.setRequest(requestA); current.setCurrentTrip(tripA); });
    const a = deferred(); mock.service.getTripById.mockReturnValueOnce(a.promise);
    const old = consume(current.fetchTrip("old-private-id"));
    await view.switchTo(OUT); expect(state()).toMatchObject({ current: null, request: null, saved: [] });
    await view.switchTo(A);
    let result; await act(async () => { a.resolve({ ...tripA, id: "old-private-id" }); result = await old; });
    expect(result.error.code).toBe("trip_session_changed");
    expect(state().current).toBe(tripA.id); expect(state().request).toEqual(requestA);
    expect(state().saved).not.toContain("old-private-id");
  });
  it("A to Demo to B never shares persisted private values; Demo draft stays memory-only", async () => {
    const view = mount(); await settled();
    act(() => { current.setRequest(requestA); current.setCurrentTrip(tripA); });
    const before = { ...localStorage };
    await view.switchTo(DEMO); expect(state()).toMatchObject({ current: null, request: null, saved: [] });
    act(() => { current.setCurrentTrip({ ...tripB, id: "demo-trip" }); current.setRequest({ note: "demo-only" }); });
    expect({ ...localStorage }).toEqual(before);
    await view.switchTo(B); expect(state()).toMatchObject({ current: null, request: null });
    await view.switchTo(A); expect(state().current).toBe(tripA.id);
  });
  it.each([{ ...A, initializing: true }, { ...A, user: {} }, OUT])("unavailable identity cannot restore or write private state", async (auth) => {
    mount(auth); await settled();
    expect(state()).toMatchObject({ current: null, request: null, saved: [] });
    expect(() => current.setCurrentTrip(tripA)).toThrow();
    expect(() => current.setRequest(requestA)).toThrow();
    expect(localStorage.length).toBe(0); expect(mock.service.getTrips).not.toHaveBeenCalled();
  });
  it("owner namespace preserves A and B resumes independently without deleting legacy data", async () => {
    localStorage.setItem(STORAGE_KEYS.TRIP_DRAFT, JSON.stringify({ id: "legacy" }));
    const view = mount(); await settled();
    act(() => { current.setCurrentTrip(tripA); current.setRequest(requestA); });
    await view.switchTo(B);
    act(() => { current.setCurrentTrip(tripB); current.setRequest({ note: "B request" }); });
    await view.switchTo(A); expect(state().current).toBe(tripA.id); expect(state().request).toEqual(requestA);
    await view.switchTo(B); expect(state().current).toBe(tripB.id); expect(state().request).toEqual({ note: "B request" });
    expect(localStorage.getItem(STORAGE_KEYS.TRIP_DRAFT)).toBe(JSON.stringify({ id: "legacy" }));
    act(() => current.setCurrentTrip(null));
    await view.switchTo(A); expect(state().current).toBe(tripA.id);
  });
  it("same-owner rerender does not reset currentTrip/request or refetch list", async () => {
    const view = mount(); await settled();
    act(() => { current.setCurrentTrip(tripA); current.setRequest(requestA); });
    await view.switchTo({ ...A, user: { ...A.user, fullName: "Updated name" } });
    expect(state().current).toBe(tripA.id); expect(state().request).toEqual(requestA);
    expect(mock.service.getTrips).toHaveBeenCalledTimes(1);
  });
  it("retained old-owner setters cannot write to memory or storage", async () => {
    const view = mount(); await settled(); const old = current;
    await view.switchTo(B); const before = { ...localStorage };
    expect(() => old.setCurrentTrip(tripA)).toThrow(); expect(() => old.setRequest(requestA)).toThrow();
    expect({ ...localStorage }).toEqual(before); expect(state().current).toBeNull();
  });

  const operations = [
    ["fetchTrip", "getTripById", (ctx) => ctx.fetchTrip(tripA.id)],
    ["generateTrip", "generateTrip", (ctx) => ctx.generateTrip(requestA)],
    ["saveTrip", "saveTrip", (ctx) => ctx.saveTrip(tripA)],
    ["deleteTrip", "deleteTrip", (ctx) => ctx.deleteTrip(tripA.id)],
    ["finalizeTrip", "finalizeTrip", (ctx) => ctx.finalizeTrip(tripA.id, { fundingSource: "SingleEntitlement", entitlementId: "entitlement-a" })],
    ["replaceItem", "replaceItem", (ctx) => ctx.replaceItem(tripA.id, "item-a", "place-new")],
    ["deleteItem", "deleteItem", (ctx) => ctx.deleteItem(tripA.id, "item-a")],
    ["markVisited", "markVisited", (ctx) => ctx.markVisited(tripA.id, "item-a")],
    ["explainTrip", "explainTrip", (ctx) => ctx.explainTrip(tripA.id)],
  ];
  it.each(operations)("late %s cannot update B, follow up, notify or write storage", async (_name, method, invoke) => {
    const view = mount(); await settled();
    act(() => { current.setCurrentTrip(tripA); current.setRequest(requestA); });
    const pending = deferred(); mock.service[method].mockReturnValueOnce(pending.promise);
    let old; act(() => { old = consume(invoke(current)); });
    await view.switchTo(B); const before = { ...localStorage };
    let result; await act(async () => { pending.resolve(tripA); result = await old; });
    expect(result.error.code).toBe("trip_session_changed");
    expect(state()).toMatchObject({ saved: [tripB.id], current: null, request: null, explaining: [], error: false });
    expect({ ...localStorage }).toEqual(before); expect(mock.refresh).not.toHaveBeenCalled();
    expect(mock.service.getTripById).toHaveBeenCalledTimes(method === "getTripById" ? 1 : 0);
  });
  it.each(operations)("same-owner %s service errors preserve the original error", async (_name, method, invoke) => {
    mount(); await settled(); const error = Object.assign(new Error("Server failure"), { status: 403, code: "original-code" });
    mock.service[method].mockRejectedValueOnce(error);
    let result; await act(async () => { result = await consume(invoke(current)); });
    expect(result.error).toBe(error); expect(mock.refresh).not.toHaveBeenCalled();
  });
  it("normal save/finalize/upsert and update workflows preserve IDs, funding and refresh", async () => {
    mount(); await settled(); act(() => current.setCurrentTrip(tripA));
    mock.service.saveTrip.mockResolvedValue(tripA);
    mock.service.finalizeTrip.mockResolvedValue({ ...tripA, status: "finalized" });
    mock.service.replaceItem.mockResolvedValue({ warnings: [] });
    mock.service.deleteItem.mockResolvedValue(null); mock.service.markVisited.mockResolvedValue(null);
    mock.service.deleteTrip.mockResolvedValue(null);
    const funding = { fundingSource: "SingleEntitlement", entitlementId: "entitlement-a" };
    await act(async () => { await current.saveTrip(tripA); await current.saveTrip(tripA); });
    expect(state().saved).toEqual([tripA.id]); expect(mock.service.saveTrip).toHaveBeenCalledWith(tripA.id);
    await act(async () => { await current.finalizeTrip(tripA.id, funding); });
    expect(mock.service.finalizeTrip).toHaveBeenCalledWith(tripA.id, funding); expect(mock.refresh).toHaveBeenCalledTimes(1);
    await act(async () => { await current.finalizeTrip(tripA.id, { fundingSource: "Normal" }); });
    expect(mock.service.finalizeTrip).toHaveBeenLastCalledWith(tripA.id, { fundingSource: "Normal" });
    await act(async () => {
      expect(await current.replaceItem(tripA.id, "item", "place")).toEqual({ warnings: [] });
      expect(await current.deleteItem(tripA.id, "item")).toEqual(tripA.items);
      expect(await current.markVisited(tripA.id, "item")).toEqual(tripA);
    });
    expect(mock.service.replaceItem).toHaveBeenCalledWith(tripA.id, "item", "place");
    expect(mock.service.markVisited).toHaveBeenCalledWith("item");
    await act(async () => { await current.deleteTrip(tripA.id); });
    expect(state().saved).toEqual([]); expect(state().current).toBe(tripA.id);
  });
  it("same-owner explain deduplicates, refreshes detail and clears pending IDs", async () => {
    mount(); await settled(); const pending = deferred(); mock.service.explainTrip.mockReturnValueOnce(pending.promise);
    let first, second; act(() => { first = current.explainTrip(tripA.id); second = current.explainTrip(tripA.id); });
    expect(first).toBe(second); expect(mock.service.explainTrip).toHaveBeenCalledTimes(1);
    expect(state().explaining).toEqual([tripA.id]);
    await act(async () => { pending.resolve(); expect(await first).toEqual(tripA); });
    expect(state().explaining).toEqual([]); expect(mock.service.getTripById).toHaveBeenCalledWith(tripA.id);
  });
  it("current-owner list error and retry retain expected loading state", async () => {
    mock.service.getTrips.mockRejectedValueOnce(new Error("List failure"));
    mount(); await settled(); expect(state()).toMatchObject({ error: true, loaded: true, loading: false });
    await act(async () => { current.retryTrips(); });
    expect(state()).toMatchObject({ error: false, loaded: true, saved: [tripA.id] });
  });
  it("actual SavedTripDetailPage consumes mapped same-account detail normally", async () => {
    mock.auth = A;
    render(<Shell auth={A} detail />);
    await screen.findByRole("heading", { level: 1, name: tripA.title });
    expect(state().saved).toEqual([tripA.id]); expect(mock.service.getTripById).toHaveBeenCalledWith(tripA.id);
  });
  it("StrictMode keeps valid owner state and list guards coherent", async () => {
    mock.auth = A;
    render(<StrictMode><Shell auth={A} /></StrictMode>); await settled();
    act(() => { current.setCurrentTrip(tripA); current.setRequest(requestA); });
    expect(state()).toMatchObject({ current: tripA.id, request: requestA, saved: [tripA.id] });
  });
});
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); sessionStorage.clear(); });

describe("B03 dev-baseline reproduction and isolation", () => {
  it("direct A to B does not reveal A records before effects or after old detail resolves", async () => {
    const view = mount(); await settled();
    act(() => { current.setCurrentTrip(tripA); current.setRequest(requestA); });
    const pending = deferred(); mock.service.getTripById.mockReturnValueOnce(pending.promise);
    const old = consume(current.fetchTrip(tripA.id));
    await view.switchTo(B);
    await act(async () => { await current.fetchTrip(tripB.id); });
    await act(async () => { pending.resolve(tripA); await old; });
    expect(screen.queryByText(tripA.title)).not.toBeInTheDocument();
    expect(state().saved).not.toContain(tripA.id);
    expect(state().current).not.toBe(tripA.id);
    expect(state().request).not.toEqual(requestA);
    expect(observed.filter((s) => s.owner === B.user.id).every((s) => !s.saved.includes(tripA.id) && s.current !== tripA.id && s.request?.note !== requestA.note)).toBe(true);
  });
  it("logout/session-ended transition then B login rejects late A detail and private state", async () => {
    const view = mount(); await settled();
    act(() => { current.setCurrentTrip(tripA); current.setRequest(requestA); });
    const pending = deferred(); mock.service.getTripById.mockReturnValueOnce(pending.promise);
    const old = consume(current.fetchTrip(tripA.id));
    await view.switchTo(OUT); await view.switchTo(B);
    await act(async () => { pending.resolve(tripA); await old; });
    expect(screen.queryByText(tripA.title)).not.toBeInTheDocument();
    expect(state().current).toBeNull(); expect(state().request).toBeNull();
  });
  it("late A list cannot replace the resolved B list", async () => {
    const pending = deferred(); mock.service.getTrips.mockReturnValueOnce(pending.promise);
    const view = mount(); await settled(); await view.switchTo(B);
    await act(async () => pending.resolve([mapMyTrip(rawA)]));
    expect(state().saved).toEqual([tripB.id]); expect(state().error).toBe(false);
  });
  it.each([B, OUT, DEMO])("unowned legacy storage is not restored for $user.id", async (auth) => {
    localStorage.setItem(STORAGE_KEYS.TRIP_DRAFT, JSON.stringify(tripA));
    localStorage.setItem(STORAGE_KEYS.TRIP_REQUEST, JSON.stringify(requestA));
    mount(auth); await settled();
    expect(state().current).toBeNull(); expect(state().request).toBeNull();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.TRIP_DRAFT))).toEqual(tripA);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.TRIP_REQUEST))).toEqual(requestA);
  });
  it("same account refresh resumes values written by that owner", async () => {
    const view = mount(); await settled();
    act(() => { current.setCurrentTrip(tripA); current.setRequest(requestA); });
    view.unmount(); mount(A); await settled();
    expect(state().current).toBe(tripA.id); expect(state().request).toEqual(requestA);
  });
});
