import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTrip } from "../../context/TripContext";
import { useSubscription } from "../../context/SubscriptionContext";
import { formatVnDateTime, isPaidSubscription, isFreeSubscription, getPlanDisplayName } from "../../utils/subscriptionUtils";
import MobileLayout from "../../components/layout/MobileLayout";
import PageHeader from "../../components/layout/PageHeader";
import { tagService } from "../../services/tagService";
import { userService } from "../../services/userService";
import NotificationBell from "../../components/notifications/NotificationBell";

const PREFERENCE_GROUPS = [
  { key: "interestTagIds", type: "Interest", label: "Sở thích", icon: "favorite" },
  { key: "travelStyleTagIds", type: "TravelStyle", label: "Phong cách trải nghiệm", icon: "explore" },
];
const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const action = "inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] px-4 py-2 text-sm font-semibold " + focus + " disabled:opacity-50";
function sameIds(left, right) { return left.length === right.length && left.every((id) => right.includes(id)); }
function Icon({ children, className = "" }) {
  return <span aria-hidden="true" className={"material-symbols-outlined " + className}>{children}</span>;
}
function usageText(used, limit) {
  if (limit === null) return "Không giới hạn";
  if (typeof limit === "number") return (typeof used === "number" ? used : "—") + " / " + limit;
  return "Chưa có thông tin";
}

export default function ProfilePage() {
  const auth = useAuth();
  const owner = auth.initializing || !auth.user?.id ? "unavailable" : (auth.isDemo ? "demo:" : "user:") + auth.user.id;
  // Reset private editor state on identity changes before it can render for a different owner.
  return <OwnedProfilePage key={owner} auth={auth} />;
}

