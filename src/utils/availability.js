//frontend availability.js

import {
  format,
  startOfDay,
  addDays,
  differenceInCalendarDays,
  addMonths,
  areIntervalsOverlapping,
} from 'date-fns';

export function calculateRoomAvailability(
  reservations,
  roomTypes,
  fromDate,
  toDate,
  gridSettings = null
) {
  if (!fromDate || isNaN(new Date(fromDate))) {
    console.error('Invalid fromDate:', { fromDate });
    return {};
  }

  const calcFromDate = startOfDay(new Date(fromDate));
  const calcToDate = startOfDay(addMonths(calcFromDate, 3)); // 변경: addMonths(calcFromDate, 1) → addMonths(calcFromDate, 3)
  const numDays = differenceInCalendarDays(calcToDate, calcFromDate) + 1;
  const dateList = [];
  for (let i = 0; i < numDays; i++) {
    dateList.push(format(addDays(calcFromDate, i), 'yyyy-MM-dd'));
  }

  // 객실 타입별 정보 구성: gridSettings 기준으로 객실 수 계산
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
            cell.roomNumber.trim() !== '' &&
            cell.isActive // isActive가 true인 객실만 포함
          );
        })
        .map((cell) => cell.roomNumber)
        .sort();
    }
    // stock은 gridSettings에서 계산된 객실 수를 사용
    const stock = rooms.length; // roomTypes.stock 대신 gridSettings에서 계산된 객실 수 사용
    roomDataByType[tKey] = { stock, rooms };
    console.info(
      `[calculateRoomAvailability] ${tKey}: stock=${stock}, rooms=${rooms}`
    );
  });

  // 날짜별 사용량 초기화
  const usageByDate = {};
  dateList.forEach((ds) => {
    usageByDate[ds] = {};
    Object.keys(roomDataByType).forEach((typeKey) => {
      usageByDate[ds][typeKey] = {
        count: 0, // 점유된 객실 수
        assignedRooms: new Set(), // 점유된 객실 번호
        checkedOutRooms: new Set(), // 퇴실 처리된 객실 번호
        reservations: [], // 점유된 예약 정보
        checkedOutReservations: [], // 퇴실 처리된 예약 정보
      };
    });
    usageByDate[ds]['unassigned'] = {
      count: 0,
      checkedOutCount: 0,
      reservations: [],
      checkedOutReservations: [],
    };
  });

  // 각 예약별 점유 계산
  reservations.forEach((res) => {
    // 📌 과거 체크아웃 예약은 아예 점유 계산에서 제외
    const today = startOfDay(new Date());
    const checkoutDay = startOfDay(new Date(res.checkOut));
    if (checkoutDay < today) {
      console.info(`[calculateRoomAvailability] 과거 예약 건너뜀:`, res._id);
      return;
    }

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
    const isCheckedOut = res.manuallyCheckedOut || false;
    const occupancyEnd = isDayUse ? startOfDay(ci) : startOfDay(co);

    dateList.forEach((ds) => {
      const dayStart = startOfDay(new Date(ds));
      const dayEnd = addDays(dayStart, 1);

      if (usageByDate[ds] && usageByDate[ds][typeKey]) {
        if (typeKey === 'unassigned') {
          if (isDayUse) {
            const isSameDay = format(ci, 'yyyy-MM-dd') === ds;
            if (isSameDay) {
              if (isCheckedOut) {
                usageByDate[ds][typeKey].checkedOutCount++;
                usageByDate[ds][typeKey].checkedOutReservations.push({
                  ...res, // 모든 필드 포함
                });
              } else {
                usageByDate[ds][typeKey].count++;
                usageByDate[ds][typeKey].reservations.push({
                  ...res, // 모든 필드 포함
                });
              }
            }
          } else {
            if (ci < dayEnd && occupancyEnd > dayStart) {
              if (isCheckedOut) {
                usageByDate[ds][typeKey].checkedOutCount++;
                usageByDate[ds][typeKey].checkedOutReservations.push({
                  ...res, // 모든 필드 포함
                });
              } else {
                usageByDate[ds][typeKey].count++;
                usageByDate[ds][typeKey].reservations.push({
                  ...res, // 모든 필드 포함
                });
              }
            }
          }
        } else {
          if (isDayUse) {
            const isSameDay = format(ci, 'yyyy-MM-dd') === ds;
            if (isSameDay) {
              if (isCheckedOut) {
                usageByDate[ds][typeKey].checkedOutRooms.add(res.roomNumber);
                usageByDate[ds][typeKey].checkedOutReservations.push({
                  ...res, // 모든 필드 포함
                });
              } else {
                usageByDate[ds][typeKey].count++;
                if (res.roomNumber) {
                  usageByDate[ds][typeKey].assignedRooms.add(res.roomNumber);
                }
                usageByDate[ds][typeKey].reservations.push({
                  ...res, // 모든 필드 포함
                });
              }
            }
          } else {
            if (ci < dayEnd && occupancyEnd > dayStart) {
              if (isCheckedOut) {
                usageByDate[ds][typeKey].checkedOutRooms.add(res.roomNumber);
                usageByDate[ds][typeKey].checkedOutReservations.push({
                  ...res, // 모든 필드 포함
                });
              } else {
                usageByDate[ds][typeKey].count++;
                if (res.roomNumber) {
                  usageByDate[ds][typeKey].assignedRooms.add(res.roomNumber);
                }
                usageByDate[ds][typeKey].reservations.push({
                  ...res, // 모든 필드 포함
                });
              }
            }
          }
        }
      }
    });
  });

  // 잔여 재고 계산
  const availability = {};
  dateList.forEach((ds) => {
    availability[ds] = {};
    Object.entries(usageByDate[ds]).forEach(([typeKey, usage]) => {
      if (typeKey === 'unassigned') {
        availability[ds][typeKey] = {
          count: usage.count,
          checkedOutCount: usage.checkedOutCount,
          reservations: usage.reservations,
          checkedOutReservations: usage.checkedOutReservations,
        };
      } else {
        const allRooms = roomDataByType[typeKey]?.rooms || [];
        const assigned = Array.from(usage.assignedRooms);
        const checkedOut = Array.from(usage.checkedOutRooms);
        const totalStock = roomDataByType[typeKey]?.stock || 0;
        const leftoverRooms = allRooms.filter(
          (rnum) => !assigned.includes(rnum) && !checkedOut.includes(rnum)
        );
        const remain = Math.max(totalStock - usage.count, 0);
        availability[ds][typeKey] = {
          remain,
          leftoverRooms,
          assignedRooms: assigned,
          checkedOutRooms: checkedOut,
          reservations: usage.reservations,
          checkedOutReservations: usage.checkedOutReservations,
        };
      }
    });
  });

  return availability;
}
/**
 * getDetailedAvailabilityMessage
 * 선택한 날짜 범위 내에, 각 날짜별 사용 가능한 객실 번호(잔여 객실)를 메시지로 생성합니다.
 */
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

