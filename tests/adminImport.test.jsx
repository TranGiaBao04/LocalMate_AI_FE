import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import ImportStepperPage from "../src/pages/admin/ImportStepperPage";
import FileUploadStep from "../src/components/admin/import/FileUploadStep";
import ImportPreviewTable from "../src/components/admin/import/ImportPreviewTable";
import ImportResultSummary from "../src/components/admin/import/ImportResultSummary";
import DownloadTemplateButton from "../src/components/admin/import/DownloadTemplateButton";
const mocks = vi.hoisted(() => ({
  places: { previewImport: vi.fn(), commitImport: vi.fn(), getImportTemplate: vi.fn(), getErrorReportUrl: vi.fn() },
}));
vi.mock("../src/services/adminPlaceService", () => ({ adminPlaceService: mocks.places }));
const preview = { importId: "exact-import-id", totalRows: 4, validRowsCount: 3, errorRowsCount: 1, warningRowsCount: 1, rows: [
  { rowNumber: 2, isValid: true, rawName: "Hợp lệ API", rawAddress: "Địa chỉ API", normalizedCategory: "Cafe", latitude: 10.78, longitude: 106.7, estimatedCostMin: 10000, estimatedCostMax: 20000, matchedStationNames: ["Bến Thành"], warnings: [], errors: [] },
  { rowNumber: 3, isValid: true, rawName: "Cảnh báo API", rawAddress: "Địa chỉ cảnh báo", rawCategory: "Food", rawCoordinates: "tọa độ thô", rawStations: "ga thô", warnings: ["Nghi trùng tên"], errors: [] },
  { rowNumber: 4, isValid: false, rawName: "Lỗi API", errors: ["Địa chỉ thiếu"], warnings: ["Ngoài vùng ga"] },
] };
const result = { importId: preview.importId, committedCount: 2, skippedCount: 7, failedCount: 1 };
const mount = (path = "/admin/import") => render(<MemoryRouter initialEntries={[path]}><ImportStepperPage /></MemoryRouter>);
const file = () => new File(["Name,Address"], "places.csv", { type: "text/csv" });
async function toPreview() {
  fireEvent.change(screen.getByLabelText("Chọn file địa điểm CSV hoặc Excel"), { target: { files: [file()] } });
  await screen.findByRole("heading", { name: "Thẩm định dữ liệu" });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.places.previewImport.mockResolvedValue(preview);
  mocks.places.commitImport.mockResolvedValue(result);
  mocks.places.getErrorReportUrl.mockReturnValue("/existing-helper-test-only");
  mocks.places.getImportTemplate.mockResolvedValue(new Blob(["template"]));
  vi.spyOn(window, "alert").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());
