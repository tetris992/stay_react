import React, { useMemo, useState } from 'react';
import {
  format,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  addDays,
  startOfWeek,
  endOfWeek,
} from 'date-fns';
import { ko } from 'date-fns/locale'; // 한국어 locale 임포트
import { FaLock, FaLockOpen } from 'react-icons/fa';
import './MonthlyCalendar.css';

/**
 * 각 날짜별 객실 재고 계산 (예시)
 * 실제 로직은 예약 데이터와 객실타입 총 재고에 따라 달라질 수 있음.
 */
const getInventoryForDate = (date, roomTypes, reservations = []) => {
  const inventory = {};
  roomTypes.forEach((rt) => {
    inventory[rt.type] = Number(rt.stock) || 0;
  });
  reservations.forEach((res) => {
    const checkIn = new Date(res.checkIn);
    const checkOut = new Date(res.checkOut);
    // 날짜(연-월-일)만 비교
    const dayStr = format(date, 'yyyy-MM-dd');
    const inStr = format(checkIn, 'yyyy-MM-dd');
    const outStr = format(checkOut, 'yyyy-MM-dd');
    if (dayStr >= inStr && dayStr < outStr) {
      const rt = res.roomInfo;
      if (inventory[rt] !== undefined) {
        inventory[rt] -= 1;
      }
    }
  });
  return inventory;
};

