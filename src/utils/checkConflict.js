export const checkConflict = (draggedReservation, targetRoomNumber, fullReservations) => {
  const draggedCheckIn = new Date(draggedReservation.checkIn);
  const draggedCheckOut = new Date(draggedReservation.checkOut);

  for (const reservation of fullReservations) {
    if (
      reservation.roomNumber !== targetRoomNumber ||
      reservation._id === draggedReservation._id ||
      reservation.isCancelled
    ) continue;

    const resCheckIn = new Date(reservation.checkIn);
    const resCheckOut = new Date(reservation.checkOut);

    if (draggedCheckIn < resCheckOut && draggedCheckOut > resCheckIn) {
      if (draggedCheckIn.getTime() === resCheckOut.getTime()) continue;
      return { isConflict: true, conflictReservation: reservation };
    }
  }

  return { isConflict: false };
};
