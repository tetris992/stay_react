import { startOfDay, areIntervalsOverlapping, format } from 'date-fns';

export const checkConflict = (draggedReservation, targetRoomNumber, fullReservations) => {
  const draggedCheckIn = new Date(draggedReservation.checkIn);
  const draggedCheckOut = new Date(draggedReservation.checkOut);
  const isDayUseDragged = draggedReservation.type === 'dayUse';
  const currentDate = startOfDay(new Date());

  // 드래그된 예약의 체크인 날짜가 현재 날짜보다 과거이면 충돌로 간주
  if (startOfDay(draggedCheckIn) < currentDate) {
    console.log(
      `[checkConflict] Cannot drag reservation ${draggedReservation._id}: Past check-in detected (Check-in: ${format(
        draggedCheckIn,
        'yyyy-MM-dd'
      )}, Current Date: ${format(currentDate, 'yyyy-MM-dd')})`
    );
    return { isConflict: true, conflictReservation: draggedReservation };
  }

  for (const reservation of fullReservations) {
    if (
      reservation.roomNumber !== targetRoomNumber ||
      reservation._id === draggedReservation._id ||
      reservation.isCancelled
    )
      continue;

    const resCheckIn = new Date(reservation.checkIn);
    const resCheckOut = new Date(reservation.checkOut);
    const isDayUseRes = reservation.type === 'dayUse';

    if (isDayUseDragged && isDayUseRes) {
      const draggedInterval = { start: draggedCheckIn, end: draggedCheckOut };
      const resInterval = { start: resCheckIn, end: resCheckOut };
      if (
        areIntervalsOverlapping(draggedInterval, resInterval, { inclusive: false })
      ) {
        return { isConflict: true, conflictReservation: reservation };
      }
    } else {
      const draggedCheckInDate = startOfDay(draggedCheckIn);
      const draggedCheckOutDate = startOfDay(draggedCheckOut);
      const resCheckInDate = startOfDay(resCheckIn);
      const resCheckOutDate = startOfDay(resCheckOut);

      if (
        draggedCheckInDate < resCheckOutDate &&
        draggedCheckOutDate > resCheckInDate
      ) {
        console.log(
          `[checkConflict] Conflict detected between ${draggedReservation._id} and ${reservation._id} (Target Room: ${targetRoomNumber})`
        );
        return { isConflict: true, conflictReservation: reservation };
      }
    }
  }

  return { isConflict: false };
};