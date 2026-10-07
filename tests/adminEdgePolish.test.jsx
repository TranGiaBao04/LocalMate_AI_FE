import { useState } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminOverlayFrame, ConfirmDialog } from "../src/components/admin/ui";
import BenefitEditor from "../src/components/admin/plans/BenefitEditor";
import MultiTagSelector from "../src/components/admin/MultiTagSelector";
import ImageUploadDropzone from "../src/components/admin/ImageUploadDropzone";
import EntitlementRepairPanel from "../src/components/admin/transactions/EntitlementRepairPanel";
import RoleFormDialog from "../src/components/admin/roles/RoleFormDialog";
import LockUserDialog from "../src/components/admin/users/LockUserDialog";

const mocks = vi.hoisted(() => ({
  plans: { getFeatures: vi.fn() }, tags: { getTags: vi.fn() },
  places: { uploadImage: vi.fn() }, users: { lockUser: vi.fn(), unlockUser: vi.fn() },
  roles: { createRole: vi.fn(), updateRole: vi.fn() },
}));
vi.mock("../src/services/adminPlanService", () => ({ adminPlanService: mocks.plans }));
vi.mock("../src/services/tagService", () => ({ tagService: mocks.tags }));
vi.mock("../src/services/adminPlaceService", () => ({ adminPlaceService: mocks.places }));
vi.mock("../src/services/adminUserService", () => ({ adminUserService: mocks.users }));
vi.mock("../src/services/adminRoleService", () => ({ adminRoleService: mocks.roles }));

const long = "LongUnbrokenValue".repeat(24);
const feature = { id: "f", name: long, code: long, description: long };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.plans.getFeatures.mockResolvedValue([feature]);
  mocks.tags.getTags.mockResolvedValue([{ id: "tag", name: long }]);
});

function OverlayHarness({ loading = false }) {
  const [open, setOpen] = useState(false);
  const [nested, setNested] = useState(false);
  return <>
    <button onClick={() => setOpen(true)}>Open detail</button>
    <AdminOverlayFrame open={open} variant="drawer" title={long} description={long}
      loading={loading || nested} onClose={() => setOpen(false)}
      footer={<button disabled={loading} onClick={() => setOpen(false)}>Close detail</button>}>
      <button onClick={() => setNested(true)}>Open confirmation</button>
      <p>{long}</p>
    </AdminOverlayFrame>
    <ConfirmDialog open={nested} title={long} message={long} onCancel={() => setNested(false)} />
  </>;
}

