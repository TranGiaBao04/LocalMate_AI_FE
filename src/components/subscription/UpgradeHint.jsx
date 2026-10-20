import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useSubscription } from "../../context/SubscriptionContext";
import {
  PLAN_CODES,
  formatPlanPrice,
  formatVnDate,
  formatVnDateTime,
  getPerDaySaving,
  getUpgradeOptions,
  isTrialSubscription,
} from "../../utils/subscriptionUtils";

const TITLES = {
  generate: "Muốn tạo thêm phương án cho chuyến đi?",
  savedTrips: "Muốn lưu thêm lịch trình?",
  ai: "Muốn nhờ AI nhiều hơn mỗi ngày?",
};
const ICONS = { generate: "auto_awesome", savedTrips: "bookmark_add", ai: "smart_toy" };
const PERK_ORDER = ["generate", "savedTrips", "ai"];

// Quyền lợi của một gói, quyền lợi đúng lý do đứng đầu. AI null = chưa đặt riêng cho gói nên bỏ dòng này
function perksOf(plan, reason) {
  const perks = {
    generate: plan.generateLimit == null ? "Tạo lịch không giới hạn" : `Tạo ${plan.generateLimit} lịch`,
    savedTrips: plan.savedTripLimit == null ? "Lưu không giới hạn" : `Lưu ${plan.savedTripLimit} lịch`,
    ai: plan.aiDailyCallLimit == null ? null : `${plan.aiDailyCallLimit} lượt AI mỗi ngày`,
  };
  return [reason, ...PERK_ORDER.filter((key) => key !== reason)]
    .map((key) => ({ key, text: perks[key] }))
    .filter((perk) => perk.text);
}

// Câu một dòng: điều gói rẻ nhất mở thêm cho đúng lý do
function inlineText(plan, reason) {
  const name = plan.name || plan.code;
  if (reason === "generate") {
    return plan.generateLimit == null
      ? `Tạo phương án mới không giới hạn với ${name}.`
      : `${name} tạo được ${plan.generateLimit} lịch.`;
  }
  if (reason === "savedTrips") {
    return plan.savedTripLimit == null
      ? `Lưu không giới hạn với ${name}.`
      : `${name} lưu được ${plan.savedTripLimit} lịch.`;
  }
  return `${name} có ${plan.aiDailyCallLimit} lượt AI mỗi ngày.`;
}

function usageText(reason, sub) {
  if (reason === "generate" && typeof sub?.usage?.generateLimit === "number") {
    const { generateUsed, generateLimit } = sub.usage;
    const period = sub.plan === PLAN_CODES.FREE || isTrialSubscription(sub) ? "tháng này" : "của gói hiện tại";
    return `Bạn đã dùng ${Math.min(generateUsed ?? generateLimit, generateLimit)}/${generateLimit} lượt tạo lịch ${period}.`;
  }
  if (reason === "savedTrips" && typeof sub?.savedTrips?.limit === "number") {
    return `Bạn đã lưu ${sub.savedTrips.used}/${sub.savedTrips.limit} lịch của gói hiện tại.`;
  }
  if (reason === "ai" && typeof sub?.ai?.dailyLimit === "number") {
    return `Bạn đã dùng hết ${sub.ai.dailyLimit} lượt AI hôm nay.`;
  }
  return "";
}

// Lựa chọn miễn phí: chờ tới lúc được cấp lại lượt
function waitText(reason, sub, resetAt) {
  if (!resetAt) return "";
  if (reason === "generate") {
    const amount = sub?.usage?.generateLimit;
    return typeof amount === "number"
      ? `Hoặc chờ đến ${formatVnDate(resetAt)} để có thêm ${amount} lịch miễn phí.`
      : `Hoặc chờ đến ${formatVnDate(resetAt)} để có lượt tạo lịch mới.`;
  }
  if (reason === "ai") return `Hoặc chờ đến ${formatVnDateTime(resetAt)} để có lượt AI mới.`;
  return "";
}

