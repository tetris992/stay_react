// src/components/Header.js
import React from 'react';
import './Header.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCaretLeft,
  faCaretRight,
  faStickyNote,
} from '@fortawesome/free-solid-svg-icons';
import PropTypes from 'prop-types';

/**
 * Header 컴포넌트
 * - 날짜 네비게이션, 메모 버튼, OTA 상태 표시, 월간 예약/Quick-create 버튼을 표시합니다.
 * - 정렬 관련 기능은 제거되었습니다.
 */
function Header({
  selectedDate,
  onDateChange,
  onPrevDay,
  onNextDay,
  onQuickCreate,
  otaToggles,
  onMemo,
  flipAllMemos,
  onMonthlyView,
  isShining,
}) {
  const dayOfWeek = selectedDate.getDay();
  const weekdayName = selectedDate.toLocaleDateString('ko-KR', {
    weekday: 'long',
  });

  return (
    <div className="header">
      {/* 첫 번째 줄: 날짜 네비게이션 */}
      <div className="header-center">
        <div className="date-navigation">
          <button
            className="arrow-button"
            onClick={onPrevDay}
            aria-label="이전 날짜로 이동"
          >
            <FontAwesomeIcon icon={faCaretLeft} />
          </button>

          <span className="selected-date">
            {selectedDate.toLocaleDateString('ko-KR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
            <span
              className={`weekday ${
                dayOfWeek === 0 || dayOfWeek === 6 ? 'weekend' : ''
              }`}
            >
              {weekdayName}
            </span>
          </span>

          <button
            className="arrow-button"
            onClick={onNextDay}
            aria-label="다음 날짜로 이동"
          >
            <FontAwesomeIcon icon={faCaretRight} />
          </button>
        </div>
      </div>

      {/* 두 번째 줄: 메모 버튼, OTA 상태, Quick-create 버튼 */}
      <div className="header-bottom">
        <div className="header-left">
          <div className="additional-buttons">
            <button
              className={`memo-button ${flipAllMemos ? 'active' : ''}`}
              onClick={onMemo}
              aria-label="모든 방 카드 메모 플립"
            >
              <FontAwesomeIcon icon={faStickyNote} /> 메모
            </button>
            {/* {hasLowStock &&
              lowStockRoomTypes &&
              lowStockRoomTypes.length > 0 && (
                <span className="low-stock-header-warning" title="재고 부족">
                  ⚠️ {lowStockRoomTypes.join(', ')} 재고확인
                </span>
              )} */}
          </div>
        </div>

        {/* 중앙: OTA 상태 표시 */}
        <div className="header-ota-status">
          {Object.keys(otaToggles).map((ota) => (
            <div
              key={ota}
              className={`ota-status-item ${
                otaToggles[ota] ? 'active' : 'inactive'
              }`}
            >
              <span>{ota}</span>
              <span
                className={`status-lamp ${otaToggles[ota] ? 'green' : 'gray'}`}
              ></span>
            </div>
          ))}
        </div>

        {/* 오른쪽: 월간 예약 버튼과 Quick-create 버튼 */}
        <div className="header-right">
          <div className="quick-create-buttons">
            <button
              className="monthly-view-button"
              onClick={onMonthlyView}
              aria-label="월간 예약 현황 보기"
            >
              객실 재고확인
            </button>
            <button
              className="quick-button"
              onClick={() => onQuickCreate('1박')}
            >
              1박
            </button>
            <button
              className="quick-button"
              onClick={() => onQuickCreate('2박')}
            >
              2박
            </button>
            <button
              className="quick-button"
              onClick={() => onQuickCreate('3박')}
            >
              3박
            </button>
            <button
              className="quick-button"
              onClick={() => onQuickCreate('4박')}
            >
              4박
            </button>
            <button
              className="quick-button quick-button-green"
              onClick={() => onQuickCreate('대실')}
            >
              대실
            </button>
          </div>
        </div>
      </div>

      {/* 투명도 효과 영역 */}
      <div className="header-fade"></div>
    </div>
  );
}

// PropTypes 정의 (정렬 관련 Prop은 제거됨)
Header.propTypes = {
  selectedDate: PropTypes.instanceOf(Date).isRequired,
  onDateChange: PropTypes.func.isRequired,
  onPrevDay: PropTypes.func.isRequired,
  onNextDay: PropTypes.func.isRequired,
  onQuickCreate: PropTypes.func.isRequired,
  isShining: PropTypes.bool.isRequired,
  otaToggles: PropTypes.object.isRequired,
  onMemo: PropTypes.func.isRequired,
  flipAllMemos: PropTypes.bool.isRequired,
  // hasLowStock: PropTypes.bool,
  // lowStockRoomTypes: PropTypes.arrayOf(PropTypes.string),
  onMonthlyView: PropTypes.func.isRequired,
};

export default Header;
