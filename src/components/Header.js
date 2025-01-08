// src/components/Header.js

import React from 'react';
import './Header.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretLeft, faCaretRight } from '@fortawesome/free-solid-svg-icons';
import PropTypes from 'prop-types'; // PropTypes 추가

function Header({
  selectedDate,
  onDateChange,
  onPrevDay,
  onNextDay,
  onQuickCreate,
  isShining,
  otaToggles,
}) {
  const dayOfWeek = selectedDate.getDay();
  const weekdayName = selectedDate.toLocaleDateString('ko-KR', {
    weekday: 'long',
  });

  return (
    <div className="header">
      <div className="header-left">
        <h1 className={isShining ? 'shining' : ''}>HOTEL MANAGEMENT SYSTEM</h1>
      </div>

      <div className="header-center">
        <div className="date-navigation">
          <button className="arrow-button" onClick={onPrevDay}>
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

          <button className="arrow-button" onClick={onNextDay}>
            <FontAwesomeIcon icon={faCaretRight} />
          </button>
        </div>
      </div>

      <div className="header-right">
        <div className="quick-create-buttons">
          <button className="quick-button" onClick={() => onQuickCreate('1박')}>
            1박
          </button>
          <button className="quick-button" onClick={() => onQuickCreate('2박')}>
            2박
          </button>
          <button className="quick-button" onClick={() => onQuickCreate('3박')}>
            3박
          </button>
          <button className="quick-button" onClick={() => onQuickCreate('4박')}>
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
      {/* 투명도 효과를 위한 영역 추가 */}
      <div className="header-fade"></div>
      
      {/* OTA 상태 표시 */}
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
              className={`status-lamp ${otaToggles[ota] ? 'green' : 'gray'}`}
            ></span>
          </div>
        ))}
      </div>
    </div>
  );
}

// PropTypes 정의 (추가)
Header.propTypes = {
  selectedDate: PropTypes.instanceOf(Date).isRequired,
  onDateChange: PropTypes.func.isRequired,
  onPrevDay: PropTypes.func.isRequired,
  onNextDay: PropTypes.func.isRequired,
  onQuickCreate: PropTypes.func.isRequired,
  isShining: PropTypes.bool.isRequired,
  otaToggles: PropTypes.object.isRequired,
};

export default Header;
