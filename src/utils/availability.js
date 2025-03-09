import {
  format,
  startOfDay,
  addDays,
  differenceInCalendarDays,
  areIntervalsOverlapping,
} from 'date-fns';

export function calculateRoomAvailability(
  reservations,
  roomTypes,
  fromDate,
  toDate,
  gridSettings = null
) {
  // 입력 날짜 유효성 검사
  if (!fromDate || !toDate || isNaN(new Date(fromDate)) || isNaN(new Date(toDate))) {
    console.error('Invalid fromDate or toDate:', { fromDate, toDate });
    return {};
  }

  const currentDate = format(new Date(), 'yyyy-MM-dd'); // 현재 날짜
  const viewingDate = format(fromDate, 'yyyy-MM-dd'); // 보고 있는 날짜

  // 1. 객실 타입별 정보 구성
  const roomDataByType = {};
  roomTypes.forEach((rt) => {
    const tKey = rt.roomInfo.toLowerCase();
    let rooms = rt.roomNumbers || [];
    if ((!rooms || rooms.length === 0) && gridSettings?.floors) {
      rooms = gridSettings.floors
        .flatMap((floor) => floor.containers || [])
        .filter((cell) => {
          const cellTypeKey = (cell.roomInfo || 'standard').toLowerCase();
          return (
            cellTypeKey === tKey &&
            cell.roomNumber &&
            cell.roomNumber.trim() !== ''
          );
        })
        .map((cell) => cell.roomNumber)
        .sort();
    }
    roomDataByType[tKey] = { stock: rt.stock || 0, rooms };
  });
  console.log('[calculateRoomAvailability] roomDataByType:', roomDataByType);

  // 2. 기준 날짜 목록 생성
  const start = startOfDay(fromDate);
  const end = startOfDay(toDate);
  const numDays = differenceInCalendarDays(end, start) + 1; // +1로 마지막 날 포함
  const dateList = [];
  for (let i = 0; i < numDays; i++) {
    dateList.push(format(addDays(start, i), 'yyyy-MM-dd'));
  }
  console.log('[calculateRoomAvailability] dateList:', dateList);

  // 3. 날짜별 사용량 초기화
  const usageByDate = {};
  dateList.forEach((ds) => {
    usageByDate[ds] = {};
    Object.keys(roomDataByType).forEach((typeKey) => {
      usageByDate[ds][typeKey] = { count: 0, assignedRooms: new Set() };
    });
    usageByDate[ds]['unassigned'] = { count: 0, assignedRooms: new Set() };
  });

  // 4. 예약별 사용량 계산
  reservations.forEach((res) => {
    const ci = res.parsedCheckInDate
      ? new Date(res.parsedCheckInDate)
      : (res.checkIn ? new Date(res.checkIn) : null);
    const co = res.parsedCheckOutDate
      ? new Date(res.parsedCheckOutDate)
      : (res.checkOut ? new Date(res.checkOut) : null);
    
    // 날짜 유효성 검사
    if (!ci || !co || isNaN(ci) || isNaN(co)) {
      console.warn('[calculateRoomAvailability] Invalid reservation dates:', res);
      return;
    }

    let typeKey = res.roomInfo ? res.roomInfo.toLowerCase() : 'standard';
    if (!res.roomNumber || !res.roomNumber.trim()) {
      typeKey = 'unassigned';
    }

    const isDayUse = res.type === 'dayUse';
    const resInterval = { start: ci, end: co };

    dateList.forEach((ds) => {
      const dayStart = startOfDay(new Date(ds));
      const dayEnd = addDays(dayStart, 1);

      if (usageByDate[ds] && usageByDate[ds][typeKey]) {
        if (isDayUse) {
          // 대실 예약: 같은 날인 경우에만 시간 범위 충돌 확인
          const isSameDay = format(ci, 'yyyy-MM-dd') === ds;
          if (isSameDay) {
            const overlapping = reservations.some((otherRes) => {
              if (otherRes._id === res._id || otherRes.isCancelled) return false;
              if (otherRes.roomNumber !== res.roomNumber) return false;
              if (otherRes.type !== 'dayUse') return false;
              const otherCi = otherRes.parsedCheckInDate
                ? new Date(otherRes.parsedCheckInDate)
                : (otherRes.checkIn ? new Date(otherRes.checkIn) : null);
              const otherCo = otherRes.parsedCheckOutDate
                ? new Date(otherRes.parsedCheckOutDate)
                : (otherRes.checkOut ? new Date(otherRes.checkOut) : null);
              if (!otherCi || !otherCo || isNaN(otherCi) || isNaN(otherCo)) return false;
              const otherInterval = { start: otherCi, end: otherCo };
              return areIntervalsOverlapping(resInterval, otherInterval, {
                inclusive: false,
              });
            });

            if (!overlapping) {
              usageByDate[ds][typeKey].count++;
              if (res.roomNumber) {
                usageByDate[ds][typeKey].assignedRooms.add(res.roomNumber);
              }
            }
          }
        } else {
          // 숙박 예약: 체크아웃 날짜는 점유에서 제외하는 조건 추가
          // 호텔의 새로운 날짜 시작 시간: 새벽 2시 (02:00)
          const coDay = format(co, 'yyyy-MM-dd');
          const coTime = format(co, 'HH:mm');
          if (
            ci < dayEnd &&
            co > dayStart &&
            !(ds === coDay && coTime >= '02:00')
          ) {
            usageByDate[ds][typeKey].count++;
            if (res.roomNumber) {
              usageByDate[ds][typeKey].assignedRooms.add(res.roomNumber);
            }
          }
        }
      }
    });
  });

  // 5. 잔여 재고 계산 및 콘솔 출력
  const availability = {};
  dateList.forEach((ds) => {
    availability[ds] = {};
    const isCurrent = ds === currentDate;
    const isViewing = ds === viewingDate;
    console.log(
      `=== [calculateRoomAvailability] 날짜: ${ds} ${isCurrent ? '(현재)' : ''} ${isViewing ? '(보고 있음)' : ''} ===`
    );
    Object.entries(usageByDate[ds]).forEach(([typeKey, usage]) => {
      if (typeKey === 'unassigned') {
        availability[ds][typeKey] = usage.count;
        console.log(`  - ${typeKey}: 사용량=${usage.count}`);
      } else {
        const allRooms = roomDataByType[typeKey]?.rooms || [];
        const assigned = Array.from(usage.assignedRooms);
        const totalStock = roomDataByType[typeKey]?.stock || allRooms.length;
        const leftoverRooms = allRooms.filter((rnum) => !assigned.includes(rnum));
        const remain = Math.max(totalStock - usage.count, 0);
        availability[ds][typeKey] = { remain, leftoverRooms };

        console.log(`  - 객실 타입: ${typeKey}
    총 재고: ${totalStock} (객실: ${allRooms.join(', ') || '없음'})
    사용 중: ${usage.count} (객실: ${assigned.join(', ') || '없음'})
    남은 객실: ${remain} (객실: ${leftoverRooms.join(', ') || '없음'})`);
      }
    });
  });

  return availability;
}
// 나머지 함수는 변경 없음
export function getDetailedAvailabilityMessage(
  rangeStart,
  rangeEnd,
  roomTypeKey,
  availabilityByDate
) {
  let msg =
    '예약이 불가능합니다.\n선택한 날짜 범위에서 날짜별 사용 가능한 객실번호는 다음과 같습니다:\n';
  let cursor = startOfDay(rangeStart);
  while (cursor < startOfDay(rangeEnd)) {
    const ds = format(cursor, 'yyyy-MM-dd');
    const freeRooms =
      availabilityByDate[ds]?.[roomTypeKey.toLowerCase()]?.leftoverRooms || [];
    msg += `${ds}: ${freeRooms.length > 0 ? freeRooms.join(', ') : '없음'}\n`;
    cursor = addDays(cursor, 1);
  }
  msg += '\n(이미 배정된 예약을 다른 객실로 옮긴 후 재시도해주세요.)';
  return msg;
}

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

  const isDayUseA = reservationA.type === 'dayUse';
  const isDayUseB = reservationB.type === 'dayUse';

  const conflictA = reservations.some((r) => {
    if (r._id === reservationA._id || r._id === reservationB._id) return false;
    if (r.isCancelled) return false;
    if (!r.roomNumber || !r.roomInfo) return false;
    if (r.roomInfo.toLowerCase() !== roomTypeA) return false;
    if (r.roomNumber !== proposedRoomForA) return false;

    const resInterval = {
      start: new Date(r.parsedCheckInDate),
      end: new Date(r.parsedCheckOutDate),
    };
    const isDayUseR = r.type === 'dayUse';

    if (isDayUseA && isDayUseR) {
      return areIntervalsOverlapping(intervalA, resInterval, { inclusive: false });
    } else if (isDayUseA || isDayUseR) {
      const aStartDate = startOfDay(intervalA.start);
      const aEndDate = startOfDay(intervalA.end);
      const rStartDate = startOfDay(resInterval.start);
      const rEndDate = startOfDay(resInterval.end);
      return aStartDate < rEndDate && aEndDate > rStartDate;
    } else {
      return areIntervalsOverlapping(intervalA, resInterval, { inclusive: false });
    }
  });

  if (conflictA) return false;

  const conflictB = reservations.some((r) => {
    if (r._id === reservationA._id || r._id === reservationB._id) return false;
    if (r.isCancelled) return false;
    if (!r.roomNumber || !r.roomInfo) return false;
    if (r.roomInfo.toLowerCase() !== roomTypeB) return false;
    if (r.roomNumber !== proposedRoomForB) return false;

    const resInterval = {
      start: new Date(r.parsedCheckInDate),
      end: new Date(r.parsedCheckOutDate),
    };
    const isDayUseR = r.type === 'dayUse';

    if (isDayUseB && isDayUseR) {
      return areIntervalsOverlapping(intervalB, resInterval, { inclusive: false });
    } else if (isDayUseB || isDayUseR) {
      const bStartDate = startOfDay(intervalB.start);
      const bEndDate = startOfDay(intervalB.end);
      const rStartDate = startOfDay(resInterval.start);
      const rEndDate = startOfDay(resInterval.end);
      return bStartDate < rEndDate && bEndDate > rStartDate;
    } else {
      return areIntervalsOverlapping(intervalB, resInterval, { inclusive: false });
    }
  });

  return !conflictB;
}

