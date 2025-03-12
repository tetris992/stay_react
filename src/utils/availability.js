import {
  format,
  startOfDay,
  addDays,
  differenceInCalendarDays,
  areIntervalsOverlapping,
  addMonths,
} from 'date-fns';

export function calculateRoomAvailability(
  reservations,
  roomTypes,
  fromDate,
  toDate,
  gridSettings = null
) {
  // 입력 날짜 유효성 검사
  if (
    !fromDate ||
    !toDate ||
    isNaN(new Date(fromDate)) ||
    isNaN(new Date(toDate))
  ) {
    console.error('Invalid fromDate or toDate:', { fromDate, toDate });
    return {};
  }

  // 최소 한 달 치 데이터 계산 (fromDate 기준으로 한 달)
  const calcFromDate = startOfDay(new Date(fromDate));
  const calcToDate = startOfDay(addMonths(calcFromDate, 1));
  const numDays = differenceInCalendarDays(calcToDate, calcFromDate) + 1;
  const dateList = [];
  for (let i = 0; i < numDays; i++) {
    dateList.push(format(addDays(calcFromDate, i), 'yyyy-MM-dd'));
  }

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

  // 2. 날짜별 사용량 초기화
  const usageByDate = {};
  dateList.forEach((ds) => {
    usageByDate[ds] = {};
    Object.keys(roomDataByType).forEach((typeKey) => {
      usageByDate[ds][typeKey] = { count: 0, assignedRooms: new Set() };
    });
    usageByDate[ds]['unassigned'] = { count: 0, assignedRooms: new Set() };
  });

  // 3. 예약별 사용량 계산 (전체 기간 고려)
  reservations.forEach((res) => {
    const ci = new Date(res.checkIn);
    const co = new Date(res.checkOut);

    if (
      !res.checkIn ||
      !res.checkOut ||
      isNaN(ci.getTime()) ||
      isNaN(co.getTime())
    ) {
      console.warn(
        '[calculateRoomAvailability] Invalid reservation dates:',
        res
      );
      return;
    }

    let typeKey = res.roomInfo ? res.roomInfo.toLowerCase() : 'standard';
    if (!res.roomNumber || !res.roomNumber.trim()) {
      typeKey = 'unassigned';
    }

    const isDayUse = res.type === 'dayUse';
    let resInterval;
    if (isDayUse) {
      resInterval = { start: ci, end: co };
    }

    dateList.forEach((ds) => {
      const dayStart = startOfDay(new Date(ds + 'T00:00:00+09:00')); // KST 기준
      const dayEnd = addDays(dayStart, 1);

      if (usageByDate[ds] && usageByDate[ds][typeKey]) {
        if (isDayUse) {
          const isSameDay = format(ci, 'yyyy-MM-dd') === ds;
          if (isSameDay) {
            const overlapping = reservations.some((otherRes) => {
              if (otherRes._id === res._id || otherRes.isCancelled)
                return false;
              if (otherRes.roomNumber !== res.roomNumber) return false;
              if (otherRes.type !== 'dayUse') return false;
              const otherCi = new Date(otherRes.checkIn);
              const otherCo = new Date(otherRes.checkOut);
              if (isNaN(otherCi.getTime()) || isNaN(otherCo.getTime()))
                return false;
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
              console.log(
                `[Debug] DayUse ${ds} - Assigned ${res.roomNumber} to ${typeKey}`
              );
            }
          }
        } else {
          // 숙박 예약 로직 (변경 없음)
          const coDay = format(co, 'yyyy-MM-dd');
          const coTime = format(co, 'HH:mm');
          const isSameDayReservation = ds === format(ci, 'yyyy-MM-dd');

          if (
            ci <= dayEnd &&
            co >= dayStart &&
            (isSameDayReservation || !(ds === coDay && coTime >= '02:00'))
          ) {
            usageByDate[ds][typeKey].count++;
            if (res.roomNumber) {
              usageByDate[ds][typeKey].assignedRooms.add(res.roomNumber);
            }
            console.log(
              `[Debug] Stay ${ds} - Assigned ${res.roomNumber} to ${typeKey}`
            );
          }
        }
      }
    });
  });

  // 4. 잔여 재고 계산 및 콘솔 출력 (모든 날짜 출력)
  const availability = {};
  dateList.forEach((ds) => {
    availability[ds] = {};
    const isCurrent = ds === format(new Date(), 'yyyy-MM-dd');
    if (isCurrent) {
      console.log(`[calculateRoomAvailability] 날짜: ${ds} (현재) ===`);
    } else {
      console.log(`[calculateRoomAvailability] 날짜: ${ds} ===`);
    }
    Object.entries(usageByDate[ds]).forEach(([typeKey, usage]) => {
      if (typeKey === 'unassigned') {
        availability[ds][typeKey] = usage.count;
        console.log(
          `availability.js:174   - ${typeKey}: 사용량=${usage.count}`
        );
      } else {
        const allRooms = roomDataByType[typeKey]?.rooms || [];
        const assigned = Array.from(usage.assignedRooms);
        const totalStock = roomDataByType[typeKey]?.stock || allRooms.length;
        const leftoverRooms = allRooms.filter(
          (rnum) => !assigned.includes(rnum)
        );
        const remain = Math.max(totalStock - usage.count, 0);
        availability[ds][typeKey] = { remain, leftoverRooms };
        console.log(`availability.js:174   - 객실 타입: ${typeKey}
    총 재고: ${totalStock} (객실: ${allRooms.join(', ') || '없음'})
    사용 중: ${usage.count} (객실: ${assigned.join(', ') || '없음'})
    남은 객실: ${remain} (객실: ${leftoverRooms.join(', ') || '없음'})`);
      }
    });
  });

  return availability;
}

// 나머지 함수는 변경 없음 (getDetailedAvailabilityMessage, canSwapReservations, isRoomAvailableForPeriod, checkContainerOverlap, canMoveToRoom 유지)

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
    start: new Date(reservationA.checkIn),
    end: new Date(reservationA.checkOut),
  };
  const intervalB = {
    start: new Date(reservationB.checkIn),
    end: new Date(reservationB.checkOut),
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
      start: new Date(r.checkIn),
      end: new Date(r.checkOut),
    };
    const isDayUseR = r.type === 'dayUse';

    if (isDayUseA && isDayUseR) {
      return areIntervalsOverlapping(intervalA, resInterval, {
        inclusive: false,
      });
    } else if (isDayUseA || isDayUseR) {
      const aStartDate = startOfDay(intervalA.start);
      const aEndDate = startOfDay(intervalA.end);
      const rStartDate = startOfDay(resInterval.start);
      const rEndDate = startOfDay(resInterval.end);
      return aStartDate < rEndDate && aEndDate > rStartDate;
    } else {
      return areIntervalsOverlapping(intervalA, resInterval, {
        inclusive: false,
      });
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
      start: new Date(r.checkIn),
      end: new Date(r.checkOut),
    };
    const isDayUseR = r.type === 'dayUse';

    if (isDayUseB && isDayUseR) {
      return areIntervalsOverlapping(intervalB, resInterval, {
        inclusive: false,
      });
    } else if (isDayUseB || isDayUseR) {
      const bStartDate = startOfDay(intervalB.start);
      const bEndDate = startOfDay(intervalB.end);
      const rStartDate = startOfDay(resInterval.start);
      const rEndDate = startOfDay(resInterval.end);
      return bStartDate < rEndDate && bEndDate > rStartDate;
    } else {
      return areIntervalsOverlapping(intervalB, resInterval, {
        inclusive: false,
      });
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
      start: new Date(r.checkIn),
      end: new Date(r.checkOut),
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
        const intervalStart = new Date(r.checkIn);
        const intervalEnd = new Date(r.checkOut);
        if (isDayUse && r.type === 'dayUse') {
          return areIntervalsOverlapping(
            { start: currentDay, end: addDays(currentDay, 1) },
            { start: intervalStart, end: intervalEnd },
            { inclusive: false }
          );
        } else if (isDayUse || r.type === 'dayUse') {
          const resStartDate = startOfDay(intervalStart);
          const resEndDate = startOfDay(intervalEnd);
          return (
            currentDay < resEndDate && addDays(currentDay, 1) > resStartDate
          );
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

      const intervalStart = new Date(r.checkIn);
      const intervalEnd = new Date(r.checkOut);

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
    console.warn(
      'availabilityByDate is not provided or invalid, using fallback logic'
    );
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