describe("A8 overlay containment without lifecycle changes", () => {
  it("retains full long values, internal scroll and drawer semantics", () => {
    render(<OverlayHarness />);
    const trigger = screen.getByRole("button", { name: "Open detail" });
    trigger.focus(); fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: long });
    expect(dialog).toHaveAccessibleDescription(long);
    expect(dialog).toHaveClass("min-w-0", "[overflow-wrap:anywhere]");
    expect(within(dialog).getByText(long, { selector: "p:not([id])" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Open confirmation" }).parentElement).toHaveClass("overflow-y-auto");
    expect(document.body.style.overflow).toBe("hidden");
    expect(fireEvent.mouseDown(dialog.parentElement)).toBe(false);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).not.toBe("hidden");
  });
  it("nested confirmation owns focus, Escape, scroll lock and restores both triggers", () => {
    render(<OverlayHarness />);
    const trigger = screen.getByRole("button", { name: "Open detail" });
    trigger.focus(); fireEvent.click(trigger);
    const nestedTrigger = screen.getByRole("button", { name: "Open confirmation" });
    nestedTrigger.focus(); fireEvent.click(nestedTrigger);
    const top = within(screen.getAllByRole("dialog").at(-1));
    const cancel = top.getByRole("button", { name: "Hủy" });
    const confirm = top.getByRole("button", { name: "Xác nhận" });
    expect(cancel).toHaveFocus();
    fireEvent.keyDown(cancel, { key: "Tab", shiftKey: true });
    expect(confirm).toHaveFocus();
    fireEvent.keyDown(confirm, { key: "Tab" });
    expect(cancel).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(nestedTrigger).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).not.toBe("hidden");
  });
  it("loading still suppresses Escape/backdrop and disables dismissal", () => {
    render(<OverlayHarness loading />);
    fireEvent.click(screen.getByRole("button", { name: "Open detail" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.mouseDown(dialog.parentElement);
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Close detail" })).toBeDisabled();
  });
});

describe("A8 legacy form children", () => {
  it("benefits keep complete long labels and exact selected IDs for all/none/toggle", async () => {
    const change = vi.fn();
    const { rerender } = render(<BenefitEditor onChange={change} />);
    const checkbox = await screen.findByRole("checkbox", { name: new RegExp("LongUnbrokenValue") });
    expect(screen.getByRole("group")).toHaveClass("[overflow-wrap:anywhere]");
    expect(checkbox.closest("label")).toHaveClass("min-h-11");
    const all = screen.getByRole("button", { name: "Chọn tất cả" });
    expect(all).toHaveClass("min-h-11");
    fireEvent.click(all);
    expect(change).toHaveBeenLastCalledWith(["f"]);
    rerender(<BenefitEditor selectedIds={["f"]} onChange={change} />);
    expect(checkbox).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Bỏ chọn" }));
    expect(change).toHaveBeenLastCalledWith([]);
    fireEvent.click(checkbox);
    expect(change).toHaveBeenLastCalledWith([]);
    expect(mocks.plans.getFeatures).toHaveBeenCalledOnce();
  });
  it("benefits retain disabled state and field validation alert without submitting", async () => {
    const change = vi.fn();
    render(<BenefitEditor selectedIds={["f"]} disabled error={long} onChange={change} />);
    const checkbox = await screen.findByRole("checkbox");
    expect(checkbox).toBeDisabled();
    fireEvent.click(checkbox);
    expect(change).not.toHaveBeenCalled();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(long);
  });
  it("benefit loading, error and empty remain distinct with exact server error", async () => {
    mocks.plans.getFeatures.mockReturnValueOnce(new Promise(() => {}));
    const first = render(<BenefitEditor />);
    expect(screen.getByRole("status")).toHaveTextContent("Đang tải quyền lợi");
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    first.unmount();
    mocks.plans.getFeatures.mockRejectedValueOnce(new Error(long));
    const second = render(<BenefitEditor />);
    expect(await screen.findByRole("alert")).toHaveTextContent(long);
    second.unmount();
    mocks.plans.getFeatures.mockResolvedValueOnce([]);
    render(<BenefitEditor />);
    expect(await screen.findByText("Hệ thống chưa có quyền lợi khả dụng nào.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it("long tags wrap without trimming text or introducing persistence", async () => {
    const change = vi.fn();
    const { rerender } = render(<MultiTagSelector onChange={change} />);
    const button = await screen.findByRole("button", { name: long });
    expect(button).toHaveClass("min-w-0", "max-w-full", "min-h-11");
    expect(within(button).getByText(long)).toHaveClass("[overflow-wrap:anywhere]");
    button.focus(); expect(button).toHaveFocus();
    fireEvent.click(button);
    expect(change).toHaveBeenLastCalledWith(["tag"]);
    rerender(<MultiTagSelector selectedTagIds={["tag"]} onChange={change} />);
    expect(button).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(button);
    expect(change).toHaveBeenLastCalledWith([]);
    expect(mocks.tags.getTags).toHaveBeenCalledOnce();
  });
  it("upload keeps hint while pending, exact file and URL callback; no filename storage", async () => {
    let resolve;
    mocks.places.uploadImage.mockReturnValue(new Promise(done => { resolve = done; }));
    const change = vi.fn();
    render(<ImageUploadDropzone value="" onChange={change} />);
    const input = screen.getByLabelText("Ảnh đại diện địa điểm");
    const file = new File(["image"], long + ".webp", { type: "image/webp" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(input).toBeDisabled();
    expect(document.getElementById(input.getAttribute("aria-describedby"))).toHaveTextContent("5MB");
    expect(screen.getByRole("status")).toHaveTextContent("Cloudinary");
    expect(mocks.places.uploadImage).toHaveBeenCalledExactlyOnceWith(file);
    await act(async () => resolve({ url: "https://example.test/place.webp" }));
    expect(change).toHaveBeenCalledExactlyOnceWith("https://example.test/place.webp");
    expect(input).toBeEnabled();
  });
  it("upload rejection keeps real long error and accepted-file guard", async () => {
    mocks.places.uploadImage.mockRejectedValue(new Error(long));
    render(<ImageUploadDropzone value="" onChange={vi.fn()} />);
    const input = screen.getByLabelText("Ảnh đại diện địa điểm");
    fireEvent.change(input, { target: { files: [new File(["x"], "bad.txt")] } });
    expect(screen.getByRole("alert")).toHaveTextContent("Định dạng ảnh không hỗ trợ");
    expect(mocks.places.uploadImage).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { files: [new File(["x"], "good.png")] } });
    expect(await screen.findByText(long)).toHaveAttribute("role", "alert");
    expect(screen.getByRole("alert")).toHaveClass("[overflow-wrap:anywhere]");
    expect(input).toHaveAttribute("aria-describedby", "place-image-error");
  });
});

describe("A8 cross-consumer contracts", () => {
  it("period-copy uses full identifier and 44px target without granting repair eligibility", () => {
    const copy = vi.fn();
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText: copy } });
    const open = vi.fn();
    render(<EntitlementRepairPanel canManagePlans detail={{ entitlement: { grantStatus: "FutureStatus", subscriptionPeriodId: long }, repairEligibility: { eligible: false }, repairHistory: [] }} onOpenRepair={open} />);
    expect(screen.getAllByText("FutureStatus")).toHaveLength(2);
    const button = screen.getByRole("button", { name: "Sao chép ID kỳ hội viên" });
    expect(button).toHaveClass("h-11", "w-11");
    fireEvent.click(button);
    expect(copy).toHaveBeenCalledExactlyOnceWith(long);
    expect(open).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Khôi phục entitlement" })).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });
  it("role dialog retains long description/permission/error and its exact catalog payload", async () => {
    mocks.roles.createRole.mockRejectedValue(new Error(long));
    render(<RoleFormDialog permissions={[{ code: "ExistingPermission", name: long, description: long }]} onClose={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Tên role *"), { target: { value: "Role" } });
    fireEvent.change(screen.getByLabelText("Mô tả"), { target: { value: long.slice(0, 200) } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Tạo role" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(long);
    expect(mocks.roles.createRole).toHaveBeenCalledExactlyOnceWith({ name: "Role", description: long.slice(0, 200), permissions: ["ExistingPermission"] });
    expect(screen.getByRole("dialog")).toHaveClass("[overflow-wrap:anywhere]");
  });
  it("lock dialog long identity/error still uses trimmed reason and never unlocks", async () => {
    mocks.users.lockUser.mockRejectedValue(new Error(long));
    render(<LockUserDialog mode="lock" user={{ id: "u", fullName: long, email: long + "@example.test" }} onClose={vi.fn()} onDone={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Lý do khoá *"), { target: { value: "  " + long + "  " } });
    fireEvent.click(screen.getByRole("button", { name: "Khoá tài khoản" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(long);
    expect(mocks.users.lockUser).toHaveBeenCalledExactlyOnceWith("u", long);
    expect(mocks.users.unlockUser).not.toHaveBeenCalled();
  });
});
