// src/utils/couponUtils.js
/**
 * ◉ coupon.applicableRoomTypes 배열이 있으면 첫 번째 요소를,
 *   없으면 coupon.applicableRoomType 을 리턴.
 *   이후 applicableRoomTypes 필드는 제거합니다.
 */
export function normalizeRoomType(coupon) {
    const roomType =
      Array.isArray(coupon.applicableRoomTypes) &&
      coupon.applicableRoomTypes.length > 0
        ? coupon.applicableRoomTypes[0]
        : coupon.applicableRoomType || 'all';
  
    return {
      ...coupon,
      applicableRoomType: roomType,
      applicableRoomTypes: undefined,
    };
  }