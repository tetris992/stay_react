import React, { useState } from 'react';
import PropTypes from 'prop-types';
import AccountingInfo from './AccountingInfo';
import { useNavigate } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import { ko } from 'date-fns/locale';
import { toZonedTime, format } from 'date-fns-tz';
import 'react-datepicker/dist/react-datepicker.css';
import './SideBar.css';
// import logo from '../assets/StaySync.svg'; //해드로 이동

import VoiceSearch from './VoiceSearch';
import Search from './Search';
import {
  FaCog,
  FaChevronDown,
  FaChevronUp,
  FaSignOutAlt,
  FaCircleNotch,
  FaTimesCircle,
  FaCalendarAlt,
  FaBed,
  FaChartLine,
  FaTools,
} from 'react-icons/fa';
import ScrapeNowButton from './ScrapeNowButton';
import availableOTAs from '../config/availableOTAs';
import RoomStatusChart from './RoomStatusChart';
import SalesGraphModal from './SalesGraphModal';

// 한국 공휴일 데이터 (2025년 예시)
const koreanHolidays2025 = [
  '2025-01-01', // 신정
  '2025-01-28', // 설날 연휴
  '2025-01-29', // 설날
  '2025-01-30', // 설날 연휴
  '2025-03-01', // 삼일절
  '2025-05-05', // 어린이날
  '2025-05-06', // 대체공휴일(어린이날)
  '2025-05-08', // 석가탄신일
  '2025-06-06', // 현충일
  '2025-08-15', // 광복절
  '2025-10-03', // 개천절
  '2025-10-05', // 추석 연휴
  '2025-10-06', // 추석
  '2025-10-07', // 추석 연휴
  '2025-10-09', // 한글날
  '2025-12-25', // 크리스마스
];

