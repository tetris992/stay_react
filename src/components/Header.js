import React from 'react';
import './Header.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCaretLeft,
  faCaretRight,
  faStickyNote,
  faCalendarAlt, // 달력 아이콘 추가
} from '@fortawesome/free-solid-svg-icons';
import PropTypes from 'prop-types';

function Header({
  selectedDate,
  onDateChange,
  onPrevDay,
  onNextDay,
  onQuickCreate,
  otaToggles,
  onMemo,
  flipAllMemos,
  isShining,
  /* 새로 추가 */
  isMonthlyView,
  toggleMonthlyView,
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
            {/* 메모 버튼 */}
            <button
              className={`memo-button ${flipAllMemos ? 'active' : ''}`}
              onClick={onMemo}
              aria-label="모든 방 카드 메모 플립"
            >
              <FontAwesomeIcon icon={faStickyNote} /> 메모
            </button>

            {/* 월간/일간 뷰 전환 버튼 */}
            <button
              className="view-toggle-button"
              onClick={toggleMonthlyView}
              aria-label="월간/일간 뷰 전환"
            >
              <FontAwesomeIcon icon={faCalendarAlt} style={{ marginRight: 6 }} />
              {isMonthlyView ? '일간 뷰' : '월간 뷰'}
            </button>
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
                className={`status-lamp ${
                  otaToggles[ota] ? 'green' : 'gray'
                }`}
              ></span>
            </div>
          ))}
        </div>

        {/* 오른쪽: Quick-create 버튼 */}
        <div className="header-right">
          <div className="quick-create-buttons">
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
  /* 새로 추가 */
  isMonthlyView: PropTypes.bool.isRequired,
  toggleMonthlyView: PropTypes.func.isRequired,
};

export default Header;
