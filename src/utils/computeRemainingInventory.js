import { matchRoomType } from './matchRoomType';

/**
 * 각 객실(roomInfo)별 예약 건수를 집계하여 남은 재고를 계산합니다.
 *
 * 1. 호텔 설정에 저장된 객실 배열(roomTypes)을 순회하며, 각 객실의 예약 건수를 0으로 초기화합니다.
 *    - 여기서 각 객실은 고유 식별 값으로 roomInfo를 사용합니다.
 * 2. 당일 활성 예약 배열(reservations)의 각 예약에 대해, 예약의 roomInfo를 matchRoomType() 함수로 매칭하여
 *    해당 객실의 예약 건수를 증가시킵니다.
 *    - 매칭되지 않는 경우 콘솔 경고를 출력합니다.
 * 3. 각 객실의 남은 재고는 (해당 객실의 stock)에서 (예약 건수)를 뺀 값으로 계산됩니다.
 *
 * @param {Array} roomTypes - 호텔 설정에 저장된 객실 배열 (각 객체는 roomInfo, nameKor, nameEng, price, stock, aliases 등을 포함)
 * @param {Array} reservations - 당일 활성 예약 배열 (각 예약 객체는 roomInfo 필드를 포함)
 * @returns {Object} - { [roomInfo]: remainingStock, ... }
 */
export function computeRemainingInventory(roomTypes, reservations) {
  // 각 객실(roomInfo)별 예약 건수를 0으로 초기화 (키: roomInfo)
  const bookedCounts = {};
  roomTypes.forEach(rt => {
    bookedCounts[rt.roomInfo] = 0;
  });

  // 각 예약의 roomInfo를 사용하여 해당 객실과 매칭 (matchRoomType 함수 활용)
  reservations.forEach(res => {
    const roomInfo = res.roomInfo;
    const matched = matchRoomType(roomInfo, roomTypes);
    if (matched) {
      bookedCounts[matched.roomInfo] += 1;
    } else {
      console.warn(
        `예약 ${res.reservationNo || res._id}의 roomInfo "${roomInfo}"는 어떤 객실과도 매칭되지 않았습니다.`
      );
    }
  });

  // 남은 재고 계산: (해당 객실의 stock) - (예약 건수)
  const remainingInventory = {};
  roomTypes.forEach(rt => {
    remainingInventory[rt.roomInfo] = (Number(rt.stock) || 0) - bookedCounts[rt.roomInfo];
  });

  return remainingInventory;
}