export function isRoomAvailableForPeriod(
  roomNumber,
  roomTypeKey,
  checkInDateTime,
  checkOutDateTime,
  reservations,
  excludeReservationId = null
) {
  const isDayUse = reservations.some(
    (r) =>
      r._id === excludeReservationId &&
      r.type === 'dayUse' &&
      r.roomNumber === roomNumber &&
      r.roomInfo.toLowerCase() === roomTypeKey
  );

  const newInterval = {
    start: new Date(checkInDateTime),
    end: new Date(checkOutDateTime),
  };

  const conflictingReservations = reservations.filter((r) => {
    if (excludeReservationId && r._id === excludeReservationId) return false;
    if (r.isCancelled) return false;
    if (!r.roomNumber || !r.roomInfo) return false;
    if (r.roomInfo.toLowerCase() !== roomTypeKey) return false;
    if (r.roomNumber !== String(roomNumber)) return false;

    const reservationInterval = {
      start: new Date(r.parsedCheckInDate),
      end: new Date(r.parsedCheckOutDate),
    };
    const isDayUseR = r.type === 'dayUse';

    if (isDayUse && isDayUseR) {
      return areIntervalsOverlapping(newInterval, reservationInterval, {
        inclusive: false,
      });
    } else if (isDayUse || isDayUseR) {
      const newStartDate = startOfDay(newInterval.start);
      const newEndDate = startOfDay(newInterval.end);
      const resStartDate = startOfDay(reservationInterval.start);
      const resEndDate = startOfDay(reservationInterval.end);
      return newStartDate < resEndDate && newEndDate > resStartDate;
    } else {
      return areIntervalsOverlapping(newInterval, reservationInterval, {
        inclusive: false,
      });
    }
  });

  const conflictDays = [];
  if (conflictingReservations.length > 0) {
    let d = startOfDay(newInterval.start);
    const end = startOfDay(newInterval.end);
    while (d < end) {
      const currentDay = d;
      const dayStr = format(currentDay, 'yyyy-MM-dd');
      const conflict = conflictingReservations.some((r) => {
        const intervalStart = new Date(r.parsedCheckInDate);
        const intervalEnd = new Date(r.parsedCheckOutDate);
        if (isDayUse && r.type === 'dayUse') {
          return areIntervalsOverlapping(
            { start: currentDay, end: addDays(currentDay, 1) },
            { start: intervalStart, end: intervalEnd },
            { inclusive: false }
          );
        } else if (isDayUse || r.type === 'dayUse') {
          const resStartDate = startOfDay(intervalStart);
          const resEndDate = startOfDay(intervalEnd);
          return currentDay < resEndDate && addDays(currentDay, 1) > resStartDate;
        } else {
          return areIntervalsOverlapping(
            { start: currentDay, end: addDays(currentDay, 1) },
            { start: intervalStart, end: intervalEnd },
            { inclusive: false }
          );
        }
      });
      if (conflict) {
        conflictDays.push(dayStr);
      }
      d = addDays(d, 1);
    }
  }

  return { canMove: conflictDays.length === 0, conflictDays };
}

