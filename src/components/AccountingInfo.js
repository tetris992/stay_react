import React, { useState } from 'react';
import {
  FaFileAlt,
  FaChartLine,
  FaChevronDown,
  FaChevronUp,
} from 'react-icons/fa';
import { format } from 'date-fns';
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
    AccountTransfer: 0,
    OTA: 0,
    Pending: 0,
  };
  const typeTotals = totalSummary?.typeTotals || { 현장숙박: 0, 현장대실: 0 };
  const danjamTotal = totalSummary?.danjamTotal || 0;
  const danjamPaymentBreakdown = totalSummary?.danjamPaymentBreakdown || {
    Cash: 0,
    Card: 0,
    AccountTransfer: 0,
    OTA: 0,
    Pending: 0,
  };

  const [showDailyDetails, setShowDailyDetails] = useState(false);
  const [showMonthlyDetails, setShowMonthlyDetails] = useState(false);
  const [showDanjamDetails, setShowDanjamDetails] = useState(false);

  console.log('[AccountingInfo] dailyTotal:', dailyTotal);
  console.log('[AccountingInfo] dailyBreakdown:', dailyBreakdown);
  console.log('[AccountingInfo] monthlyTotal:', monthlyTotal);
  console.log('[AccountingInfo] monthlyDailyBreakdown:', monthlyDailyBreakdown);
  console.log(
    `[AccountingInfo] Payment Totals for ${format(selectedDate, 'yyyy-MM-dd')}:`,
    paymentTotals
  );
  console.log(
    `[AccountingInfo] Danjam Total for ${format(selectedDate, 'yyyy-MM-dd')}:`,
    danjamTotal
  );
  console.log(
    `[AccountingInfo] Danjam Payment Breakdown for ${format(selectedDate, 'yyyy-MM-dd')}:`,
    danjamPaymentBreakdown
  );

  const dailyTotalValue =
    typeof dailyTotal === 'object' && dailyTotal.total !== undefined
      ? dailyTotal.total
      : 0;

  const monthlyTotalValue =
    typeof monthlyTotal === 'object'
      ? monthlyTotal.total || 0
      : monthlyTotal || 0;

  // 데이터 유효성 검사
  const hasSalesData =
    dailyTotalValue > 0 ||
    monthlyTotalValue > 0 ||
    paymentTotals.Cash > 0 ||
    paymentTotals.Card > 0 ||
    paymentTotals.AccountTransfer > 0 ||
    paymentTotals.OTA > 0 ||
    paymentTotals.Pending > 0 ||
    typeTotals['현장숙박'] > 0 ||
    typeTotals['현장대실'] > 0 ||
    danjamTotal > 0;

  return (
    <div className="accounting-info">
      {/* 제목은 SideBar.js에서 렌더링하므로 제거 */}
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

      {hasSalesData ? (
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
              {showMonthlyDetails ? <FaChevronUp /> : <FaChevronDown />}
            </button>
          </li>
          {showMonthlyDetails && (
            <li>
              <span>월매출 상세: </span>
              <ul>
                {monthlyDailyBreakdown.Total > 0 ? (
                  <li>
                    {format(selectedDate, 'yyyy-MM-dd')}: ₩{monthlyDailyBreakdown.Total.toLocaleString()}
                  </li>
                ) : (
                  <li>해당 날짜에 매출 데이터가 없습니다.</li>
                )}
              </ul>
            </li>
          )}
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
            <span>현금 매출 (단잠 포함): </span>₩{(paymentTotals.Cash || 0).toLocaleString()}
          </li>
          <li>
            <span>카드 매출 (단잠 포함): </span>₩{(paymentTotals.Card || 0).toLocaleString()}
          </li>
          <li>
            <span>계좌이체 매출 (단잠 포함): </span>₩{(paymentTotals.AccountTransfer || 0).toLocaleString()}
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
          <li>
            <span>단잠 매출: </span>₩{(danjamTotal || 0).toLocaleString()}
            <button
              onClick={() => setShowDanjamDetails(!showDanjamDetails)}
              style={{
                marginLeft: '10px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {showDanjamDetails ? <FaChevronUp /> : <FaChevronDown />}
            </button>
          </li>
          {showDanjamDetails && (
            <li>
              <span>단잠 결제 방법별 매출: </span>
              <ul>
                <li>현금: ₩{(danjamPaymentBreakdown.Cash || 0).toLocaleString()}</li>
                <li>카드: ₩{(danjamPaymentBreakdown.Card || 0).toLocaleString()}</li>
                <li>계좌이체: ₩{(danjamPaymentBreakdown.AccountTransfer || 0).toLocaleString()}</li>
                <li>OTA: ₩{(danjamPaymentBreakdown.OTA || 0).toLocaleString()}</li>
                <li>미결제: ₩{(danjamPaymentBreakdown.Pending || 0).toLocaleString()}</li>
              </ul>
            </li>
          )}
        </ul>
      ) : (
        <p className="no-data-message">매출 데이터가 없습니다.</p>
      )}
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
  monthlyDailyBreakdown: PropTypes.shape({
    Total: PropTypes.number,
    Cash: PropTypes.number,
    Card: PropTypes.number,
    OTA: PropTypes.number,
    Pending: PropTypes.number,
    현장숙박: PropTypes.number,
    현장대실: PropTypes.number,
  }).isRequired,
  openSalesModal: PropTypes.func.isRequired,
  openGraphModal: PropTypes.func,
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
  selectedDate: PropTypes.instanceOf(Date).isRequired,
};

export default AccountingInfo;