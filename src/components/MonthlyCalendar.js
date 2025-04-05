import React, { useMemo, useState } from 'react';
import {
  format,
  startOfDay,
  endOfMonth,
  addMonths,
  addDays,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { FaLock, FaLockOpen } from 'react-icons/fa';
import './MonthlyCalendar.css';
import { calculateRoomAvailability } from '../utils/availability';

// 문자열 기반으로 가용 객실 메시지 생성
const getDetailedAvailabilityMessage = (
  rangeStart,
  rangeEnd,
  roomTypeKey,
  availabilityByDate
) => {
  let msg = '선택한 기간 동안 예약이 불가능합니다.\n날짜별 가용 객실:\n';
  let cursor = startOfDay(rangeStart);
  while (cursor < startOfDay(rangeEnd)) {
    const ds = format(cursor, 'yyyy-MM-dd');
    const freeRooms =
      availabilityByDate[ds]?.[roomTypeKey.toLowerCase()]?.leftoverRooms || [];
    msg += `${ds}: ${freeRooms.length > 0 ? freeRooms.join(', ') : '없음'}\n`;
    cursor = addDays(cursor, 1);
  }
  msg += '\n(기존 예약을 이동하거나 객실을 조정 후 다시 시도하세요.)';
  return msg;
};

const MonthlyCalendar = ({
  reservations = [],
  roomTypes = [],
  availabilityByDate: propAvailabilityByDate = {},
  gridSettings,
  onRangeSelect,
  onReturnView,
  onDateNavigate,
}) => {
  // 취소된 예약 제외
  const filteredReservations = useMemo(
    () => reservations.filter((res) => !res.isCancelled),
    [reservations]
  );
  console.log('[MonthlyCalendar] filteredReservations:', filteredReservations);

  const filteredRoomTypes = useMemo(
    () => roomTypes.filter((rt) => rt.roomInfo?.toLowerCase() !== 'none'),
    [roomTypes]
  );

  const today = startOfDay(new Date());
  const todayStr = format(today, 'yyyy-MM-dd');
  const calendarStart = today;
  const calendarEnd = endOfMonth(addMonths(today, 1));

  const [isLocked, setIsLocked] = useState(true);
  const gridStart = isLocked
    ? startOfWeek(today, { weekStartsOn: 0 })
    : calendarStart;
  const gridEnd = isLocked
    ? endOfWeek(calendarEnd, { weekStartsOn: 0 })
    : calendarEnd;

  const days = useMemo(
    () => eachDayOfInterval({ start: gridStart, end: gridEnd }),
    [gridStart, gridEnd]
  );

  const unassignedDates = useMemo(() => {
    const dates = new Set();
    filteredReservations.forEach((res) => {
      if (!res.roomNumber && res.checkIn) {
        const checkInDate = new Date(res.checkIn);
        if (!isNaN(checkInDate.getTime())) {
          dates.add(format(checkInDate, 'MM/dd'));
        }
      }
    });
    return Array.from(dates).sort();
  }, [filteredReservations]);

  const [selectedRange, setSelectedRange] = useState(null);
  const [selectedDate, setSelectedDate] = useState(today);

  const availabilityByDate = useMemo(() => {
    const calcFromDate = addDays(today, -1);
    const calcToDate = addDays(endOfMonth(addMonths(today, 1)), 1);
    const selectedDates = [];
    const baseDate = startOfDay(selectedDate);
    for (let i = -1; i <= 1; i++) {
      selectedDates.push(format(addDays(baseDate, i), 'yyyy-MM-dd'));
    }
    const result = calculateRoomAvailability(
      filteredReservations,
      roomTypes,
      calcFromDate,
      calcToDate,
      gridSettings,
      selectedDates
    );
    console.log('[MonthlyCalendar] availabilityByDate:', result);
    return result;
  }, [filteredReservations, roomTypes, gridSettings, selectedDate, today]);

  // gridSettings에서 객실 수 계산
  const roomCounts = useMemo(() => {
    const counts = {};
    if (gridSettings?.floors) {
      gridSettings.floors.forEach((floor) => {
        floor.containers.forEach((cell) => {
          if (cell.isActive) {
            const typeKey = cell.roomInfo.toLowerCase();
            counts[typeKey] = (counts[typeKey] || 0) + 1;
          }
        });
      });
    }
    console.log('[MonthlyCalendar] roomCounts:', counts);
    return counts;
  }, [gridSettings]);

  const handleRoomTypeMouseDown = (day, roomInfo) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    if (dayStr < todayStr) return;
    setSelectedRange({ roomInfo, start: day, end: day });
  };

  const handleRoomTypeMouseEnter = (day, roomInfo) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    if (!selectedRange || dayStr < todayStr || selectedRange.roomInfo !== roomInfo)
      return;
    setSelectedRange((prev) => ({ ...prev, end: day }));
  };

  const handleRoomTypeMouseUp = () => {
    if (!selectedRange) {
      console.log('[MonthlyCalendar] selectedRange is null');
      return;
    }
    console.log('[MonthlyCalendar] selectedRange:', selectedRange);

    const { roomInfo, start, end } = selectedRange;
    const [rangeStart, rangeEnd] = [start, end].sort((a, b) => a - b);
    const tKey = roomInfo.toLowerCase();

    let cursor = rangeStart;
    const shortageDays = [];
    while (cursor < rangeEnd) {
      const ds = format(cursor, 'yyyy-MM-dd');
      const data = availabilityByDate[ds]?.[tKey];
      console.log(`[MonthlyCalendar] Checking availability for ${ds}:`, data);
      if (!data || data.remain <= 0) shortageDays.push(ds);
      cursor = addDays(cursor, 1);
    }

    if (shortageDays.length > 0) {
      console.log('[MonthlyCalendar] Shortage days detected:', shortageDays);
      alert(`선택 구간에 재고 부족: ${shortageDays.join(', ')}`);
      setSelectedRange(null);
      return;
    }

    let commonRooms = null;
    cursor = rangeStart;
    while (cursor < rangeEnd) {
      const ds = format(cursor, 'yyyy-MM-dd');
      const freeRooms = availabilityByDate[ds]?.[tKey]?.leftoverRooms || [];
      console.log(`[MonthlyCalendar] Free rooms for ${ds}:`, freeRooms);
      commonRooms = commonRooms
        ? new Set([...commonRooms].filter((r) => freeRooms.includes(r)))
        : new Set(freeRooms);
      cursor = addDays(cursor, 1);
    }

    console.log('[MonthlyCalendar] Calculated commonRooms:', commonRooms);

    if (!commonRooms || commonRooms.size === 0) {
      const msg = getDetailedAvailabilityMessage(rangeStart, rangeEnd, tKey, availabilityByDate);
      console.log('[MonthlyCalendar] No common rooms, showing message:', msg);
      alert(msg);
      setSelectedRange(null);
      return;
    }

    const selectedRoomNumber = Math.min(...Array.from(commonRooms));
    const msg = `기간: ${format(rangeStart, 'MM/dd')} ~ ${format(rangeEnd, 'MM/dd')} (${roomInfo})\n공통 객실 번호: ${selectedRoomNumber}\n예약 생성하시겠습니까?`;
    console.log('[MonthlyCalendar] Showing confirm dialog with message:', msg);
    if (window.confirm(msg)) {
      try {
        const checkInDateObj = startOfDay(rangeStart);
        checkInDateObj.setHours(16, 0, 0, 0);
        const checkOutDateObj = startOfDay(rangeEnd);
        checkOutDateObj.setHours(11, 0, 0, 0);
        console.log('[MonthlyCalendar] Calling onRangeSelect:', {
          checkIn: checkInDateObj,
          checkOut: checkOutDateObj,
          roomInfo,
        });
        if (typeof onRangeSelect !== 'function') {
          console.error('[MonthlyCalendar] onRangeSelect is not a function:', onRangeSelect);
          return;
        }
        onRangeSelect(checkInDateObj, checkOutDateObj, roomInfo);
      } catch (error) {
        console.error('[MonthlyCalendar] Error calling onRangeSelect:', error);
      }
    }
    setSelectedRange(null);
  };

  const isRoomTypeSelected = (day, roomInfo) => {
    if (!selectedRange || selectedRange.roomInfo !== roomInfo) return false;
    const [rs, re] = [selectedRange.start, selectedRange.end].sort(
      (a, b) => a - b
    );
    return day >= rs && day <= re;
  };

  const [popup, setPopup] = useState(null);
  const handleHeaderClick = (day, e) => {
    e.stopPropagation();
    setPopup({ day, x: e.clientX, y: e.clientY });
    setSelectedDate(day);
  };

  const handlePopupConfirm = () => {
    if (popup) {
      onDateNavigate(popup.day);
      setPopup(null);
    }
  };

  const handlePopupCancel = () => setPopup(null);

  const renderDayCell = (day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const isOutside = day < calendarStart || day > calendarEnd;
    const isToday = dateStr === todayStr;
    const isWeekend = [0, 6].includes(day.getDay());
    const dayAvailability = availabilityByDate[dateStr] || {};
    console.log(`[MonthlyCalendar] dayAvailability for ${dateStr}:`, dayAvailability);

    // 헤더에 표시할 총 재고와 가용 재고 계산
    const roomTypeSummary = filteredRoomTypes.map((rt) => {
      const typeKey = rt.roomInfo.toLowerCase();
      const data = dayAvailability[typeKey] || {
        remain: 0,
        leftoverRooms: [],
      };
      const totalStock = roomCounts[typeKey] || 0;
      const remain = data.remain;
      const leftoverRooms = data.leftoverRooms || [];
      return {
        roomInfo: rt.roomInfo,
        totalStock,
        remain,
        leftoverRooms,
      };
    });

    // 헤더에 표시할 텍스트 생성
    const summaryText = roomTypeSummary
      .map(
        (rt) =>
          `${rt.roomInfo.toLowerCase()}: ${rt.remain}${
            rt.leftoverRooms.length > 0 ? ` (${rt.leftoverRooms.join(', ')})` : ''
          }`
      )
      .join('\n');

    return (
      <div
        key={dateStr}
        className={`calendar-cell ${isOutside ? 'outside' : ''} ${
          isToday ? 'today' : ''
        }`}
      >
        <div className="cell-wrapper">
          <div className={`cell-header ${isWeekend ? 'weekend' : ''}`}>
            <span
              className="header-date"
              style={{ cursor: 'pointer' }}
              onClick={(e) => handleHeaderClick(day, e)}
              title={summaryText} // 헤더에 총 재고와 가용 재고 표시
            >
              {format(day, 'MM/dd (EEE)', { locale: ko })}
            </span>
            {dayAvailability.unassigned > 0 && (
              <span style={{ fontSize: '1rem', marginLeft: 4, color: 'red' }}>
                미배정: {dayAvailability.unassigned}
              </span>
            )}
            <button
              className="daily-nav-button"
              onClick={(e) => handleHeaderClick(day, e)}
              title="일간 예약 보기"
            >
              이동
            </button>
          </div>
        </div>
        <div className="cell-content">
          {filteredRoomTypes.map((rt) => {
            const typeKey = rt.roomInfo.toLowerCase();
            const data = dayAvailability[typeKey] || {
              remain: 0,
              leftoverRooms: [],
            };
            const remain = data.remain;
            const leftoverRooms = data.leftoverRooms || [];
            const selected = isRoomTypeSelected(day, rt.roomInfo);
            const totalStock = roomCounts[typeKey] || 0;
            const isAllAvailable = remain === totalStock && remain > 0;

            return (
              <div
                key={rt.roomInfo}
                className={`room-type ${selected ? 'selected-room-type' : ''}`}
                onMouseDown={() => handleRoomTypeMouseDown(day, rt.roomInfo)}
                onMouseEnter={() => handleRoomTypeMouseEnter(day, rt.roomInfo)}
                onMouseUp={handleRoomTypeMouseUp}
                title={
                  leftoverRooms.length > 0
                    ? leftoverRooms.join(', ')
                    : '가용 객실 없음'
                }
              >
                <span>
                  {rt.roomInfo}: {isAllAvailable ? '(All)' : remain}
                </span>
                {leftoverRooms.length > 0 && (
                  <span className="leftover-rooms">
                    ({leftoverRooms.join(', ')})
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="monthly-calendar">
      <div className="calendar-header">
        <h2 className="calendar-title">
          {format(calendarStart, 'yyyy년 MM월', { locale: ko })} ~{' '}
          {format(calendarEnd, 'yyyy년 MM월', { locale: ko })}
          <button
            className="lock-toggle-button"
            onClick={() => setIsLocked(!isLocked)}
            title={isLocked ? '고정 해제' : '고정'}
          >
            {isLocked ? <FaLock /> : <FaLockOpen />}
            <span style={{ marginLeft: 4 }}>{isLocked ? '고정' : '해제'}</span>
          </button>
        </h2>
        {onReturnView && (
          <button className="return-button" onClick={onReturnView}>
            일간예약 보기
          </button>
        )}
      </div>

      <div className="monthly-summary" style={{ marginBottom: '1rem' }}>
        {unassignedDates.length > 0 ? (
          <p style={{ color: 'red' }}>
            미배정 날짜: {unassignedDates.join(', ')}
          </p>
        ) : (
          <p>모든 예약이 배정됨</p>
        )}
      </div>

      {isLocked && (
        <div className="weekday-header">
          {['일', '월', '화', '수', '목', '금', '토'].map((day) => (
            <div key={day} className="weekday-cell">
              {day}
            </div>
          ))}
        </div>
      )}

      <div className={`calendar-grid ${isLocked ? 'locked' : ''}`}>
        {days.map(renderDayCell)}
      </div>

      {popup && (
        <div
          className="confirm-popup"
          style={{
            position: 'fixed',
            top: popup.y,
            left: popup.x,
            background: '#fff',
            border: '1px solid #ccc',
            padding: '8px',
            zIndex: 1000,
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}
        >
          <p style={{ margin: 0, fontSize: '0.9rem' }}>
            {format(popup.day, 'MM/dd (EEE)', { locale: ko })}로 이동?
          </p>
          <div style={{ marginTop: '8px', textAlign: 'right' }}>
            <button
              onClick={handlePopupConfirm}
              style={{ marginRight: '4px', padding: '2px 8px' }}
            >
              이동
            </button>
            <button onClick={handlePopupCancel} style={{ padding: '2px 8px' }}>
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MonthlyCalendar;