export function checkContainerOverlap(
  roomNumber,
  roomTypeKey,
  checkInDateTime,
  checkOutDateTime,
  reservations
) {
  const isDayUse = reservations.some(
    (r) =>
      r.type === 'dayUse' &&
      r.roomNumber === roomNumber &&
      r.roomInfo.toLowerCase() === roomTypeKey
  );

  const newInterval = {
    start: new Date(checkInDateTime),
    end: new Date(checkOutDateTime),
  };

  const conflictDays = [];
  let d = startOfDay(newInterval.start);
  const end = startOfDay(newInterval.end);
  while (d < end) {
    const currentD = d;
    const dayStr = format(currentD, 'yyyy-MM-dd');
    const conflictingReservations = reservations.filter((r) => {
      if (r.isCancelled) return false;
      if (!r.roomNumber || !r.roomInfo) return false;
      if (r.roomInfo.toLowerCase() !== roomTypeKey) return false;
      if (r.roomNumber !== String(roomNumber)) return false;

      const intervalStart = new Date(r.parsedCheckInDate);
      const intervalEnd = new Date(r.parsedCheckOutDate);

      if (isDayUse && r.type === 'dayUse') {
        return areIntervalsOverlapping(
          { start: currentD, end: addDays(currentD, 1) },
          { start: intervalStart, end: intervalEnd },
          { inclusive: false }
        );
      } else if (isDayUse || r.type === 'dayUse') {
        const resStartDate = startOfDay(intervalStart);
        const resEndDate = startOfDay(intervalEnd);
        return currentD < resEndDate && addDays(currentD, 1) > resStartDate;
      } else {
        return areIntervalsOverlapping(
          { start: currentD, end: addDays(currentD, 1) },
          { start: intervalStart, end: intervalEnd },
          { inclusive: false }
        );
      }
    });

    if (conflictingReservations.length > 1) {
      conflictDays.push(dayStr);
    }
    d = addDays(d, 1);
  }
  return { canMove: conflictDays.length === 0, conflictDays };
}

export function canMoveToRoom(
  roomNumber,
  roomTypeKey,
  checkInDateTime,
  checkOutDateTime,
  availabilityByDate,
  reservations,
  excludeReservationId = null
) {
  if (!availabilityByDate || typeof availabilityByDate !== 'object') {
    console.warn('availabilityByDate is not provided or invalid, using fallback logic');
    availabilityByDate = {};
  }

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