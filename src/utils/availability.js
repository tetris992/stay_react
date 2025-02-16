import {
  format,
  startOfDay,
  addDays,
  differenceInCalendarDays,
  areIntervalsOverlapping,
} from 'date-fns';

/**
 * 예약 정보를 바탕으로 날짜별 객실 잔여 정보를 계산합니다.
 * (기존 코드 - 수정 없음)
 */
export function computeDailyAvailability(
  reservations,
  roomTypes,
  fromDate,
  toDate,
  gridSettings = null
) {
  // 1) 각 roomType별로 stock과 객실번호(roomNumbers)를 정리
  const roomDataByType = {};
  roomTypes.forEach((rt) => {
    const tKey = (rt.roomInfo || 'Standard').toLowerCase();
    let rooms = rt.roomNumbers || [];
    // roomNumbers가 없으면 gridSettings.containers에서 추출
    if (
      (!rooms || rooms.length === 0) &&
      gridSettings &&
      gridSettings.containers
    ) {
      rooms = gridSettings.containers
        .filter(
          (cell) =>
            (cell.roomInfo || 'standard').toLowerCase() === tKey &&
            cell.roomNumber &&
            cell.roomNumber.trim() !== ''
        )
        .map((cell) => cell.roomNumber);
    }
    roomDataByType[tKey] = {
      stock: rt.stock || 0,
      rooms,
    };
  });

  // 2) fromDate ~ toDate 범위 내 날짜 리스트 생성
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
  dateList.forEach((ds) => {
    usageByDate[ds] = {};
    Object.keys(roomDataByType).forEach((typeKey) => {
      usageByDate[ds][typeKey] = { count: 0, assignedRooms: [] };
    });
    usageByDate[ds]['unassigned'] = { count: 0, assignedRooms: [] };
  });

  // 4) 각 예약에 대해 사용 내역 업데이트
  reservations.forEach((res) => {
    if (res.isCancelled) return; // 취소 예약 무시

    const ci = res.parsedCheckInDate ? startOfDay(res.parsedCheckInDate) : null;
    const co = res.parsedCheckOutDate
      ? startOfDay(res.parsedCheckOutDate)
      : null;
    if (!ci || !co) return;

    let typeKey;
    if (!res.roomNumber || res.roomNumber.trim() === '') {
      typeKey = 'unassigned';
    } else {
      typeKey = res.roomInfo ? res.roomInfo.toLowerCase() : 'standard';
    }

    // 예약 기간이 전체 범위보다 벗어나면 범위에 맞게 조정
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

  // 5) 최종 availability 계산
  const availability = {};
  dateList.forEach((ds) => {
    availability[ds] = {};
    Object.entries(usageByDate[ds]).forEach(([typeKey, usage]) => {
      if (typeKey === 'unassigned') {
        availability[ds][typeKey] = usage.count;
      } else {
        const allRooms = roomDataByType[typeKey]?.rooms || [];
        const usedCount = usage.count;
        const assigned = usage.assignedRooms || [];
        const totalStock = roomDataByType[typeKey]?.stock || 0;
        const leftoverRooms = allRooms.filter(
          (rnum) => !assigned.includes(rnum)
        );
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
 * 사용 가능한 객실번호 목록 메시지를 생성합니다.
 */
export function getDetailedAvailabilityMessage(
  rangeStart,
  rangeEnd,
  roomTypeKey,
  availabilityByDate
) {
  let msg =
    '연박 예약이 불가능합니다.\n선택한 날짜 범위에서 날짜별 사용 가능한 객실번호는 다음과 같습니다:\n';
  let cursor = rangeStart;
  while (cursor <= rangeEnd) {
    const ds = format(cursor, 'yyyy-MM-dd');
    const freeRooms =
      availabilityByDate[ds]?.[roomTypeKey]?.leftoverRooms || [];
    msg += `${ds}: ${freeRooms.length > 0 ? freeRooms.join(', ') : '없음'}\n`;
    cursor = addDays(cursor, 1);
  }
  msg += '\n(이미 배정된 예약을 다른 객실로 옮긴 후 재시도해주세요.)';
  return msg;
}

/**
 * 두 예약을 스왑할 경우, 상대방의 객실번호를 사용했을 때 충돌 여부를 검사합니다.
 */
export function canSwapReservations(reservationA, reservationB, reservations) {
  const proposedRoomForA = reservationB.roomNumber;
  const proposedRoomForB = reservationA.roomNumber;
  const roomTypeA = reservationA.roomInfo
    ? reservationA.roomInfo.toLowerCase()
    : '';
  const roomTypeB = reservationB.roomInfo
    ? reservationB.roomInfo.toLowerCase()
    : '';

  const intervalA = {
    start: reservationA.parsedCheckInDate,
    end: reservationA.parsedCheckOutDate,
  };
  const intervalB = {
    start: reservationB.parsedCheckInDate,
    end: reservationB.parsedCheckOutDate,
  };

  const conflictA = reservations.some((r) => {
    if (r._id === reservationA._id || r._id === reservationB._id) return false;
    if (r.isCancelled) return false;
    if (!r.roomNumber || !r.roomInfo) return false;
    if (r.roomInfo.toLowerCase() !== roomTypeA) return false;
    if (r.roomNumber !== proposedRoomForA) return false;
    return areIntervalsOverlapping(
      intervalA,
      { start: r.parsedCheckInDate, end: r.parsedCheckOutDate },
      { inclusive: false }
    );
  });

  if (conflictA) return false;

  const conflictB = reservations.some((r) => {
    if (r._id === reservationA._id || r._id === reservationB._id) return false;
    if (r.isCancelled) return false;
    if (!r.roomNumber || !r.roomInfo) return false;
    if (r.roomInfo.toLowerCase() !== roomTypeB) return false;
    if (r.roomNumber !== proposedRoomForB) return false;
    return areIntervalsOverlapping(
      intervalB,
      { start: r.parsedCheckInDate, end: r.parsedCheckOutDate },
      { inclusive: false }
    );
  });

  return !conflictB;
}

/**
 * 내부: 지정한 객실이 지정 기간 동안 다른 예약과 겹치는지 검사합니다.
 */
export function isRoomAvailableForPeriod(
  roomNumber,
  roomTypeKey,
  checkInDateTime,
  checkOutDateTime,
  reservations,
  excludeReservationId = null
) {
  const newInterval = { start: checkInDateTime, end: checkOutDateTime };

  const conflictingReservations = reservations.filter((r) => {
    if (excludeReservationId && r._id === excludeReservationId) return false;
    if (r.isCancelled) return false;
    if (!r.roomNumber || !r.roomInfo) return false;
    if (r.roomInfo.toLowerCase() !== roomTypeKey) return false;
    if (r.roomNumber !== String(roomNumber)) return false;
    return areIntervalsOverlapping(
      newInterval,
      { start: r.parsedCheckInDate, end: r.parsedCheckOutDate },
      { inclusive: false }
    );
  });

  const conflictDays = [];
  if (conflictingReservations.length > 0) {
    let d = startOfDay(checkInDateTime);
    const end = startOfDay(checkOutDateTime);
    while (d < end) {
      const currentDay = d; // 현재 값을 캡처
      const dayStr = format(currentDay, 'yyyy-MM-dd');
      const conflict = conflictingReservations.some(
        (r) =>
          currentDay >= startOfDay(r.parsedCheckInDate) &&
          currentDay < startOfDay(r.parsedCheckOutDate)
      );
      if (conflict) {
        conflictDays.push(dayStr);
      }
      d = addDays(d, 1);
    }
  }

  return { canMove: conflictingReservations.length === 0, conflictDays };
}

/**
 * 새로운 함수: 동일 컨테이너(같은 roomNumber, roomType) 내에서
 * 예약들이 수직(날짜별)로 중첩되어 있는지 검사합니다.
 *
 * 예: 오늘 빈 객실인데, 내일 이미 예약이 있다면 같은 컨테이너에 두 예약이 존재하게 됩니다.
 */
export function checkContainerOverlap(
  roomNumber,
  roomTypeKey,
  checkInDateTime,
  checkOutDateTime,
  reservations
) {
  const conflictDays = [];
  let d = startOfDay(checkInDateTime);
  const end = startOfDay(checkOutDateTime);
  while (d < end) {
    const currentD = d; // 현재 값을 캡처
    const dayStr = format(currentD, 'yyyy-MM-dd');
    // 해당 날짜에 이 컨테이너(객실)에 배정된 예약 수를 계산합니다.
    const count = reservations.filter((r) => {
      if (r.isCancelled) return false;
      if (!r.roomNumber || !r.roomInfo) return false;
      if (r.roomInfo.toLowerCase() !== roomTypeKey) return false;
      if (r.roomNumber !== String(roomNumber)) return false;
      return (
        currentD >= startOfDay(r.parsedCheckInDate) &&
        currentD < startOfDay(r.parsedCheckOutDate)
      );
    }).length;
    if (count > 1) {
      conflictDays.push(dayStr);
    }
    d = addDays(d, 1);
  }
  return { canMove: conflictDays.length === 0, conflictDays };
}
/**
 * 빈 객실 이동(드래그 또는 스왑) 시, 대상 객실의 사용 가능 여부를 점검합니다.
 * 여기서는 기존의 isRoomAvailableForPeriod와 함께,
 * 추가로 checkContainerOverlap를 실행하여 수직(날짜별) 중첩이 없는지 확인합니다.
 *
 * @returns {Object} { canMove: boolean, conflictDays: Array<string> }
 */
export function canMoveToRoom(
  roomNumber,
  roomTypeKey,
  checkInDateTime,
  checkOutDateTime,
  availabilityByDate, // 메시지용 (현재는 사용하지 않음)
  reservations,
  excludeReservationId = null
) {
  const result1 = isRoomAvailableForPeriod(
    roomNumber,
    roomTypeKey,
    checkInDateTime,
    checkOutDateTime,
    reservations,
    excludeReservationId
  );
  const result2 = checkContainerOverlap(
    roomNumber,
    roomTypeKey,
    checkInDateTime,
    checkOutDateTime,
    reservations
  );
  return {
    canMove: result1.canMove && result2.canMove,
    conflictDays: [...result1.conflictDays, ...result2.conflictDays],
  };
}
