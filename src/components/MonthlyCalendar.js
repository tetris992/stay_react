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
  differenceInCalendarDays,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { FaLock, FaLockOpen } from 'react-icons/fa';
import './MonthlyCalendar.css';

/* ------------------------------------------------------------------------
   유틸 함수: 체크인~체크아웃을 날짜 단위로 쪼개어, 
   일자별 룸 타입별 점유 ( +1 ) → 총객실 - 점유 = 잔여 계산
   미배정 예약은 roomInfo가 없으면 "unassigned"로 처리하여 별도 카운트
   ------------------------------------------------------------------------ */
function computeDailyAvailability(reservations, roomTypes, fromDate, toDate) {
  // 1) roomInfo별 총 객실 수 (stock)
  const totalStockByType = {};
  roomTypes.forEach((rt) => {
    const typeKey = (rt.roomInfo || 'Standard').toLowerCase();
    totalStockByType[typeKey] = rt.stock || 0;
  });

  // 2) fromDate ~ toDate 의 모든 날짜(자정 기준) 문자열 배열
  const start = startOfDay(fromDate);
  const end = startOfDay(toDate);
  const totalDays = differenceInCalendarDays(end, start) + 1;
  const dateList = [];
  for (let i = 0; i < totalDays; i++) {
    const d = addDays(start, i);
    const dateStr = format(d, 'yyyy-MM-dd');
    dateList.push(dateStr);
  }

  // 3) 날짜별, 타입별 점유 수 초기화 (roomTypes와 미배정 포함)
  const usageByDate = {};
  dateList.forEach((ds) => {
    usageByDate[ds] = {};
    Object.keys(totalStockByType).forEach((typeKey) => {
      usageByDate[ds][typeKey] = 0;
    });
    usageByDate[ds]['unassigned'] = 0; // 미배정 예약 건수 초기화
  });

  // 4) 예약별로 체크인~체크아웃(전날 혹은 당일 대실)까지 점유 처리
  reservations.forEach((res) => {
    if (res.isCancelled) return; // 취소된 예약은 무시

    const ci = res.parsedCheckInDate ? startOfDay(res.parsedCheckInDate) : null;
    const co = res.parsedCheckOutDate ? startOfDay(res.parsedCheckOutDate) : null;
    if (!ci || !co) return; // 날짜 파싱 실패 시 무시

    // roomInfo가 없으면 미배정 처리
    const typeKey = res.roomInfo ? res.roomInfo.toLowerCase() : 'unassigned';

    // (b) 우리가 계산하려는 기간 [fromDate, toDate]와 겹치는 부분만 반영
    const usageStart = ci < start ? start : ci;
    const usageEnd = co > end ? end : co;

    if (usageEnd > usageStart) {
      // 일반적인 연박 (1박 이상)
      let cursor = usageStart;
      while (cursor < usageEnd) {
        const dateStr = format(cursor, 'yyyy-MM-dd');
        if (usageByDate[dateStr]?.[typeKey] !== undefined) {
          usageByDate[dateStr][typeKey] += 1;
        }
        cursor = addDays(cursor, 1);
      }
    } else if (usageEnd.getTime() === usageStart.getTime()) {
      // 체크인과 체크아웃이 같은 날짜 (대실) → 당일 사용 처리
      const dateStr = format(usageStart, 'yyyy-MM-dd');
      if (usageByDate[dateStr]?.[typeKey] !== undefined) {
        usageByDate[dateStr][typeKey] += 1;
      }
    }
  });

  // 5) 최종 잔여 계산: assigned 예약은 (총 객실수 - 사용수), 미배정은 단순 카운트 표시
  const availability = {};
  dateList.forEach((ds) => {
    availability[ds] = {};
    Object.entries(usageByDate[ds]).forEach(([key, used]) => {
      if (key === 'unassigned') {
        availability[ds][key] = used;
      } else {
        const total = totalStockByType[key] || 0;
        const remaining = total - used;
        availability[ds][key] = remaining < 0 ? 0 : remaining;
      }
    });
  });

  return availability;
}

