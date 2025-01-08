// src/components/EditReservationModal.js

import React, { useState } from 'react';
import Modal from 'react-modal';
import PropTypes from 'prop-types';
import './EditReservationModal.css'; // 스타일링 파일
import { parseDate } from '../utils/dateParser.js';
import { format } from 'date-fns';


const EditReservationModal = ({
  isOpen,
  onRequestClose,
  reservation,
  onSave,
}) => {
  const [formData, setFormData] = useState({
    customerName: reservation.customerName || '',
    checkIn: reservation.checkIn || '',
    checkOut: reservation.checkOut || '',
    roomInfo: reservation.roomInfo || '',
    price: reservation.price || '',
    paymentMethod: reservation.paymentMethod || 'Pending',
    specialRequests: reservation.specialRequests || '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // 필수 필드 검증 (예: 고객 이름, 체크인/체크아웃 날짜)
    if (!formData.customerName || !formData.checkIn || !formData.checkOut) {
      alert('고객 이름과 체크인/체크아웃 날짜는 필수 항목입니다.');
      return;
    }

    // 날짜 유효성 검사
    const checkInDate = parseDate(formData.checkIn);
    const checkOutDate = parseDate(formData.checkOut);

    if (!checkInDate || !checkOutDate || checkOutDate <= checkInDate) {
      alert('체크아웃 날짜는 체크인 날짜보다 이후여야 합니다.');
      return;
    }

    // 가격 유효성 검사
    const priceNumber = parseInt(formData.price, 10);
    if (isNaN(priceNumber) || priceNumber < 0) {
      alert('가격은 유효한 숫자여야 합니다.');
      return;
    }

    // 수정된 예약 정보 객체 생성
    const updatedReservation = {
      ...reservation,
      customerName: formData.customerName,
      checkIn: format(checkInDate, 'yyyy-MM-dd HH:mm'),
      checkOut: format(checkOutDate, 'yyyy-MM-dd HH:mm'),
      roomInfo: formData.roomInfo,
      price: formData.price,
      paymentMethod: formData.paymentMethod,
      specialRequests: formData.specialRequests,
    };

    // 부모 컴포넌트로 수정된 예약 정보 전달
    onSave(updatedReservation);
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onRequestClose}
      contentLabel="Edit Reservation"
      className="modal"
      overlayClassName="overlay"
    >
      <h2>예약 수정</h2>
      <form onSubmit={handleSubmit} className="edit-reservation-form">
        <label>
          예약자 이름:
          <input
            type="text"
            name="customerName"
            value={formData.customerName}
            onChange={handleChange}
            required
          />
        </label>
        <label>
          체크인 날짜:
          <input
            type="datetime-local"
            name="checkIn"
            value={format(parseDate(formData.checkIn), "yyyy-MM-dd'T'HH:mm")}
            onChange={handleChange}
            required
          />
        </label>
        <label>
          체크아웃 날짜:
          <input
            type="datetime-local"
            name="checkOut"
            value={format(parseDate(formData.checkOut), "yyyy-MM-dd'T'HH:mm")}
            onChange={handleChange}
            required
          />
        </label>
        <label>
          객실 정보:
          <input
            type="text"
            name="roomInfo"
            value={formData.roomInfo}
            onChange={handleChange}
          />
        </label>
        <label>
          가격:
          <input
            type="number"
            name="price"
            value={formData.price}
            onChange={handleChange}
            min="0"
          />
        </label>
        <label>
          결제 방법:
          <select
            name="paymentMethod"
            value={formData.paymentMethod}
            onChange={handleChange}
          >
            <option value="Pending">대기 중</option>
            <option value="Card">신용카드</option>
            <option value="Cash">현금</option>
            <option value="Account Transfer">계좌 이체</option>
            {/* 필요한 결제 방법 추가 */}
          </select>
        </label>
        <label>
          고객 요청 사항:
          <textarea
            name="specialRequests"
            value={formData.specialRequests}
            onChange={handleChange}
          />
        </label>
        <div className="modal-buttons">
          <button type="submit" className="save-button">
            저장
          </button>
          <button
            type="button"
            className="cancel-button"
            onClick={onRequestClose}
          >
            취소
          </button>
        </div>
      </form>
    </Modal>
  );
};

EditReservationModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onRequestClose: PropTypes.func.isRequired,
  reservation: PropTypes.object.isRequired,
  onSave: PropTypes.func.isRequired,
};

export default EditReservationModal;
