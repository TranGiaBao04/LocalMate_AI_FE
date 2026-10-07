import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AdminErrorState, AdminField, AdminOverlayFrame, AdminPagination, AdminRecordCard, AdminSurface, ConfirmDialog, DataTable, EmptyState, FilterBar, LoadingState, NoticeBanner, StatusBadge } from "../src/components/admin/ui";
import { ADMIN_INPUT, ADMIN_PRIMARY_BUTTON } from "../src/components/admin/adminStyles";

const rows = [{ id: "one", name: "Một", amount: 29000 }, { id: "two", name: "Hai", amount: 43000 }];
const columns = [{ key: "name", header: "Tên", sortable: true }, { key: "amount", header: "Số tiền", render: (row, index) => `${row.amount} VND / ${index}` }];

function DialogHarness({ loading = false }) {
  const [open, setOpen] = useState(false);
  return <><button onClick={() => setOpen(true)}>Mở xác nhận</button><ConfirmDialog open={open} title="Xóa bản ghi" message="Giữ nguyên contract" loading={loading} onCancel={() => setOpen(false)} onConfirm={() => {}} /></>;
}

describe("A2 DataTable contract", () => {
  it("T01 keeps raw evidence and render(row,index), function row keys", () => {
    render(<DataTable columns={columns} rows={rows} rowKey={(row) => row.id} />);
    expect(screen.getByRole("table")).toHaveAccessibleName("Dữ liệu quản trị");
    expect(screen.getAllByRole("row")).toHaveLength(3);
    expect(screen.getByText("29000 VND / 0")).toBeInTheDocument();
    expect(screen.getByText("43000 VND / 1")).toBeInTheDocument();
  });
  it.each(["asc", "desc"])("T02 exposes %s without sorting rows itself", (direction) => {
    render(<DataTable columns={columns} rows={rows} sort={{ key: "name", direction }} onSort={() => {}} />);
    expect(screen.getByRole("columnheader", { name: "Tên" })).toHaveAttribute("aria-sort", direction === "asc" ? "ascending" : "descending");
    expect(screen.getAllByRole("row")[1]).toHaveTextContent("Một");
  });
  it("T03 sends only the existing column key, unsorted aria-sort none", () => {
    const sort = vi.fn();
    render(<DataTable columns={columns} rows={rows} onSort={sort} />);
    expect(screen.getByRole("columnheader", { name: /Tên/ })).toHaveAttribute("aria-sort", "none");
    fireEvent.click(screen.getByRole("button", { name: "Sắp xếp theo Tên" }));
    expect(sort).toHaveBeenCalledExactlyOnceWith("name");
  });
  it("T04 composes server-owned one-based pagination", () => {
    const page = vi.fn();
    render(<DataTable columns={columns} rows={rows} pagination={{ page: 2, totalPages: 4, totalCount: 93 }} onPageChange={page} />);
    expect(screen.getByRole("navigation")).toHaveTextContent("93 kết quả");
    fireEvent.click(screen.getByRole("button", { name: "Trước" }));
    fireEvent.click(screen.getByRole("button", { name: "Sau" }));
    expect(page.mock.calls).toEqual([[1], [3]]);
    expect(screen.getAllByRole("row")).toHaveLength(3);
  });
  it("T05 optional mobile rendering receives same supplied rows and indexes", () => {
    const mobile = vi.fn((row) => <p>Mobile {row.name}</p>);
    render(<DataTable columns={columns} rows={rows} renderMobileRow={mobile} />);
    expect(mobile.mock.calls).toEqual([[rows[0], 0], [rows[1], 1]]);
    expect(screen.getByText("Mobile Một")).toBeInTheDocument();
    expect(screen.getAllByRole("table")).toHaveLength(1);
  });
  it("loading keeps five skeleton rows and never renders supplied evidence", () => {
    render(<DataTable columns={columns} rows={rows} loading />);
    expect(screen.getByRole("status")).toHaveTextContent("Đang tải");
    expect(screen.getByRole("table")).toHaveAttribute("aria-busy", "true");
    expect(document.querySelectorAll("tbody tr")).toHaveLength(5);
    expect(screen.queryByText("29000 VND / 0")).not.toBeInTheDocument();
  });
  it("empty action stays caller-owned", () => {
    const action = vi.fn();
    render(<DataTable columns={columns} rows={[]} emptyState={{ title: "Không có đơn", actionLabel: "Tải lại", onAction: action }} />);
    fireEvent.click(screen.getByRole("button", { name: "Tải lại" }));
    expect(action).toHaveBeenCalledOnce();
  });
  it("pagination hides single page and disables boundaries", () => {
    const { rerender } = render(<AdminPagination page={1} totalPages={1} />);
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    rerender(<AdminPagination page={1} totalPages={3} />);
    expect(screen.getByRole("button", { name: "Trước" })).toBeDisabled();
    rerender(<AdminPagination page={3} totalPages={3} />);
    expect(screen.getByRole("button", { name: "Sau" })).toBeDisabled();
  });
});

