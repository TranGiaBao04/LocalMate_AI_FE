import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminTrialProgramsPage from "../src/pages/admin/AdminTrialProgramsPage";
import { ApiError } from "../src/api/apiClient";

const mocks = vi.hoisted(() => ({
  trials: { getPrograms: vi.fn(), createProgram: vi.fn(), updateProgram: vi.fn() },
  plans: { getPlans: vi.fn() },
}));
vi.mock("../src/services/adminTrialProgramService", () => ({ adminTrialProgramService: mocks.trials }));
vi.mock("../src/services/adminPlanService", () => ({ adminPlanService: mocks.plans }));

const program = (overrides = {}) => ({
  id: "p-running", name: "Khai trương tháng 10", startsOn: "2026-10-14", endsOn: "2026-10-31",
  trialDays: 7, maxRecipients: 100, isEnabled: true, status: "Running", grantedCount: 3, remaining: 97,
  createdAt: "2026-10-14T03:42:04Z", updatedAt: "2026-10-14T03:42:04Z", ...overrides,
});

const PROGRAMS = [
  program(),
  program({ id: "p-off", name: "Chương trình tắt", isEnabled: false, status: "Disabled", maxRecipients: null, remaining: null, grantedCount: 0 }),
  program({ id: "p-ended", name: "Đã qua", status: "Ended", startsOn: "2026-09-01", endsOn: "2026-09-30" }),
  program({ id: "p-up", name: "Sắp tới", status: "Upcoming", startsOn: "2026-11-01", endsOn: "2026-11-30" }),
  program({ id: "p-full", name: "Hết chỗ", status: "Full", maxRecipients: 3, remaining: 0 }),
];

const PLANS = {
  items: [
    { id: "f", code: "FREE", name: "Free", currentVersion: { aiDailyCallLimit: 3 } },
    { id: "t", code: "TRIP_PASS", name: "Trip Pass", currentVersion: { aiDailyCallLimit: 15 } },
  ],
};

const table = () => within(screen.getByRole("table"));
const rowOf = (name) => table().getByText(name).closest("tr");

async function mount(programs = PROGRAMS) {
  mocks.trials.getPrograms.mockResolvedValue(programs);
  render(<AdminTrialProgramsPage />);
  if (programs.length) await table().findByText(programs[0].name);
}

async function openCreate() {
  fireEvent.click(screen.getByRole("button", { name: /Tạo chương trình/ }));
  return screen.findByRole("dialog", { name: "Tạo chương trình dùng thử" });
}

beforeEach(() => {
  vi.resetAllMocks();
  // 10:00 ngày 14/10/2026 giờ VN
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-14T03:00:00Z"));
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected live network request"); }));
  mocks.plans.getPlans.mockResolvedValue(PLANS);
});

afterEach(() => {
  expect(fetch).not.toHaveBeenCalled();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Danh sách chương trình dùng thử", () => {
  it("hiện nhãn trạng thái, ngày dd/MM/yyyy, số suất", async () => {
    await mount();
    expect(within(rowOf("Khai trương tháng 10")).getByText("Đang chạy")).toBeInTheDocument();
    expect(within(rowOf("Chương trình tắt")).getByText("Đã tắt")).toBeInTheDocument();
    expect(within(rowOf("Đã qua")).getByText("Đã kết thúc")).toBeInTheDocument();
    expect(within(rowOf("Sắp tới")).getByText("Sắp diễn ra")).toBeInTheDocument();
    expect(within(rowOf("Hết chỗ")).getByText("Hết suất")).toBeInTheDocument();

    const running = within(rowOf("Khai trương tháng 10"));
    expect(running.getByText("14/10/2026 – 31/10/2026")).toBeInTheDocument();
    expect(running.getByText("3 / 100")).toBeInTheDocument();
    expect(running.getByText("Còn 97 suất")).toBeInTheDocument();
    expect(within(rowOf("Chương trình tắt")).getByText("0 / Không giới hạn")).toBeInTheDocument();
  });

  it("chưa có chương trình thì hiện trạng thái trống", async () => {
    await mount([]);
    expect((await screen.findAllByText("Chưa có chương trình dùng thử nào")).length).toBeGreaterThan(0);
  });
});

