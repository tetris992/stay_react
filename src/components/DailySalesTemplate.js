import React from 'react';
import './DailySalesTemplate.css';
import PropTypes from 'prop-types';
import { format } from 'date-fns';
import { FaCheckCircle, FaExclamationCircle } from 'react-icons/fa';

const DailySalesTemplate = ({
  dailySales,
  dailyTotal,
  monthlySales,
  selectedDate,
  totalRooms,
  remainingRooms,
  occupancyRate, // 프롭이 전달되지 않아서 수식을 대체함.
  dailyAverageRoomPrice, // dailyAverageRoomPrice 추가
}) => {
  const soldRooms = totalRooms - remainingRooms;

  const truncateText = (text, maxLength) => {
    if (!text) return '정보 없음';
    if (text.length > maxLength) {
      return text.substring(0, maxLength) + '...';
    }
    return text;
  };

  const formatDateOnly = (isoString) => {
    if (!isoString || isoString === '정보 없음') return '정보 없음';
    const date = new Date(isoString);
    return format(date, 'yyyy-MM-dd');
  };

  return (
    <div className="daily-sales-template">
      <div className="report-header">
        <h1 className="report-title">일일 매출 리포트</h1>
        <p className="report-date">
          {format(selectedDate, 'yyyy년 MM월 dd일')}
        </p>
      </div>

      <table>
        <thead>
          <tr>
            <th>객실번호</th>
            <th>사이트</th>
            <th>예약자</th>
            <th>객실타입</th>
            <th>체크인 ~ 체크아웃</th>
            <th>가격(1박기준)</th> {/* 여기서 1박 기준 명시 */}
            <th>결제방법</th>
          </tr>
        </thead>
        <tbody>
          {dailySales.length > 0 ? (
            dailySales.map((sale) => {
              const [rawCheckIn, rawCheckOut] =
                sale.checkInCheckOut.split(' ~ ');
              const checkInDate = formatDateOnly(rawCheckIn);
              const checkOutDate = formatDateOnly(rawCheckOut);

              return (
                <tr key={sale.reservationId}>
                  <td>{sale.roomNumber}</td>
                  <td>{truncateText(sale.siteInfo, 15)}</td>
                  <td>{truncateText(sale.customerName, 15)}</td>
                  <td>{truncateText(sale.roomInfo, 15)}</td>
                  <td>{`${checkInDate} ~ ${checkOutDate}`}</td>
                  <td>₩{(sale.price || 0).toLocaleString()}</td>
                  <td>
                    {sale.paymentMethod === 'Card' ? (
                      <FaCheckCircle
                        className="payment-icon card"
                        title="카드 결제"
                      />
                    ) : sale.paymentMethod === 'Cash' ? (
                      <FaCheckCircle
                        className="payment-icon cash"
                        title="현금 결제"
                      />
                    ) : sale.paymentMethod === 'Account Transfer' ? (
                      <FaCheckCircle
                        className="payment-icon transfer"
                        title="계좌 이체 결제"
                      />
                    ) : sale.paymentMethod === 'Pending' ? (
                      <FaExclamationCircle
                        className="payment-icon pending"
                        title="결제 대기"
                      />
                    ) : sale.paymentMethod === 'OTA' ? (
                      <FaCheckCircle
                        className="payment-icon ota"
                        title="OTA 결제"
                      />
                    ) : (
                      <span>정보 없음</span>
                    )}
                    {sale.paymentMethod}
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan="7">해당 날짜의 예약이 없습니다.</td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="sales-summary">
        <div className="summary-left">
          <div className="summary-item">
            <span className="summary-label">총 객실수:</span>
            <span className="summary-value">{totalRooms}개</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">잔여 객실수:</span>
            <span className="summary-value">{remainingRooms}개</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">일 판매 객실 수:</span>
            <span className="summary-value">{soldRooms}개</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">일일 점유율:</span>
            <span className="summary-value">
              {Math.ceil((soldRooms / totalRooms) * 100)}%
            </span>
          </div>
        </div>
        <div className="summary-right">
          <div className="summary-item">
            <span className="summary-label">일일 매출:</span>
            <span className="summary-value">
              ₩{(dailyTotal || 0).toLocaleString()}원
            </span>
          </div>
          <div className="summary-item">
            <span className="summary-label">세후 매출:</span>
            <span className="summary-value">
              ₩
              {(dailyTotal > 0
                ? Math.floor(dailyTotal * 0.9)
                : 0
              ).toLocaleString()}
              원
            </span>
          </div>
          <div className="summary-item">
            <span className="summary-label">월 매출:</span>
            <span className="summary-value">
              ₩{(monthlySales || 0).toLocaleString()}원
            </span>
          </div>
          <div className="summary-item">
            <span className="summary-label">일 평균 객실 가격:</span>{' '}
            {/* 문구 변경 */}
            <span className="summary-value">
              ₩{(dailyAverageRoomPrice || 0).toLocaleString()}원
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

DailySalesTemplate.propTypes = {
  dailySales: PropTypes.array.isRequired,
  dailyTotal: PropTypes.number.isRequired,
  monthlySales: PropTypes.number.isRequired,
  selectedDate: PropTypes.instanceOf(Date).isRequired,
  totalRooms: PropTypes.number.isRequired,
  remainingRooms: PropTypes.number.isRequired,
  occupancyRate: PropTypes.number.isRequired,
  dailyAverageRoomPrice: PropTypes.number.isRequired,
};

export default DailySalesTemplate;
