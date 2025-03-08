import { startOfDay, areIntervalsOverlapping } from 'date-fns';

export const checkConflict = (draggedReservation, targetRoomNumber, fullReservations) => {
  const draggedCheckIn = new Date(draggedReservation.checkIn);
  const draggedCheckOut = new Date(draggedReservation.checkOut);
  const isDayUseDragged = draggedReservation.type === 'dayUse';

  for (const reservation of fullReservations) {
    if (
      reservation.roomNumber !== targetRoomNumber ||
      reservation._id === draggedReservation._id ||
      reservation.isCancelled
    ) continue;

    const resCheckIn = new Date(reservation.checkIn);
    const resCheckOut = new Date(reservation.checkOut);
    const isDayUseRes = reservation.type === 'dayUse';

    if (isDayUseDragged && isDayUseRes) {
      // 대실 예약 간의 충돌: 시간 단위로 확인
      const draggedInterval = { start: draggedCheckIn, end: draggedCheckOut };
      const resInterval = { start: resCheckIn, end: resCheckOut };
      if (
        areIntervalsOverlapping(draggedInterval, resInterval, { inclusive: false })
      ) {
        return { isConflict: true, conflictReservation: reservation };
      }
    } else if (isDayUseDragged || isDayUseRes) {
      // 대실 예약과 숙박 예약 간의 충돌: 날짜 단위로만 확인
      const draggedCheckInDate = startOfDay(draggedCheckIn);
      const draggedCheckOutDate = startOfDay(draggedCheckOut);
      const resCheckInDate = startOfDay(resCheckIn);
      const resCheckOutDate = startOfDay(resCheckOut);
      if (
        draggedCheckInDate < resCheckOutDate &&
        draggedCheckOutDate > resCheckInDate
      ) {
        return { isConflict: true, conflictReservation: reservation };
      }
    } else {
      // 숙박 예약 간의 충돌: 시간 단위로 확인
      if (
        draggedCheckIn < resCheckOut &&
        draggedCheckOut > resCheckIn &&
        draggedCheckIn.getTime() !== resCheckOut.getTime()
      ) {
        return { isConflict: true, conflictReservation: reservation };
      }
    }
  }

  return { isConflict: false };
};