// src/components/SideBar.js

import React, { useState } from 'react';
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
  // FaTh,
} from 'react-icons/fa';

// import { defaultRoomTypes } from '../config/defaultRoomTypes';
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
  // handleSaveSettings,
  totalRooms,
  remainingRooms,
  // roomTypes,
  monthlySoldRooms,
  avgMonthlyRoomPrice,
  onLogout,
  dailyBreakdown,
  monthlyDailyBreakdown,
  openSalesModal,
  // hotelSettings,
  hotelId,
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
  const [isGraphModalOpen, setIsGraphModalOpen] = useState(false); // 그래프 모달 열림 여부
  // ★ 새로 추가: OTA 설정 토글 상태 (기본적으로 닫힘)
  const [isOtaSettingsOpen, setIsOtaSettingsOpen] = useState(false);

  // ★ 추가: react-router-dom의 useNavigate 훅
  const navigate = useNavigate();

  // 1) Sync 버튼 클릭 핸들러
  const handleSyncClick = () => {
    setIsShining(true);
    onSync();
    setTimeout(() => setIsShining(false), 5000);
  };

  // 2) 호텔 설정 버튼 클릭 핸들러
  const handleSettingsClick = () => {
    navigate('/hotel-settings'); // ← 페이지 전환
  };

  // 4) 날짜 변경
  const handleDateChangeInternal = (date) => {
    onDateChange(date);
  };

  // 5) 음성 검색 결과 처리
  const handleVoiceResult = (transcript) => {
    setSearchCriteria({ ...searchCriteria, name: transcript });
    setTimeout(() => {
      executeSearch(transcript);
    }, 1000);
  };

  // 6) 시각적 효과 트리거
  const triggerVisualEffect = (effectType) => {
    if (effectType === 'battery') {
      setHighlightEffect('blink');
      setTimeout(() => setHighlightEffect(''), 2000);
    }
  };

  // 7) 검색 제출
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    executeSearch(searchCriteria.name || '');
    setTimeout(() => {
      setSearchCriteria({ ...searchCriteria, name: '' });
    }, 1000);
  };

  // 8) 활성화된 OTA 목록
  const activeOTAs = availableOTAs.filter((ota) => otaToggles?.[ota]);

  // 모달 열기/닫기
  const handleOpenGraphModal = () => setIsGraphModalOpen(true);
  const handleCloseGraphModal = () => setIsGraphModalOpen(false);

  // 그래프에 쓸 데이터 구성
  const dailySales = {
    labels: labelsForOTA,
    values: [],
  };

  const monthlySales = {
    labels: ['현재월'],
    values: [monthlyTotal],
  };

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
          <span className="hotel-id-tooltip">호텔 설정</span>
        </button>
        <button
          className="sync-button"
          onClick={handleSyncClick}
          disabled={loading}
          aria-label="서버 동기화"
        >
          <FaCircleNotch className={`sync-icon ${loading ? 'spinning' : ''}`} />
          {loading ? '동기화 중...' : '서버 동기화'}
        </button>
        <ScrapeNowButton hotelId={hotelId} activeOTAs={activeOTAs} />
        <button className="onsite-button" onClick={onOnsiteReservationClick}>
          <FaClipboardCheck className="onsite-icon" /> 현장예약
        </button>
        <button className="cancelSearch-button" onClick={onShowCanceledModal}>
          <FaTimesCircle className="cancel-icon" /> 취소예약확인
        </button>
        <button className="logout-button" onClick={onLogout}>
          <FaSignOutAlt className="logout-icon" />
          <span>로그아웃</span>
        </button>
      </div>

      {/* 날짜 선택 섹션 */}
      <div className="date-picker-section">
        <h4>날짜 선택</h4>
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
        <h4>객실 상태</h4>
        <div className="room-status-content">
          <RoomStatusChart
            totalRooms={totalRooms}
            roomsSold={roomsSold}
            remainingRooms={remainingRooms}
          />
        </div>
      </div>

      {/* 매출 정보 섹션 (AccountingInfo) */}
      <AccountingInfo
        dailyTotal={dailyTotal}
        monthlyTotal={monthlyTotal}
        occupancyRate={occupancyRate}
        roomsSold={roomsSold}
        monthlySoldRooms={monthlySoldRooms}
        avgMonthlyRoomPrice={avgMonthlyRoomPrice}
        dailyBreakdown={dailyBreakdown}
        monthlyDailyBreakdown={monthlyDailyBreakdown}
        openSalesModal={openSalesModal} // 기존 상세 보기 모달
        openGraphModal={handleOpenGraphModal} // 추가: 새 그래프 모달 열기
      />

      {/* ★ OTA 설정 섹션 (토글 가능하게 변경) */}
      <div className="ota-settings-section">
        <div
          className="ota-settings-header"
          onClick={() => setIsOtaSettingsOpen((prev) => !prev)}
        >
          <h4 className="otaSetup">OTA 설정</h4>
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

      {/* 추가: 매출 그래프 모달 (SalesGraphModal) */}
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

export default SideBar;
