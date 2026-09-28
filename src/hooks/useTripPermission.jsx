import { useMemo } from "react";
import { useAuth } from "../context/AuthContext";

/**
 * Custom React Hook kiểm tra phân quyền & trạng thái chỉnh sửa lịch trình (FE-63 / SPEC-02)
 *
 * @param {Object} trip Object lịch trình hiện tại
 * @returns {Object} permissions { isFinalized, isOwner, canEdit, canDelete, canFinalize, canShare, canFork }
 */
export function useTripPermission(trip) {
  const { user } = useAuth();

  return useMemo(() => {
    if (!trip) {
      return {
        isFinalized: false,
        isOwner: false,
        canEdit: false,
        canDelete: false,
        canFinalize: false,
        canShare: false,
        canFork: false,
      };
    }

    const statusStr = String(trip.status || "").toLowerCase();
    const isFinalized = statusStr === "finalized" || Boolean(trip.isFinalized);

    // Kiểm tra chủ sở hữu: nếu không có thông tin user, coi như demo/guest
    const isOwner = user?.id ? String(trip.userId) === String(user.id) : true;

    return {
      isFinalized,
      isOwner,
      canEdit: !isFinalized && isOwner,
      canDelete: !isFinalized && isOwner,
      canFinalize: !isFinalized && isOwner,
      canShare: isFinalized,
      canFork: true, // BE-59 cho phép fork cả Draft và Finalized
    };
  }, [trip, user]);
}

export default useTripPermission;
