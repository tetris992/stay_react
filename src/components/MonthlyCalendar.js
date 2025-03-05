// src/components/MonthlyCalendar.js
import React, { useMemo, useState } from 'react';
import {
  format,
  endOfMonth,
  addMonths,
  addDays,
  startOfDay,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { FaLock, FaLockOpen } from 'react-icons/fa';
import './MonthlyCalendar.css';
import { calculateRoomAvailability } from '../utils/availability.js';

function getDetailedAvailabilityMessage(
  rangeStart,
  rangeEnd,
  roomTypeKey,
  availabilityByDate
) {
  let msg =
    '연박 예약이 불가능합니다.\n선택한 날짜 범위에서 날짜별 사용 가능한 객실번호는 다음과 같습니다:\n';
  let cursor = startOfDay(rangeStart);
  while (cursor < startOfDay(rangeEnd)) {
    const ds = format(cursor, 'yyyy-MM-dd');
    const freeRooms =
      availabilityByDate[ds]?.[roomTypeKey.toLowerCase()]?.leftoverRooms || [];
    msg += `${ds}: ${freeRooms.length > 0 ? freeRooms.join(', ') : '없음'}\n`;
    cursor = addDays(cursor, 1);
  }
  msg += '\n(이미 배정된 예약을 다른 객실로 옮긴 후 재시도해주세요.)';
  return msg;
}

const MonthlyCalendar = ({
  reservations,
  roomTypes,
  gridSettings,
  onRangeSelect,
  onReturnView,
  onDateNavigate,
}) => {
  const filteredRoomTypes = useMemo(
    () => roomTypes.filter((rt) => rt.roomInfo.toLowerCase() !== 'none'),
    [roomTypes]
  );

  // 달력 범위: 오늘부터 한 달 말일까지
  const calendarStart = startOfDay(new Date());
  const calendarEnd = endOfMonth(addMonths(new Date(), 1));

  // **중요**: 월간 계산 시, 이전 날(혹은 가장 빠른 예약이 시작된 날)부터 계산하여,
  // 이미 체크인한 예약도 반영되도록 한다.
  // 여기서는 단순히 calendarStart의 하루 전으로 설정.
  const calcFromDate = addDays(calendarStart, -1);
  // toDate는 calendarEnd의 다음 날
  const calcToDate = addDays(calendarEnd, 1);

  const [isLocked, setIsLocked] = useState(true);
  const gridStart = isLocked
    ? startOfWeek(calendarStart, { weekStartsOn: 0 })
    : calendarStart;
  const gridEnd = isLocked
    ? endOfWeek(calendarEnd, { weekStartsOn: 0 })
    : calendarEnd;

  const days = useMemo(
    () => eachDayOfInterval({ start: gridStart, end: gridEnd }),
    [gridStart, gridEnd]
  );

  const availabilityByDate = useMemo(() => {
    console.log('[MonthlyCalendar] 계산 범위:', {
      calcFromDate: format(calcFromDate, 'yyyy-MM-dd'),
      calcToDate: format(calcToDate, 'yyyy-MM-dd'),
    });
    return calculateRoomAvailability(
      reservations,
      filteredRoomTypes,
      calcFromDate,
      calcToDate,
      gridSettings
    );
  }, [reservations, filteredRoomTypes, calcFromDate, calcToDate, gridSettings]);

  const unassignedDates = useMemo(() => {
    const setOfDates = new Set();
    reservations.forEach((res) => {
      if (
        (!res.roomNumber || res.roomNumber.trim() === '') &&
        res.parsedCheckInDate
      ) {
        setOfDates.add(format(res.parsedCheckInDate, 'MM/dd'));
      }
    });
    return Array.from(setOfDates).sort();
  }, [reservations]);

  const [selectedRange, setSelectedRange] = useState(null);
  const today = startOfDay(new Date());

  const handleRoomTypeMouseDown = (day, roomInfo) => {
    if (day < today) return;
    setSelectedRange({ roomInfo, start: day, end: day });
  };

  const handleRoomTypeMouseEnter = (day, roomInfo) => {
    if (!selectedRange || day < today || selectedRange.roomInfo !== roomInfo)
      return;
    setSelectedRange((prev) => ({ ...prev, end: day }));
  };

  const handleRoomTypeMouseUp = () => {
    if (!selectedRange) return;
    const { roomInfo, start, end } = selectedRange;
    const [rangeStart, rangeEnd] = [start, end].sort((a, b) => a - b);
    const tKey = roomInfo.toLowerCase();
    const isDayUse =
      format(rangeStart, 'yyyy-MM-dd') === format(rangeEnd, 'yyyy-MM-dd');

    let cursor = rangeStart;
    const shortageDays = [];
    if (isDayUse) {
      const ds = format(cursor, 'yyyy-MM-dd');
      const data = availabilityByDate[ds]?.[tKey];
      const remainVal = data?.remain ?? 0;
      if (remainVal <= 0) shortageDays.push(ds);
    } else {
      while (cursor < rangeEnd) {
        const ds = format(cursor, 'yyyy-MM-dd');
        const data = availabilityByDate[ds]?.[tKey];
        const remainVal = data?.remain ?? 0;
        if (remainVal <= 0) shortageDays.push(ds);
        cursor = addDays(cursor, 1);
      }
    }
    if (shortageDays.length > 0) {
      alert(`선택 구간 중 재고 부족: ${shortageDays.join(', ')}`);
      setSelectedRange(null);
      return;
    }

    cursor = rangeStart;
    let commonRooms = null;
    if (isDayUse) {
      const ds = format(cursor, 'yyyy-MM-dd');
      const freeRooms = availabilityByDate[ds]?.[tKey]?.leftoverRooms || [];
      commonRooms = new Set(freeRooms);
    } else {
      while (cursor < rangeEnd) {
        const ds = format(cursor, 'yyyy-MM-dd');
        const freeRooms = availabilityByDate[ds]?.[tKey]?.leftoverRooms || [];
        commonRooms =
          commonRooms === null
            ? new Set(freeRooms)
            : new Set([...commonRooms].filter((r) => freeRooms.includes(r)));
        cursor = addDays(cursor, 1);
      }
    }
    if (!commonRooms || commonRooms.size === 0) {
      const detailedMsg = getDetailedAvailabilityMessage(
        rangeStart,
        rangeEnd,
        tKey,
        availabilityByDate
      );
      alert(detailedMsg);
      setSelectedRange(null);
      return;
    }

    const selectedRoomNumber = Math.min(...Array.from(commonRooms));
    const msg = `기간: ${format(rangeStart, 'MM/dd')} ~ ${format(
      rangeEnd,
      'MM/dd'
    )} (${roomInfo})\n공통 객실 번호: ${selectedRoomNumber}\n예약 생성하시겠습니까?`;
    if (window.confirm(msg)) {
      onRangeSelect?.(rangeStart, rangeEnd, roomInfo, selectedRoomNumber);
      onReturnView?.();
    }
    setSelectedRange(null);
  };

  const isRoomTypeSelected = (day, roomInfo) => {
    if (!selectedRange || selectedRange.roomInfo !== roomInfo) return false;
    const [rs, re] = [selectedRange.start, selectedRange.end].sort(
      (a, b) => a - b
    );
    return day >= rs && day < re;
  };

  const [popup, setPopup] = useState(null);
  const handleHeaderClick = (day, e) => {
    e.stopPropagation();
    setPopup({ day, x: e.clientX, y: e.clientY });
  };
  const handlePopupConfirm = () => {
    if (popup) {
      onDateNavigate?.(popup.day);
      setPopup(null);
    }
  };
  const handlePopupCancel = () => setPopup(null);

  const renderDayCell = (day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const isOutside = day < calendarStart || day > calendarEnd;
    const isToday = dateStr === format(today, 'yyyy-MM-dd');
    const isWeekend = [0, 6].includes(day.getDay());
    const dayAvailability = availabilityByDate[dateStr] || {};

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
            >
              {format(day, 'MM/dd (EEE)', { locale: ko })}
            </span>
            {typeof dayAvailability.unassigned === 'number' &&
              dayAvailability.unassigned > 0 && (
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
            const data = dayAvailability[typeKey] || {};
            const remain = data.remain ?? 0;
            const leftoverRooms = data.leftoverRooms || [];
            const selected = isRoomTypeSelected(day, rt.roomInfo);
            const isAll = remain === rt.stock && remain > 0;
            const remainLabel = isAll ? '(All)' : remain;
            const leftoverRoomDisplay =
              leftoverRooms.length > 0 ? leftoverRooms.join(', ') : null;
            return (
              <div
                key={rt.roomInfo}
                className={`room-type ${selected ? 'selected-room-type' : ''}`}
                onMouseDown={() => handleRoomTypeMouseDown(day, rt.roomInfo)}
                onMouseEnter={() => handleRoomTypeMouseEnter(day, rt.roomInfo)}
                onMouseUp={handleRoomTypeMouseUp}
              >
                <span>
                  {rt.roomInfo}: {remainLabel}
                </span>
                {leftoverRoomDisplay && (
                  <span className="leftover-rooms">
                    ({leftoverRoomDisplay})
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
            미배정 예약 있는 날짜: {unassignedDates.join(', ')}
          </p>
        ) : (
          <p>모든 예약이 배정되었습니다.</p>
        )}
      </div>

      {isLocked && (
        <div className="weekday-header">
          {['일', '월', '화', '수', '목', '금', '토'].map((dayName) => (
            <div key={dayName} className="weekday-cell">
              {dayName}
            </div>
          ))}
        </div>
      )}

      <div className={`calendar-grid ${isLocked ? 'locked' : ''}`}>
        {days.map((day) => renderDayCell(day))}
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
            padding: 8,
            zIndex: 9999,
          }}
        >
          <p style={{ margin: 0, fontSize: '0.9rem' }}>
            {format(popup.day, 'MM/dd (EEE)', { locale: ko })}의 일간 예약
            화면으로 이동?
          </p>
          <div style={{ marginTop: 8, textAlign: 'right' }}>
            <button onClick={handlePopupConfirm} style={{ marginRight: 4 }}>
              이동
            </button>
            <button onClick={handlePopupCancel}>취소</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MonthlyCalendar;