/**
 * Lời nhắc nâng cấp khi chạm giới hạn: cho thấy gói cao hơn mở thêm được gì. Số liệu và tên gói lấy từ API.
 * reason: "generate" | "savedTrips" | "ai". variant: "card" | "inline".
 * resetAt: lúc được cấp lại lượt (có thì hiện lựa chọn chờ). children: nút phụ đặt cạnh "Xem các gói".
 * usage: câu số đã dùng do trang đưa vào khi có số mới hơn gói trong context (ví dụ số từ API khả dụng lúc chốt).
 * Ẩn với phiên demo/chưa đăng nhập. Kiểu inline ẩn khi đã có danh sách gói mà không gói nào mở thêm được.
 */
export default function UpgradeHint({ reason, variant = "card", resetAt = null, usage: usageOverride, children }) {
  const navigate = useNavigate();
  const { isLoggedIn, isDemo } = useAuth();
  const { subscription, plans } = useSubscription();
  if (!isLoggedIn || isDemo) return null;

  const catalog = Array.isArray(plans) ? plans : [];
  const options = getUpgradeOptions(reason, subscription, catalog);

  if (variant === "inline") {
    // Chưa tải được danh sách gói thì vẫn chỉ đường tới trang Gói; đã có danh sách mà không gói nào mở thêm thì im lặng
    if (options.length === 0 && catalog.length > 0) return null;
    return (
      <p className="text-[13px] leading-5 text-navy-dark">
        {options.length > 0 ? inlineText(options[0], reason) : "Nâng cấp gói để mở thêm."}{" "}
        <button
          type="button"
          onClick={() => navigate("/subscription")}
          className="rounded-[4px] font-semibold text-primary underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Xem các gói
        </button>
      </p>
    );
  }

  const usage = usageOverride ?? usageText(reason, subscription);
  const wait = waitText(reason, subscription, resetAt);
  return (
    <section aria-label={TITLES[reason]} className="space-y-4 rounded-[8px] border border-border-soft bg-white p-4 sm:p-5">
      <div className="flex items-start gap-2.5">
        <span aria-hidden="true" className="material-symbols-outlined mt-0.5 shrink-0 text-[22px] text-primary">{ICONS[reason]}</span>
        <div className="min-w-0 space-y-1 break-words">
          <h3 className="text-body-lg font-semibold leading-6 text-navy-dark">{TITLES[reason]}</h3>
          {usage && (
            <p className="text-body-md text-text-muted">
              {usage}{options.length > 0 ? " Nâng cấp để mở thêm:" : ""}
            </p>
          )}
        </div>
      </div>

      {options.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {options.map((plan) => {
            const saving = getPerDaySaving(plan, catalog);
            return (
              <li key={plan.code} className="min-w-0 rounded-[8px] border border-border-soft bg-surface-container-low p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="min-w-0 break-words font-semibold text-navy-dark">{plan.name || plan.code}</span>
                  <span className="text-[13px] text-text-muted">
                    {formatPlanPrice(plan.price)}
                    {plan.durationDays ? ` / ${plan.durationDays} ngày` : ""}
                  </span>
                </div>
                <ul className="mt-2 space-y-1 text-[13px] leading-5 text-text-muted">
                  {perksOf(plan, reason).map((perk, index) => (
                    <li key={perk.key} className={index === 0 ? "font-semibold text-navy-dark" : undefined}>
                      {perk.text}
                    </li>
                  ))}
                </ul>
                {saving && (
                  <span className="mt-2 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[12px] font-medium text-emerald-800">
                    Rẻ hơn {saving.percent}% mỗi ngày so với {saving.baseName}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {wait && <p className="text-body-md text-text-muted">{wait}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => navigate("/subscription")}
          className="flex min-h-11 items-center gap-2 rounded-[8px] bg-primary px-4 py-2.5 text-body-md font-semibold text-on-primary transition-colors hover:bg-navy-dark motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[18px]">workspace_premium</span>
          Xem các gói
        </button>
        {children}
      </div>
    </section>
  );
}
