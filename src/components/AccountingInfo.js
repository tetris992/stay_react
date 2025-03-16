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
  openSalesModal,
  openGraphModal,
  dailySalesReport,
}) {
  // 결제 방법별 및 숙박/대실별 합계 계산 (방어 코드 추가)
  const totalSummary = dailySalesReport?.find((item) => item.reservationId === 'totalSummary');
  const paymentTotals = totalSummary?.paymentTotals || { Cash: 0, Card: 0, OTA: 0, Pending: 0 };
  const typeTotals = totalSummary?.typeTotals || { '현장숙박': 0, '현장대실': 0 };

  return (
    <div className="accounting-info">
      <h4 className="accounting-title">
        매출 정보
        <div className='accounting-buttons'>
          <button className="sales-button" onClick={openSalesModal}>
            <FaFileAlt className="sales-icon" />
          </button>
          {openGraphModal && (
            <button className="sales-button" onClick={openGraphModal}>
              <FaChartLine className="sales-icon" style={{ marginRight: '5px' }} />
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
        {/* 결제 방법별 매출 */}
        <li>
          <span>현금 매출: </span>₩{paymentTotals.Cash.toLocaleString()}
        </li>
        <li>
          <span>카드 매출: </span>₩{paymentTotals.Card.toLocaleString()}
        </li>
        <li>
          <span>OTA 매출: </span>₩{paymentTotals.OTA.toLocaleString()}
        </li>
        <li>
          <span>미결제 매출: </span>₩{paymentTotals.Pending.toLocaleString()}
        </li>
        {/* 숙박/대실별 매출 */}
        <li>
          <span>현장숙박 매출: </span>₩{typeTotals['현장숙박'].toLocaleString()}
        </li>
        <li>
          <span>현장대실 매출: </span>₩{typeTotals['현장대실'].toLocaleString()}
        </li>
      </ul>
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
  openSalesModal: PropTypes.func.isRequired,
  openGraphModal: PropTypes.func,
  dailySalesReport: PropTypes.array.isRequired,
};

export default AccountingInfo;