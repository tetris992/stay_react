// src/components/AccountingInfo.js

import React, { useState } from 'react';
import { FaFileAlt } from 'react-icons/fa';
import PropTypes from 'prop-types';

function AccountingInfo({
  dailyTotal,
  monthlyTotal,
  roomsSold,
  occupancyRate,
  avgMonthlyRoomPrice,
  monthlySoldRooms,
  dailyBreakdown,
  openSalesModal, // openSalesModal prop 추가
}) {
  const [showDetails, setShowDetails] = useState(false);

  const toggleDetails = () => {
    setShowDetails(!showDetails);
  };

  return (
    <div className="accounting-info">
      <h4 className="accounting-title">
        매출 정보
        <button className="sales-button" onClick={openSalesModal}>
          <FaFileAlt className="sales-icon" />
        </button>
      </h4>
      <ul className="accounting-detail">
        <li>
          <span>일 매출 : </span>₩{dailyTotal.toLocaleString()}
        </li>
        <li>
          <span>월 매출 : </span>₩{monthlyTotal.toLocaleString()}
        </li>
        <li>
          <span>일 판매 객실 수: </span>
          {roomsSold}
        </li>
        <li>
          <span>점유율: </span>
          {Math.ceil(occupancyRate)}%
        </li>
        <li>
          <span>월 평균 객실 가격: </span>₩
          {avgMonthlyRoomPrice.toLocaleString()}
        </li>
        <li>
          <span>월 판매 객실 수: </span>
          {monthlySoldRooms}
        </li>
      </ul>
      <button onClick={toggleDetails} className="details-button">
        {showDetails ? '상세보기 닫기' : '상세보기'}
      </button>
      {/* {showDetails && (
        <div className="daily-breakdown">
          <h3>일 매출 상세:</h3>
          <ol>
            {dailyBreakdown.map((price, index) => (
              <li key={index}>₩{price.toLocaleString()}</li>
            ))}
          </ol>
        </div>
      )} */}
    </div>
  );
}

AccountingInfo.propTypes = {
  dailyTotal: PropTypes.number.isRequired,
  monthlyTotal: PropTypes.number.isRequired,
  roomsSold: PropTypes.number.isRequired,
  occupancyRate: PropTypes.number.isRequired,
  avgMonthlyRoomPrice: PropTypes.number.isRequired,
  monthlySoldRooms: PropTypes.number.isRequired,
  dailyBreakdown: PropTypes.arrayOf(PropTypes.number).isRequired,
  openSalesModal: PropTypes.func.isRequired, // propTypes 추가
};

export default AccountingInfo;