describe("Công tắc bật/tắt", () => {
  it("gửi PUT đủ 6 field, chỉ đảo isEnabled, rồi cập nhật dòng theo response", async () => {
    mocks.trials.updateProgram.mockResolvedValue(program({ isEnabled: false, status: "Disabled" }));
    await mount();
    fireEvent.click(within(rowOf("Khai trương tháng 10")).getByRole("switch", { name: "Tắt chương trình Khai trương tháng 10" }));

    await waitFor(() => expect(mocks.trials.updateProgram).toHaveBeenCalledExactlyOnceWith("p-running", {
      name: "Khai trương tháng 10", startsOn: "2026-10-14", endsOn: "2026-10-31", trialDays: 7, maxRecipients: 100, isEnabled: false,
    }));
    expect(await screen.findByText('Đã tắt "Khai trương tháng 10".')).toBeInTheDocument();
    expect(within(rowOf("Khai trương tháng 10")).getByRole("switch")).toHaveAttribute("aria-checked", "false");
    expect(mocks.trials.getPrograms).toHaveBeenCalledTimes(1);
  });

  it("409 trial_program_overlap hiện câu tiếng Việt", async () => {
    mocks.trials.updateProgram.mockRejectedValue(new ApiError("Conflict", 409, "trial_program_overlap"));
    await mount();
    fireEvent.click(within(rowOf("Chương trình tắt")).getByRole("switch"));
    expect(await screen.findByText("Khoảng ngày trùng với một chương trình dùng thử đang bật khác.")).toBeInTheDocument();
  });

  it("400 EndsOn khi bật lại chương trình đã qua: hiện câu của BE", async () => {
    mocks.trials.updateProgram.mockRejectedValue(new ApiError("x", 400, "invalid_trial_program", { EndsOn: ["Ngày kết thúc không được ở quá khứ."] }));
    await mount();
    fireEvent.click(within(rowOf("Chương trình tắt")).getByRole("switch"));
    expect(await screen.findByText("Ngày kết thúc không được ở quá khứ.")).toBeInTheDocument();
  });
});

