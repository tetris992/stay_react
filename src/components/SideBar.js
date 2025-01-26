// src/components/SideBar.js

import React, { useState } from 'react';
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
}) {
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isRoomTypesOpen, setIsRoomTypesOpen] = useState(false);
  const [highlightEffect, setHighlightEffect] = useState('');

  // Handles the sync and applies the shining effect
  const handleSyncClick = () => {
    setIsShining(true);
    onSync();
    setTimeout(() => setIsShining(false), 5000);
  };

  const handleSettingsClick = () => {
    setShowSettingsModal(true);
  };

  const toggleRoomTypes = () => {
    setIsRoomTypesOpen((prev) => !prev);
  };

  // 날짜 변경 시 처리
  const handleDateChangeInternal = (date) => {
    onDateChange(date);
  };

  // 음성 검색 결과 처리 함수
  const handleVoiceResult = (transcript) => {
    setSearchCriteria({ ...searchCriteria, name: transcript });

    // 1초 후에 executeSearch 호출
    setTimeout(() => {
      executeSearch(transcript);
    }, 1000);
  };

  // 특정 단어에 대한 시각적 효과 트리거 함수
  const triggerVisualEffect = (effectType) => {
    if (effectType === 'battery') {
      setHighlightEffect('blink');
      // 효과를 잠시 적용 후 초기화
      setTimeout(() => setHighlightEffect(''), 2000);
    }
    // 다른 효과 타입을 추가할 수 있습니다.
  };

  // 검색 제출 함수
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    executeSearch(searchCriteria.name || '');

    // 검색 후 입력창을 잠시 후에 비우기
    setTimeout(() => {
      setSearchCriteria({ ...searchCriteria, name: '' });
    }, 1000);
  };

  // 활성화된 OTA 목록 가져오기
  const activeOTAs = availableOTAs.filter((ota) => otaToggles?.[ota]);

  return (
    <div
      className={`sidebar ${
        highlightEffect === 'blink' ? 'highlight-blink' : ''
      }`}
    >
      {/* 헤더 섹션 추가 */}
      <div className="sidebar-header">
        <img src={logo} alt="Logo" className="sidebar-logo" />
        {/* <h3 className="sidebar-title">
          STAYSYNC.<span className="red">ME</span>
        </h3> */}
      </div>
      <Search
        searchCriteria={searchCriteria}
        setSearchCriteria={setSearchCriteria}
        handleSearchSubmit={handleSearchSubmit}
      />
      <VoiceSearch
        onResult={handleVoiceResult}
        triggerVisualEffect={triggerVisualEffect}
      />

      <div className="sync-section">
        <button className="settings-button" onClick={handleSettingsClick}>
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

        {/* 즉시 스크랩 버튼 추가 */}
        <ScrapeNowButton hotelId={hotelId} activeOTAs={activeOTAs} />
        {/* 현장예약 */}
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

      {/* Date Picker Section */}
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

      {/* Room Status Section */}
      <div className="room-status-section">
        <h4>객실 상태</h4>
        <p>총 객실: {totalRooms}</p>
        <p>판매된 객실: {roomsSold}</p>
        <p>잔여 객실: {remainingRooms}</p>
        <button className="toggle-room-types-button" onClick={toggleRoomTypes}>
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

        {isRoomTypesOpen && (
          <div className="room-types">
            {roomTypes.length > 0 ? (
              roomTypes.map((room, index) => (
                <div key={index} className="room-type-info">
                  <p>
                    타입: {room.nameKor} / {room.nameEng}
                  </p>
                  <p>가격: {room.price.toLocaleString()}원</p>
                  <p>잔여 수: {room.stock}</p>
                </div>
              ))
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

      {/* Accounting Information Section */}
      <AccountingInfo
        dailyTotal={dailyTotal}
        monthlyTotal={monthlyTotal}
        occupancyRate={occupancyRate}
        roomsSold={roomsSold}
        monthlySoldRooms={monthlySoldRooms}
        avgMonthlyRoomPrice={avgMonthlyRoomPrice}
        dailyBreakdown={dailyBreakdown}
        openSalesModal={openSalesModal}
      />

      {/* OTA 설정 섹션 추가 */}
      <div className="ota-settings-section">
        <h4>OTA 설정</h4>
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
      </div>

      {/* 호텔 설정 모달 열기 */}
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
      {/* 새롭게 추가한 회색 박스 */}
      <div className="sidebar-footer">
        <div className="footer-divider" />
        <p>
          Zero to One, Inc. - By subscribing, you agree to our{' '}
          <span>Purchaser Terms of Service</span>. Subscriptions auto-renew
          until canceled. Cancel anytime, at least 24 hours prior to renewal to
          avoid additional charges. Manage your subscription through the
          platform you subscribed on.
        </p>
        <div className="footer-divider" />
      </div>
    </div>
  );
}

export default SideBar;
