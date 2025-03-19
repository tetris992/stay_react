import React, { useState } from 'react';
import {
  FaFileAlt,
  FaChartLine,
  FaChevronDown,
  FaChevronUp,
} from 'react-icons/fa';
// import { format } from 'date-fns';
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
  selectedDate,
}) {
  const totalSummary = dailySalesReport?.find(
    (item) => item.reservationId === 'totalSummary'
  );
  const paymentTotals = totalSummary?.paymentTotals || {
    Cash: 0,
    Card: 0,
    OTA: 0,
    Pending: 0,
  };
  const typeTotals = totalSummary?.typeTotals || { 현장숙박: 0, 현장대실: 0 };

  const [showDailyDetails, setShowDailyDetails] = useState(false);
  const [showMonthlyDetails, setShowMonthlyDetails] = useState(false);

  // 디버깅 로그 추가
  console.log('[AccountingInfo] dailyTotal:', dailyTotal);
  console.log('[AccountingInfo] dailyBreakdown:', dailyBreakdown);
  console.log('[AccountingInfo] monthlyTotal:', monthlyTotal);
  console.log('[AccountingInfo] monthlyDailyBreakdown:', monthlyDailyBreakdown);

  // dailyTotal과 monthlyTotal에서 total 값 추출
  const dailyTotalValue =
  typeof dailyTotal === 'object' && dailyTotal.total !== undefined
    ? dailyTotal.total
    : 0;

  const monthlyTotalValue =
    typeof monthlyTotal === 'object'
      ? monthlyTotal.total || 0
      : monthlyTotal || 0;

  return (
    <div className="accounting-info">
      <h4 className="accounting-title">
        매출 정보
        <div className="accounting-buttons">
          <button className="sales-button" onClick={openSalesModal}>
            <FaFileAlt className="sales-icon" />
          </button>
          {openGraphModal && (
            <button className="sales-button" onClick={openGraphModal}>
              <FaChartLine
                className="sales-icon"
                style={{ marginRight: '5px' }}
              />
            </button>
          )}
        </div>
      </h4>

      <ul className="accounting-detail">
        <li>
          <span>일 매출: </span>₩{dailyTotalValue.toLocaleString()}
          <button
            onClick={() => setShowDailyDetails(!showDailyDetails)}
            style={{
              marginLeft: '10px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {showDailyDetails ? <FaChevronUp /> : <FaChevronDown />}
          </button>
        </li>
        {showDailyDetails && dailyBreakdown && dailyBreakdown.length > 0 && (
          <li>
            <span>일매출 상세: </span>
            <ul>
              {dailyBreakdown.map((amount, index) => (
                <li key={index}>
                  예약 {index + 1}: ₩{amount.toLocaleString()}
                </li>
              ))}
            </ul>
          </li>
        )}
        <li>
          <span>월 매출: </span>₩{monthlyTotalValue.toLocaleString()}
          <button
            onClick={() => setShowMonthlyDetails(!showMonthlyDetails)}
            style={{
              marginLeft: '10px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {/* {showMonthlyDetails ? <FaChevronUp /> : <FaChevronDown />} */}
          </button>
        </li>
        {/* {showMonthlyDetails &&
          monthlyDailyBreakdown &&
          monthlyDailyBreakdown.length > 0 && (
            <li>
              <span>월매출 상세: </span>
              <ul>
                {monthlyDailyBreakdown.map(
                  (day, index) =>
                    day.Total > 0 && (
                      <li key={index}>
                        {format(
                          new Date(
                            selectedDate.getFullYear(),
                            selectedDate.getMonth(),
                            index + 1
                          ),
                          'yyyy-MM-dd'
                        )}
                        : ₩{day.Total.toLocaleString()}
                      </li>
                    )
                )}
              </ul>
            </li>
          )} */}
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
        <li>
          <span>현금 매출: </span>₩{(paymentTotals.Cash || 0).toLocaleString()}
        </li>
        <li>
          <span>카드 매출: </span>₩{(paymentTotals.Card || 0).toLocaleString()}
        </li>
        <li>
          <span>OTA 매출: </span>₩{(paymentTotals.OTA || 0).toLocaleString()}
        </li>
        <li>
          <span>미결제 매출: </span>₩
          {(paymentTotals.Pending || 0).toLocaleString()}
        </li>
        <li>
          <span>현장숙박 매출: </span>₩
          {(typeTotals['현장숙박'] || 0).toLocaleString()}
        </li>
        <li>
          <span>현장대실 매출: </span>₩
          {(typeTotals['현장대실'] || 0).toLocaleString()}
        </li>
      </ul>
    </div>
  );
}

AccountingInfo.propTypes = {
  dailyTotal: PropTypes.shape({
    total: PropTypes.number.isRequired,
    paymentTotals: PropTypes.object.isRequired,
    typeTotals: PropTypes.object.isRequired,
    dailyBreakdown: PropTypes.array.isRequired,
  }).isRequired,
  monthlyTotal: PropTypes.oneOfType([
    PropTypes.number,
    PropTypes.shape({
      total: PropTypes.number,
      paymentTotals: PropTypes.object,
      typeTotals: PropTypes.object,
    }),
  ]).isRequired,
  roomsSold: PropTypes.number.isRequired,
  occupancyRate: PropTypes.number.isRequired,
  avgMonthlyRoomPrice: PropTypes.number.isRequired,
  monthlySoldRooms: PropTypes.number.isRequired,
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
  openGraphModal: PropTypes.func,
  dailySalesReport: PropTypes.array.isRequired,
  selectedDate: PropTypes.instanceOf(Date).isRequired,
};

export default AccountingInfo;
