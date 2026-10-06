import { useEffect, useState } from "react";
import AdminPageHeader from "../../components/admin/AdminPageHeader";
import FeedbackList from "../../components/admin/feedback/FeedbackList";
import FeedbackSummary from "../../components/admin/feedback/FeedbackSummary";
import { masterDataService } from "../../services/masterDataService";

const TABS = [
  { key: "summary", label: "Thống kê" },
  { key: "reviews", label: "Đánh giá địa điểm" },
  { key: "tripFeedback", label: "Feedback chuyến đi" },
];

// [{ code, label }] -> { code: label }, giữ thứ tự BE trả
const toLabelMap = (tags) => Object.fromEntries((tags ?? []).map((tag) => [tag.code, tag.label]));

export default function AdminFeedbackPage() {
  const [tab, setTab] = useState("summary");
  // Bộ lọc mang từ tab Thống kê sang tab Đánh giá (bấm "Xem đánh giá" ở địa điểm điểm thấp)
  const [reviewPreset, setReviewPreset] = useState(null);
  // Nhãn tiếng Việt từ master-data: review = 12 quick tag đánh giá, feedback = 7 nhãn feedback chuyến đi
  const [tagLabels, setTagLabels] = useState({ review: {}, feedback: {} });

  useEffect(() => {
    let active = true;
    masterDataService
      .getMasterData()
      .then((data) => {
        if (active) {
          setTagLabels({ review: toLabelMap(data.reviewQuickTags), feedback: toLabelMap(data.feedbackQuickTags) });
        }
      })
      .catch(() => {}); // Thiếu nhãn thì hiện mã
    return () => { active = false; };
  }, []);

  const selectTab = (key) => {
    setReviewPreset(null);
    setTab(key);
  };

  const openPlaceReviews = (preset) => {
    setReviewPreset(preset);
    setTab("reviews");
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Người dùng & Phân quyền"
        title="Phản hồi & đánh giá"
        description="Xem đánh giá địa điểm và feedback chuyến đi người dùng đã gửi. Trang này chỉ để xem, chưa có thao tác ẩn hay xoá."
      />

      <div role="tablist" aria-label="Phản hồi & đánh giá" className="inline-flex flex-wrap rounded-xl bg-slate-100 p-1">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            onClick={() => selectTab(item.key)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              tab === item.key ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "summary" && (
        <FeedbackSummary
          reviewTagLabels={tagLabels.review}
          feedbackTagLabels={tagLabels.feedback}
          onOpenPlaceReviews={openPlaceReviews}
        />
      )}
      {tab === "reviews" && <FeedbackList kind="reviews" tagLabels={tagLabels.review} preset={reviewPreset} />}
      {tab === "tripFeedback" && <FeedbackList kind="tripFeedback" tagLabels={tagLabels.feedback} />}
    </div>
  );
}