function SideBar({
  loading,
  onSync,
  setIsShining,
  dailyTotal,
  monthlyTotal,
  roomsSold,
  occupancyRate,
  selectedDate,
  onDateChange,
  totalRooms,
  remainingRooms,
  monthlySoldRooms,
  avgMonthlyRoomPrice,
  onLogout,
  dailyBreakdown,
  monthlyDailyBreakdown,
  openSalesModal,
  hotelId,
  otaToggles,
  onToggleOTA,
  searchCriteria,
  setSearchCriteria,
  executeSearch,
  onShowCanceledModal,
  needsConsent,
  dailySalesByOTA,
  labelsForOTA,
  dailySalesReport,
}) {
  const [highlightEffect, setHighlightEffect] = useState('');
  const [isGraphModalOpen, setIsGraphModalOpen] = useState(false);
  const [isOtaSettingsOpen, setIsOtaSettingsOpen] = useState(false);

  const navigate = useNavigate();

  // 동기화 버튼
  const handleSyncClick = () => {
    setIsShining(true);
    onSync();
    setTimeout(() => setIsShining(false), 5000);
  };

  // 호텔 설정 이동
  const handleSettingsClick = () => {
    navigate('/hotel-settings');
  };

  // 날짜 변경 핸들러 (KST 변환)
  const handleDateChangeInternal = (date) => {
    try {
      const kstDate = toZonedTime(date, 'Asia/Seoul');
      console.log('[SideBar] Date changed to:', kstDate);
      onDateChange(kstDate);
    } catch (error) {
      console.error('[SideBar] Date change error:', error);
      alert('날짜 선택에 실패했습니다.');
    }
  };

  // 음성 검색 결과
  const handleVoiceResult = (transcript) => {
    try {
      setSearchCriteria({ ...searchCriteria, name: transcript });
      setTimeout(() => {
        executeSearch(transcript);
      }, 1000);
    } catch (error) {
      console.error('[SideBar] Voice search error:', error);
      alert('음성 검색에 실패했습니다.');
    }
  };

  // 시각적 이펙트(블링크 등)
  const triggerVisualEffect = (effectType) => {
    if (effectType === 'battery') {
      setHighlightEffect('blink');
      setTimeout(() => setHighlightEffect(''), 2000);
    }
  };

  // 일반 검색 제출
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    executeSearch(searchCriteria.name || '');
    setTimeout(() => {
      setSearchCriteria({ ...searchCriteria, name: '' });
    }, 1000);
  };

  // 활성화된 OTA
  const activeOTAs = availableOTAs.filter((ota) => otaToggles?.[ota]);

  // 매출 그래프 모달 열기/닫기
  const handleOpenGraphModal = () => setIsGraphModalOpen(true);
  const handleCloseGraphModal = () => setIsGraphModalOpen(false);

  // 그래프용 데이터
  const dailySales = { labels: labelsForOTA, values: [] };
  const monthlySales = { labels: ['현재월'], values: [monthlyTotal.total] };

  // 주말·공휴일 표시용 dayClassName
  const getDayClassName = (date) => {
    const dayOfWeek = date.getDay(); // 일(0) ~ 토(6)
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const dateStr = format(date, 'yyyy-MM-dd');
    const isHoliday = koreanHolidays2025.includes(dateStr);

    if (isHoliday) return 'holiday';
    if (isWeekend) return 'weekend';
    return '';
  };

  return (
    <div
      className={`sidebar ${
        highlightEffect === 'blink' ? 'highlight-blink' : ''
      }`}
    >
      <div className="sidebar-header">

      </div>

      <Search
        searchCriteria={searchCriteria}
        setSearchCriteria={setSearchCriteria}
        handleSearchSubmit={handleSearchSubmit}
        className="sidebar-search-input"
      />
      <VoiceSearch
        onResult={handleVoiceResult}
        triggerVisualEffect={triggerVisualEffect}
      />

      {/* 동기화 / 설정 / 로그아웃 / 취소예약확인 */}
      <div className="sync-section">
        <button
          className={`settings-button ${needsConsent ? 'blink-button' : ''}`}
          onClick={handleSettingsClick}
          aria-label="호텔 설정 페이지로 이동"
        >
          <FaCog className="settings-icon" />
          <span className="btn-text">호텔 설정</span>
        </button>
        <button
          className="sync-button"
          onClick={handleSyncClick}
          disabled={loading}
          aria-label="서버 동기화"
        >
          <FaCircleNotch className={`sync-icon ${loading ? 'spinning' : ''}`} />
          <span className="btn-text">
            {loading ? '동기화 중...' : '서버 동기화'}
          </span>
        </button>
        <ScrapeNowButton
          hotelId={hotelId}
          activeOTAs={activeOTAs}
          aria-label="즉시 스크래핑"
        />
        <button
          className="cancelSearch-button"
          onClick={onShowCanceledModal}
          aria-label="취소 예약 확인"
        >
          <FaTimesCircle className="cancel-icon" />
          <span className="btn-text">취소 예약 확인</span>
        </button>
        <button
          className="logout-button"
          onClick={onLogout}
          aria-label="로그아웃"
        >
          <FaSignOutAlt className="logout-icon" />
          <span className="btn-text">로그 아웃</span>
        </button>
      </div>

      {/* 날짜 선택 달력 */}
      <div className="date-picker-section">
        <h4 className="section-title">
          <FaCalendarAlt className="section-icon" />
          <span className="section-text">날짜 선택</span>
        </h4>
        <div className="date-picker-row">
          <DatePicker
            selected={selectedDate}
            onChange={handleDateChangeInternal}
            dateFormat="P"
            locale={ko}
            inline
            monthsShown={1}
            dayClassName={getDayClassName} // 주말·공휴일 클래스 부여
            aria-label="날짜 선택 캘린더"
          />
        </div>
      </div>

      {/* 객실 상태 */}
      <div className="room-status-section">
        <h4 className="section-title">
          <FaBed className="section-icon" />
          <span className="section-text">객실 상태</span>
        </h4>
        <div className="room-status-content">
          <RoomStatusChart
            totalRooms={totalRooms}
            roomsSold={roomsSold}
            remainingRooms={remainingRooms}
            aria-label="객실 상태 차트"
          />
        </div>
      </div>

      {/* 매출 정보 */}
      <AccountingInfo
        dailyTotal={dailyTotal}
        monthlyTotal={monthlyTotal}
        occupancyRate={occupancyRate}
        roomsSold={roomsSold}
        monthlySoldRooms={monthlySoldRooms}
        avgMonthlyRoomPrice={avgMonthlyRoomPrice}
        dailyBreakdown={dailyBreakdown}
        monthlyDailyBreakdown={monthlyDailyBreakdown}
        openSalesModal={openSalesModal}
        openGraphModal={handleOpenGraphModal}
        dailySalesReport={dailySalesReport}
        selectedDate={selectedDate}
      >
        <h4 className="section-title">
          <FaChartLine className="section-icon" />
          <span className="section-text">매출정보</span>
        </h4>
      </AccountingInfo>

      {/* OTA 설정 (토글) */}
      <div className="ota-settings-section">
        <div
          className="ota-settings-header"
          onClick={() => setIsOtaSettingsOpen((prev) => !prev)}
          aria-label="OTA 설정 토글"
        >
          <h4 className="section-title">
            <FaTools className="section-icon" />
            <span className="section-text">OTA 설정</span>
          </h4>
          {isOtaSettingsOpen ? <FaChevronUp /> : <FaChevronDown />}
        </div>
        {isOtaSettingsOpen && (
          <div className="ota-toggles" role="region" aria-label="OTA 토글 목록">
            {availableOTAs.map((ota) => (
              <label key={ota}>
                <input
                  type="checkbox"
                  checked={otaToggles?.[ota] || false}
                  onChange={() => onToggleOTA(ota)}
                  aria-label={`${ota} 토글`}
                />
                {ota}
              </label>
            ))}
          </div>
        )}
      </div>

      {/* 매출 그래프 모달 */}
      <SalesGraphModal
        isOpen={isGraphModalOpen}
        onRequestClose={handleCloseGraphModal}
        monthlySales={monthlySales}
        monthlyDailyBreakdown={monthlyDailyBreakdown}
        selectedDate={selectedDate}
        dailySales={dailySales}
        dailySalesByOTA={dailySalesByOTA}
        maxRooms={totalRooms}
        aria-label="매출 그래프 모달"
      />

      {/* 하단 푸터 */}
      <div className="sidebar-footer">
        <div className="footer-divider" />
        <p>
          Zero to One, Inc. - STAYSYNC is distributed for free and is supported
          by voluntary donations. By using this service, you are considered to
          have agreed to the{' '}
          <a
            href="https://staysync.framer.ai/privacypolicy"
            target="_blank"
            rel="noopener noreferrer"
          >
            Terms of Service
          </a>{' '}
          and{' '}
          <a
            href="https://staysync.framer.ai/privacypolicy"
            target="_blank"
            rel="noopener noreferrer"
          >
            the Privacy Policy
          </a>
          . Donations are optional, and refunds are not supported. Thank you for
          your generous support.
        </p>
        <div className="footer-divider" />
      </div>
    </div>
  );
}