describe("A2 filters and states", () => {
  it("T06 search passes current text immediately with no shared debounce", () => {
    const change = vi.fn();
    render(<FilterBar searchValue="cũ" onSearchChange={change} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: " mới " } });
    expect(change).toHaveBeenCalledExactlyOnceWith(" mới ");
  });
  it("T07 child native controls keep callback/value and legacy reset visibility", () => {
    const change = vi.fn(), clear = vi.fn();
    render(<FilterBar onClear={clear}><select aria-label="Trạng thái" value="active" onChange={change}><option value="active">Active</option><option value="all">All</option></select></FilterBar>);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "all" } });
    expect(change).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Xóa lọc" }));
    expect(clear).toHaveBeenCalledOnce();
  });
  it("T08 explicit zero active count does not infer activity from children", () => {
    const { rerender } = render(<FilterBar activeFilterCount={0} onClear={() => {}}><span>Passive</span></FilterBar>);
    expect(screen.queryByRole("button", { name: "Xóa lọc" })).not.toBeInTheDocument();
    rerender(<FilterBar activeFilterCount={2} onClear={() => {}}><span>Passive</span></FilterBar>);
    expect(screen.getByRole("button", { name: "Xóa lọc" })).toBeInTheDocument();
    rerender(<FilterBar activeFilterCount={0} searchValue="abc" onClear={() => {}} />);
    expect(screen.getByRole("button", { name: "Xóa lọc" })).toBeInTheDocument();
  });
  it("mobile filter affordance remains optional/caller owned", () => {
    const open = vi.fn();
    render(<FilterBar activeFilterCount={2} onOpenMobileFilters={open} meta="15 kết quả" />);
    fireEvent.click(screen.getByRole("button", { name: "Bộ lọc (2)" }));
    expect(open).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it.each(["success", "warning", "error", "info", "neutral", "violet"])("T09 %s always has text", (variant) => {
    render(<StatusBadge variant={variant} status="domainState" label="Nội dung thật" dot icon="info" />);
    expect(screen.getByText("Nội dung thật")).toBeInTheDocument();
    expect(screen.getByText("info")).toHaveAttribute("aria-hidden", "true");
  });
  it.each([{ status: "FutureState" }, { status: "success", variant: "FutureVariant" }])("T10 unknown mappings stay neutral: %j", (props) => {
    render(<StatusBadge {...props} />);
    const badge = screen.getByText(props.status);
    expect(badge).toHaveClass("bg-[#F4F6FA]");
    expect(badge).not.toHaveClass("bg-emerald-50");
  });
  it.each(["default", "compact"])("T11 %s empty state preserves text and action", (density) => {
    const action = vi.fn();
    render(<EmptyState density={density} title="Trống" description="Không có bản ghi" actionLabel="Thử lại" onAction={action} />);
    expect(screen.getByRole("heading")).toHaveTextContent("Trống");
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(action).toHaveBeenCalledOnce();
  });
  it("T12 error retains real message and retry", () => {
    const retry = vi.fn();
    render(<AdminErrorState message="Lỗi máy chủ cụ thể" onRetry={retry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Lỗi máy chủ cụ thể");
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(retry).toHaveBeenCalledOnce();
  });
  it("T13 error alerts, success status and close callback", () => {
    const close = vi.fn();
    const { rerender } = render(<NoticeBanner notice={{ type: "error", message: "Không thể lưu" }} onClose={close} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Không thể lưu");
    fireEvent.click(screen.getByRole("button", { name: "Đóng thông báo" }));
    expect(close).toHaveBeenCalledOnce();
    rerender(<NoticeBanner notice={{ type: "success", message: "Đã lưu" }} />);
    expect(screen.getByRole("status")).toHaveTextContent("Đã lưu");
    rerender(<NoticeBanner notice={null} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
  it.each(["inline", "card", "section"])("loading %s announces progress", (variant) => {
    render(<LoadingState variant={variant} />);
    expect(screen.getByRole("status")).toHaveTextContent("Đang tải dữ liệu...");
  });
});

describe("A2 accessible overlays", () => {
  it("T14 cancel initial focus, title/description association", () => {
    render(<ConfirmDialog open title="Xóa?" message="Không hoàn tác" onCancel={() => {}} />);
    expect(screen.getByRole("dialog", { name: "Xóa?" })).toHaveAccessibleDescription("Không hoàn tác");
    expect(screen.getByRole("button", { name: "Hủy" })).toHaveFocus();
  });
  it("T15 Escape closes and does not call confirm", () => {
    const cancel = vi.fn(), confirm = vi.fn();
    render(<ConfirmDialog open title="Xóa?" onCancel={cancel} onConfirm={confirm} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(cancel).toHaveBeenCalledOnce();
    expect(confirm).not.toHaveBeenCalled();
  });
  it("T16 loading guards Escape, backdrop and disables both callbacks", () => {
    const cancel = vi.fn(), confirm = vi.fn();
    render(<ConfirmDialog open loading title="Xóa?" onCancel={cancel} onConfirm={confirm} />);
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.mouseDown(screen.getByRole("dialog").parentElement);
    expect(screen.getByRole("button", { name: "Hủy" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Đang xử lý..." }));
    expect(cancel).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
  });
  it("T17 Tab and Shift+Tab loop; outside focus is redirected", () => {
    render(<DialogHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Mở xác nhận" }));
    const dialog = within(screen.getByRole("dialog"));
    const cancel = dialog.getByRole("button", { name: "Hủy" }), confirm = dialog.getByRole("button", { name: "Xác nhận" });
    fireEvent.keyDown(cancel, { key: "Tab", shiftKey: true });
    expect(confirm).toHaveFocus();
    fireEvent.keyDown(confirm, { key: "Tab" });
    expect(cancel).toHaveFocus();
    screen.getByText("Mở xác nhận").focus();
    expect(cancel).toHaveFocus();
  });
  it("T18 restores trigger and backdrop dismisses safely", () => {
    render(<DialogHarness />);
    const trigger = screen.getByRole("button", { name: "Mở xác nhận" });
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.mouseDown(screen.getByRole("dialog").parentElement);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
  it("T19 scroll lock restores previous value after unmount", () => {
    document.body.style.overflow = "scroll";
    const { unmount } = render(<ConfirmDialog open title="Xóa?" />);
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("scroll");
    document.body.style.overflow = "";
  });
  it("loading rerender does not steal focus and unlock only after closure", () => {
    const { rerender } = render(<ConfirmDialog open title="Xóa?" />);
    screen.getByRole("button", { name: "Xác nhận" }).focus();
    rerender(<ConfirmDialog open title="Xóa?" confirmLabel="Lưu" />);
    expect(screen.getByRole("button", { name: "Lưu" })).toHaveFocus();
    rerender(<ConfirmDialog open={false} title="Xóa?" />);
    expect(document.body.style.overflow).toBe("");
  });
  it("nested frames isolate Escape and retain scroll lock until last closes", () => {
    const outer = vi.fn(), inner = vi.fn();
    const { rerender } = render(<><AdminOverlayFrame open title="Outer" onClose={outer} footer={<button>Outer action</button>} /><AdminOverlayFrame open title="Inner" onClose={inner} footer={<button>Inner action</button>} /></>);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(inner).toHaveBeenCalledOnce();
    expect(outer).not.toHaveBeenCalled();
    rerender(<><AdminOverlayFrame open title="Outer" onClose={outer} footer={<button>Outer action</button>} /><AdminOverlayFrame open={false} title="Inner" /></>);
    expect(document.body.style.overflow).toBe("hidden");
    expect(screen.getByRole("dialog", { name: "Outer" })).toBeInTheDocument();
  });
  it("drawer variant uses the same keyboard mechanics", () => {
    const close = vi.fn();
    render(<AdminOverlayFrame open variant="drawer" title="Chi tiết" onClose={close} footer={<button>Đóng</button>} />);
    expect(screen.getByRole("button")).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(close).toHaveBeenCalledOnce();
  });
});

describe("A2 presentation foundations", () => {
  it("T20 record action slots remain caller-owned", () => {
    const primary = vi.fn(), more = vi.fn();
    render(<AdminRecordCard title="Bản ghi" subtitle="Thông tin" status={<StatusBadge label="Đang dùng" />} leading={<span>Icon</span>} primaryAction={<button onClick={primary}>Mở</button>} moreAction={<button onClick={more}>Thêm</button>}>Giá trị gốc 29000</AdminRecordCard>);
    fireEvent.click(screen.getByRole("button", { name: "Mở" }));
    fireEvent.click(screen.getByRole("button", { name: "Thêm" }));
    expect(primary).toHaveBeenCalledOnce();
    expect(more).toHaveBeenCalledOnce();
    expect(screen.getByRole("article")).toHaveTextContent("Giá trị gốc 29000");
  });
  it("T21 native disabled buttons do not execute callbacks", () => {
    const click = vi.fn();
    render(<button type="button" disabled className={ADMIN_PRIMARY_BUTTON} onClick={click}>Lưu</button>);
    fireEvent.click(screen.getByRole("button"));
    expect(click).not.toHaveBeenCalled();
  });
  it("T22 no auth provider needed to render supplied arbitrary evidence/actions", () => {
    render(<AdminSurface as="section"><AdminRecordCard title="unknown-domain" primaryAction={<button>Caller action</button>}>Cash 29000 / Credit 12000</AdminRecordCard></AdminSurface>);
    expect(screen.getByRole("button", { name: "Caller action" })).toBeEnabled();
    expect(screen.getByText("Cash 29000 / Credit 12000")).toBeInTheDocument();
  });
  it("field label, hint and validation remain native/caller-owned", () => {
    render(<AdminField id="name" label="Tên" hint="Tên hiện tại" error="Không hợp lệ"><input id="name" aria-describedby="name-hint name-error" aria-invalid="true" className={ADMIN_INPUT} /></AdminField>);
    expect(screen.getByRole("textbox", { name: "Tên" })).toHaveAccessibleDescription("Tên hiện tại Không hợp lệ");
    expect(screen.getByRole("alert")).toHaveTextContent("Không hợp lệ");
  });
});
