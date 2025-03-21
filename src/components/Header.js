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
  faExpand, // 단축 모드 해제 아이콘 추가
} from '@fortawesome/free-solid-svg-icons';
import PropTypes from 'prop-types';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toZonedTime } from 'date-fns-tz';

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
  onToggleMinimalMode, //이건 필요한거 아닌가 ? 지금 비활성화 됨 ! 단축모드 토글과 관계없나 ? 
  onMonthlyView,
}) {
  // selectedDate를 KST로 변환
  const kstDate = toZonedTime(selectedDate, 'Asia/Seoul');
  const dayOfWeek = kstDate.getDay();
  const weekdayName = format(kstDate, 'eeee', { locale: ko });
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

  // const handleToggleMonthlyView = () => {
  //   try {
  //     toggleMonthlyView();
  //   } catch (error) {
  //     console.error('[Header] Error on toggling monthly view:', error);
  //     alert('뷰 전환 중 오류가 발생했습니다.');
  //   }
  // };

  const handleMemoClick = () => {
    try {
      onMemo();
    } catch (error) {
      console.error('[Header] Error on memo toggle:', error);
      alert('메모 플립 중 오류가 발생했습니다.');
    }
  };

  const handleViewLogs = () => {
    try {
      onViewLogs();
    } catch (error) {
      console.error('[Header] Error on view logs:', error);
      alert('로그 보기 중 오류가 발생했습니다.');
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

      {/* 두 번째 줄: 메모 버튼, 로그 보기, 월간 뷰/일간 뷰, 단축 모드, OTA 상태, Quick-create 버튼 */}
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

            {/* 로그 보기 버튼 */}
            <button
              className={`memo-button ${isLogViewerOpen ? 'active' : ''}`}
              onClick={handleViewLogs}
              aria-label="로그 보기"
            >
              <FontAwesomeIcon icon={faList} /> 과거내역확인
            </button>

            {/* 월간/일간 뷰 전환 버튼 */}
            <button
              className={`memo-button ${isMonthlyView ? 'active' : ''}`}
              onClick={onMonthlyView}
              aria-label="월간/일간 뷰 전환"
            >
              <FontAwesomeIcon
                icon={faCalendarAlt}
                style={{ marginRight: 6 }}
              />
              {isMonthlyView ? '일간 뷰' : '월간 뷰'}
            </button>

            {/* 단축 모드 토글 버튼 */}
            <button
              className={`memo-button ${isMinimalModeEnabled ? 'active' : ''}`}
              onClick={onToggleMinimalMode}
              aria-label="단축 모드 토글"
            >
              <FontAwesomeIcon
                icon={isMinimalModeEnabled ? faExpand : faCompress}
                style={{ marginRight: 6 }}
              />
              {isMinimalModeEnabled ? '일반 모드' : '단축 모드'}
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

        {/* 오른쪽: Quick-create 버튼들 */}
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
  onPrevDay: PropTypes.func.isRequired,
  onNextDay: PropTypes.func.isRequired,
  onQuickCreate: PropTypes.func.isRequired,
  otaToggles: PropTypes.objectOf(PropTypes.bool).isRequired,
  onMemo: PropTypes.func.isRequired,
  flipAllMemos: PropTypes.bool.isRequired,
  isMonthlyView: PropTypes.bool.isRequired,
  onMonthlyView: PropTypes.func.isRequired,
  onViewLogs: PropTypes.func.isRequired,
  isLogViewerOpen: PropTypes.bool,
  isMinimalModeEnabled: PropTypes.bool.isRequired,
  onToggleMinimalMode: PropTypes.func.isRequired,
};

export default Header;
