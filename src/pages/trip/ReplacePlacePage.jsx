import { useNavigate, useParams } from "react-router-dom";
import { useTrip } from "../../context/TripContext";
import ReplacePlacePanel from "../../components/trip/ReplacePlacePanel";

// Trang riêng /replace/:itemId: giữ cho link cũ và nút back. Trang Nháp dùng chung ReplacePlacePanel ngay tại chỗ.
export default function ReplacePlacePage() {
  const { itemId } = useParams();
  const navigate = useNavigate();
  const { currentTrip } = useTrip();

  const currentItem = currentTrip?.items.find((i) => i.id === itemId);

  return (
    <div className="app-shell flex flex-col">
      <header className="app-header flex h-16 items-center gap-3 border-b border-outline-variant/20 px-container-margin py-stack-sm lg:px-8">
        <button
          type="button"
          aria-label="Quay lại"
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full hover:bg-surface-container-high flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          <span className="material-symbols-outlined text-on-surface-variant">
            arrow_back
          </span>
        </button>

        <div>
          <h1 className="text-title-md font-semibold text-on-surface">
            Thay thế địa điểm
          </h1>
          {currentItem && (
            <p className="text-label-md text-on-surface-variant">
              {currentItem.placeName}
            </p>
          )}
        </div>
      </header>

      <main className="content-shell flex-1 px-container-margin pb-8 pt-24 lg:px-8">
        <ReplacePlacePanel
          tripId={currentTrip?.id}
          itemId={itemId}
          itemName={currentItem?.placeName}
          wide
          // Thay /replace trong lịch sử, để nút back ở trang Nháp không quay lại trang thay thế
          onReplaced={(toast) => navigate("/draft", { replace: true, state: { toast } })}
        />
      </main>
    </div>
  );
}
