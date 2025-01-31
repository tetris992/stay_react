// src/components/AccountingInfo.js

import React from 'react';
import { FaFileAlt, FaChartLine } from 'react-icons/fa';
import PropTypes from 'prop-types';
import './AccountingInfo.css';

function AccountingInfo({
  dailyTotal,
  monthlyTotal,
  roomsSold,
  occupancyRate,
  avgMonthlyRoomPrice,
  monthlySoldRooms,
  dailyBreakdown,
  monthlyDailyBreakdown,
  openSalesModal, // 기존 매출 상세 모달 열기용 prop
  openGraphModal, // 새로 추가: 그래프 모달 열기용 prop
}) {
  return (
    <div className="accounting-info">
      <h4 className="accounting-title">
        매출 정보
        <div className='accounting-buttons'>
          {' '}
          {/* 기존 SalesModal 열기 버튼 */}
          <button className="sales-button" onClick={openSalesModal}>
            <FaFileAlt className="sales-icon" />
          </button>
          {/* 새로 추가한 그래프 모달 열기 버튼 */}
          {openGraphModal && (
            <button className="sales-button" onClick={openGraphModal}>
              <FaChartLine className="sales-icon"  style={{ marginRight: '5px' }} />
            </button>
          )}
        </div>
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

      {/* 일 매출 상세보기 토글 버튼 */}

      {/* 일 매출 상세 정보 */}
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
  openSalesModal: PropTypes.func.isRequired, // 기존 상세 모달 콜백
  openGraphModal: PropTypes.func, // 새로 추가된 그래프 모달 콜백
};

export default AccountingInfo;
