import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ReplacePlacePage from "../src/pages/trip/ReplacePlacePage";
import * as Trip from "../src/context/TripContext";
import { tripService } from "../src/services/tripService";

const alt = (placeId, name, openingStatus) => ({ placeId, name, openingStatus, address: "Quận 1", stationName: "Bến Thành",
  distanceFromStationMeters: 300, category: "Cafe", estimatedCostMin: 30000, estimatedCostMax: 50000, matchScore: 0.5 });
let replaceItem;

beforeEach(() => {
  vi.restoreAllMocks();
  replaceItem = vi.fn();
  vi.spyOn(Trip, "useTrip").mockImplementation(() => ({
    currentTrip: { id: "trip-one", items: [{ id: "item-one", placeName: "Quán cũ" }] }, replaceItem }));
  vi.spyOn(tripService, "getItemAlternatives").mockResolvedValue([
    alt("p1", "Quán đang mở", "Open"), alt("p2", "Quán chưa rõ giờ", "Unknown"), alt("p3", "Quán đã đóng", "Closed")]);
});
async function mount() {
  render(<MemoryRouter initialEntries={["/replace/item-one"]}>
    <Routes><Route path="/replace/:itemId" element={<ReplacePlacePage />} /></Routes></MemoryRouter>);
  await act(async () => {});
}

describe("ReplacePlacePage opening status", () => {
  it("keeps BE order, labels open/closed suggestions and still allows a closed pick", async () => {
    await mount();
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent))
      .toEqual(["Quán đang mở", "Quán chưa rõ giờ", "Quán đã đóng"]);
    expect(screen.getAllByText("Mở cửa vào giờ này")).toHaveLength(1);
    expect(screen.getAllByText("Có thể đã đóng cửa giờ này")).toHaveLength(1);
    expect(screen.getByText(/được xếp cuối danh sách/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Chọn địa điểm này" })[2]).toBeEnabled();
  });
  it("maps replacement_too_long to a Vietnamese message", async () => {
    replaceItem.mockRejectedValue({ code: "replacement_too_long" });
    await mount();
    fireEvent.click(screen.getAllByRole("button", { name: "Chọn địa điểm này" })[0]);
    await act(async () => {});
    expect(replaceItem).toHaveBeenCalledWith("trip-one", "item-one", "p1");
    expect(screen.getByText("Thay địa điểm này sẽ làm lịch dài quá 24 giờ. Hãy chọn địa điểm khác.")).toBeInTheDocument();
  });
});
