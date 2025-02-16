// src/utils/availability.js
import { format, startOfDay, addDays, differenceInCalendarDays } from 'date-fns';

/**
 * 예약 정보를 바탕으로 날짜별 객실 잔여 정보를 계산합니다.
 * 
 * @param {Array} reservations - 예약 배열
 * @param {Array} roomTypes - 객실 타입 배열 (각 항목은 { roomInfo, stock, roomNumbers } 형태)
 * @param {Date} fromDate - 계산 시작 날짜
 * @param {Date} toDate - 계산 종료 날짜
 * @param {Object|null} gridSettings - (선택) gridSettings 객체. roomNumbers가 없을 경우 사용
 * @returns {Object} 날짜별 availability 객체
 */
export function computeDailyAvailability(reservations, roomTypes, fromDate, toDate, gridSettings = null) {
  // 1) 각 roomType 별로 stock과 객실번호(roomNumbers)를 정리합니다.
  const roomDataByType = {};
  roomTypes.forEach(rt => {
    const tKey = (rt.roomInfo || 'Standard').toLowerCase();
    let rooms = rt.roomNumbers || [];
    // roomNumbers가 없으면 gridSettings.containers에서 추출
    if ((!rooms || rooms.length === 0) && gridSettings && gridSettings.containers) {
      rooms = gridSettings.containers
        .filter(cell =>
          ((cell.roomInfo || 'standard').toLowerCase() === tKey) &&
          cell.roomNumber &&
          cell.roomNumber.trim() !== ''
        )
        .map(cell => cell.roomNumber);
    }
    roomDataByType[tKey] = {
      stock: rt.stock || 0,
      rooms,
    };
  });

  // 2) fromDate ~ toDate 범위 내의 날짜 리스트(자정 기준)를 생성합니다.
  const start = startOfDay(fromDate);
  const end = startOfDay(toDate);
  const totalDays = differenceInCalendarDays(end, start) + 1;
  const dateList = [];
  for (let i = 0; i < totalDays; i++) {
    const d = addDays(start, i);
    dateList.push(format(d, 'yyyy-MM-dd'));
  }

  // 3) 날짜별, 타입별 사용 내역 초기화
  const usageByDate = {};
  dateList.forEach(ds => {
    usageByDate[ds] = {};
    Object.keys(roomDataByType).forEach(typeKey => {
      usageByDate[ds][typeKey] = { count: 0, assignedRooms: [] };
    });
    usageByDate[ds]['unassigned'] = { count: 0, assignedRooms: [] };
  });

  // 4) 각 예약에 대해, 체크인부터 체크아웃 전날까지 사용 내역 업데이트
  reservations.forEach(res => {
    if (res.isCancelled) return; // 취소 예약 무시

    const ci = res.parsedCheckInDate ? startOfDay(res.parsedCheckInDate) : null;
    const co = res.parsedCheckOutDate ? startOfDay(res.parsedCheckOutDate) : null;
    if (!ci || !co) return;

    let typeKey;
    if (!res.roomNumber || res.roomNumber.trim() === '') {
      typeKey = 'unassigned';
    } else {
      typeKey = res.roomInfo ? res.roomInfo.toLowerCase() : 'standard';
    }

    // 예약 날짜 범위 조정
    const usageStart = ci < start ? start : ci;
    const usageEnd = co > end ? end : co;

    if (usageEnd > usageStart) {
      let cursor = usageStart;
      while (cursor < usageEnd) {
        const ds = format(cursor, 'yyyy-MM-dd');
        if (usageByDate[ds] && usageByDate[ds][typeKey]) {
          usageByDate[ds][typeKey].count += 1;
          if (typeKey !== 'unassigned' && res.roomNumber) {
            usageByDate[ds][typeKey].assignedRooms.push(res.roomNumber);
          }
        }
        cursor = addDays(cursor, 1);
      }
    } else if (usageEnd.getTime() === usageStart.getTime()) {
      const ds = format(usageStart, 'yyyy-MM-dd');
      if (usageByDate[ds] && usageByDate[ds][typeKey]) {
        usageByDate[ds][typeKey].count += 1;
        if (typeKey !== 'unassigned' && res.roomNumber) {
          usageByDate[ds][typeKey].assignedRooms.push(res.roomNumber);
        }
      }
    }
  });

  // 5) 최종 availability 계산: 남은 객실 수와 leftoverRooms 계산
  const availability = {};
  dateList.forEach(ds => {
    availability[ds] = {};
    Object.entries(usageByDate[ds]).forEach(([typeKey, usage]) => {
      if (typeKey === 'unassigned') {
        availability[ds][typeKey] = usage.count;
      } else {
        const allRooms = roomDataByType[typeKey]?.rooms || [];
        const usedCount = usage.count;
        const assigned = usage.assignedRooms || [];
        const totalStock = roomDataByType[typeKey]?.stock || 0;
        const leftoverRooms = allRooms.filter(rnum => !assigned.includes(rnum));
        const remainCalc = totalStock - usedCount;
        const remain = remainCalc < 0 ? 0 : remainCalc;
        availability[ds][typeKey] = { remain, leftoverRooms };
      }
    });
  });

  return availability;
}

/**
 * 선택한 날짜 범위와 해당 객실 타입에 대해,
 * 각 날짜별로 사용 가능한 객실번호 목록을 상세하게 안내하는 메시지를 생성합니다.
 * 
 * @param {Date} rangeStart - 예약 시작 날짜
 * @param {Date} rangeEnd - 예약 종료 날짜
 * @param {string} roomTypeKey - 객실 타입 키 (소문자)
 * @param {Object} availabilityByDate - 날짜별 availability 객체
 * @returns {string} 상세 안내 메시지
 */
export function getDetailedAvailabilityMessage(rangeStart, rangeEnd, roomTypeKey, availabilityByDate) {
  let msg = '연박 예약이 불가능합니다.\n선택한 날짜 범위에서 날짜별 사용 가능한 객실번호는 다음과 같습니다:\n';
  let cursor = rangeStart;
  while (cursor <= rangeEnd) {
    const ds = format(cursor, 'yyyy-MM-dd');
    const freeRooms = availabilityByDate[ds]?.[roomTypeKey]?.leftoverRooms || [];
    msg += `${ds}: ${freeRooms.length > 0 ? freeRooms.join(', ') : '없음'}\n`;
    cursor = addDays(cursor, 1);
  }
  msg += '\n(이미 배정된 예약을 다른 객실로 옮긴 후 재시도해주세요.)';
  return msg;
}
