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

// 상세 예약 가능 메시지 생성 함수
function getDetailedAvailabilityMessage(rangeStart, rangeEnd, roomTypeKey, availabilityByDate) {
  let msg =
    '연박 예약이 불가능합니다.\n선택한 날짜 범위에서 날짜별 사용 가능한 객실번호는 다음과 같습니다:\n';
  let cursor = startOfDay(rangeStart);
  // 체크아웃 날짜는 포함하지 않고(즉, rangeEnd 전일까지)
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
  roomTypes,      // 예: [{ roomInfo:'Standard', stock:7, roomNumbers:['201','202', ...] }, ...]
  gridSettings,   // 호텔 설정 페이지에서 전달받은 객실 그리드 정보 (선택적)
  onRangeSelect,
  onReturnView,
  onDateNavigate,
}) => {
  // 'none' 객실은 제외
  const filteredRoomTypes = useMemo(
    () => roomTypes.filter(rt => rt.roomInfo.toLowerCase() !== 'none'),
    [roomTypes]
  );

  // 달력 범위: 오늘부터 한 달 말일까지
  const calendarStart = startOfDay(new Date());
  const calendarEnd = endOfMonth(addMonths(new Date(), 1));

  // 잠금 옵션: isLocked가 true면 주 단위(일요일 시작)로 표시
  const [isLocked, setIsLocked] = useState(true);
  const gridStart = isLocked ? startOfWeek(calendarStart, { weekStartsOn: 0 }) : calendarStart;
  const gridEnd = isLocked ? endOfWeek(calendarEnd, { weekStartsOn: 0 }) : calendarEnd;

  // 달력에 표시할 날짜 배열 생성
  const days = useMemo(
    () => eachDayOfInterval({ start: gridStart, end: gridEnd }),
    [gridStart, gridEnd]
  );

  // 날짜별 잔여 예약 계산 (calculateRoomAvailability 내부에서 체크아웃 날짜는 제외)
  const availabilityByDate = useMemo(() => {
    console.log('Computing availability with:', {
      reservations,
      filteredRoomTypes,
      calendarStart: format(calendarStart, 'yyyy-MM-dd'),
      calendarEnd: format(calendarEnd, 'yyyy-MM-dd'),
      gridSettings,
      currentTime: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
    });
    return calculateRoomAvailability(
      reservations,
      filteredRoomTypes,
      calendarStart,
      calendarEnd,
      gridSettings
    );
  }, [reservations, filteredRoomTypes, calendarStart, calendarEnd, gridSettings]);

  // 월간 요약: 미배정 예약이 있는 날짜(체크인 날짜 기준)
  const unassignedDates = useMemo(() => {
    const dates = new Set();
    reservations.forEach(res => {
      if ((!res.roomNumber || res.roomNumber.trim() === '') && res.parsedCheckInDate) {
        dates.add(format(res.parsedCheckInDate, 'MM/dd'));
      }
    });
    return Array.from(dates).sort();
  }, [reservations]);

  // 드래그 예약을 위한 상태
  const [selectedRange, setSelectedRange] = useState(null);
  const today = startOfDay(new Date());

  const handleRoomTypeMouseDown = (day, roomInfo) => {
    if (day < today) return;
    setSelectedRange({ roomInfo, start: day, end: day });
  };

  const handleRoomTypeMouseEnter = (day, roomInfo) => {
    if (!selectedRange || day < today || selectedRange.roomInfo !== roomInfo) return;
    setSelectedRange(prev => ({ ...prev, end: day }));
  };

  const handleRoomTypeMouseUp = () => {
    if (!selectedRange) return;
    const { roomInfo, start, end } = selectedRange;
    // 예약의 체크아웃은 선택된 마지막날을 제외하므로, 실제 사용 기간은 [start, end) 입니다.
    const [rangeStart, rangeEnd] = [start, end].sort((a, b) => a - b);
    const tKey = roomInfo.toLowerCase();

    // 당일 예약 여부 판단 (체크인==체크아웃)
    const isDayUse = format(rangeStart, 'yyyy-MM-dd') === format(rangeEnd, 'yyyy-MM-dd');

    // (1) 예약 기간(체크아웃 미포함) 동안의 잔여 재고 검사
    let cursor = rangeStart;
    const shortageDays = [];
    if (isDayUse) {
      const ds = format(cursor, 'yyyy-MM-dd');
      const data = availabilityByDate[ds]?.[tKey];
      const remainVal = data && typeof data === 'object' ? data.remain : 0;
      if (remainVal <= 0) {
        shortageDays.push(format(cursor, 'yyyy-MM-dd(EEE)', { locale: ko }));
      }
    } else {
      while (cursor < rangeEnd) {
        const ds = format(cursor, 'yyyy-MM-dd');
        const data = availabilityByDate[ds]?.[tKey];
        const remainVal = data && typeof data === 'object' ? data.remain : 0;
        if (remainVal <= 0) {
          shortageDays.push(format(cursor, 'yyyy-MM-dd(EEE)', { locale: ko }));
        }
        cursor = addDays(cursor, 1);
      }
    }
    if (shortageDays.length > 0) {
      alert(`선택 구간 중 재고 부족: ${shortageDays.join(', ')}`);
      setSelectedRange(null);
      return;
    }

    // (2) 예약 기간 내 각 날짜에서 남은 객실번호(leftoverRooms)의 교집합 계산
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
        commonRooms = commonRooms === null
          ? new Set(freeRooms)
          : new Set([...commonRooms].filter(room => freeRooms.includes(room)));
        cursor = addDays(cursor, 1);
      }
    }
    if (!commonRooms || commonRooms.size === 0) {
      const detailedMsg = getDetailedAvailabilityMessage(rangeStart, rangeEnd, tKey, availabilityByDate);
      alert(detailedMsg);
      setSelectedRange(null);
      return;
    }

    // (3) 교집합 중 가장 작은 객실 번호 선택
    const selectedRoomNumber = Math.min(...Array.from(commonRooms));

    // (4) 사용자 확인 후 예약 생성 요청
    const msg = `기간: ${format(rangeStart, 'MM/dd')} ~ ${format(rangeEnd, 'MM/dd')} (${roomInfo})\n공통 객실 번호: ${selectedRoomNumber}\n예약 생성하시겠습니까?`;
    if (window.confirm(msg)) {
      onRangeSelect?.(rangeStart, rangeEnd, roomInfo, selectedRoomNumber);
      onReturnView?.();
    }
    setSelectedRange(null);
  };

  const isRoomTypeSelected = (day, roomInfo) => {
    if (!selectedRange || selectedRange.roomInfo !== roomInfo) return false;
    const [rs, re] = [selectedRange.start, selectedRange.end].sort((a, b) => a - b);
    return day >= rs && day < re; // 체크아웃 날 미포함
  };

  // 날짜 헤더 클릭 시 일간 예약 화면 이동 (팝업)
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

  // 날짜 셀 렌더링 함수
  const renderDayCell = (day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const isOutside = day < calendarStart || day > calendarEnd;
    const isToday = dateStr === format(today, 'yyyy-MM-dd');
    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
    const dayAvailability = availabilityByDate[dateStr] || {};

    return (
      <div key={dateStr} className={`calendar-cell ${isOutside ? 'outside' : ''} ${isToday ? 'today' : ''}`}>
        <div className="cell-wrapper">
          <div className={`cell-header ${isWeekend ? 'weekend' : ''}`}>
            <span
              className="header-date"
              style={{ cursor: 'pointer' }}
              onClick={(e) => handleHeaderClick(day, e)}
            >
              {format(day, 'MM/dd (EEE)', { locale: ko })}
            </span>
            {typeof dayAvailability.unassigned === 'number' && dayAvailability.unassigned > 0 && (
              <span style={{ fontSize: '1rem', marginLeft: 4, color: 'red' }}>
                미배정: {dayAvailability.unassigned}
              </span>
            )}
            <button className="daily-nav-button" onClick={(e) => handleHeaderClick(day, e)} title="일간 예약 보기">
              이동
            </button>
          </div>
        </div>
        <div className="cell-content">
          {filteredRoomTypes.map(rt => {
            const typeKey = rt.roomInfo.toLowerCase();
            const data = dayAvailability[typeKey] || {};
            const remain = typeof data.remain === 'number' ? data.remain : 0;
            const leftoverRooms = data.leftoverRooms || [];
            const selected = isRoomTypeSelected(day, rt.roomInfo);
            const isAll = remain === rt.stock && remain > 0;
            const remainLabel = isAll ? '(All)' : remain;
            const leftoverRoomDisplay = !isAll && leftoverRooms.length > 0 ? leftoverRooms.join(', ') : null;
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
                  <span className="leftover-rooms">({leftoverRoomDisplay})</span>
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
          {format(calendarStart, 'yyyy년 MM월', { locale: ko })} ~ {format(calendarEnd, 'yyyy년 MM월', { locale: ko })}
          <button
            className="lock-toggle-button"
            onClick={() => setIsLocked(!isLocked)}
            title={isLocked ? '고정 해제' : '고정'}
          >
            {isLocked ? <FaLock /> : <FaLockOpen />}
            <span style={{ marginLeft: '4px' }}>{isLocked ? '고정' : '해제'}</span>
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
          <p style={{ color: 'red' }}>미배정 예약 있는 날짜: {unassignedDates.join(', ')}</p>
        ) : (
          <p>모든 예약이 배정되었습니다.</p>
        )}
      </div>

      {isLocked && (
        <div className="weekday-header">
          {['일', '월', '화', '수', '목', '금', '토'].map(dayName => (
            <div key={dayName} className="weekday-cell">{dayName}</div>
          ))}
        </div>
      )}

      <div className={`calendar-grid ${isLocked ? 'locked' : ''}`}>
        {days.map(day => renderDayCell(day))}
      </div>

      {popup && (
        <div
          className="confirm-popup"
          style={{
            top: popup.y,
            left: popup.x,
            position: 'fixed',
            background: '#fff',
            border: '1px solid #ccc',
            padding: '8px',
            zIndex: 9999,
          }}
        >
          <p style={{ margin: 0, fontSize: '0.9rem' }}>
            {format(popup.day, 'MM/dd (EEE)', { locale: ko })}의 일간 예약 화면으로 이동하시겠습니까?
          </p>
          <div style={{ marginTop: '8px', textAlign: 'right' }}>
            <button onClick={handlePopupConfirm} style={{ marginRight: '4px' }}>이동</button>
            <button onClick={handlePopupCancel}>취소</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MonthlyCalendar;
