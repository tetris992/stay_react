// utils/checkConflict.js (클라이언트)
import { startOfDay, areIntervalsOverlapping } from 'date-fns';

export const checkConflict = (draggedReservation, targetRoomNumber, fullReservations) => {
  const draggedCheckIn = new Date(draggedReservation.checkIn);
  const draggedCheckOut = new Date(draggedReservation.checkOut);
  const isDayUseDragged = draggedReservation.type === 'dayUse';
  const currentDate = startOfDay(new Date());

  // 날짜 유효성 검사
  if (isNaN(draggedCheckIn.getTime()) || isNaN(draggedCheckOut.getTime())) {
    console.warn('Invalid dragged reservation dates:', draggedReservation);
    return { isConflict: true, conflictReservation: draggedReservation };
  }

  // 과거 체크인 예약은 이동 불가
  if (startOfDay(draggedCheckIn) < currentDate) {
    console.log(
      `[checkConflict] 예약 ${draggedReservation._id}는 과거 체크인 예약으로 이동할 수 없습니다.`
    );
    return { isConflict: true, conflictReservation: draggedReservation };
  }

  // 드래그된 예약의 점유 간격 설정
  const draggedInterval = {
    start: draggedCheckIn,
    end: isDayUseDragged ? draggedCheckOut : startOfDay(draggedCheckOut),
  };

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
      console.warn('Invalid dates in reservation:', reservation);
      continue;
    }

    const isDayUseRes = reservation.type === 'dayUse';
    const resInterval = {
      start: resCheckIn,
      end: isDayUseRes ? resCheckOut : startOfDay(resCheckOut),
    };

    // 전체 기간 동안 충돌 여부 검사
    if (areIntervalsOverlapping(draggedInterval, resInterval, { inclusive: false })) {
      console.log(
        `[checkConflict] 충돌 발생: 예약 ${draggedReservation._id}와 ${reservation._id}`
      );
      return { isConflict: true, conflictReservation: reservation };
    }
  }

  return { isConflict: false };
};