const MonthlyCalendar = ({
  roomTypes,
  reservations,
  currentDate,
  onRangeSelect,
  onReturnView,
}) => {
  // 오늘 날짜부터 시작하여 2개월(오늘부터 다음 달 말일까지) 표시
  const calendarStart = useMemo(() => new Date(), []);
  const calendarEnd = useMemo(() => endOfMonth(addMonths(new Date(), 1)), []);

  // 고정(잠금) 여부 상태 – true이면 요일 헤더 및 그리드가 고정됨
  const [isLocked, setIsLocked] = useState(true);

  // 고정모드일 때는 달력의 시작/끝을 해당 주의 일요일/토요일로 보정하여 주 단위로 고정
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

  // 드래그 범위 선택 상태: { roomType, start, end }
  const [selectedRange, setSelectedRange] = useState(null);

  // 개별 객실타입 영역에서 마우스 다운 시 선택 시작
  const handleRoomTypeMouseDown = (day, roomType) => {
    setSelectedRange({ roomType, start: day, end: day });
  };

  // 같은 객실타입 영역에서 마우스 엔터 시 선택 범위 업데이트
  const handleRoomTypeMouseEnter = (day, roomType) => {
    if (selectedRange && selectedRange.roomType === roomType) {
      setSelectedRange((prev) => ({ ...prev, end: day }));
    }
  };

  // 드래그가 끝나면 선택 범위를 확정하고 재고 확인 후, 확인 메시지 표시
  const handleRoomTypeMouseUp = () => {
    if (selectedRange) {
      const { roomType, start, end } = selectedRange;
      const rangeStart = start < end ? start : end;
      const rangeEnd = start < end ? end : start;

      // 선택한 범위 내에 재고가 부족한 날짜가 있는지 확인
      let insufficientDays = [];
      let current = rangeStart;
      while (current <= rangeEnd) {
        const inventory = getInventoryForDate(current, roomTypes, reservations);
        if (inventory[roomType] <= 0) {
          insufficientDays.push(
            format(current, 'yyyy년 MM월 dd일 (eee)', { locale: ko })
          );
        }
        current = addDays(current, 1);
      }
      if (insufficientDays.length > 0) {
        alert(
          `경고: ${insufficientDays.join(
            ', '
          )}에 ${roomType} 객실 재고가 부족합니다.`
        );
        setSelectedRange(null);
        return;
      }

      // 확인 메시지 표시: 선택한 기간에 예약을 진행할지 확인
      const confirmMessage = `선택한 기간 (${format(
        rangeStart,
        'yyyy년 MM월 dd일',
        { locale: ko }
      )} ~ ${format(rangeEnd, 'yyyy년 MM월 dd일', {
        locale: ko,
      })})에 ${roomType} 객실 예약을 진행하시겠습니까?`;
      if (window.confirm(confirmMessage)) {
        if (typeof onRangeSelect === 'function') {
          onRangeSelect(rangeStart, rangeEnd, roomType);
        }
        // 선택 후 월간 모드 닫기
        if (typeof onReturnView === 'function') {
          onReturnView();
        }
      }
      setSelectedRange(null);
    }
  };

  // 해당 날짜와 객실타입이 선택된 범위 내에 있는지 판단
  const isRoomTypeSelected = (day, roomType) => {
    if (!selectedRange) return false;
    if (selectedRange.roomType !== roomType) return false;
    const rangeStart =
      selectedRange.start < selectedRange.end
        ? selectedRange.start
        : selectedRange.end;
    const rangeEnd =
      selectedRange.start < selectedRange.end
        ? selectedRange.end
        : selectedRange.start;
    return day >= rangeStart && day <= rangeEnd;
  };

  // 각 날짜별 총 잔여재고(모든 객실타입 합계)를 계산하는 헬퍼 함수
  const getTotalInventory = (date) => {
    const inventory = getInventoryForDate(date, roomTypes, reservations);
    return Object.values(inventory).reduce((sum, val) => sum + val, 0);
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
            {isLocked ? (
              <FaLock className="lock-icon" />
            ) : (
              <FaLockOpen className="lock-icon" />
            )}
            <span className="lock-text">{isLocked ? '고정' : '고정 해제'}</span>
          </button>
        </h2>
        {onReturnView && (
          <button className="return-button" onClick={onReturnView}>
            일간예약 보기
          </button>
        )}
      </div>

      {/* 고정된 요일 헤더: locked 상태일 때 보임 */}
      {isLocked && (
        <div className="weekday-header">
          {['일', '월', '화', '수', '목', '금', '토'].map((dayName) => {
            const isWeekend = dayName === '일' || dayName === '토';
            return (
              <div
                key={dayName}
                className={`weekday-cell ${isWeekend ? 'weekend' : ''}`}
              >
                {dayName}
              </div>
            );
          })}
        </div>
      )}
      {/* 고정모드일 때 .locked 클래스를 추가하여 그리드 컬럼을 7열로 고정 */}
      <div className={`calendar-grid ${isLocked ? 'locked' : ''}`}>
        {days.map((day) => {
          // 달력 범위(calendarStart ~ calendarEnd) 밖의 날짜는 흐리게 표시 (옵션)
          const isOutside = day < calendarStart || day > calendarEnd;
          const inventory = getInventoryForDate(day, roomTypes, reservations);
          const totalInventory = getTotalInventory(day);
          const isWeekend = day.getDay() === 0 || day.getDay() === 6;
          return (
            <div
              key={format(day, 'yyyy-MM-dd')}
              className={`calendar-cell ${isOutside ? 'outside' : ''}`}
            >
              <div className={`cell-header ${isWeekend ? 'weekend' : ''}`}>
                {format(day, 'dd (eee)', { locale: ko })} [잔여:{' '}
                {totalInventory}]
              </div>
              <div className="cell-content">
                {roomTypes.map((rt) => {
                  const selected = isRoomTypeSelected(day, rt.type);
                  return (
                    <div
                      key={rt.type}
                      className={`room-type ${
                        selected ? 'selected-room-type' : ''
                      }`}
                      onMouseDown={() => handleRoomTypeMouseDown(day, rt.type)}
                      onMouseEnter={() =>
                        handleRoomTypeMouseEnter(day, rt.type)
                      }
                      onMouseUp={handleRoomTypeMouseUp}
                    >
                      {rt.type} : {inventory[rt.type] ?? 0}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MonthlyCalendar;