describe("Form tạo/sửa", () => {
  it("mặc định bắt đầu hôm nay (giờ VN), 7 ngày, đang bật; có dòng nhắc lượt AI theo gói", async () => {
    await mount();
    const dialog = await openCreate();
    expect(within(dialog).getByLabelText("Từ ngày *")).toHaveValue("2026-10-14");
    expect(within(dialog).getByLabelText("Số ngày dùng thử *")).toHaveValue(7);
    expect(within(dialog).getByRole("switch", { name: "Bật chương trình" })).toHaveAttribute("aria-checked", "true");
    expect(within(dialog).getByText(/Mỗi người dùng thử có 15 lượt AI mỗi ngày \(Free: 3\)/)).toBeInTheDocument();
  });

  it("tên gói dùng thử và gói miễn phí lấy từ /admin/plans (admin đổi tên thì đổi theo)", async () => {
    mocks.plans.getPlans.mockResolvedValue({
      items: [
        { id: "f", code: "FREE", name: "Cơ bản", currentVersion: { aiDailyCallLimit: 3 } },
        { id: "t", code: "TRIP_PASS", name: "Gói Tuần", currentVersion: { aiDailyCallLimit: 15 } },
      ],
    });
    await mount();
    expect(await screen.findByText(/được dùng thử gói Gói Tuần\./)).toBeInTheDocument();
    const dialog = await openCreate();
    expect(within(dialog).getByText("Gói Tuần")).toBeInTheDocument();
    expect(within(dialog).getByText(/15 lượt AI mỗi ngày \(Cơ bản: 3\)/)).toBeInTheDocument();
    expect(screen.queryByText(/Trip Pass/)).not.toBeInTheDocument();
  });

  it("không tải được gói thì dòng nhắc dùng câu chung", async () => {
    mocks.plans.getPlans.mockRejectedValue(new Error("x"));
    await mount();
    const dialog = await openCreate();
    expect(within(dialog).getByText(/Người dùng thử có nhiều lượt AI hơn gói miễn phí/)).toBeInTheDocument();
    expect(within(dialog).getByText(/được nhận gói dùng thử/)).toBeInTheDocument();
  });

  it("chặn ngày kết thúc trước ngày bắt đầu và chương trình đang bật đã qua ngày kết thúc", async () => {
    await mount();
    const dialog = await openCreate();
    fireEvent.change(within(dialog).getByLabelText("Tên chương trình *"), { target: { value: "Thử" } });
    fireEvent.change(within(dialog).getByLabelText("Từ ngày *"), { target: { value: "2026-10-20" } });
    fireEvent.change(within(dialog).getByLabelText("Đến ngày *"), { target: { value: "2026-10-18" } });
    expect(within(dialog).getByText("Ngày kết thúc phải từ ngày bắt đầu trở đi.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Tạo chương trình" })).toBeDisabled();

    fireEvent.change(within(dialog).getByLabelText("Từ ngày *"), { target: { value: "2026-10-01" } });
    fireEvent.change(within(dialog).getByLabelText("Đến ngày *"), { target: { value: "2026-10-13" } });
    expect(within(dialog).getByText(/Chương trình đang bật không được kết thúc trong quá khứ/)).toBeInTheDocument();

    // Tắt chương trình thì được lưu
    fireEvent.click(within(dialog).getByRole("switch", { name: "Bật chương trình" }));
    expect(within(dialog).queryByText(/Chương trình đang bật không được kết thúc trong quá khứ/)).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Tạo chương trình" })).toBeEnabled();
  });

  it("tạo mới: cắt khoảng trắng tên, để trống giới hạn thì gửi null, rồi tải lại danh sách", async () => {
    mocks.trials.createProgram.mockResolvedValue(program({ id: "p-new", name: "Mới" }));
    await mount();
    const dialog = await openCreate();
    fireEvent.change(within(dialog).getByLabelText("Tên chương trình *"), { target: { value: "  Mới  " } });
    fireEvent.change(within(dialog).getByLabelText("Đến ngày *"), { target: { value: "2026-10-31" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Tạo chương trình" }));

    await waitFor(() => expect(mocks.trials.createProgram).toHaveBeenCalledExactlyOnceWith({
      name: "Mới", startsOn: "2026-10-14", endsOn: "2026-10-31", trialDays: 7, maxRecipients: null, isEnabled: true,
    }));
    expect(await screen.findByText('Đã tạo "Mới".')).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(mocks.trials.getPrograms).toHaveBeenCalledTimes(2));
  });

  it("400 invalid_trial_program hiện lỗi dưới đúng ô", async () => {
    mocks.trials.createProgram.mockRejectedValue(new ApiError("x", 400, "invalid_trial_program", { Name: ["Tên bắt buộc, tối đa 100 ký tự."] }));
    await mount();
    const dialog = await openCreate();
    fireEvent.change(within(dialog).getByLabelText("Tên chương trình *"), { target: { value: "Thử" } });
    fireEvent.change(within(dialog).getByLabelText("Đến ngày *"), { target: { value: "2026-10-31" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Tạo chương trình" }));
    expect(await within(dialog).findByText("Tên bắt buộc, tối đa 100 ký tự.")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Tên chương trình *")).toHaveAttribute("aria-invalid", "true");
  });

  it("sửa: điền sẵn dữ liệu và gửi PUT đúng id", async () => {
    mocks.trials.updateProgram.mockResolvedValue(program({ trialDays: 10 }));
    await mount();
    fireEvent.click(within(rowOf("Khai trương tháng 10")).getByRole("button", { name: /Sửa/ }));
    const dialog = await screen.findByRole("dialog", { name: "Sửa chương trình dùng thử" });
    expect(within(dialog).getByLabelText("Tên chương trình *")).toHaveValue("Khai trương tháng 10");
    expect(within(dialog).getByLabelText("Giới hạn số người nhận")).toHaveValue(100);
    expect(within(dialog).getByText(/Đã có 3 người nhận/)).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText("Số ngày dùng thử *"), { target: { value: "10" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() => expect(mocks.trials.updateProgram).toHaveBeenCalledExactlyOnceWith("p-running", {
      name: "Khai trương tháng 10", startsOn: "2026-10-14", endsOn: "2026-10-31", trialDays: 10, maxRecipients: 100, isEnabled: true,
    }));
  });

  it("404 khi sửa: đóng dialog, báo lỗi và tải lại danh sách", async () => {
    mocks.trials.updateProgram.mockRejectedValue(new ApiError("x", 404, "trial_program_not_found"));
    await mount();
    fireEvent.click(within(rowOf("Khai trương tháng 10")).getByRole("button", { name: /Sửa/ }));
    const dialog = await screen.findByRole("dialog", { name: "Sửa chương trình dùng thử" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Lưu thay đổi" }));
    expect(await screen.findByText("Chương trình không còn tồn tại. Danh sách đã được tải lại.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(mocks.trials.getPrograms).toHaveBeenCalledTimes(2));
  });
});
