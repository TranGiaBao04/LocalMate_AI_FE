import { useCallback, useEffect, useMemo, useState } from "react";
import AdminPageHeader from "../../components/admin/AdminPageHeader";
import { ADMIN_PRIMARY_BUTTON, ADMIN_TERTIARY_BUTTON } from "../../components/admin/adminStyles";
import { AdminErrorState, AdminRecordCard, DataTable, EmptyState, LoadingState, NoticeBanner, StatusBadge } from "../../components/admin/ui";
import TrialEnabledSwitch from "../../components/admin/trials/TrialEnabledSwitch";
import TrialProgramFormDialog from "../../components/admin/trials/TrialProgramFormDialog";
import { TRIAL_ERROR_MESSAGES, TRIAL_STATUS_BADGE, formatIsoDate, getTrialErrorMessage, toTrialPayload } from "../../components/admin/trials/trialProgramLabels";
import { adminPlanService } from "../../services/adminPlanService";
import { adminTrialProgramService } from "../../services/adminTrialProgramService";

// Dòng nhắc lượt AI: số và tên lấy từ gói (mã nội bộ của /admin/plans), không gắn cứng
function buildAiHint(plans) {
  const tail = "Hạn mức AI miễn phí của cả hệ thống có giới hạn, nên đặt giới hạn số người nhận.";
  const trialLimit = plans?.trial?.currentVersion?.aiDailyCallLimit;
  const freeLimit = plans?.free?.currentVersion?.aiDailyCallLimit;
  const freeName = plans?.free?.name || "gói miễn phí";
  if (typeof trialLimit !== "number") return `Người dùng thử có nhiều lượt AI hơn ${freeName}. ${tail}`;
  const free = typeof freeLimit === "number" ? ` (${freeName}: ${freeLimit})` : "";
  return `Mỗi người dùng thử có ${trialLimit} lượt AI mỗi ngày${free}. ${tail}`;
}

