// src/components/SideBar.js

import React, { useState, useMemo } from 'react';
import AccountingInfo from './AccountingInfo';
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
} from 'react-icons/fa';
import HotelSettings from './HotelSettings';
import { defaultRoomTypes } from '../config/defaultRoomTypes';
import ScrapeNowButton from './ScrapeNowButton';
import availableOTAs from '../config/availableOTAs';
import RoomStatusChart from './RoomStatusChart';
import SalesGraphModal from './SalesGraphModal';

// [추가] 재고 계산 유틸 함수 import
import { computeRemainingInventory } from '../utils/computeRemainingInventory';

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
  handleSaveSettings,
  totalRooms,
  remainingRooms,
  roomTypes,
  monthlySoldRooms,
  avgMonthlyRoomPrice,
  onLogout,
  dailyBreakdown,
  monthlyDailyBreakdown,
  openSalesModal,
  hotelSettings,
  hotelId,
  otaToggles,
  userInfo,
  onToggleOTA,
  searchCriteria,
  setSearchCriteria,
  executeSearch,
  onShowCanceledModal,
  memos,
  setMemos,
  onOnsiteReservationClick,
  needsConsent,
  dailySalesByOTA,
  labelsForOTA,
  activeReservations,
}) {
  // 기존 상태 변수들...
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isRoomTypesOpen, setIsRoomTypesOpen] = useState(false);
  const [highlightEffect, setHighlightEffect] = useState('');
  const [isGraphModalOpen, setIsGraphModalOpen] = useState(false); // 그래프 모달 열림 여부
  // ★ 새로 추가: OTA 설정 토글 상태 (기본적으로 닫힘)
  const [isOtaSettingsOpen, setIsOtaSettingsOpen] = useState(false);

  // 1) Sync 버튼 클릭 핸들러
  const handleSyncClick = () => {
    setIsShining(true);
    onSync();
    setTimeout(() => setIsShining(false), 5000);
  };

  // 2) 호텔 설정 버튼 클릭 핸들러
  const handleSettingsClick = () => {
    setShowSettingsModal(true);
  };

  // 3) 객실 타입 토글
  const toggleRoomTypes = () => {
    setIsRoomTypesOpen((prev) => !prev);
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
    labels: labelsForOTA, // 예: ['08-01', '08-02', ...]
    values: [],
  };

  const monthlySales = {
    labels: ['현재월'],
    values: [monthlyTotal],
  };

  // [추가된 부분: 남은 재고 계산]
  const remainingInventory = useMemo(
    () => computeRemainingInventory(roomTypes, activeReservations || []),
    [roomTypes, activeReservations]
  );
  console.log(activeReservations);

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
          <button
            className="toggle-room-types-button"
            onClick={toggleRoomTypes}
          >
            {isRoomTypesOpen ? (
              <>
                객실 타입 숨기기 <FaChevronUp />
              </>
            ) : (
              <>
                객실 타입 보기 <FaChevronDown />
              </>
            )}
          </button>
        </div>

        {isRoomTypesOpen && (
          <div className="room-types">
            {roomTypes.length > 0 ? (
              roomTypes.map((room, index) => {
                const remaining = remainingInventory[room.type] ?? room.stock;
                console.log(remaining);
                const isLowStock = remaining <= 1; // 남은 재고가 1 이하이면 경고 표시
                return (
                  <div key={index} className="room-type-info">
                    <p>
                      타입: {room.nameKor} / {room.nameEng}
                    </p>
                    <p>가격: {room.price.toLocaleString()}원</p>
                    <p>
                      잔여 수:{' '}
                      <span style={{ color: isLowStock ? 'red' : 'inherit' }}>
                        ({remaining})
                      </span>{' '}
                      {isLowStock && (
                        <span className="low-stock-warning" title="재고 부족!">
                          ⚠️
                        </span>
                      )}
                    </p>
                  </div>
                );
              })
            ) : (
              <div className="room-type-info">
                <p>
                  타입: {defaultRoomTypes[0].nameKor} /{' '}
                  {defaultRoomTypes[0].nameEng}
                </p>
                <p>가격: {defaultRoomTypes[0].price.toLocaleString()}원</p>
                <p>잔여 수: {defaultRoomTypes[0].stock}</p>
              </div>
            )}
          </div>
        )}
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

      {/* 호텔 설정 모달 */}
      {showSettingsModal && (
        <HotelSettings
          onClose={() => setShowSettingsModal(false)}
          onSave={handleSaveSettings}
          existingSettings={{
            ...userInfo,
            ...hotelSettings,
            otas:
              hotelSettings?.otas ||
              availableOTAs.map((ota) => ({
                name: ota,
                isActive: false,
              })),
          }}
        />
      )}

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
