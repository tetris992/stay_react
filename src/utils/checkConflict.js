import { startOfDay, areIntervalsOverlapping } from 'date-fns';

export const checkConflict = (
  draggedReservation,
  targetRoomNumber,
  fullReservations
) => {
  const draggedCheckIn = new Date(draggedReservation.checkIn);
  const draggedCheckOut = new Date(draggedReservation.checkOut);
  const isDayUseDragged = draggedReservation.type === 'dayUse';
  const currentDate = startOfDay(new Date());

  // 과거 체크인 예약은 이동 불가
  if (startOfDay(draggedCheckIn) < currentDate) {
    console.log(
      `[checkConflict] 예약 ${draggedReservation._id}는 과거 체크인 예약으로 이동할 수 없습니다.`
    );
    return { isConflict: true, conflictReservation: draggedReservation };
  }

  const draggedInterval = {
    start: draggedCheckIn,
    end: isDayUseDragged
      ? new Date(draggedCheckIn)
      : startOfDay(draggedCheckOut),
  };

  for (const reservation of fullReservations) {
    if (
      reservation.roomNumber !== targetRoomNumber ||
      reservation._id === draggedReservation._id ||
      reservation.isCancelled
    ) {
      continue;
    }

    const resCheckIn = new Date(reservation.checkIn);
    const resCheckOut = new Date(reservation.checkOut);
    const isDayUseRes = reservation.type === 'dayUse';
    const resInterval = {
      start: resCheckIn,
      end: isDayUseRes ? new Date(resCheckIn) : startOfDay(resCheckOut),
    };

    if (isDayUseDragged && isDayUseRes) {
      if (
        areIntervalsOverlapping(draggedInterval, resInterval, {
          inclusive: false,
        })
      ) {
        return { isConflict: true, conflictReservation: reservation };
      }
    } else {
      // 날짜 단위로 비교
      const draggedCI = startOfDay(draggedCheckIn);
      const draggedCO = startOfDay(draggedCheckOut);
      const resCI = startOfDay(resCheckIn);
      const resCO = startOfDay(resCheckOut);
      if (draggedCI < resCO && draggedCO > resCI) {
        console.log(
          `[checkConflict] 충돌 발생: 예약 ${draggedReservation._id}와 ${reservation._id}`
        );
        return { isConflict: true, conflictReservation: reservation };
      }
    }
  }
  return { isConflict: false };
};
