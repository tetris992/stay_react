// src/components/InvoiceTemplate.js

import React from 'react';
import PropTypes from 'prop-types';
import './InvoiceTemplate.css'; // 스타일링 추가
import { useTranslation } from 'react-i18next'; // 다국어 지원을 위한 훅 추가

const InvoiceTemplate = ({
  reservation,
  hotelAddress,
  phoneNumber, // 전화번호 prop 추가
  email, // 이메일 prop 추가
  isEditing,
  toggleEditMode,
  handleSave,
  handleChange,
}) => {
  const { t } = useTranslation(); // 번역 함수 가져오기

  const {
    reservationNo,
    customerName,
    checkIn,
    checkOut,
    price,
    reservationDate,
    roomInfo,
    specialRequests,
    nightlyRates,
  } = reservation;

  // 가격 추출 함수 (이미 존재)
  const extractPrice = (priceString) => {
    if (priceString == null) return 0;
    if (typeof priceString === 'number') return priceString;
    if (typeof priceString !== 'string') return 0;

    const salePriceMatch = priceString.match(/판매가\s*([\d,]+)/);
    if (salePriceMatch && salePriceMatch[1]) {
      return parseInt(salePriceMatch[1].replace(/,/g, ''), 10);
    }

    const krwPriceMatch = priceString.match(/KRW\s*([\d,]+)/);
    if (krwPriceMatch && krwPriceMatch[1]) {
      return parseInt(krwPriceMatch[1].replace(/,/g, ''), 10);
    }

    const matches = priceString.match(/[\d,]+/g);
    if (matches && matches.length > 0) {
      const numbers = matches.map((s) => parseInt(s.replace(/,/g, ''), 10));
      return Math.max(...numbers);
    }

    return 0;
  };

  // roomInfo 가공 함수
  const processRoomInfo = (roomInfo) => {
    if (!roomInfo) return t('invoice.infoUnavailable');

    // 괄호 안의 내용을 삭제하고 괄호는 유지
    let processed = roomInfo.replace(/\([^)]*\)/g, '  ');

    // 하이픈 뒤의 내용을 삭제
    if (processed.includes('-')) {
      processed = processed.split('-')[0].trim();
    }

    processed = processed.replace(/\s+/g, ' ');

    return processed || t('invoice.infoUnavailable');
  };

  // 합계 계산
  const totalPrice = nightlyRates
    ? nightlyRates.reduce(
        (acc, curr) => acc + (typeof curr.rate === 'number' ? curr.rate : 0),
        0
      )
    : extractPrice(price);

  return (
    <div className="invoice-template">
      <div className="invoice-header">
        <h1>{t('invoice.title')}</h1> {/* 번역된 제목 사용 */}
        <p>
          <strong>{t('invoice.hotelAddress')}:</strong>{' '}
          {hotelAddress || t('invoice.infoUnavailable')}
        </p>
      </div>
      <div className="invoice-details">
        <p>
          <strong>{t('invoice.reservationNumber')}:</strong>{' '}
          {reservationNo || t('invoice.infoUnavailable')}
        </p>
        <p>
          <strong>{t('invoice.customerName')}:</strong>{' '}
          {isEditing ? (
            <input
              type="text"
              name="customerName"
              value={customerName}
              onChange={(e) => handleChange('customerName', e.target.value)}
            />
          ) : (
            customerName || t('invoice.infoUnavailable')
          )}
        </p>
        <p>
          <strong>{t('invoice.checkIn')}:</strong>{' '}
          {isEditing ? (
            <input
              type="date"
              name="checkIn"
              value={checkIn}
              onChange={(e) => handleChange('checkIn', e.target.value)}
            />
          ) : (
            checkIn || t('invoice.infoUnavailable')
          )}
        </p>
        <p>
          <strong>{t('invoice.checkOut')}:</strong>{' '}
          {isEditing ? (
            <input
              type="date"
              name="checkOut"
              value={checkOut}
              onChange={(e) => handleChange('checkOut', e.target.value)}
            />
          ) : (
            checkOut || t('invoice.infoUnavailable')
          )}
        </p>
        <p>
          <strong>{t('invoice.reservationDate')}:</strong>{' '}
          {isEditing ? (
            <input
              type="date"
              name="reservationDate"
              value={reservationDate}
              onChange={(e) => handleChange('reservationDate', e.target.value)}
            />
          ) : (
            reservationDate || t('invoice.infoUnavailable')
          )}
        </p>
        <p>
          <strong>{t('invoice.roomInfo')}:</strong>{' '}
          {isEditing ? (
            <input
              type="text"
              name="roomInfo"
              value={roomInfo}
              onChange={(e) => handleChange('roomInfo', e.target.value)}
            />
          ) : (
            processRoomInfo(roomInfo) // 가공된 roomInfo 사용
          )}
        </p>
        <p>
          <strong>{t('invoice.specialRequests')}:</strong>{' '}
          {isEditing ? (
            <input
              name="specialRequests"
              value={specialRequests}
              onChange={(e) => handleChange('specialRequests', e.target.value)}
            />
          ) : (
            specialRequests || t('invoice.none')
          )}
        </p>
        <p>
          <strong>{t('invoice.phoneNumber')}:</strong>{' '}
          {phoneNumber || t('invoice.infoUnavailable')}
        </p>
        <p>
          <strong>{t('invoice.email')}:</strong>{' '}
          {email || t('invoice.infoUnavailable')}
        </p>
      </div>

      {nightlyRates && nightlyRates.length > 0 ? (
        <div className="invoice-nightly-rates">
          <h4>{t('invoice.nightlyRates')}</h4>
          <table>
            <thead>
              <tr>
                <th>{t('invoice.date')}</th>
                <th>{t('invoice.rate')}</th>
              </tr>
            </thead>
            <tbody>
              {nightlyRates.map((rate, idx) => (
                <tr key={idx}>
                  <td>{rate.date || t('invoice.infoUnavailable')}</td>
                  <td>{rate.rate ? `${rate.rate.toLocaleString()}` : '0'}</td>
                </tr>
              ))}
              <tr>
                <td>
                  <strong>{t('invoice.total')}</strong>
                </td>
                <td>
                  <strong>{`${totalPrice.toLocaleString()}`}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="invoice-single-rate">
          <h4>{t('invoice.price')}</h4>
          <p>{`${totalPrice.toLocaleString()}`}</p>
        </div>
      )}

      <div className="invoice-footer">
        <p>{t('invoice.thankYou')}</p>
      </div>
    </div>
  );
};

InvoiceTemplate.propTypes = {
  reservation: PropTypes.object.isRequired,
  hotelAddress: PropTypes.string.isRequired,
  phoneNumber: PropTypes.string.isRequired,
  email: PropTypes.string.isRequired,
  isEditing: PropTypes.bool.isRequired,
  toggleEditMode: PropTypes.func.isRequired,
  handleSave: PropTypes.func.isRequired,
  handleChange: PropTypes.func.isRequired,
};

export default InvoiceTemplate;