SideBar.propTypes = {
  loading: PropTypes.bool.isRequired,
  onSync: PropTypes.func.isRequired,
  setIsShining: PropTypes.func.isRequired,
  dailyTotal: PropTypes.shape({
    total: PropTypes.number,
    paymentTotals: PropTypes.object,
    typeTotals: PropTypes.object,
    dailyBreakdown: PropTypes.array,
  }).isRequired,
  monthlyTotal: PropTypes.shape({
    total: PropTypes.number,
    paymentTotals: PropTypes.object,
    typeTotals: PropTypes.object,
  }).isRequired,
  roomsSold: PropTypes.number.isRequired,
  occupancyRate: PropTypes.number.isRequired,
  selectedDate: PropTypes.instanceOf(Date).isRequired,
  onDateChange: PropTypes.func.isRequired,
  totalRooms: PropTypes.number.isRequired,
  remainingRooms: PropTypes.number.isRequired,
  monthlySoldRooms: PropTypes.number.isRequired,
  avgMonthlyRoomPrice: PropTypes.number.isRequired,
  onLogout: PropTypes.func.isRequired,
  dailyBreakdown: PropTypes.arrayOf(PropTypes.number).isRequired,
  monthlyDailyBreakdown: PropTypes.arrayOf(
    PropTypes.shape({
      Total: PropTypes.number,
      Cash: PropTypes.number,
      Card: PropTypes.number,
      OTA: PropTypes.number,
      Pending: PropTypes.number,
      현장숙박: PropTypes.number,
      현장대실: PropTypes.number,
    })
  ).isRequired,
  openSalesModal: PropTypes.func.isRequired,
  hotelId: PropTypes.string.isRequired,
  hotelSettings: PropTypes.shape({
    hotelAddress: '주소 정보 없음',
    phoneNumber: '전화번호 정보 없음',
    email: '이메일 정보 없음',
    totalRooms: 0,
    roomTypes: [],
    gridSettings: {},
  }),
  otaToggles: PropTypes.objectOf(PropTypes.bool).isRequired,
  onToggleOTA: PropTypes.func.isRequired,
  searchCriteria: PropTypes.shape({
    name: PropTypes.string,
    reservationNo: PropTypes.string,
    checkInDate: PropTypes.string,
    checkOutDate: PropTypes.string,
  }).isRequired,
  setSearchCriteria: PropTypes.func.isRequired,
  executeSearch: PropTypes.func.isRequired,
  onShowCanceledModal: PropTypes.func.isRequired,
  needsConsent: PropTypes.bool.isRequired,
  dailySalesByOTA: PropTypes.objectOf(PropTypes.arrayOf(PropTypes.number))
    .isRequired,
  labelsForOTA: PropTypes.arrayOf(PropTypes.string).isRequired,
  activeReservations: PropTypes.arrayOf(PropTypes.object).isRequired,
  dailySalesReport: PropTypes.array.isRequired,
};

export default SideBar;