/* ============================================================================
   MonthlyCalendar 컴포넌트
   → 오늘부터 한 달 뒤까지의 날짜별 룸타입 잔여 객실과 미배정 예약 건수를 표시
       또한, 날짜 헤더를 클릭하면 해당 날짜의 일간 예약 화면으로 이동할 것인지 
       확인 후, 클릭한 위치 근처에 팝업으로 이동 여부를 묻고, 확인 시 이동함.
   ============================================================================ */
const MonthlyCalendar = ({
  reservations,    // 전체 예약 (각 예약은 parsedCheckInDate, parsedCheckOutDate, roomInfo 포함)
  roomTypes,       // [{ roomInfo: 'Standard', stock: 7 }, { roomInfo: 'Deluxe', stock: 3 }, ... ]
  onRangeSelect,
  onReturnView,
  onDateNavigate,  // 일간 예약 화면으로 이동하는 함수 (예: (date) => { ... })
}) => {
  // 1) 달력 범위: 오늘(자정) ~ 다음 달 말일까지
  const calendarStart = startOfDay(new Date());
  const calendarEnd = endOfMonth(addMonths(new Date(), 1));

  // 2) 잠금 옵션(isLocked) → 주단위로 달력 표시
  const [isLocked, setIsLocked] = useState(true);
  const gridStart = isLocked
    ? startOfWeek(calendarStart, { weekStartsOn: 0 })
    : calendarStart;
  const gridEnd = isLocked
    ? endOfWeek(calendarEnd, { weekStartsOn: 0 })
    : calendarEnd;

  // 3) 달력에 표시할 일자 배열
  const days = useMemo(() => {
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [gridStart, gridEnd]);

  // 4) 한 달치 잔여 객실 및 미배정 예약 계산
  const availabilityByDate = useMemo(() => {
    return computeDailyAvailability(reservations, roomTypes, calendarStart, calendarEnd);
  }, [reservations, roomTypes, calendarStart, calendarEnd]);

  // 5) 날짜 범위 드래그(마우스)로 예약 진행
  const [selectedRange, setSelectedRange] = useState(null);
  const today = startOfDay(new Date());

  const handleRoomTypeMouseDown = (day, roomInfo) => {
    if (day < today) return; // 과거 날짜는 예약 불가
    setSelectedRange({ roomInfo, start: day, end: day });
  };

  const handleRoomTypeMouseEnter = (day, roomInfo) => {
    if (!selectedRange) return;
    if (day < today) return;
    if (selectedRange.roomInfo === roomInfo) {
      setSelectedRange((prev) => ({ ...prev, end: day }));
    }
  };

  const handleRoomTypeMouseUp = () => {
    if (!selectedRange) return;
    const { roomInfo, start, end } = selectedRange;
    const [rangeStart, rangeEnd] = [start, end].sort((a, b) => a - b);

    // 선택 기간 안에 잔여 객실이 0인 날짜가 있는지 확인
    let cursor = rangeStart;
    const shortageDays = [];
    while (cursor <= rangeEnd) {
      const ds = format(cursor, 'yyyy-MM-dd');
      const tkey = (roomInfo || 'standard').toLowerCase();
      if (!availabilityByDate[ds] || availabilityByDate[ds][tkey] <= 0) {
        shortageDays.push(format(cursor, 'yyyy-MM-dd(EEE)', { locale: ko }));
      }
      cursor = addDays(cursor, 1);
    }
    if (shortageDays.length > 0) {
      alert(`선택 구간 중 재고 부족: ${shortageDays.join(', ')}`);
      setSelectedRange(null);
      return;
    }

    // 최종 확인 (기존 window.confirm 사용)
    const msg = `기간: ${format(rangeStart, 'MM/dd')}~${format(rangeEnd, 'MM/dd')} (${roomInfo}). 진행하시겠습니까?`;
    if (window.confirm(msg)) {
      onRangeSelect && onRangeSelect(rangeStart, rangeEnd, roomInfo);
      onReturnView && onReturnView();
    }
    setSelectedRange(null);
  };

  const isRoomTypeSelected = (day, roomInfo) => {
    if (!selectedRange) return false;
    if (selectedRange.roomInfo !== roomInfo) return false;
    const [rs, re] = [selectedRange.start, selectedRange.end].sort((a, b) => a - b);
    return day >= rs && day <= re;
  };

  // 팝업 상태: 클릭한 날짜와 클릭 좌표를 저장
  const [popup, setPopup] = useState(null);

  // 날짜 헤더 클릭 시 팝업을 띄움 (window.confirm 대신)
  const handleHeaderClick = (day, e) => {
    e.stopPropagation();
    setPopup({
      day,
      x: e.clientX,
      y: e.clientY,
    });
  };

  const handlePopupConfirm = () => {
    if (popup) {
      onDateNavigate && onDateNavigate(popup.day);
      setPopup(null);
    }
  };

  const handlePopupCancel = () => {
    setPopup(null);
  };

  // 6) 날짜 셀 렌더링
  const renderDayCell = (day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const isOutside = day < calendarStart || day > calendarEnd;
    const isToday = dateStr === format(today, 'yyyy-MM-dd');
    const isWeekend = day.getDay() === 0 || day.getDay() === 6;

    // 해당 날짜의 룸 타입별 잔여 및 미배정 예약
    const remainObj = availabilityByDate[dateStr] || {};
    // assigned 예약의 총 잔여 (미배정은 제외)
    const totalRemaining = Object.entries(remainObj)
      .filter(([key]) => key !== 'unassigned')
      .reduce((acc, [_, count]) => acc + count, 0);

    return (
      <div
        key={dateStr}
        className={`calendar-cell ${isOutside ? 'outside' : ''} ${isToday ? 'today' : ''}`}
      >
        <div className={`cell-header ${isWeekend ? 'weekend' : ''}`}>
          <span
            className="header-date"
            style={{ cursor: 'pointer' }}
            onClick={(e) => handleHeaderClick(day, e)}
          >
            {format(day, 'MM/dd (EEE)', { locale: ko })}
          </span>
          <span className='remain_stock' style={{ fontSize: '0.8rem', marginLeft: 4 }}>
            잔여: {totalRemaining}
          </span>
          {remainObj.unassigned > 0 && (
            <span style={{ fontSize: '0.8rem', marginLeft: 4, color: 'red' }}>
              미배정: {remainObj.unassigned}
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
        <div className="cell-content">
          {roomTypes.map((rt) => {
            const typeKey = (rt.roomInfo || 'standard').toLowerCase();
            const remain = remainObj[typeKey] ?? 0;
            const selected = isRoomTypeSelected(day, rt.roomInfo);

            return (
              <div
                key={rt.roomInfo}
                className={`room-type ${selected ? 'selected-room-type' : ''}`}
                onMouseDown={() => handleRoomTypeMouseDown(day, rt.roomInfo)}
                onMouseEnter={() => handleRoomTypeMouseEnter(day, rt.roomInfo)}
                onMouseUp={handleRoomTypeMouseUp}
              >
                {rt.roomInfo}: {remain}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // UI 렌더링
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
            <span style={{ marginLeft: '4px' }}>{isLocked ? '고정' : '해제'}</span>
          </button>
        </h2>
        {onReturnView && (
          <button className="return-button" onClick={onReturnView}>
            일간예약 보기
          </button>
        )}
      </div>
      {/* 요일 헤더 */}
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

      {/* 클릭한 위치 근처에 팝업을 표시 */}
      {popup && (
        <div
          className="confirm-popup"
          style={{
            top: popup.y,
            left: popup.x,
            position: 'fixed',
          }}
        >
          <p style={{ margin: 0, fontSize: '0.9rem' }}>
            {format(popup.day, 'MM/dd (EEE)', { locale: ko })}의 일간 예약 화면으로 이동하시겠습니까?
          </p>
          <div style={{ marginTop: '8px', textAlign: 'right' }}>
            <button onClick={handlePopupConfirm} style={{ marginRight: '4px' }}>
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
