// UnassignedReservationsPanel.js
import React, { useMemo } from 'react';
import { format } from 'date-fns';

const UnassignedReservationsPanel = ({ reservations }) => {
  // roomNumber가 없거나 빈 문자열인 예약을 미배정 예약으로 판단
  const unassigned = useMemo(
    () =>
      reservations.filter(
        (res) => !res.roomNumber || res.roomNumber.trim() === ''
      ),
    [reservations]
  );

  // 미배정 예약들의 체크인 날짜(중복 제거)
  const unassignedDates = useMemo(() => {
    const dates = new Set();
    unassigned.forEach((res) => {
      if (res.checkIn) {
        dates.add(format(new Date(res.checkIn), 'MM/dd'));
      }
    });
    return Array.from(dates);
  }, [unassigned]);

  if (unassigned.length === 0) return null;

  return (
    <div className="unassigned-reservations-panel" style={{ marginBottom: '1rem', border: '1px solid #ccc', padding: '0.5rem' }}>
      <h3>
        미배정 예약: {unassigned.length}건{' '}
        {unassignedDates.length > 0 && (
          <span style={{ fontSize: '0.9rem', color: 'red' }}>
            (날짜: {unassignedDates.join(', ')})
          </span>
        )}
      </h3>
      <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
        {unassigned.map((res) => (
          <li key={res._id}>
            {res.customerName} - 체크인: {format(new Date(res.checkIn), 'MM/dd')}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default UnassignedReservationsPanel;
 