/**
 * canSwapReservations
 * 두 예약을 서로의 객실 번호로 교환할 수 있는지 판단합니다.
 * 점유 간격은:
 * - 일반 예약: [checkIn, startOfDay(checkOut))
 * - 대실: [checkIn, checkIn]
 */
export function canSwapReservations(reservationA, reservationB, reservations) {
  const roomTypeA = reservationA.roomInfo
    ? reservationA.roomInfo.toLowerCase()
    : '';
  const roomTypeB = reservationB.roomInfo
    ? reservationB.roomInfo.toLowerCase()
    : '';

  const intervalA = {
    start: new Date(reservationA.checkIn),
    end:
      reservationA.type === 'dayUse'
        ? new Date(reservationA.checkIn)
        : startOfDay(new Date(reservationA.checkOut)),
  };
  const intervalB = {
    start: new Date(reservationB.checkIn),
    end:
      reservationB.type === 'dayUse'
        ? new Date(reservationB.checkIn)
        : startOfDay(new Date(reservationB.checkOut)),
  };

  const conflictA = reservations.some((r) => {
    if (r._id === reservationA._id || r._id === reservationB._id) return false;
    if (!r.roomNumber || !r.roomInfo) return false;
    if (r.roomInfo.toLowerCase() !== roomTypeA) return false;
    if (r.roomNumber !== reservationB.roomNumber) return false;

    const resInterval = {
      start: new Date(r.checkIn),
      end:
        r.type === 'dayUse'
          ? new Date(r.checkIn)
          : startOfDay(new Date(r.checkOut)),
    };

    return areIntervalsOverlapping(intervalA, resInterval, {
      inclusive: false,
    });
  });
  if (conflictA) return false;

  const conflictB = reservations.some((r) => {
    if (r._id === reservationA._id || r._id === reservationB._id) return false;
    if (!r.roomNumber || !r.roomInfo) return false;
    if (r.roomInfo.toLowerCase() !== roomTypeB) return false;
    if (r.roomNumber !== reservationA.roomNumber) return false;

    const resInterval = {
      start: new Date(r.checkIn),
      end:
        r.type === 'dayUse'
          ? new Date(r.checkIn)
          : startOfDay(new Date(r.checkOut)),
    };

    return areIntervalsOverlapping(intervalB, resInterval, {
      inclusive: false,
    });
  });

  return !conflictB;
}

