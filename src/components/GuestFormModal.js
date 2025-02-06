// src/components/GuestFormModal.js
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom'; // Portal 사용을 위해 추가
import './GuestFormModal.css';
import { parseDate } from '../utils/dateParser.js';
import { format, addDays } from 'date-fns';
import PropTypes from 'prop-types';

const GuestFormModal = ({ onClose, onSave, initialData, roomTypes }) => {
  const [formData, setFormData] = useState({
    reservationNo: '',
    customerName: '',
    phoneNumber: '',
    checkInDate: '',
    checkInTime: '',
    checkOutDate: '',
    checkOutTime: '',
    reservationDate: '',
    roomInfo: '',
    price: '',
    paymentMethod: '',
    specialRequests: '',
  });

  // 초기 데이터가 있으면 (수정 모드) formData 초기화
  useEffect(() => {
    if (initialData) {
      const checkInDateObj = new Date(initialData.checkIn);
      const checkOutDateObj = new Date(initialData.checkOut);
      setFormData({
        reservationNo: initialData.reservationNo || '',
        customerName: initialData.customerName || '',
        phoneNumber: initialData.phoneNumber || '',
        checkInDate: format(checkInDateObj, 'yyyy-MM-dd'),
        checkInTime: format(checkInDateObj, 'HH:mm'),
        checkOutDate: format(checkOutDateObj, 'yyyy-MM-dd'),
        checkOutTime: format(checkOutDateObj, 'HH:mm'),
        reservationDate: initialData.reservationDate
          ? format(new Date(initialData.reservationDate), 'yyyy-MM-dd HH:mm')
          : format(new Date(), 'yyyy-MM-dd HH:mm'),
        roomInfo: initialData.roomInfo || (roomTypes.length > 0 ? roomTypes[0].type : ''),
        price: initialData.price ? initialData.price.toString() : '',
        paymentMethod: initialData.paymentMethod || 'Pending',
        specialRequests: initialData.specialRequests || '',
      });
    }
  }, [initialData, roomTypes]);

  // 생성 모드: 초기 데이터가 없으면 기본값 설정
  useEffect(() => {
    if (!initialData) {
      const now = new Date();
      setFormData({
        reservationNo: `${Date.now()}`,
        customerName: '',
        phoneNumber: '',
        checkInDate: format(now, 'yyyy-MM-dd'),
        checkInTime: '16:00', // 기본 체크인 시간: 오후 4시
        checkOutDate: format(addDays(now, 1), 'yyyy-MM-dd'),
        checkOutTime: '11:00', // 기본 체크아웃 시간: 오전 11시
        reservationDate: format(now, 'yyyy-MM-dd HH:mm'),
        roomInfo: roomTypes.length > 0 ? roomTypes[0].type : 'Standard',
        price: roomTypes.length > 0 ? roomTypes[0].price.toString() : '',
        paymentMethod: 'Pending',
        specialRequests: '',
      });
    }
  }, [initialData, roomTypes]);

  // 입력값(체크인, 체크아웃, 객실타입)이 바뀔 때마다 숙박일수에 따른 가격 재계산
  useEffect(() => {
    if (formData.checkInDate && formData.checkOutDate && formData.roomInfo) {
      const checkInDateObj = new Date(`${formData.checkInDate}T${formData.checkInTime}:00`);
      const checkOutDateObj = new Date(`${formData.checkOutDate}T${formData.checkOutTime}:00`);
      const nightsStayed = Math.ceil((checkOutDateObj - checkInDateObj) / (1000 * 60 * 60 * 24));
      const selectedRoom = roomTypes.find(room => room.type === formData.roomInfo);
      const nightlyPrice = selectedRoom ? selectedRoom.price : 0;
      const totalPrice = nightlyPrice * nightsStayed;
      if (totalPrice.toString() !== formData.price) {
        setFormData(prev => ({ ...prev, price: totalPrice.toString() }));
      }
    }
  }, [
    formData.checkInDate,
    formData.checkInTime,
    formData.checkOutDate,
    formData.checkOutTime,
    formData.roomInfo,
    roomTypes
  ]);

  const handlePriceIncrement = () => {
    const currentPrice = parseInt(formData.price || '0', 10);
    const newPrice = currentPrice + 1000;
    setFormData(prev => ({ ...prev, price: newPrice.toString() }));
  };

  const handlePriceDecrement = () => {
    const currentPrice = parseInt(formData.price || '0', 10);
    const newPrice = currentPrice - 1000;
    if (newPrice >= 0) {
      setFormData(prev => ({ ...prev, price: newPrice.toString() }));
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'roomInfo') {
      const selectedRoom = roomTypes.find(room => room.type === value);
      const nightlyPrice = selectedRoom ? selectedRoom.price : 0;
      if (formData.checkInDate && formData.checkOutDate) {
        const checkInDateObj = new Date(`${formData.checkInDate}T${formData.checkInTime}:00`);
        const checkOutDateObj = new Date(`${formData.checkOutDate}T${formData.checkOutTime}:00`);
        const nightsStayed = Math.ceil((checkOutDateObj - checkInDateObj) / (1000 * 60 * 60 * 24));
        const totalPrice = nightlyPrice * nightsStayed;
        setFormData(prev => ({ ...prev, [name]: value, price: totalPrice.toString() }));
      } else {
        setFormData(prev => ({ ...prev, [name]: value, price: nightlyPrice.toString() }));
      }
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleCheckInDateChange = (e) => {
    const selectedDate = e.target.value;
    const defaultCheckInTime = '16:00';
    const checkInDateObj = new Date(`${selectedDate}T${defaultCheckInTime}:00`);
    const checkOutDateObj = addDays(checkInDateObj, 1);
    checkOutDateObj.setHours(11, 0, 0, 0);
    setFormData(prev => ({
      ...prev,
      checkInDate: selectedDate,
      checkInTime: defaultCheckInTime,
      checkOutDate: format(checkOutDateObj, 'yyyy-MM-dd'),
      checkOutTime: '11:00',
    }));
  };

  const handleCheckOutDateChange = (e) => {
    const selectedDate = e.target.value;
    const checkInDateObj = new Date(`${formData.checkInDate}T${formData.checkInTime}:00`);
    const checkOutDateObj = new Date(`${selectedDate}T${formData.checkOutTime}:00`);
    const nightsStayed = Math.ceil((checkOutDateObj - checkInDateObj) / (1000 * 60 * 60 * 24));
    const selectedRoom = roomTypes.find(room => room.type === formData.roomInfo);
    const nightlyPrice = selectedRoom ? selectedRoom.price : 0;
    const totalPrice = nightlyPrice * nightsStayed;
    setFormData(prev => ({ ...prev, checkOutDate: selectedDate, price: totalPrice.toString() }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const numericPrice = parseFloat(formData.price);
    if (isNaN(numericPrice) || numericPrice < 0) {
      alert('가격은 유효한 숫자여야 하며 음수가 될 수 없습니다.');
      return;
    }

    const checkInDateTime = parseDate(`${formData.checkInDate}T${formData.checkInTime}:00`);
    const checkOutDateTime = parseDate(`${formData.checkOutDate}T${formData.checkOutTime}:00`);

    if (!checkInDateTime || !checkOutDateTime) {
      alert('유효한 체크인/체크아웃 날짜와 시간을 입력해주세요.');
      return;
    }

    if (checkInDateTime >= checkOutDateTime) {
      alert('체크인 날짜/시간은 체크아웃보다 이전이어야 합니다.');
      return;
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (!initialData && formData.customerName.includes('현장') && checkInDateTime < todayStart) {
      alert('현장예약은 과거 예약으로 생성할 수 없습니다. 체크인 날짜를 수정해주세요.');
      return;
    }

    const finalData = {
      ...formData,
      price: numericPrice,
      checkIn: format(checkInDateTime, "yyyy-MM-dd'T'HH:mm"),
      checkOut: format(checkOutDateTime, "yyyy-MM-dd'T'HH:mm"),
    };

    try {
      if (initialData && initialData._id) {
        await onSave(initialData._id, finalData);
      } else {
        await onSave(null, finalData);
        alert('예약이 성공적으로 저장되었습니다.');
      }
      onClose();
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || '예약 저장에 실패했습니다. 다시 시도해주세요.';
      alert(errorMessage);
      console.error('예약 저장 오류:', error);
    }
  };

  return ReactDOM.createPortal(
    <div className="guest-form-modal">
      <div className="modal-card">
        <span className="close-button" onClick={onClose}>&times;</span>
        <h2>현장 예약 입력</h2>
        <form onSubmit={handleSubmit}>
          <label htmlFor="reservationNo">
            예약번호:
            <input
              id="reservationNo"
              type="text"
              name="reservationNo"
              value={formData.reservationNo || ''}
              readOnly
            />
          </label>
          <label htmlFor="customerName">
            예약자:
            <input
              id="customerName"
              type="text"
              name="customerName"
              value={formData.customerName}
              onChange={handleInputChange}
              required
            />
          </label>
          <label htmlFor="phoneNumber">
            연락처:
            <input
              id="phoneNumber"
              type="text"
              name="phoneNumber"
              value={formData.phoneNumber}
              onChange={handleInputChange}
            />
          </label>
          <label htmlFor="checkInDate">
            체크인 (오후 4시):
            <input
              id="checkInDate"
              type="date"
              name="checkInDate"
              value={formData.checkInDate}
              onChange={handleCheckInDateChange}
              required
            />
          </label>
          <label htmlFor="checkOutDate">
            체크아웃 (오전 11시):
            <input
              id="checkOutDate"
              type="date"
              name="checkOutDate"
              value={formData.checkOutDate}
              onChange={handleCheckOutDateChange}
              required
            />
          </label>
          <label htmlFor="reservationDate">
            예약시간:
            <input
              id="reservationDate"
              type="text"
              name="reservationDate"
              value={formData.reservationDate || ''}
              readOnly
            />
          </label>
          <label htmlFor="roomInfo">
            객실타입:
            <select
              id="roomInfo"
              name="roomInfo"
              value={formData.roomInfo}
              onChange={handleInputChange}
              required
            >
              {roomTypes && roomTypes.length > 0 ? (
                roomTypes.map((room, index) =>
                  room.type ? (
                    <option key={index} value={room.type}>
                      {room.type.charAt(0).toUpperCase() + room.type.slice(1)}
                    </option>
                  ) : (
                    <option key={index} value="">
                      Unknown Room Type
                    </option>
                  )
                )
              ) : (
                <option value="Standard">Standard</option>
              )}
            </select>
          </label>
          <label htmlFor="price">
            가격 (KRW):
            <div className="price-input-wrapper">
              <input
                id="price"
                type="number"
                name="price"
                value={formData.price}
                onChange={handleInputChange}
                min="0"
                step="1000"
                required
              />
              <div className="price-buttons">
                <button
                  type="button"
                  className="price-decrement"
                  onClick={handlePriceDecrement}
                  aria-label="가격 감소"
                >
                  –
                </button>
                <button
                  type="button"
                  className="price-increment"
                  onClick={handlePriceIncrement}
                  aria-label="가격 증가"
                >
                  +
                </button>
              </div>
            </div>
          </label>
          <label htmlFor="paymentMethod">
            결제방법/상태:
            <select
              id="paymentMethod"
              name="paymentMethod"
              value={formData.paymentMethod}
              onChange={handleInputChange}
              required
            >
              <option value="Card">Card</option>
              <option value="Cash">Cash</option>
              <option value="Account Transfer">Account Transfer</option>
              <option value="Pending">Pending</option>
            </select>
          </label>
          <label htmlFor="specialRequests">
            고객요청:
            <input
              id="specialRequests"
              type="text"
              name="specialRequests"
              value={formData.specialRequests}
              onChange={handleInputChange}
            />
          </label>
          <div className="modal-actions">
            <button type="button" onClick={onClose}>취소</button>
            <button type="submit">저장</button>
          </div>
        </form>
      </div>
    </div>,
    document.getElementById('modal-root')
  );
};

GuestFormModal.propTypes = {
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  initialData: PropTypes.object,
  roomTypes: PropTypes.arrayOf(
    PropTypes.shape({
      type: PropTypes.string.isRequired,
      price: PropTypes.number.isRequired,
    })
  ).isRequired,
};

export default GuestFormModal;
