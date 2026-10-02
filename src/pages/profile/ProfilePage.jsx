import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTrip } from "../../context/TripContext";
import { useSubscription } from "../../context/SubscriptionContext";
import { PLAN_DISPLAY_NAMES, formatVnDateTime } from "../../utils/subscriptionUtils";
import MobileLayout from "../../components/layout/MobileLayout";
import { tagService } from "../../services/tagService";
import { userService } from "../../services/userService";

const PREFERENCE_GROUPS = [
  { key: "interestTagIds", type: "Interest", label: "Sở thích" },
  { key: "travelStyleTagIds", type: "TravelStyle", label: "Phong cách trải nghiệm" },
];

function sameIds(left, right) {
  return left.length === right.length && left.every((id) => right.includes(id));
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, isDemo, logout, applyUserProfile } = useAuth();
  const { savedTrips } = useTrip();
  const { subscription } = useSubscription();
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

  useEffect(() => {
    if (isDemo || !userId) return undefined;

    let active = true;
    tagService
      .getTags()
      .then((result) => {
        if (active) {
          setTags(result);
          setTagsError(false);
        }
      })
      .catch(() => {
        if (active) setTagsError(true);
      })
      .finally(() => {
        if (active) setTagsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isDemo, userId, tagsReload]);

  const reloadTags = () => {
    setTagsLoading(true);
    setTagsReload((value) => value + 1);
  };

  const startEditing = () => {
    setDraft({
      fullName: user.fullName,
      interestTagIds: [...(user.preferences?.interestTagIds ?? [])],
      travelStyleTagIds: [...(user.preferences?.travelStyleTagIds ?? [])],
    });
    setNameError("");
    setFormError("");
    setSuccess("");
  };

  const cancelEditing = () => {
    setDraft(null);
    setNameError("");
    setFormError("");
  };

  const toggleTag = (group, tagId) => {
    const activeIds = new Set(
      tags.filter((tag) => tag.type === group.type).map((tag) => tag.id),
    );
    setDraft((current) => {
      const selected = current[group.key].filter((id) => activeIds.has(id));
      return {
        ...current,
        [group.key]: selected.includes(tagId)
          ? selected.filter((id) => id !== tagId)
          : [...selected, tagId],
      };
    });
    setFormError("");
  };

  const nameChanged = draft && draft.fullName.trim() !== user?.fullName;
  const changedGroups = draft
    ? PREFERENCE_GROUPS.filter(
        (group) =>
          !sameIds(
            draft[group.key],
            user?.preferences?.[group.key] ?? [],
          ),
      )
    : [];
  const hasChanges = Boolean(nameChanged || changedGroups.length);

  const handleSave = async (event) => {
    event.preventDefault();
    if (saving || isDemo || !draft || !hasChanges) return;

    setNameError("");
    setFormError("");
    const fullName = draft.fullName.trim();
    if (nameChanged && !fullName) {
      setNameError("Vui lòng nhập họ và tên.");
      return;
    }
    if (nameChanged && fullName.length > 200) {
      setNameError("Họ và tên không được quá 200 ký tự.");
      return;
    }

    const payload = {};
    if (nameChanged) payload.fullName = fullName;
    if (changedGroups.length) {
      payload.preferences = Object.fromEntries(
        changedGroups.map((group) => [group.key, draft[group.key]]),
      );
    }

    setSaving(true);
    try {
      const updatedProfile = await userService.updateProfile(payload);
      applyUserProfile(updatedProfile);
      setDraft(null);
      setSuccess("Đã cập nhật hồ sơ.");
    } catch (err) {
      if (err.errors?.fullName || err.errors?.FullName) {
        setNameError("Họ và tên không hợp lệ. Vui lòng kiểm tra lại.");
      } else if (err.code === "no_changes") {
        setFormError("Không có thay đổi để lưu.");
      } else if (err.code === "invalid_preference") {
        setFormError("Sở thích đã thay đổi trên máy chủ. Vui lòng tải lại trang.");
      } else if (err.status === 401 || err.status === 403) {
        setFormError("Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại.");
      } else if (!err.status) {
        setFormError("Không kết nối được máy chủ. Vui lòng thử lại.");
      } else {
        setFormError("Không thể cập nhật hồ sơ. Vui lòng thử lại.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const completedTrips = savedTrips.filter(
    (t) => t.status === "completed",
  ).length;

  return (
    <MobileLayout>
      <header className="app-header flex h-16 items-center justify-between border-b border-outline-variant/20 px-container-margin py-stack-sm lg:px-8">
        <h1 className="text-headline-lg-mobile font-extrabold text-primary">
          Hồ sơ
        </h1>
        <div className="flex items-center gap-stack-md">
          {!isDemo && !draft && (
            <button
              type="button"
              onClick={startEditing}
              aria-label="Chỉnh sửa hồ sơ"
              title="Chỉnh sửa hồ sơ"
              className="flex h-10 w-10 items-center justify-center rounded-full text-primary hover:bg-surface-container-high focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              <span className="material-symbols-outlined">edit</span>
            </button>
          )}
          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-primary-container bg-primary-container/20 flex items-center justify-center">
            <span
              className="material-symbols-outlined text-primary"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              person
            </span>
          </div>
        </div>
      </header>

      <main className="content-shell flex flex-col gap-stack-lg px-container-margin pb-28 pt-20 lg:px-8 lg:pb-12">
        <section className="flex flex-col items-center gap-stack-sm py-stack-lg text-center lg:items-start lg:text-left">
          <div className="w-24 h-24 rounded-full bg-primary-container/20 border-4 border-primary-container flex items-center justify-center mb-2">
            <span
              className="material-symbols-outlined text-primary"
              style={{ fontSize: 56, fontVariationSettings: "'FILL' 1" }}
            >
              person
            </span>
          </div>
          <h2 className="text-headline-lg-mobile font-bold text-on-surface">
            {user?.fullName}
          </h2>
          <p className="max-w-full break-all text-body-md text-on-surface-variant">
            {user?.email}
          </p>
          <p className="text-label-md text-on-surface-variant">
            {isDemo ? "Phiên Demo" : `Vai trò: ${user?.role}`}
          </p>
          {isDemo && (
            <p className="text-body-md text-on-surface-variant">
              Phiên Demo chỉ cho phép xem hồ sơ.
            </p>
          )}
          {success && (
            <p role="status" className="text-body-md text-primary">
              {success}
            </p>
          )}

          <div className="mt-stack-sm flex flex-wrap justify-center gap-8 lg:justify-start">
            {[
              { label: "Lịch trình", value: savedTrips.length },
              { label: "Đã đi", value: completedTrips },
              {
                label: "Đang lên kế hoạch",
                value: savedTrips.filter((t) => t.status !== "completed")
                  .length,
              },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-headline-lg font-bold text-primary">
                  {stat.value}
                </p>
                <p className="text-label-md text-on-surface-variant">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Compact Subscription Card */}
        <section className="card w-full max-w-3xl border border-outline-variant/30 space-y-4">
          <div className="flex items-center justify-between gap-3 border-b border-outline-variant/20 pb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[22px]">
                workspace_premium
              </span>
              <h3 className="text-title-md font-bold text-on-surface">
                Gói dịch vụ
              </h3>
            </div>
            <button
              type="button"
              onClick={() => navigate("/subscription")}
              className="text-label-md font-bold text-primary hover:underline flex items-center gap-0.5"
            >
              <span>Quản lý gói</span>
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </button>
          </div>

          {isDemo ? (
            <div className="rounded-xl bg-amber-50 p-3.5 text-label-md text-amber-900 border border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <span>Tài khoản Demo không hỗ trợ gói thành viên. Vui lòng đăng ký tài khoản chính thức để sử dụng.</span>
              <button
                type="button"
                onClick={() => navigate("/register")}
                className="px-3 py-1.5 rounded-lg bg-amber-700 text-white font-bold text-xs flex-shrink-0"
              >
                Đăng ký ngay
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-body-md font-semibold text-on-surface">
                    Gói hiện tại:
                  </span>
                  <span className="rounded-full bg-primary/10 px-3 py-0.5 text-label-md font-bold text-primary">
                    {PLAN_DISPLAY_NAMES[subscription?.plan] || subscription?.plan || "Free"}
                  </span>
                </div>
                {subscription?.endsAt && (
                  <span className="text-label-sm text-text-muted">
                    Hết hạn: {formatVnDateTime(subscription.endsAt)}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="rounded-xl bg-surface-container-low p-3">
                  <div className="text-label-sm text-on-surface-variant">Lượt tạo AI tháng này</div>
                  <div className="text-body-lg font-bold text-on-surface mt-0.5">
                    {subscription?.usage?.generateLimit == null
                      ? "Không giới hạn"
                      : `${subscription?.usage?.generateUsed ?? 0} / ${subscription?.usage?.generateLimit}`}
                  </div>
                </div>
                <div className="rounded-xl bg-surface-container-low p-3">
                  <div className="text-label-sm text-on-surface-variant">Lịch trình đã chốt</div>
                  <div className="text-body-lg font-bold text-on-surface mt-0.5">
                    {subscription?.savedTrips?.limit == null
                      ? "Không giới hạn"
                      : `${subscription?.savedTrips?.used ?? 0} / ${subscription?.savedTrips?.limit}`}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {draft ? (
          <section className="card w-full max-w-3xl">
            <form onSubmit={handleSave} className="space-y-stack-lg">
              <h3 className="text-title-md font-semibold text-on-surface">
                Chỉnh sửa hồ sơ
              </h3>

              <div>
                <label
                  htmlFor="profile-full-name"
                  className="mb-2 block text-label-md font-semibold text-on-surface"
                >
                  Họ và tên
                </label>
                <input
                  id="profile-full-name"
                  type="text"
                  value={draft.fullName}
                  onChange={(event) => {
                    setDraft((current) => ({
                      ...current,
                      fullName: event.target.value,
                    }));
                    setNameError("");
                  }}
                  disabled={saving}
                  aria-invalid={Boolean(nameError)}
                  aria-describedby={nameError ? "profile-name-error" : undefined}
                  className="input-field w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                />
                {nameError && (
                  <p id="profile-name-error" role="alert" className="mt-2 text-label-md text-error">
                    {nameError}
                  </p>
                )}
              </div>

              {PREFERENCE_GROUPS.map((group) => {
                const options = tags.filter((tag) => tag.type === group.type);
                return (
                  <fieldset key={group.key} disabled={saving || tagsLoading || tagsError}>
                    <legend className="mb-2 text-label-md font-semibold text-on-surface">
                      {group.label}
                    </legend>
                    {tagsLoading ? (
                      <p className="text-body-md text-on-surface-variant">Đang tải danh mục...</p>
                    ) : tagsError ? (
                      <p className="text-body-md text-error">Chưa tải được danh mục.</p>
                    ) : options.length === 0 ? (
                      <p className="text-body-md text-on-surface-variant">Chưa có lựa chọn.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {options.map((tag) => {
                          const selected = draft[group.key].includes(tag.id);
                          return (
                            <button
                              key={tag.id}
                              type="button"
                              onClick={() => toggleTag(group, tag.id)}
                              aria-pressed={selected}
                              className={`${selected ? "chip-active" : "chip"} min-h-11 px-4 text-body-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary`}
                            >
                              {tag.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </fieldset>
                );
              })}

              {tagsError && (
                <button
                  type="button"
                  onClick={reloadTags}
                  className="text-body-md font-semibold text-primary underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                >
                  Tải lại danh mục
                </button>
              )}
              {formError && (
                <p role="alert" className="text-body-md text-error">
                  {formError}
                </p>
              )}
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={cancelEditing}
                  disabled={saving}
                  className="min-h-11 flex-1 rounded-full border border-outline-variant px-5 py-3 font-semibold text-on-surface-variant focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving || !hasChanges}
                  className="min-h-11 flex-1 rounded-full bg-primary px-5 py-3 font-semibold text-on-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60"
                >
                  {saving ? "Đang lưu..." : "Lưu thay đổi"}
                </button>
              </div>
            </form>
          </section>
        ) : (
          <section className="card space-y-stack-md">
            <h3 className="text-title-md font-semibold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">
                favorite
              </span>
              Sở thích của bạn
            </h3>
            {PREFERENCE_GROUPS.map((group) => {
              const savedIds = user?.preferences?.[group.key] ?? [];
              const selectedTags = tags.filter(
                (tag) => tag.type === group.type && savedIds.includes(tag.id),
              );
              return (
                <div key={group.key} className="space-y-2">
                  <h4 className="text-label-md font-semibold text-on-surface-variant">
                    {group.label}
                  </h4>
                  {isDemo || savedIds.length === 0 ? (
                    <p className="text-body-md text-on-surface-variant">Chưa chọn {group.label.toLowerCase()}.</p>
                  ) : tagsLoading ? (
                    <p className="text-body-md text-on-surface-variant">Đang tải danh mục...</p>
                  ) : tagsError ? (
                    <p className="text-body-md text-error">Chưa tải được danh mục.</p>
                  ) : selectedTags.length ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedTags.map((tag) => (
                        <span key={tag.id} className="chip-active text-label-md">
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-body-md text-on-surface-variant">
                      Sở thích đã lưu không còn trong danh mục hoạt động.
                    </p>
                  )}
                </div>
              );
            })}
            {tagsError && !isDemo && (
              <button
                type="button"
                onClick={reloadTags}
                className="text-body-md font-semibold text-primary underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              >
                Tải lại danh mục
              </button>
            )}
          </section>
        )}

        <section className="space-y-stack-md">
          <div className="flex justify-between items-center">
            <h3 className="text-title-md font-semibold text-on-surface">
              Lịch trình gần đây
            </h3>
            <button
              onClick={() => navigate("/trips")}
              className="text-label-md text-primary"
            >
              Xem tất cả
            </button>
          </div>

          {savedTrips.slice(0, 3).map((trip) => (
            <div
              key={trip.id}
              onClick={() => navigate(`/trips/${trip.id}`)}
              className="card flex items-center gap-3 cursor-pointer active:scale-[0.98] transition-transform"
            >
              <div className="w-10 h-10 rounded-DEFAULT bg-primary-container/20 flex items-center justify-center flex-shrink-0">
                <span
                  className="material-symbols-outlined text-primary text-[20px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  map_search
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-body-md font-semibold text-on-surface truncate">
                  {trip.title}
                </p>
                <p className="text-label-md text-on-surface-variant">
                  {trip.durationHours} tiếng · {trip.itemCount ?? trip.items.length} địa điểm
                </p>
              </div>
              <span className="material-symbols-outlined text-outline-variant">
                chevron_right
              </span>
            </div>
          ))}
        </section>

        <section className="card divide-y divide-outline-variant/20">
          {[
            { icon: "notifications", label: "Thông báo" },
            { icon: "privacy_tip", label: "Quyền riêng tư" },
            { icon: "help", label: "Trợ giúp" },
            { icon: "info", label: "Về LocalMate AI" },
          ].map((item) => (
            <button
              key={item.label}
              className="w-full flex items-center gap-3 py-stack-md text-left hover:bg-surface-container-low transition-colors px-1"
            >
              <span className="material-symbols-outlined text-on-surface-variant">
                {item.icon}
              </span>
              <span className="flex-1 text-body-md text-on-surface">
                {item.label}
              </span>
              <span className="material-symbols-outlined text-outline-variant">
                chevron_right
              </span>
            </button>
          ))}
        </section>

        <button
          onClick={handleLogout}
          className="w-full py-4 bg-error-container text-on-error-container rounded-full font-semibold text-button active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined">logout</span>
          Đăng xuất
        </button>

        <p className="text-center text-label-md text-on-surface-variant opacity-50">
          LocalMate AI · v0.1.0
        </p>
      </main>
    </MobileLayout>
  );
}
