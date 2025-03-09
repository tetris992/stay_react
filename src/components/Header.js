import React from 'react';
import './Header.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCaretLeft,
  faCaretRight,
  faStickyNote,
  faCalendarAlt,
} from '@fortawesome/free-solid-svg-icons';
import PropTypes from 'prop-types';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toZonedTime } from 'date-fns-tz';

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
  isMonthlyView,
  toggleMonthlyView,
}) {
  // selectedDate를 KST로 변환
  const kstDate = toZonedTime(selectedDate, 'Asia/Seoul');
  const dayOfWeek = kstDate.getDay();
  const weekdayName = format(kstDate, 'eeee', { locale: ko }); // 한국어 요일
  const formattedDate = format(kstDate, 'yyyy년 M월 d일', { locale: ko });

  // 디버깅 로그
  console.log('[Header] Selected date (KST):', kstDate);

  const handlePrevDay = () => {
    try {
      onPrevDay();
    } catch (error) {
      console.error('[Header] Error on previous day navigation:', error);
      alert('이전 날짜로 이동하는 중 오류가 발생했습니다.');
    }
  };

  const handleNextDay = () => {
    try {
      onNextDay();
    } catch (error) {
      console.error('[Header] Error on next day navigation:', error);
      alert('다음 날짜로 이동하는 중 오류가 발생했습니다.');
    }
  };

  const handleQuickCreate = (type) => {
    try {
      onQuickCreate(type);
    } catch (error) {
      console.error(`[Header] Error on quick create (${type}):`, error);
      alert('빠른 예약 생성 중 오류가 발생했습니다.');
    }
  };

  const handleToggleMonthlyView = () => {
    try {
      toggleMonthlyView();
    } catch (error) {
      console.error('[Header] Error on toggling monthly view:', error);
      alert('뷰 전환 중 오류가 발생했습니다.');
    }
  };

  const handleMemoClick = () => {
    try {
      onMemo();
    } catch (error) {
      console.error('[Header] Error on memo toggle:', error);
      alert('메모 플립 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="header">
      {/* 첫 번째 줄: 날짜 네비게이션 */}
      <div className="header-center">
        <div className="date-navigation">
          <button
            className="arrow-button"
            onClick={handlePrevDay}
            aria-label="이전 날짜로 이동"
          >
            <FontAwesomeIcon icon={faCaretLeft} />
          </button>

          <span className="selected-date">
            {formattedDate}
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
            onClick={handleNextDay}
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
              onClick={handleMemoClick}
              aria-label="모든 방 카드 메모 플립"
            >
              <FontAwesomeIcon icon={faStickyNote} /> 메모
            </button>

            {/* 월간/일간 뷰 전환 버튼 */}
            <button
              className="view-toggle-button"
              onClick={handleToggleMonthlyView}
              aria-label="월간/일간 뷰 전환"
            >
              <FontAwesomeIcon
                icon={faCalendarAlt}
                style={{ marginRight: 6 }}
              />
              {isMonthlyView ? '일간 뷰' : '월간 뷰'}
            </button>
          </div>
        </div>

        {/* 중앙: OTA 상태 표시 */}
        <div
          className="header-ota-status"
          role="region"
          aria-label="OTA 상태 목록"
        >
          {Object.keys(otaToggles).map((ota) => (
            <div
              key={ota}
              className={`ota-status-item ${
                otaToggles[ota] ? 'active' : 'inactive'
              }`}
              aria-label={`${ota} 상태: ${
                otaToggles[ota] ? '활성화' : '비활성화'
              }`}
            >
              <span>{ota}</span>
              <span
                className={`status-lamp ${otaToggles[ota] ? 'green' : 'gray'}`}
              ></span>
            </div>
          ))}
        </div>

        {/* 오른쪽: Quick-create 버튼 */}
        <div className="header-right">
          <div className="quick-create-buttons">
            <button
              className="quick-button"
              onClick={() => handleQuickCreate('1박')}
              aria-label="1박 예약 생성"
            >
              1박
            </button>
            <button
              className="quick-button"
              onClick={() => handleQuickCreate('2박')}
              aria-label="2박 예약 생성"
            >
              2박
            </button>
            <button
              className="quick-button"
              onClick={() => handleQuickCreate('3박')}
              aria-label="3박 예약 생성"
            >
              3박
            </button>
            <button
              className="quick-button"
              onClick={() => handleQuickCreate('4박')}
              aria-label="4박 예약 생성"
            >
              4박
            </button>
            <button
              className="quick-button quick-button-green"
              onClick={() => handleQuickCreate('대실')}
              aria-label="대실 예약 생성"
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
  otaToggles: PropTypes.objectOf(PropTypes.bool).isRequired, // 더 구체적으로 정의
  onMemo: PropTypes.func.isRequired,
  flipAllMemos: PropTypes.bool.isRequired,
  isMonthlyView: PropTypes.bool.isRequired,
  toggleMonthlyView: PropTypes.func.isRequired,
};

export default Header;
