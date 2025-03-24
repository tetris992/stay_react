import React from 'react';
import './Header.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCaretLeft,
  faCaretRight,
  faStickyNote,
  faCalendarAlt,
  faList,
  faCompress,
  faExpand,
} from '@fortawesome/free-solid-svg-icons';
import PropTypes from 'prop-types';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toZonedTime } from 'date-fns-tz';
import logo from '../assets/StaySync.svg';

function Header({
  selectedDate,
  onPrevDay,
  onNextDay,
  onQuickCreate,
  otaToggles,
  onMemo,
  flipAllMemos,
  isMonthlyView,
  onViewLogs,
  isLogViewerOpen,
  isMinimalModeEnabled,
  onToggleMinimalMode,
  onMonthlyView,
}) {
  // 날짜를 KST로 변환
  const kstDate = toZonedTime(selectedDate, 'Asia/Seoul');
  const dayOfWeek = kstDate.getDay();
  const weekdayName = format(kstDate, 'eeee', { locale: ko });
  const formattedDate = format(kstDate, 'yyyy년 M월 d일', { locale: ko });

  // 이전 날짜
  const handlePrevDay = () => {
    try {
      onPrevDay();
    } catch (error) {
      console.error('[Header] Error on previous day navigation:', error);
      alert('이전 날짜 이동 오류');
    }
  };

  // 다음 날짜
  const handleNextDay = () => {
    try {
      onNextDay();
    } catch (error) {
      console.error('[Header] Error on next day navigation:', error);
      alert('다음 날짜 이동 오류');
    }
  };

  // 빠른 예약 생성
  const handleQuickCreate = (type) => {
    try {
      onQuickCreate(type);
    } catch (error) {
      console.error(`[Header] Error on quick create (${type}):`, error);
      alert('빠른 예약 생성 오류');
    }
  };

  // 메모 버튼
  const handleMemoClick = () => {
    try {
      onMemo();
    } catch (error) {
      console.error('[Header] Error on memo toggle:', error);
      alert('메모 플립 오류');
    }
  };

  // 로그 보기
  const handleViewLogs = () => {
    try {
      onViewLogs();
    } catch (error) {
      console.error('[Header] Error on view logs:', error);
      alert('로그 보기 오류');
    }
  };

  return (
    <div className="header">
      {/* 왼쪽 로고 칸: 전체 높이 차지 */}
      <div className="header-left">
        <a
          href="https://staysync.framer.ai/"
          target="_blank"
          rel="noopener noreferrer"
          className="header-logo-link"
        >
          <img src={logo} alt="STAYSYNC" className="header-logo" />
        </a>
      </div>

      {/* 오른쪽 칸: 2줄 구조 (위: 날짜, 아래: 기타 버튼) */}
      <div className="header-right">
        {/* (1) 위쪽: 날짜 네비게이션 */}
        <div className="header-right-top">
          <button
            className="arrow-button"
            onClick={handlePrevDay}
            aria-label="이전 날짜"
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
            aria-label="다음 날짜"
          >
            <FontAwesomeIcon icon={faCaretRight} />
          </button>
        </div>

        {/* (2) 아래쪽: 메모/로그/월간뷰/단축모드/OTA/빠른예약 */}
        <div className="header-right-bottom">
          {/* 왼쪽: 메모/로그/월간뷰/단축모드 */}
          <div className="header-right-bottom-left">
            <div className="additional-buttons">
              {/* 메모 버튼 */}
              <button
                className={`memo-button ${flipAllMemos ? 'active' : ''}`}
                onClick={handleMemoClick}
              >
                <FontAwesomeIcon icon={faStickyNote} /> 메모
              </button>
              {/* 로그 버튼 */}
              <button
                className={`memo-button ${isLogViewerOpen ? 'active' : ''}`}
                onClick={handleViewLogs}
              >
                <FontAwesomeIcon icon={faList} /> 로그
              </button>
              {/* 월간/일간 뷰 전환 */}
              <button
                className={`memo-button ${isMonthlyView ? 'active' : ''}`}
                onClick={onMonthlyView}
              >
                <FontAwesomeIcon icon={faCalendarAlt} style={{ marginRight: 6 }} />
                {isMonthlyView ? '일간 뷰' : '월간 뷰'}
              </button>
              {/* 단축 모드 */}
              <button
                className={`memo-button ${
                  isMinimalModeEnabled ? 'active' : ''
                }`}
                onClick={onToggleMinimalMode}
              >
                <FontAwesomeIcon
                  icon={isMinimalModeEnabled ? faExpand : faCompress}
                  style={{ marginRight: 6 }}
                />
                {isMinimalModeEnabled ? '일반 모드' : '단축 모드'}
              </button>
            </div>
          </div>

          {/* 중앙: OTA 상태 */}
          <div className="header-ota-status" role="region" aria-label="OTA 상태">
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

          {/* 오른쪽: 빠른예약(박) 버튼 */}
          <div className="header-right-bottom-right">
            <div className="quick-create-buttons">
              <button
                className="quick-button"
                onClick={() => handleQuickCreate('1박')}
              >
                1박
              </button>
              <button
                className="quick-button"
                onClick={() => handleQuickCreate('2박')}
              >
                2박
              </button>
              <button
                className="quick-button"
                onClick={() => handleQuickCreate('3박')}
              >
                3박
              </button>
              <button
                className="quick-button"
                onClick={() => handleQuickCreate('4박')}
              >
                4박
              </button>
              <button
                className="quick-button quick-button-green"
                onClick={() => handleQuickCreate('대실')}
              >
                대실
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

Header.propTypes = {
  selectedDate: PropTypes.instanceOf(Date).isRequired,
  onPrevDay: PropTypes.func.isRequired,
  onNextDay: PropTypes.func.isRequired,
  onQuickCreate: PropTypes.func.isRequired,
  otaToggles: PropTypes.objectOf(PropTypes.bool).isRequired,
  onMemo: PropTypes.func.isRequired,
  flipAllMemos: PropTypes.bool.isRequired,
  isMonthlyView: PropTypes.bool.isRequired,
  onViewLogs: PropTypes.func.isRequired,
  isLogViewerOpen: PropTypes.bool,
  isMinimalModeEnabled: PropTypes.bool.isRequired,
  onToggleMinimalMode: PropTypes.func.isRequired,
  onMonthlyView: PropTypes.func.isRequired,
};

export default Header;