function OwnedProfilePage({ auth }) {
  const navigate = useNavigate();
  const { user, isDemo, initializing, logout, applyUserProfile } = auth;
  const { savedTrips = [], tripsLoading, tripsLoaded, tripsError, retryTrips } = useTrip();
  const { subscription, subscriptionLoading, subscriptionError, plans } = useSubscription();
  const lifetime = useRef({ active: false, generation: 0 });
  const savingRef = useRef(false);
  useLayoutEffect(() => {
    const scope = lifetime.current;
    scope.active = true;
    scope.generation += 1;
    return () => { scope.active = false; scope.generation += 1; };
  }, []);
  const [tags, setTags] = useState([]);
  const [tagsLoading, setTagsLoading] = useState(true);
  const [tagsError, setTagsError] = useState(false);
  const [tagsReload, setTagsReload] = useState(0);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState("");
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");
  const userId = user?.id;
  const editable = !isDemo && !initializing && Boolean(userId);
  const fullName = typeof user?.fullName === "string" ? user.fullName : "";
  const initials = fullName.trim().split(/\s+/).filter(Boolean)
    .filter((_, index, names) => index === 0 || index === names.length - 1)
    .map((name) => name[0]).join("").toLocaleUpperCase("vi-VN");

  useEffect(() => {
    if (isDemo || !userId) return undefined;
    let active = true;
    tagService.getTags().then((result) => {
      if (!Array.isArray(result)) throw new Error("Invalid tag catalog");
      if (active) { setTags(result); setTagsError(false); }
    }).catch(() => {
      if (active) setTagsError(true);
    }).finally(() => { if (active) setTagsLoading(false); });
    return () => { active = false; };
  }, [isDemo, userId, tagsReload]);

  const reloadTags = () => {
    setTagsLoading(true); setTagsError(false); setTagsReload((value) => value + 1);
  };
  const startEditing = () => {
    if (!editable) return;
    setDraft({
      fullName,
      interestTagIds: [...(user.preferences?.interestTagIds ?? [])],
      travelStyleTagIds: [...(user.preferences?.travelStyleTagIds ?? [])],
    });
    setNameError(""); setFormError(""); setSuccess("");
  };
  const cancelEditing = () => {
    if (savingRef.current) return;
    setDraft(null); setNameError(""); setFormError("");
  };
  const toggleTag = (group, tagId) => {
    setDraft((current) => ({
      ...current,
      [group.key]: current[group.key].includes(tagId)
        ? current[group.key].filter((id) => id !== tagId)
        : [...current[group.key], tagId],
    }));
    setFormError("");
  };
  const nameChanged = draft && draft.fullName.trim() !== fullName;
  const changedGroups = draft ? PREFERENCE_GROUPS.filter((group) =>
    !sameIds(draft[group.key], user?.preferences?.[group.key] ?? [])) : [];
  const hasChanges = Boolean(nameChanged || changedGroups.length);

  const handleSave = async (event) => {
    event.preventDefault();
    if (savingRef.current || !editable || !draft || !hasChanges) return;
    setNameError(""); setFormError("");
    const name = draft.fullName.trim();
    if (nameChanged && !name) { setNameError("Vui lòng nhập họ và tên."); return; }
    if (nameChanged && name.length > 200) { setNameError("Họ và tên không được quá 200 ký tự."); return; }
    const payload = {};
    if (nameChanged) payload.fullName = name;
    if (changedGroups.length) {
      payload.preferences = Object.fromEntries(changedGroups.map((group) => [group.key, draft[group.key]]));
    }
    const generation = lifetime.current.generation;
    const active = () => lifetime.current.active && lifetime.current.generation === generation;
    savingRef.current = true;
    setSaving(true);
    try {
      const updatedProfile = await userService.updateProfile(payload);
      if (!active()) return;
      if (!updatedProfile || updatedProfile.id !== userId) {
        setFormError("Máy chủ trả về hồ sơ không hợp lệ. Vui lòng thử lại.");
        return;
      }
      applyUserProfile(updatedProfile);
      setDraft(null);
      setSuccess("Đã cập nhật hồ sơ.");
    } catch (err) {
      if (!active()) return;
      if (err.errors?.fullName || err.errors?.FullName) setNameError("Họ và tên không hợp lệ. Vui lòng kiểm tra lại.");
      else if (err.code === "no_changes") setFormError("Không có thay đổi để lưu.");
      else if (err.code === "invalid_preference") setFormError("Sở thích đã thay đổi trên máy chủ. Vui lòng tải lại trang.");
      else if (err.status === 401 || err.status === 403) setFormError("Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại.");
      else if (!err.status) setFormError("Không kết nối được máy chủ. Vui lòng thử lại.");
      else setFormError("Không thể cập nhật hồ sơ. Vui lòng thử lại.");
    } finally {
      if (active()) { savingRef.current = false; setSaving(false); }
    }
  };
  const handleLogout = () => { logout(); navigate("/"); };
  const tripsPending = tripsLoading || (tripsLoaded === false && !tripsError);
  const tripsReady = !isDemo && !tripsPending && !tripsError;
  const stats = [
    { label: "Đã lưu", name: "Số lịch trình đã lưu", value: savedTrips.length },
    { label: "Đã chốt", name: "Số lịch trình đã chốt", value: savedTrips.filter((trip) => trip.status === "finalized").length },
    { label: "Bản nháp", name: "Số lịch trình nháp", value: savedTrips.filter((trip) => trip.status === "draft").length },
  ];
  const validSubscription = subscription && (isFreeSubscription(subscription) || isPaidSubscription(subscription));
  const effectiveDate = formatVnDateTime(subscription?.effectiveUntil);
  const endDate = formatVnDateTime(subscription?.endsAt);

  return (
    <MobileLayout>
      <PageHeader title="Hồ sơ">
        {editable && !draft && (
          <button type="button" onClick={startEditing} aria-label="Chỉnh sửa hồ sơ" title="Chỉnh sửa hồ sơ" className={action + " bg-primary text-on-primary"}>
            <Icon>edit</Icon><span className="hidden sm:inline">Chỉnh sửa</span>
          </button>
        )}
      </PageHeader>
      <main className="content-shell min-w-0 space-y-8 px-container-margin pb-28 pt-24 lg:px-8 lg:pb-12">
        <section aria-label="Thông tin hồ sơ" className="flex min-w-0 flex-col gap-6 border-b border-border-soft pb-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div aria-label="Ảnh đại diện" className="flex h-20 w-20 flex-none items-center justify-center rounded-full border border-border-soft bg-white text-2xl font-bold text-primary">
              {initials || <Icon className="text-4xl">person</Icon>}
            </div>
            <div className="min-w-0 space-y-1.5">
              <span className="inline-block rounded-md bg-primary-container/20 px-2 py-1 text-xs font-semibold text-primary">{isDemo ? "Phiên Demo" : user?.role || "Chưa cập nhật vai trò"}</span>
              <h2 className="break-words text-[24px] font-bold leading-8 text-navy-dark [overflow-wrap:anywhere] sm:text-[28px]">{fullName || "Chưa cập nhật tên"}</h2>
              <p className="break-words text-sm text-on-surface-variant [overflow-wrap:anywhere]">{user?.email || "Chưa cập nhật email"}</p>
            </div>
          </div>
          {tripsReady ? (
            <dl className="grid flex-none grid-cols-3 gap-4 sm:gap-6">
              {stats.map((stat) => <div key={stat.name} className="border-l border-border-soft pl-4">
                <dd aria-label={stat.name} className="text-2xl font-bold text-navy-dark">{stat.value}</dd>
                <dt className="mt-1 text-xs text-on-surface-variant">{stat.label}</dt>
              </div>)}
            </dl>
          ) : (
            <p role="status" aria-label="Thống kê lịch trình" className="text-sm text-on-surface-variant">
              {isDemo ? "Phiên Demo chỉ cho phép xem hồ sơ." : tripsError ? "Chưa tải được thống kê lịch trình." : "Đang tải thống kê lịch trình..."}
            </p>
          )}
        </section>
        {success && <p role="status" className="flex items-center gap-2 rounded-[8px] border border-green-200 bg-green-50 p-3 text-sm text-green-800"><Icon>check_circle</Icon>{success}</p>}
        <div className="grid min-w-0 gap-8 xl:grid-cols-[minmax(0,1fr)_340px] xl:gap-10">
          <div className="min-w-0 space-y-8">
            <section aria-labelledby="profile-preferences-title" className="min-w-0">
              <div className="mb-5 flex items-center gap-2"><Icon className="text-primary">tune</Icon><h2 id="profile-preferences-title" className="text-lg font-bold text-navy-dark">{draft ? "Chỉnh sửa hồ sơ" : "Cá nhân hóa"}</h2></div>
              {draft ? (
                <form onSubmit={handleSave} aria-label="Chỉnh sửa hồ sơ" aria-busy={saving} className="space-y-6">
                  <div>
                    <label htmlFor="profile-full-name" className="mb-2 block text-sm font-semibold text-on-surface">Họ và tên</label>
                    <input id="profile-full-name" name="fullName" autoComplete="name" type="text" value={draft.fullName}
                      onChange={(event) => { setDraft((current) => ({ ...current, fullName: event.target.value })); setNameError(""); }}
                      disabled={saving} aria-invalid={Boolean(nameError)} aria-describedby={nameError ? "profile-name-error" : undefined}
                      className={"w-full rounded-[8px] border border-outline-variant bg-white px-3 py-3 text-base text-on-surface " + focus + " disabled:opacity-60"} />
                    {nameError && <p id="profile-name-error" role="alert" className="mt-2 text-sm text-error">{nameError}</p>}
                  </div>
                  {PREFERENCE_GROUPS.map((group) => {
                    const options = tags.filter((tag) => tag.type === group.type);
                    const unavailable = draft[group.key].filter((id) => !options.some((tag) => tag.id === id)).length;
                    return <fieldset key={group.key} disabled={saving || tagsLoading || tagsError} className="min-w-0 space-y-3">
                      <legend className="mb-2 text-sm font-semibold text-on-surface">{group.label}</legend>
                      {tagsLoading ? <p role="status" className="text-sm text-on-surface-variant">Đang tải danh mục...</p>
                        : tagsError ? <p className="text-sm text-error">Chưa tải được danh mục.</p>
                          : !options.length ? <p className="text-sm text-on-surface-variant">Chưa có lựa chọn.</p>
                            : <div className="flex flex-wrap gap-2">{options.map((tag) => (
                              <button key={tag.id} type="button" onClick={() => toggleTag(group, tag.id)} aria-pressed={draft[group.key].includes(tag.id)}
                                className={"inline-flex min-h-11 max-w-full items-center gap-2 rounded-[8px] border px-3 py-2 text-left text-sm " + focus + " disabled:opacity-50 " + (draft[group.key].includes(tag.id) ? "border-primary bg-primary text-on-primary" : "border-outline-variant bg-white text-on-surface hover:border-primary")}>
                                <Icon className="text-lg">{draft[group.key].includes(tag.id) ? "check" : "add"}</Icon><span className="break-words [overflow-wrap:anywhere]">{tag.name}</span>
                              </button>
                            ))}</div>}
                      {!tagsLoading && !tagsError && unavailable > 0 && <p className="text-xs text-on-surface-variant">{unavailable} lựa chọn đã lưu hiện không có trong danh mục.</p>}
                    </fieldset>;
                  })}
                  {formError && <p role="alert" className="rounded-[8px] border border-error/20 bg-error-container/40 p-3 text-sm text-error">{formError}</p>}
                  {!hasChanges && <p role="status" className="text-sm text-on-surface-variant">Không có thay đổi để lưu.</p>}
                  <div className="flex flex-wrap gap-3 border-t border-border-soft pt-4">
                    <button type="submit" disabled={saving || !hasChanges} className={action + " flex-1 bg-primary text-on-primary sm:flex-none"}><Icon>{saving ? "hourglass_top" : "save"}</Icon>{saving ? "Đang lưu..." : "Lưu thay đổi"}</button>
                    <button type="button" onClick={cancelEditing} disabled={saving} className={action + " flex-1 border border-outline-variant bg-white text-on-surface sm:flex-none"}>Hủy</button>
                  </div>
                </form>
              ) : (
                <div className="space-y-5">{PREFERENCE_GROUPS.map((group) => {
                  const savedIds = user?.preferences?.[group.key] ?? [];
                  const selected = tags.filter((tag) => tag.type === group.type && savedIds.includes(tag.id));
                  const unavailable = savedIds.length - selected.length;
                  return <div key={group.key} className="space-y-2">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-on-surface"><Icon className="text-lg text-on-surface-variant">{group.icon}</Icon>{group.label}</h3>
                    {isDemo || !savedIds.length ? <p className="text-sm text-on-surface-variant">Chưa chọn {group.label.toLowerCase()}.</p>
                      : tagsLoading ? <p role="status" className="text-sm text-on-surface-variant">Đang tải danh mục...</p>
                        : tagsError ? <p className="text-sm text-error">Chưa tải được danh mục.</p>
                          : <><div className="flex flex-wrap gap-2">{selected.map((tag) => <span key={tag.id} className="max-w-full break-words rounded-[8px] border border-border-soft bg-white px-3 py-2 text-sm text-on-surface [overflow-wrap:anywhere]">{tag.name}</span>)}</div>
                            {unavailable > 0 && <p className="text-xs text-on-surface-variant">{unavailable} lựa chọn đã lưu hiện không có trong danh mục.</p>}</>}
                  </div>;
                })}</div>
              )}
              {!isDemo && !tagsLoading && (tagsError || tags.length === 0) && <button type="button" onClick={reloadTags} disabled={saving} className={action + " mt-3 text-primary"}><Icon>refresh</Icon>Tải lại danh mục</button>}
            </section>
            <section aria-labelledby="profile-recent-title" className="min-w-0 border-t border-border-soft pt-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 id="profile-recent-title" className="text-lg font-bold text-navy-dark">Lịch trình gần đây</h2><Link to="/trips" className={action + " text-primary"}>Xem tất cả<Icon>arrow_forward</Icon></Link></div>
              {isDemo ? <p className="text-sm text-on-surface-variant">Đăng nhập tài khoản chính thức để xem lịch trình đã lưu.</p>
                : tripsPending ? <p role="status" className="text-sm text-on-surface-variant">Đang tải lịch trình...</p>
                  : tripsError ? <div role="alert" className="space-y-2"><p className="text-sm text-error">Chưa tải được lịch trình.</p><button type="button" onClick={retryTrips} className={action + " text-primary"}><Icon>refresh</Icon>Thử lại lịch trình</button></div>
                    : !savedTrips.length ? <div className="flex items-center gap-3 border-l-2 border-outline-variant py-3 pl-4"><Icon className="text-on-surface-variant">map</Icon><p className="text-sm text-on-surface-variant">Chưa có lịch trình đã lưu.</p></div>
                      : <ul className="space-y-3">{savedTrips.slice(0, 3).map((trip) => <li key={trip.id}>
                        <Link to={"/trips/" + trip.id} className={"flex min-w-0 items-center gap-3 rounded-[8px] border border-border-soft bg-white p-4 hover:border-primary " + focus}>
                          <Icon className="flex-none text-primary">route</Icon><span className="min-w-0 flex-1">
                            <span className="block break-words text-sm font-semibold text-on-surface [overflow-wrap:anywhere]">{trip.title || "Lịch trình"}</span>
                            <span className="mt-1 block text-xs text-on-surface-variant">{trip.status === "finalized" ? "Đã chốt" : trip.status === "draft" ? "Nháp" : "Chưa rõ trạng thái"} · {trip.durationHours != null ? trip.durationHours + " tiếng" : "Chưa có thời lượng"} · {trip.itemCount ?? trip.items?.length ?? "—"} địa điểm</span>
                          </span><Icon className="flex-none text-on-surface-variant">chevron_right</Icon>
                        </Link>
                      </li>)}</ul>}
            </section>
          </div>
          <div className="min-w-0 space-y-8">
            <section aria-labelledby="profile-subscription-title" className="min-w-0 border-t border-border-soft pt-6 xl:border-t-0 xl:pt-0">
              <h2 id="profile-subscription-title" className="mb-4 flex items-center gap-2 text-lg font-bold text-navy-dark"><Icon className="text-primary">workspace_premium</Icon>Gói dịch vụ</h2>
              {isDemo ? <div className="space-y-3 border-l-2 border-amber-400 pl-4"><p className="text-sm text-on-surface-variant">Tài khoản Demo không hỗ trợ gói thành viên.</p><Link to="/register" className={action + " bg-primary text-on-primary"}>Đăng ký ngay</Link></div>
                : subscriptionLoading ? <p role="status" data-testid="profile-subscription-loading" className="text-sm text-on-surface-variant">Đang tải thông tin gói...</p>
                  : subscriptionError || !validSubscription ? <div role="alert" data-testid="profile-subscription-unavailable" className="space-y-2"><p className="text-sm font-semibold text-on-surface">Không thể tải thông tin gói</p><p className="break-words text-sm text-on-surface-variant">{subscriptionError || "Chưa có thông tin gói dịch vụ từ máy chủ."}</p></div>
                    : <div className="space-y-4">
                      <div><p className="text-xs text-on-surface-variant">Gói hiện tại</p><p className="mt-1 break-words text-xl font-bold text-primary">{getPlanDisplayName(subscription.plan, plans)}</p></div>
                      {(effectiveDate || endDate) && <dl className="space-y-2 text-sm text-on-surface-variant">
                        {effectiveDate && <div><dt>Kỳ hiện tại</dt><dd className="mt-0.5 font-medium text-on-surface">{effectiveDate}</dd></div>}
                        {endDate && (!effectiveDate || subscription.effectiveUntil !== subscription.endsAt) && <div><dt>{effectiveDate ? "Thanh toán đến" : "Hết hạn"}</dt><dd className="mt-0.5 font-medium text-on-surface">{endDate}</dd></div>}
                      </dl>}
                      <dl className="divide-y divide-border-soft border-y border-border-soft">
                        <div className="flex flex-wrap items-baseline justify-between gap-2 py-3"><dt className="text-xs text-on-surface-variant">{isFreeSubscription(subscription) ? "Lượt tạo AI tháng này" : "Lượt tạo AI"}</dt><dd className="text-sm font-bold text-on-surface">{usageText(subscription.usage?.generateUsed, subscription.usage?.generateLimit)}</dd></div>
                        <div className="flex flex-wrap items-baseline justify-between gap-2 py-3"><dt className="text-xs text-on-surface-variant">Lịch trình đã chốt</dt><dd className="text-sm font-bold text-on-surface">{usageText(subscription.savedTrips?.used, subscription.savedTrips?.limit)}</dd></div>
                      </dl>
                    </div>}
              <Link to="/subscription" className={action + " mt-4 w-full border border-outline-variant bg-white text-primary"}>Quản lý gói<Icon>arrow_forward</Icon></Link>
            </section>
            <section aria-labelledby="profile-account-title" className="border-t border-border-soft pt-6">
              <h2 id="profile-account-title" className="mb-2 text-lg font-bold text-navy-dark">Tài khoản</h2>
              <div className="divide-y divide-border-soft [&_button]:min-h-11 [&_button]:focus-visible:outline [&_button]:focus-visible:outline-2 [&_button]:focus-visible:outline-primary">
                <NotificationBell variant="profile" />
                <Link to="/about" className={"flex min-h-12 items-center gap-3 py-3 text-sm text-on-surface " + focus}><Icon className="text-on-surface-variant">info</Icon><span className="flex-1">Về LocalMate AI</span><Icon className="text-on-surface-variant">chevron_right</Icon></Link>
              </div>
              <button type="button" onClick={handleLogout} className={action + " mt-4 w-full border border-error/20 bg-error-container/40 text-error"}><Icon>logout</Icon>Đăng xuất</button>
            </section>
          </div>
        </div>
      </main>
    </MobileLayout>
  );
}
