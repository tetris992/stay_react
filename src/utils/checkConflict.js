// checkConflict.js (클라이언트 측)
export const checkConflict = (draggedReservation, targetRoomNumber, allReservations) => {
    const draggedCheckIn = new Date(draggedReservation.checkIn);
    const draggedCheckOut = new Date(draggedReservation.checkOut);
  
    const conflictReservation = allReservations.find((reservation) => {
      if (reservation._id === draggedReservation._id || reservation.roomNumber !== targetRoomNumber) return false;
  
      const existingCheckIn = new Date(reservation.checkIn);
      const existingCheckOut = new Date(reservation.checkOut);
  
      return draggedCheckIn < existingCheckOut && draggedCheckOut > existingCheckIn;
    });
  
    return conflictReservation
      ? { isConflict: true, conflictReservation }
      : { isConflict: false };
  };
  