describe("A4 Import state machine", () => {
  it.each(["/admin/import", "/admin/places/import"])("route %s preserves file -> preview -> commit with exact ID/mode", async (path) => {
    mount(path); const selected = file();
    fireEvent.change(screen.getByLabelText("Chọn file địa điểm CSV hoặc Excel"), { target: { files: [selected] } });
    await screen.findByRole("heading", { name: "Thẩm định dữ liệu" });
    expect(mocks.places.previewImport).toHaveBeenCalledWith(selected);
    fireEvent.click(screen.getByRole("button", { name: /Xác nhận Import/ }));
    await screen.findByRole("heading", { name: /Hoàn tất tiến trình/ });
    expect(mocks.places.commitImport).toHaveBeenCalledWith({ importId: "exact-import-id", mode: 0 });
    expect(screen.getByRole("link", { name: /Về danh sách/ })).toHaveAttribute("href", "/admin/places");
  });
  it("stepper announces current step without click-to-jump", async () => {
    const { container } = mount();
    expect(container.querySelector('[aria-current="step"]')).toHaveTextContent("Bước 1");
    expect(within(screen.getByRole("list", { name: "Tiến trình nhập địa điểm" })).queryByRole("button")).not.toBeInTheDocument();
    await toPreview();
    expect(container.querySelector('[aria-current="step"]')).toHaveTextContent("Bước 2");
  });
  it("Strict remains blocked when server reports invalid rows", async () => {
    mount(); await toPreview();
    fireEvent.click(screen.getByRole("radio", { name: /Hủy toàn bộ/ }));
    expect(screen.getByRole("button", { name: /Xác nhận Import/ })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("1 dòng bị lỗi");
    expect(mocks.places.commitImport).not.toHaveBeenCalled();
  });
  it("valid Strict sends mode 1 unchanged", async () => {
    mocks.places.previewImport.mockResolvedValue({ ...preview, errorRowsCount: 0 });
    mount(); await toPreview();
    fireEvent.click(screen.getByRole("radio", { name: /Hủy toàn bộ/ }));
    fireEvent.click(screen.getByRole("button", { name: /Xác nhận Import/ }));
    await screen.findByRole("heading", { name: /Hoàn tất tiến trình/ });
    expect(mocks.places.commitImport).toHaveBeenCalledWith({ importId: preview.importId, mode: 1 });
  });
  it("pending commit disables repeated submit and preview restart", async () => {
    let resolve; mocks.places.commitImport.mockReturnValue(new Promise((r) => { resolve = r; }));
    mount(); await toPreview();
    const button = screen.getByRole("button", { name: /Xác nhận Import/ });
    fireEvent.click(button); fireEvent.click(button);
    expect(button).toBeDisabled();
    expect(screen.getByRole("button", { name: /Tải lại file khác/ })).toBeDisabled();
    expect(mocks.places.commitImport).toHaveBeenCalledTimes(1);
    await act(async () => resolve(result));
  });
  it("restart retains original file step, no automatic second parse", async () => {
    mount(); await toPreview();
    fireEvent.click(screen.getByRole("button", { name: /Tải lại file khác/ }));
    expect(screen.getByLabelText("Chọn file địa điểm CSV hoặc Excel")).toBeInTheDocument();
    expect(mocks.places.previewImport).toHaveBeenCalledTimes(1);
    expect(mocks.places.commitImport).not.toHaveBeenCalled();
  });
  it("commit error retains preview and existing alert", async () => {
    mocks.places.commitImport.mockRejectedValue(new Error("Phiên import hết hạn"));
    mount(); await toPreview(); fireEvent.click(screen.getByRole("button", { name: /Xác nhận Import/ }));
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Phiên import hết hạn"));
    expect(screen.getByRole("heading", { name: "Thẩm định dữ liệu" })).toBeInTheDocument();
  });
});
describe("A4 Import diagnostics and files", () => {
  it.each([["bad.pdf", 10, /Định dạng file/], ["large.csv", 11 * 1024 * 1024, /vượt quá 10MB/]])("file %s validation remains without upload", (name, size, message) => {
    render(<FileUploadStep onPreviewLoaded={vi.fn()} />);
    const selected = new File(["x"], name); Object.defineProperty(selected, "size", { value: size });
    fireEvent.change(screen.getByLabelText("Chọn file địa điểm CSV hoặc Excel"), { target: { files: [selected] } });
    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(screen.getByLabelText("Chọn file địa điểm CSV hoặc Excel")).toHaveAttribute("aria-describedby", "import-file-help import-file-error");
    expect(mocks.places.previewImport).not.toHaveBeenCalled();
  });
  it("preview failure remains visible and allows reselect", async () => {
    mocks.places.previewImport.mockRejectedValue(new Error("File lỗi"));
    render(<FileUploadStep onPreviewLoaded={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Chọn file địa điểm CSV hoặc Excel"), { target: { files: [file()] } });
    await screen.findByRole("alert");
    expect(screen.getByLabelText("Chọn file địa điểm CSV hoặc Excel")).toBeEnabled();
  });
  it("same rows render every parsed field, warning and error on desktop/mobile", () => {
    render(<ImportPreviewTable preview={preview} />);
    const table = screen.getByRole("table", { name: "Thẩm định địa điểm nhập" });
    const cards = screen.getAllByRole("article");
    expect(cards).toHaveLength(3);
    for (const [index, row] of preview.rows.entries()) {
      expect(table).toHaveTextContent(row.rawName);
      expect(cards[index]).toHaveTextContent(row.rawName);
      for (const text of [...row.errors, ...row.warnings]) {
        expect(table).toHaveTextContent(text);
        expect(cards[index]).toHaveTextContent(text);
      }
    }
    expect(cards[0]).toHaveTextContent("10.78, 106.7");
    expect(cards[0]).toHaveTextContent("Bến Thành");
    expect(cards[1]).toHaveTextContent("tọa độ thô");
    expect(cards[1]).toHaveTextContent("ga thô");
    expect(cards[1]).toHaveTextContent("Cảnh báo / Nghi trùng");
    expect(cards[2]).toHaveTextContent("Lỗi");
  });
  it("result uses exact server counts including skipped and failed", () => {
    render(<MemoryRouter><ImportResultSummary commitResult={result} /></MemoryRouter>);
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Tải CSV báo lỗi/ })).toBeInTheDocument();
  });
  it("error-report action retains called helper instead of silently repairing ADMIN-FUNC-03", () => {
    vi.spyOn(window, "open").mockImplementation(() => {});
    render(<MemoryRouter><ImportResultSummary commitResult={result} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /Tải CSV báo lỗi/ }));
    expect(mocks.places.getErrorReportUrl).toHaveBeenCalledWith(result.importId);
    expect(window.open).toHaveBeenCalledWith("/existing-helper-test-only", "_blank");
  });
  it("records actual ADMIN-FUNC-03 export mismatch rather than masking it with the mock", async () => {
    const actual = await vi.importActual("../src/services/adminPlaceService");
    expect(actual.adminPlaceService.getImportErrorReportUrl).toEqual(expect.any(Function));
    expect(actual.adminPlaceService.getErrorReportUrl).toBeUndefined();
  });
  it("template retains authenticated blob workflow, filename and cleanup", async () => {
    const blob = new Blob(["template"]); blob.fileName = "server-template.csv";
    mocks.places.getImportTemplate.mockResolvedValue(blob);
    const create = vi.fn(() => "blob:template"); const revoke = vi.fn();
    vi.stubGlobal("URL", class extends URL { static createObjectURL = create; static revokeObjectURL = revoke; });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function () { expect(this.download).toBe("server-template.csv"); });
    render(<DownloadTemplateButton />);
    fireEvent.click(screen.getByRole("button", { name: /Tải mẫu CSV/ }));
    await waitFor(() => expect(revoke).toHaveBeenCalledWith("blob:template"));
    expect(mocks.places.getImportTemplate).toHaveBeenCalledWith("csv");
    expect(click).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
