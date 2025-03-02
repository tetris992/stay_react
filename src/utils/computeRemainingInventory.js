import { calculateRoomAvailability } from './availability';
import { format, startOfDay, endOfDay } from 'date-fns';

/**
 * 전체 객실 타입별 잔여 재고를 계산합니다.
 * - calculateRoomAvailability를 기반으로 오늘 날짜에 대한 잔여 재고만 추출.
 *
 * @param {Array} roomTypes - 객실 타입 데이터 (roomInfo, stock, roomNumbers 포함)
 * @param {Array} reservations - 예약 데이터 배열 (parsedCheckInDate, parsedCheckOutDate, roomInfo, roomNumber 포함)
 * @returns {Object} - { [roomInfo]: remainingStock, ... }
 */
export function computeRemainingInventory(roomTypes, reservations) {
  const today = new Date();
  const availability = calculateRoomAvailability(
    reservations,
    roomTypes,
    startOfDay(today),
    endOfDay(today),
    null // gridSettings는 필요 없음
  );

  const remainingInventory = {};
  const todayStr = format(today, 'yyyy-MM-dd');
  roomTypes.forEach((rt) => {
    const typeKey = rt.roomInfo.toLowerCase();
    const dailyData = availability[todayStr]?.[typeKey] || {
      remain: rt.stock || 0,
      leftoverRooms: rt.roomNumbers || [],
    };
    remainingInventory[typeKey] = dailyData.remain;
  });

  return remainingInventory;
}
