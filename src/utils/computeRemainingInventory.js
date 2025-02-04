import { matchRoomType } from './matchRoomType';

/**
 * 각 객실타입별 예약 건수를 집계하여 남은 재고를 계산합니다.
 *
 * 1. 호텔 세팅에 저장된 객실타입 배열을 순회하며, 각 타입의 예약 건수를 0으로 초기화합니다.
 * 2. 당일 활성 예약 배열의 각 예약에 대해, 예약의 roomInfo를 matchRoomType()으로 매칭하여 해당 객실타입의 예약 건수를 증가시킵니다.
 *    - 매칭되지 않는 경우 콘솔 경고를 출력합니다.
 * 3. 각 객실타입의 남은 재고는 (객실타입의 stock) - (예약 건수)로 계산됩니다.
 *
 * @param {Array} roomTypes - 호텔 설정에 저장된 객실타입 배열
 * @param {Array} reservations - 당일 활성 예약 배열
 * @returns {Object} - { [roomType]: remainingStock, ... }
 */
export function computeRemainingInventory(roomTypes, reservations) {
  // 각 객실 타입별 예약 건수를 0으로 초기화
  const bookedCounts = {};
  roomTypes.forEach(rt => {
    bookedCounts[rt.type] = 0;
  });

  // 각 예약의 roomInfo를 사용하여 객실타입 매칭 (matchRoomType 함수 활용)
  reservations.forEach(res => {
    const roomInfo = res.roomInfo;
    const matched = matchRoomType(roomInfo, roomTypes);
    if (matched) {
      bookedCounts[matched.type] += 1;
    } else {
      console.warn(
        `예약 ${res.reservationNo || res._id}의 roomInfo "${roomInfo}"는 어떤 객실타입과도 매칭되지 않았습니다.`
      );
    }
  });

  // 남은 재고 계산: (객실타입의 stock) - (예약 건수)
  const remainingInventory = {};
  roomTypes.forEach(rt => {
    remainingInventory[rt.type] = (Number(rt.stock) || 0) - bookedCounts[rt.type];
  });

  return remainingInventory;
}
