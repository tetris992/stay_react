// frontend/utils/checkConflict.js



import {
  startOfDay,
  areIntervalsOverlapping,
  differenceInCalendarDays,
  format,
} from 'date-fns';
import logger from '../utils/logger.js';

export const checkConflict = (
  draggedReservation,
  targetRoomNumber,
  fullReservations,
  selectedDate
) => {
  const draggedCheckIn = new Date(draggedReservation.checkIn);
  const draggedCheckOut = new Date(draggedReservation.checkOut);
  const isDayUseDragged = draggedReservation.type === 'dayUse';
  const currentDate = startOfDay(new Date());
  const selectedDateStart = startOfDay(selectedDate);

  // 미배정 예약 여부
  const isUnassigned = !draggedReservation.roomNumber || draggedReservation.roomNumber.trim() === '';

  // 날짜 유효성 검사
  if (isNaN(draggedCheckIn.getTime()) || isNaN(draggedCheckOut.getTime())) {
    console.warn('Invalid dragged reservation dates:', draggedReservation);
    return { isConflict: true, conflictReservation: draggedReservation };
  }

  // 배정된 예약에만 과거 체크인 및 연박 제한 적용
  if (!isUnassigned) {
    // 대원칙 2: 연박 예약의 경우 첫날만 이동 가능
    const checkInDay = startOfDay(draggedCheckIn);
    const checkOutDay = startOfDay(draggedCheckOut);
    const isMultiNight = differenceInCalendarDays(checkOutDay, checkInDay) > 1;
    if (isMultiNight && selectedDateStart > checkInDay) {
      logger.info(
        `[checkConflict] 예약 ${draggedReservation._id}는 연박 예약이며, 첫날(${format(
          checkInDay,
          'yyyy-MM-dd'
        )})만 이동 가능합니다. 현재 선택된 날짜: ${format(
          selectedDateStart,
          'yyyy-MM-dd'
        )}`
      );
      return { isConflict: true, conflictReservation: draggedReservation };
    }

    // 과거 체크인 예약은 이동 불가
    if (checkInDay < currentDate) {
      logger.info(
        `[checkConflict] 예약 ${draggedReservation._id}는 과거 체크인 예약으로 이동할 수 없습니다.`
      );
      return { isConflict: true, conflictReservation: draggedReservation };
    }
  }

  // 드래그된 예약의 점유 간격 설정
  const draggedInterval = {
    start: draggedCheckIn,
    end: isDayUseDragged ? draggedCheckOut : startOfDay(draggedCheckOut),
  };

  // 오버랩 충돌 검사 (미배정 예약 포함, 항상 실행)
  for (const reservation of fullReservations) {
    if (
      reservation.roomNumber !== targetRoomNumber ||
      reservation._id === draggedReservation._id ||
      reservation.isCancelled ||
      reservation.manuallyCheckedOut
    ) {
      continue;
    }

    const resCheckIn = new Date(reservation.checkIn);
    const resCheckOut = new Date(reservation.checkOut);
    if (isNaN(resCheckIn.getTime()) || isNaN(resCheckOut.getTime())) {
      logger.warn('Invalid dates in reservation:', reservation);
      continue;
    }

    const isDayUseRes = reservation.type === 'dayUse';
    const resInterval = {
      start: resCheckIn,
      end: isDayUseRes ? resCheckOut : startOfDay(resCheckOut),
    };

    if (
      areIntervalsOverlapping(draggedInterval, resInterval, {
        inclusive: false,
      })
    ) {
      logger.info(
        `[checkConflict] 충돌 발생: 예약 ${draggedReservation._id}와 ${reservation._id}`
      );
      return { isConflict: true, conflictReservation: reservation };
    }
  }

  return { isConflict: false };
};