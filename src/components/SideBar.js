import React, { useState } from 'react';
import PropTypes from 'prop-types';
import AccountingInfo from './AccountingInfo';
import { useNavigate } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import { ko } from 'date-fns/locale';
import { toZonedTime, format } from 'date-fns-tz';
import { differenceInCalendarDays, startOfDay, startOfMonth } from 'date-fns';
import 'react-datepicker/dist/react-datepicker.css';
import './SideBar.css';

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

const koreanHolidays2025 = [
  '2025-01-01',
  '2025-01-28',
  '2025-01-29',
  '2025-01-30',
  '2025-03-01',
  '2025-05-05',
  '2025-05-06',
  '2025-05-08',
  '2025-06-06',
  '2025-08-15',
  '2025-10-03',
  '2025-10-05',
  '2025-10-06',
  '2025-10-07',
  '2025-10-09',
  '2025-12-25',
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
  labelsForOTA = [],
  dailySalesReport,
  handleCardFlip,
}) {
  const [highlightEffect, setHighlightEffect] = useState('');
  const [isGraphModalOpen, setIsGraphModalOpen] = useState(false);
  const [isOtaSettingsOpen, setIsOtaSettingsOpen] = useState(false);

  const navigate = useNavigate();

  const handleSyncClick = () => {
    setIsShining(true);
    onSync();
    setTimeout(() => setIsShining(false), 5000);
  };

  const handleSettingsClick = () => {
    navigate('/hotel-settings');
  };

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

  const triggerVisualEffect = (effectType) => {
    if (effectType === 'battery') {
      setHighlightEffect('blink');
      setTimeout(() => setHighlightEffect(''), 2000);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    executeSearch(searchCriteria.name || '', handleCardFlip);
    setTimeout(() => {
      setSearchCriteria({ ...searchCriteria, name: '' });
    }, 1000);
  };

  const activeOTAs = availableOTAs.filter((ota) => otaToggles?.[ota]);

  const handleOpenGraphModal = () => setIsGraphModalOpen(true);
  const handleCloseGraphModal = () => setIsGraphModalOpen(false);

  const dailySales = { labels: labelsForOTA, values: [] };
  const monthlySales = { labels: ['현재월'], values: [monthlyTotal?.total || 0] };

  const getDayClassName = (date) => {
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const dateStr = format(date, 'yyyy-MM-dd');
    const isHoliday = koreanHolidays2025.includes(dateStr);

    if (isHoliday) return 'holiday';
    if (isWeekend) return 'weekend';
    return '';
  };

  const selectedDateIndex = differenceInCalendarDays(
    startOfDay(selectedDate),
    startOfMonth(selectedDate)
  );
  const selectedBreakdown =
    selectedDateIndex >= 0 && selectedDateIndex < monthlyDailyBreakdown.length
      ? monthlyDailyBreakdown[selectedDateIndex]
      : { Total: 0, Cash: 0, Card: 0, OTA: 0, Pending: 0, 현장숙박: 0, 현장대실: 0 };

  console.log(
    `[SideBar] Selected Breakdown for ${format(selectedDate, 'yyyy-MM-dd')}:`,
    selectedBreakdown
  );

  console.log('[SideBar] dailyTotal:', dailyTotal);
  console.log('[SideBar] monthlyTotal:', monthlyTotal);
  console.log('[SideBar] dailySalesReport:', dailySalesReport);
  console.log('[SideBar] dailyBreakdown:', dailyBreakdown);
  console.log('[SideBar] monthlyDailyBreakdown:', monthlyDailyBreakdown);

  return (
    <div
      className={`sidebar ${
        highlightEffect === 'blink' ? 'highlight-blink' : ''
      }`}
    >
      <div className="sidebar-header"></div>
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
          <span className="btn-text" style={{ color: 'red' }}>
            로그 아웃
          </span>
        </button>
      </div>

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
            dayClassName={getDayClassName}
            aria-label="날짜 선택 캘린더"
          />
        </div>
      </div>

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

      {/* "매출정보" 제목을 박스 바깥으로 이동 */}
      <div className="accounting-section">
        <h4 className="section-title">
          <FaChartLine className="section-icon" />
          <span className="section-text">매출 정보</span>
        </h4>
        <AccountingInfo
          dailyTotal={dailyTotal}
          monthlyTotal={monthlyTotal}
          occupancyRate={occupancyRate}
          roomsSold={roomsSold}
          monthlySoldRooms={monthlySoldRooms}
          avgMonthlyRoomPrice={avgMonthlyRoomPrice}
          dailyBreakdown={dailyBreakdown}
          monthlyDailyBreakdown={selectedBreakdown}
          openSalesModal={openSalesModal}
          openGraphModal={handleOpenGraphModal}
          dailySalesReport={dailySalesReport}
          selectedDate={selectedDate}
        />
      </div>

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

      <SalesGraphModal
        isOpen={isGraphModalOpen}
        onRequestClose={handleCloseGraphModal}
        monthlySales={monthlySales}
        monthlyDailyBreakdown={selectedBreakdown}
        selectedDate={selectedDate}
        dailySales={dailySales}
        dailySalesByOTA={dailySalesByOTA}
        maxRooms={totalRooms}
        aria-label="매출 그래프 모달"
      />

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
  monthlyDailyBreakdown: PropTypes.oneOfType([
    PropTypes.arrayOf(
      PropTypes.shape({
        Total: PropTypes.number,
        Cash: PropTypes.number,
        Card: PropTypes.number,
        OTA: PropTypes.number,
        Pending: PropTypes.number,
        현장숙박: PropTypes.number,
        현장대실: PropTypes.number,
      })
    ),
    PropTypes.shape({
      Total: PropTypes.number,
      Cash: PropTypes.number,
      Card: PropTypes.number,
      OTA: PropTypes.number,
      Pending: PropTypes.number,
      현장숙박: PropTypes.number,
      현장대실: PropTypes.number,
    }),
  ]).isRequired,
  openSalesModal: PropTypes.func.isRequired,
  hotelId: PropTypes.string.isRequired,
  hotelSettings: PropTypes.shape({
    hotelId: PropTypes.string,
    totalRooms: PropTypes.number,
    roomTypes: PropTypes.arrayOf(
      PropTypes.shape({
        roomInfo: PropTypes.string,
        nameKor: PropTypes.string,
        nameEng: PropTypes.string,
        price: PropTypes.number,
        stock: PropTypes.number,
        aliases: PropTypes.arrayOf(PropTypes.string),
        floorSettings: PropTypes.object,
        startRoomNumbers: PropTypes.object,
      })
    ),
    otas: PropTypes.arrayOf(
      PropTypes.shape({
        name: PropTypes.string,
        isActive: PropTypes.bool,
      })
    ),
    otaCredentials: PropTypes.object,
    gridSettings: PropTypes.shape({
      floors: PropTypes.arrayOf(
        PropTypes.shape({
          floorNum: PropTypes.number,
          containers: PropTypes.arrayOf(
            PropTypes.shape({
              containerId: PropTypes.string,
              roomInfo: PropTypes.string,
              roomNumber: PropTypes.string,
              price: PropTypes.number,
              isActive: PropTypes.bool,
            })
          ),
        })
      ),
    }),
    checkInTime: PropTypes.string,
    checkOutTime: PropTypes.string,
    hotelAddress: PropTypes.string,
    phoneNumber: PropTypes.string,
    email: PropTypes.string,
    hotelName: PropTypes.string,
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
  labelsForOTA: PropTypes.arrayOf(PropTypes.string),
  activeReservations: PropTypes.arrayOf(PropTypes.object).isRequired,
  dailySalesReport: PropTypes.arrayOf(
    PropTypes.shape({
      reservationId: PropTypes.string,
      roomNumber: PropTypes.string,
      customerName: PropTypes.string,
      roomInfo: PropTypes.string,
      checkInCheckOut: PropTypes.string,
      price: PropTypes.number,
      siteInfo: PropTypes.string,
      paymentMethod: PropTypes.string,
      paymentTotals: PropTypes.shape({
        Cash: PropTypes.number,
        Card: PropTypes.number,
        AccountTransfer: PropTypes.number,
        OTA: PropTypes.number,
        Pending: PropTypes.number,
      }),
      typeTotals: PropTypes.object,
      danjamTotal: PropTypes.number,
      danjamPaymentBreakdown: PropTypes.shape({
        Cash: PropTypes.number,
        Card: PropTypes.number,
        AccountTransfer: PropTypes.number,
        OTA: PropTypes.number,
        Pending: PropTypes.number,
      }),
    })
  ).isRequired,
};

export default SideBar;