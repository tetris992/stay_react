import React, { useMemo } from 'react';
import PropTypes from 'prop-types'; // PropTypes 임포트 추가
import { parseDate, formatDate } from '../utils/dateParser';

const UnassignedReservationsPanel = ({
  reservations = [],
  onSelectReservation,
}) => {
  const unassigned = useMemo(
    () =>
      reservations.filter(
        (res) => !res.roomNumber || res.roomNumber.trim() === ''
      ),
    [reservations]
  );

  const unassignedDates = useMemo(() => {
    const dates = new Set();
    unassigned.forEach((res) => {
      if (res.checkIn) {
        const parsedDate = parseDate(res.checkIn);
        if (parsedDate) {
          dates.add(formatDate(parsedDate, 'MM/dd'));
        }
      }
    });
    return Array.from(dates);
  }, [unassigned]);

  if (unassigned.length === 0) return null;

  return (
    <div
      className="unassigned-reservations-panel"
      style={{
        marginBottom: '1rem',
        border: '1px solid #ccc',
        padding: '0.5rem',
      }}
    >
      <h3 className="unassigned-reservations-list_all">
        미배정 OTA 예약: {unassigned.length}건{' '}
        {unassignedDates.length > 0 && (
          <span style={{ fontSize: '0.9rem', color: 'red' }}>
            (날짜: {unassignedDates.join(', ')})
          </span>
        )}
      </h3>
      <ul
        style={{
          listStyle: 'none',
          paddingLeft: 0,
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        {unassigned.map((res) => (
          <li
            className="reservation-list-li"
            key={res._id}
            onClick={() => onSelectReservation && onSelectReservation(res)}
            style={{
              border: '1px solid #ccc',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
            }}
          >
            <span style={{ marginRight: '4px' }}>#</span>
            <span>
              {res.customerName} - 체크인:{' '}
              {res.checkIn
                ? formatDate(parseDate(res.checkIn), 'MM/dd')
                : '미정'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

UnassignedReservationsPanel.propTypes = {
  reservations: PropTypes.array.isRequired,
  onSelectReservation: PropTypes.func.isRequired,
};

export default UnassignedReservationsPanel;