export default function AdminTrialProgramsPage() {
  const [reloadCount, setReloadCount] = useState(0);
  const [response, setResponse] = useState({ key: null, programs: [], error: "" });
  const [trialPlans, setTrialPlans] = useState(null); // { trial, free }: gói TRIP_PASS, FREE từ /admin/plans
  const [formTarget, setFormTarget] = useState(null); // { program: null (tạo mới) | program }
  const [togglingId, setTogglingId] = useState(null);
  const [notice, setNotice] = useState(null);
  const loading = response.key !== reloadCount;
  const trialPlanName = trialPlans?.trial?.name;

  useEffect(() => {
    let active = true;
    adminTrialProgramService.getPrograms()
      .then((programs) => {
        if (active) setResponse({ key: reloadCount, programs: programs ?? [], error: "" });
      })
      .catch((err) => {
        // Tải lại lỗi thì giữ danh sách cũ
        if (active) setResponse((prev) => ({ ...prev, key: reloadCount, error: err?.message || "Không tải được danh sách chương trình." }));
      });
    return () => { active = false; };
  }, [reloadCount]);

  // Chỉ để lấy tên gói dùng thử và dựng dòng nhắc, lỗi thì dùng câu chung
  useEffect(() => {
    let active = true;
    adminPlanService.getPlans({ pageSize: 100 })
      .then((data) => {
        if (!active) return;
        const planOf = (code) => data?.items?.find((plan) => plan.code === code);
        setTrialPlans({ trial: planOf("TRIP_PASS"), free: planOf("FREE") });
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(timer);
  }, [notice]);

  const reload = useCallback(() => setReloadCount((count) => count + 1), []);
  const closeForm = useCallback(() => setFormTarget(null), []);

  const handleSaved = (saved, isEdit) => {
    setFormTarget(null);
    setNotice({ type: "success", message: isEdit ? `Đã lưu "${saved.name}".` : `Đã tạo "${saved.name}".` });
    reload();
  };

  const handleNotFound = () => {
    setFormTarget(null);
    setNotice({ type: "error", message: TRIAL_ERROR_MESSAGES.trial_program_not_found });
    reload();
  };

  // Công tắc nhanh: PUT đủ mọi field hiện tại, chỉ đổi isEnabled
  const handleToggle = useCallback(async (program) => {
    setTogglingId(program.id);
    try {
      const saved = await adminTrialProgramService.updateProgram(program.id, { ...toTrialPayload(program), isEnabled: !program.isEnabled });
      setResponse((prev) => ({ ...prev, programs: prev.programs.map((item) => (item.id === saved.id ? saved : item)) }));
      setNotice({ type: "success", message: saved.isEnabled ? `Đã bật "${saved.name}".` : `Đã tắt "${saved.name}".` });
    } catch (err) {
      setNotice({ type: "error", message: getTrialErrorMessage(err, "Không đổi được trạng thái. Vui lòng thử lại.") });
      if (err?.code === "trial_program_not_found") reload();
    } finally {
      setTogglingId(null);
    }
  }, [reload]);

  const columns = useMemo(() => [
    {
      key: "name",
      header: "Chương trình",
      render: (row) => <p className="font-semibold text-[#0F2148] [overflow-wrap:anywhere]">{row.name}</p>,
    },
    {
      key: "period",
      header: "Thời gian",
      render: (row) => <span className="whitespace-nowrap text-[#0F2148]">{formatIsoDate(row.startsOn)} – {formatIsoDate(row.endsOn)}</span>,
    },
    { key: "trialDays", header: "Dùng thử", render: (row) => `${row.trialDays} ngày` },
    {
      key: "recipients",
      header: "Đã nhận / Tối đa",
      render: (row) => (
        <div>
          <p className="font-medium text-[#0F2148]">
            {row.grantedCount.toLocaleString("vi-VN")} / {row.maxRecipients == null ? "Không giới hạn" : row.maxRecipients.toLocaleString("vi-VN")}
          </p>
          {row.remaining != null && <p className="mt-0.5 text-xs text-[#5C6B8A]">Còn {row.remaining.toLocaleString("vi-VN")} suất</p>}
        </div>
      ),
    },
    {
      key: "status",
      header: "Trạng thái",
      render: (row) => {
        const badge = TRIAL_STATUS_BADGE[row.status] ?? { status: "inactive", label: row.status };
        return <StatusBadge status={badge.status} label={badge.label} />;
      },
    },
    {
      key: "isEnabled",
      header: "Bật/Tắt",
      render: (row) => (
        <TrialEnabledSwitch
          checked={row.isEnabled}
          onChange={() => handleToggle(row)}
          disabled={togglingId !== null}
          label={row.isEnabled ? `Tắt chương trình ${row.name}` : `Bật chương trình ${row.name}`}
        />
      ),
    },
    {
      key: "actions",
      header: "Thao tác",
      className: "text-right",
      cellClassName: "text-right",
      render: (row) => (
        <button type="button" onClick={() => setFormTarget({ program: row })} className={`${ADMIN_TERTIARY_BUTTON} text-[#1d3e82] hover:bg-blue-50`}>
          <span className="material-symbols-outlined text-[16px]">edit</span>
          Sửa
        </button>
      ),
    },
  ], [handleToggle, togglingId]);

  const emptyState = { icon: "redeem", title: "Chưa có chương trình dùng thử nào" };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Gói cước & Doanh thu"
        title="Dùng thử khi đăng ký"
        description={`Tài khoản tạo mới trong thời gian chương trình đang bật ${trialPlanName ? `được dùng thử gói ${trialPlanName}` : "được nhận gói dùng thử"}. Mỗi tài khoản nhận tối đa một lần, tài khoản có từ trước không được cấp bù. Muốn dừng thì tắt chương trình (không xoá được).`}
      >
        <button type="button" onClick={() => setFormTarget({ program: null })} disabled={response.key === null} className={ADMIN_PRIMARY_BUTTON}>
          <span className="material-symbols-outlined text-[20px]">add</span>
          Tạo chương trình
        </button>
      </AdminPageHeader>

      <NoticeBanner notice={notice} onClose={() => setNotice(null)} />

      {response.error && !loading && <AdminErrorState message={response.error} onRetry={reload} />}
      <div className="hidden md:block [&_table]:w-full [&_table]:min-w-[900px]">
        <DataTable columns={columns} rows={response.programs} loading={response.key === null} emptyState={emptyState} />
      </div>
      <div aria-label="Danh sách chương trình trên di động" className="space-y-3 md:hidden">
        {response.key === null ? <LoadingState label="Đang tải chương trình" /> : response.programs.length ? response.programs.map((row) => (
          <AdminRecordCard key={row.id} title={columns[0].render(row)} status={columns[4].render(row)} primaryAction={columns[6].render(row)}>
            <dl className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><dt className="mb-1 text-xs">Thời gian</dt><dd>{columns[1].render(row)}</dd></div>
              <div><dt className="mb-1 text-xs">Dùng thử</dt><dd>{columns[2].render(row)}</dd></div>
              <div><dt className="mb-1 text-xs">Đã nhận / Tối đa</dt><dd>{columns[3].render(row)}</dd></div>
              <div className="col-span-2 flex items-center justify-between"><dt className="text-xs">Bật/Tắt</dt><dd>{columns[5].render(row)}</dd></div>
            </dl>
          </AdminRecordCard>
        )) : <EmptyState {...emptyState} />}
      </div>

      {formTarget && (
        <TrialProgramFormDialog
          program={formTarget.program}
          aiHint={buildAiHint(trialPlans)}
          planName={trialPlanName}
          onClose={closeForm}
          onSaved={handleSaved}
          onNotFound={handleNotFound}
        />
      )}
    </div>
  );
}
