import React, { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { parseDate, formatDate } from '../utils/dateParser';

const UnassignedReservationsPanel = ({
  reservations = [],
  onSelectReservation,
}) => {
  const [showWarning, setShowWarning] = useState(false);

  // 한국 시간으로 오늘 날짜 계산
  const today = useMemo(() => {
    // 한국 시간으로 변환
    const now = new Date();
    const koreaTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const year = koreaTime.getUTCFullYear();
    const month = String(koreaTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(koreaTime.getUTCDate()).padStart(2, '0');
    
    // yyyy-MM-dd 형식으로 반환
    return `${year}-${month}-${day}`;
  }, []);

  console.log('Today (Korea Time):', today); // 디버깅용 로그

  const unassigned = useMemo(
    () =>
      reservations.filter(
        (res) => !res.roomNumber || res.roomNumber.trim() === ''
      ),
    [reservations]
  );

  // 당일 미배정 예약만 필터링
  const todayUnassigned = useMemo(() => {
    return unassigned.filter((res) => {
      if (!res.checkIn) return false;
      const checkInDate = formatDate(parseDate(res.checkIn), 'yyyy-MM-dd');
      console.log('Comparing dates:', checkInDate, today); // 디버깅용 로그
      return checkInDate === today;
    });
  }, [unassigned, today]);

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

  // 디버깅용 로그
  useEffect(() => {
    console.log('Today unassigned count:', todayUnassigned.length);
    console.log('Warning state:', showWarning);
  }, [todayUnassigned.length, showWarning]);

  useEffect(() => {
    if (todayUnassigned.length > 0) {
      const warningInterval = setInterval(() => {
        setShowWarning(true);
        setTimeout(() => {
          setShowWarning(false);
        }, 300000); // 5분
      }, 900000); // 15분

      // 초기 경고 시작
      setShowWarning(true);
      setTimeout(() => {
        setShowWarning(false);
      }, 300000);

      return () => {
        clearInterval(warningInterval);
        setShowWarning(false);
      };
    } else {
      setShowWarning(false);
    }
  }, [todayUnassigned.length]);

  if (unassigned.length === 0) return null;

  return (
    <div className={`unassigned-section ${todayUnassigned.length > 0 && showWarning ? 'warning' : ''}`}>
      <h3 className="unassigned-reservations-list_all">
        미배정 OTA 예약: {unassigned.length}건
        {todayUnassigned.length > 0 && (
          <span style={{ fontSize: '0.9rem', color: 'red', marginLeft: '8px' }}>
            (당일 미배정: {todayUnassigned.length}건)
          </span>
        )}
        {unassignedDates.length > 0 && (
          <span style={{ fontSize: '0.9rem', color: '#666', marginLeft: '8px' }}>
            (전체 날짜: {unassignedDates.join(', ')})
          </span>
        )}
      </h3>
      {todayUnassigned.length > 0 && (
        <div className="unassigned-warning-text">
          ⚠️ 당일 체크인 미배정 예약 {todayUnassigned.length}건을 확인해주세요! (한국시간: {today})
        </div>
      )}
      <ul
        style={{
          listStyle: 'none',
          paddingLeft: 0,
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        {unassigned.map((res) => {
          const checkInDate = res.checkIn ? formatDate(parseDate(res.checkIn), 'yyyy-MM-dd') : null;
          const isToday = checkInDate === today;
          
          return (
            <li
              className="reservation-list-li"
              key={res._id}
              onClick={() => onSelectReservation && onSelectReservation(res)}
              style={{
                border: `1px solid ${isToday ? '#ff4444' : '#ccc'}`,
                padding: '8px',
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                backgroundColor: isToday ? '#fff8f8' : '#fff',
                borderRadius: '4px',
                transition: 'all 0.2s ease',
              }}
            >
              <span style={{ marginRight: '4px' }}>#</span>
              <span>
                {res.customerName} - 체크인:{' '}
                {res.checkIn
                  ? formatDate(parseDate(res.checkIn), 'MM/dd')
                  : '미정'}
                {isToday && (
                  <span style={{ color: 'red', marginLeft: '4px' }}>
                    (당일)
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

UnassignedReservationsPanel.propTypes = {
  reservations: PropTypes.array.isRequired,
  onSelectReservation: PropTypes.func.isRequired,
};

export default UnassignedReservationsPanel;
