// src/components/CanceledReservationsTemplate.js
import React from 'react';
import PropTypes from 'prop-types';
import './CanceledReservationsTemplate.css';
import { format } from 'date-fns';

const CanceledReservationsTemplate = ({ reservations }) => {
  const formatDateOnly = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return format(date, 'yyyy-MM-dd');
  };

  // 추가: 텍스트 길이 제한 함수
  const truncateText = (text, maxLength) => {
    if (!text) return '';
    if (text.length > maxLength) {
      return text.substring(0, maxLength) + '...';
    }
    return text;
  };

  return (
    <div className="canceled-reservations-template">
      <h2>취소된 예약 목록</h2>
      {reservations.length === 0 ? (
        <p className="no-data">취소된 예약이 없습니다.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>사이트</th>

              <th>예약자</th>
              <th>객실 정보</th>
              <th>체크인</th>
              <th>체크아웃</th>
            </tr>
          </thead>
          <tbody>
            {reservations.map((res) => (
              <tr key={res._id}>
                <td>{res.siteName || '정보 없음'}</td>
                <td>{res.customerName || '정보 없음'}</td>
                {/* 최대 25자까지만 표시 */}
                <td>{truncateText(res.roomInfo, 25) || '정보 없음'}</td>
                <td>{formatDateOnly(res.checkIn)}</td>
                <td>{formatDateOnly(res.checkOut)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

CanceledReservationsTemplate.propTypes = {
  reservations: PropTypes.arrayOf(
    PropTypes.shape({
      _id: PropTypes.string.isRequired,
      customerName: PropTypes.string,
      roomInfo: PropTypes.string,
      checkIn: PropTypes.string,
      checkOut: PropTypes.string,
    })
  ).isRequired,
};

export default CanceledReservationsTemplate;
