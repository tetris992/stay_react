import React, { useState } from 'react';
import PropTypes from 'prop-types';
import AccountingInfo from './AccountingInfo';
import { useNavigate } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import { ko } from 'date-fns/locale';
import 'react-datepicker/dist/react-datepicker.css';
import './SideBar.css';
import logo from '../assets/StaySync.svg';

import VoiceSearch from './VoiceSearch';
import Search from './Search';
import {
  FaCog,
  FaChevronDown,
  FaChevronUp,
  FaSignOutAlt,
  FaCircleNotch,
  FaClipboardCheck,
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
  hotelSettings,
  otaToggles,
  onToggleOTA,
  searchCriteria,
  setSearchCriteria,
  executeSearch,
  onShowCanceledModal,
  onOnsiteReservationClick,
  needsConsent,
  dailySalesByOTA,
  labelsForOTA,
  activeReservations,
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
    onDateChange(date);
  };

  const handleVoiceResult = (transcript) => {
    setSearchCriteria({ ...searchCriteria, name: transcript });
    setTimeout(() => {
      executeSearch(transcript);
    }, 1000);
  };

  const triggerVisualEffect = (effectType) => {
    if (effectType === 'battery') {
      setHighlightEffect('blink');
      setTimeout(() => setHighlightEffect(''), 2000);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    executeSearch(searchCriteria.name || '');
    setTimeout(() => {
      setSearchCriteria({ ...searchCriteria, name: '' });
    }, 1000);
  };

  const activeOTAs = availableOTAs.filter((ota) => otaToggles?.[ota]);

  const handleOpenGraphModal = () => setIsGraphModalOpen(true);
  const handleCloseGraphModal = () => setIsGraphModalOpen(false);

  const dailySales = { labels: labelsForOTA, values: [] };
  const monthlySales = { labels: ['현재월'], values: [monthlyTotal] };

  return (
    <div
      className={`sidebar ${
        highlightEffect === 'blink' ? 'highlight-blink' : ''
      }`}
    >
      {/* 로고 섹션 */}
      <div className="sidebar-header">
        <a
          href="https://staysync.framer.ai/"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img src={logo} alt="Logo" className="sidebar-logo" />
        </a>
      </div>

      {/* 검색 섹션 */}
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

      {/* 동기화, 설정, 로그아웃 등 버튼 섹션 */}
      <div className="sync-section">
        <button
          className={`settings-button ${needsConsent ? 'blink-button' : ''}`}
          onClick={handleSettingsClick}
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
        <ScrapeNowButton hotelId={hotelId} activeOTAs={activeOTAs} />
        <button className="onsite-button" onClick={onOnsiteReservationClick}>
          <FaClipboardCheck className="onsite-icon" />
          <span className="btn-text">현장예약</span>
        </button>
        <button className="cancelSearch-button" onClick={onShowCanceledModal}>
          <FaTimesCircle className="cancel-icon" />
          <span className="btn-text">취소예약확인</span>
        </button>
        <button className="logout-button" onClick={onLogout}>
          <FaSignOutAlt className="logout-icon" />
          <span className="btn-text">로그아웃</span>
        </button>
      </div>

      {/* 날짜 선택 섹션 */}
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
          />
        </div>
      </div>

      {/* 객실 상태 섹션 */}
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
          />
        </div>
      </div>

      {/* 매출 정보 섹션 */}
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
      >
        <h4 className="section-title">
          <FaChartLine className="section-icon" />
          <span className="section-text">매출정보</span>
        </h4>
      </AccountingInfo>

      {/* OTA 설정 섹션 */}
      <div className="ota-settings-section">
        <div
          className="ota-settings-header"
          onClick={() => setIsOtaSettingsOpen((prev) => !prev)}
        >
          <h4 className="section-title">
            <FaTools className="section-icon" />
            <span className="section-text">OTA 설정</span>
          </h4>
          {isOtaSettingsOpen ? <FaChevronUp /> : <FaChevronDown />}
        </div>
        {isOtaSettingsOpen && (
          <div className="ota-toggles">
            {availableOTAs.map((ota) => (
              <label key={ota}>
                <input
                  type="checkbox"
                  checked={otaToggles?.[ota] || false}
                  onChange={() => onToggleOTA(ota)}
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
      />

      {/* Footer */}
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
  dailyTotal: PropTypes.number.isRequired,
  monthlyTotal: PropTypes.number.isRequired,
  roomsSold: PropTypes.number.isRequired,
  occupancyRate: PropTypes.number.isRequired,
  selectedDate: PropTypes.instanceOf(Date).isRequired,
  onDateChange: PropTypes.func.isRequired,
  totalRooms: PropTypes.number.isRequired,
  remainingRooms: PropTypes.number.isRequired,
  monthlySoldRooms: PropTypes.number.isRequired,
  avgMonthlyRoomPrice: PropTypes.number.isRequired,
  onLogout: PropTypes.func.isRequired,
  dailyBreakdown: PropTypes.array.isRequired,
  monthlyDailyBreakdown: PropTypes.array.isRequired,
  openSalesModal: PropTypes.func.isRequired,
  hotelId: PropTypes.string.isRequired,
  hotelSettings: PropTypes.object.isRequired,
  otaToggles: PropTypes.object.isRequired,
  onToggleOTA: PropTypes.func.isRequired,
  searchCriteria: PropTypes.object.isRequired,
  setSearchCriteria: PropTypes.func.isRequired,
  executeSearch: PropTypes.func.isRequired,
  onShowCanceledModal: PropTypes.func.isRequired,
  onOnsiteReservationClick: PropTypes.func.isRequired,
  needsConsent: PropTypes.bool.isRequired,
  dailySalesByOTA: PropTypes.object.isRequired,
  labelsForOTA: PropTypes.array.isRequired,
  activeReservations: PropTypes.array.isRequired,
};

export default SideBar;