/**
 * isRoomAvailableForPeriod
 * 지정된 객실 번호와 예약 기간에 대해 점유 충돌이 있는지 확인하고,
 * 충돌이 발생한 날짜(문자열 배열)를 반환합니다.
 * 점유 간격은:
 * - 일반 예약: [checkIn, startOfDay(checkOut))
 * - 대실: [checkIn, checkIn]
 */
export function isRoomAvailableForPeriod(
  roomNumber,
  roomTypeKey,
  checkInDateTime,
  checkOutDateTime,
  reservations,
  excludeReservationId = null
) {
  const newInterval = {
    start: new Date(checkInDateTime),
    end: (() => {
      const candidate = reservations.find(
        (r) => r._id === excludeReservationId
      );
      if (candidate && candidate.type === 'dayUse') {
        return new Date(checkInDateTime);
      }
      return startOfDay(new Date(checkOutDateTime));
    })(),
  };

  const conflictingReservations = reservations.filter((r) => {
    if (excludeReservationId && r._id === excludeReservationId) return false;
    if (!r.roomNumber || !r.roomInfo) return false;
    if (r.roomInfo.toLowerCase() !== roomTypeKey) return false;
    if (r.roomNumber !== String(roomNumber)) return false;

    const resInterval = {
      start: new Date(r.checkIn),
      end:
        r.type === 'dayUse'
          ? new Date(r.checkIn)
          : startOfDay(new Date(r.checkOut)),
    };

    return areIntervalsOverlapping(newInterval, resInterval, {
      inclusive: false,
    });
  });

  const conflictDays = [];
  if (conflictingReservations.length > 0) {
    let d = startOfDay(newInterval.start);
    const end = startOfDay(newInterval.end);
    while (d < end) {
      // 안전하게 현재 날짜를 캡처
      const currentDay = d;
      const dayStr = format(currentDay, 'yyyy-MM-dd');
      const conflict = conflictingReservations.some((r) => {
        const intervalStart = new Date(r.checkIn);
        const intervalEnd =
          r.type === 'dayUse'
            ? new Date(r.checkIn)
            : startOfDay(new Date(r.checkOut));
        return (
          currentDay < intervalEnd && addDays(currentDay, 1) > intervalStart
        );
      });
      if (conflict) conflictDays.push(dayStr);
      d = addDays(d, 1);
    }
  }

  return { canMove: conflictDays.length === 0, conflictDays };
}

/**
 * checkContainerOverlap
 * 같은 컨테이너(객실) 내에서 예약 점유가 겹치는지 확인합니다.
 */
export function checkContainerOverlap(
  roomNumber,
  roomTypeKey,
  checkInDateTime,
  checkOutDateTime,
  reservations
) {
  const newInterval = {
    start: new Date(checkInDateTime),
    end: (() => {
      const candidate = reservations.find(
        (r) =>
          r.roomNumber === roomNumber &&
          r.roomInfo.toLowerCase() === roomTypeKey
      );
      if (candidate && candidate.type === 'dayUse') {
        return new Date(checkInDateTime);
      }
      return startOfDay(new Date(checkOutDateTime));
    })(),
  };

  const conflictDays = [];
  let d = startOfDay(newInterval.start);
  const end = startOfDay(newInterval.end);
  while (d < end) {
    const currentDay = d; // 안전하게 캡처
    const dayStr = format(currentDay, 'yyyy-MM-dd');
    const conflictingReservations = reservations.filter((r) => {
      if (!r.roomNumber || !r.roomInfo) return false;
      if (r.roomInfo.toLowerCase() !== roomTypeKey) return false;
      if (r.roomNumber !== String(roomNumber)) return false;

      const intervalStart = new Date(r.checkIn);
      const intervalEnd =
        r.type === 'dayUse'
          ? new Date(r.checkIn)
          : startOfDay(new Date(r.checkOut));

      return currentDay < intervalEnd && addDays(currentDay, 1) > intervalStart;
    });
    if (conflictingReservations.length > 1) {
      conflictDays.push(dayStr);
    }
    d = addDays(d, 1);
  }
  return { canMove: conflictDays.length === 0, conflictDays };
}

/**
 * canMoveToRoom
 * 특정 객실에 대해, 예약 점유 가능 여부와 컨테이너 내 점유 충돌 여부를 모두 확인하여 이동 가능 여부를 반환합니다.
 */
export function canMoveToRoom(
  roomNumber,
  roomTypeKey,
  checkInDateTime,
  checkOutDateTime,
  availabilityByDate,
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
