// src/components/GuestFormModal.js

import React, { useState, useEffect } from 'react';
import './GuestFormModal.css';
import { parseDate } from '../utils/dateParser.js';
import { format, addDays } from 'date-fns';
import PropTypes from 'prop-types';

const GuestFormModal = ({ onClose, onSave, initialData, roomTypes }) => {
  // console.log('Initial data:', initialData); // 디버깅용 로그
  // console.log('roomTypes:', roomTypes); // 디버깅용 로그

  const [formData, setFormData] = useState({
    reservationNo: '',
    customerName: '',
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

  // initialData가 변경될 때마다 formData를 업데이트
  useEffect(() => {
    if (initialData) {
      const checkInDateObj = new Date(initialData.checkIn);
      const checkOutDateObj = new Date(initialData.checkOut);
      const checkInDate = format(checkInDateObj, 'yyyy-MM-dd');
      const checkInTime = format(checkInDateObj, 'HH:mm');
      const checkOutDate = format(checkOutDateObj, 'yyyy-MM-dd');
      const checkOutTime = format(checkOutDateObj, 'HH:mm');

      setFormData({
        reservationNo: initialData.reservationNo || '',
        customerName: initialData.customerName || '',
        checkInDate,
        checkInTime,
        checkOutDate,
        checkOutTime,
        reservationDate: initialData.reservationDate
          ? format(new Date(initialData.reservationDate), 'yyyy-MM-dd HH:mm')
          : format(new Date(), 'yyyy-MM-dd HH:mm'),
        roomInfo:
          initialData.roomInfo ||
          (roomTypes.length > 0 ? roomTypes[0].type : ''),
        price: initialData.price ? initialData.price.toString() : '',
        paymentMethod: initialData.paymentMethod || 'Pending',
        specialRequests: initialData.specialRequests || '',
      });
    }
  }, [initialData, roomTypes]);

  // 초기 체크인과 체크아웃 시간 설정 (새 예약 시)
  useEffect(() => {
    if (!initialData) {
      const now = new Date();
      const initialCheckInDate = format(now, 'yyyy-MM-dd');
      const initialCheckInTime = '16:00'; // 오후 4시로 설정
      const initialCheckOutDate = format(addDays(now, 1), 'yyyy-MM-dd');
      const initialCheckOutTime = '11:00'; // 오전 11시로 설정

      // 기본 객실 타입 설정 (첫 번째 roomTypes가 있는 경우 그 타입, 없으면 'Standard')
      const defaultRoomInfo =
        roomTypes.length > 0 ? roomTypes[0].type : 'Standard';
      const defaultPrice =
        roomTypes.length > 0 ? roomTypes[0].price.toString() : '';

      setFormData((prevData) => ({
        ...prevData,
        reservationNo: `${Date.now()}`,
        checkInDate: initialCheckInDate,
        checkInTime: initialCheckInTime,
        checkOutDate: initialCheckOutDate,
        checkOutTime: initialCheckOutTime,
        reservationDate: format(now, 'yyyy-MM-dd HH:mm'),
        roomInfo: defaultRoomInfo,
        price: defaultPrice,
        paymentMethod: 'Pending',
      }));
    }
  }, [initialData, roomTypes]);

  // 모든 입력 필드의 변경을 처리하는 핸들러
  const handleInputChange = (e) => {
    const { name, value } = e.target;

    if (name === 'roomInfo') {
      const selectedRoom = roomTypes.find((room) => room.type === value);
      const nightlyPrice = selectedRoom ? selectedRoom.price : 0;

      if (formData.checkInDate && formData.checkOutDate) {
        const checkInDateObj = new Date(
          `${formData.checkInDate}T${formData.checkInTime}:00`
        );
        const checkOutDateObj = new Date(
          `${formData.checkOutDate}T${formData.checkOutTime}:00`
        );
        const nightsStayed = Math.ceil(
          (checkOutDateObj - checkInDateObj) / (1000 * 60 * 60 * 24)
        );

        const totalPrice = nightlyPrice * nightsStayed;
        setFormData((prevData) => ({
          ...prevData,
          [name]: value,
          price: totalPrice.toString(),
        }));
      } else {
        setFormData((prevData) => ({
          ...prevData,
          [name]: value,
          price: nightlyPrice.toString(),
        }));
      }
    } else {
      setFormData((prevData) => ({ ...prevData, [name]: value }));
    }
  };

  // 체크인 날짜 변경 시 호출되는 핸들러
  const handleCheckInDateChange = (e) => {
    const selectedDate = e.target.value; // 'YYYY-MM-DD' 형식
    const formattedCheckInTime = '16:00'; // 오후 4시로 설정

    // 기본적으로 1박으로 설정 (필요 시 수정)
    const checkInDateObj = new Date(
      `${selectedDate}T${formattedCheckInTime}:00`
    );
    const checkOutDateObj = addDays(checkInDateObj, 1);
    checkOutDateObj.setHours(11, 0, 0, 0); // 오전 11시로 설정

    const formattedCheckOutDate = format(checkOutDateObj, 'yyyy-MM-dd');
    const formattedCheckOutTime = '11:00'; // 오전 11시로 설정

    setFormData((prevData) => ({
      ...prevData,
      checkInDate: selectedDate,
      checkInTime: formattedCheckInTime,
      checkOutDate: formattedCheckOutDate,
      checkOutTime: formattedCheckOutTime,
    }));
  };

  // 체크아웃 날짜 변경 시 호출되는 핸들러
  const handleCheckOutDateChange = (e) => {
    const selectedDate = e.target.value;

    // 체크인 및 체크아웃 날짜 객체 생성
    const checkInDateObj = new Date(
      `${formData.checkInDate}T${formData.checkInTime}:00`
    );
    const checkOutDateObj = new Date(
      `${selectedDate}T${formData.checkOutTime}:00`
    );

    const nightsStayed = Math.ceil(
      (checkOutDateObj - checkInDateObj) / (1000 * 60 * 60 * 24)
    );

    const selectedRoom = roomTypes.find(
      (room) => room.type === formData.roomInfo
    );
    const nightlyPrice = selectedRoom ? selectedRoom.price : 0;
    const totalPrice = nightlyPrice * nightsStayed;

    setFormData((prevData) => ({
      ...prevData,
      checkOutDate: selectedDate,
      price: totalPrice.toString(),
    }));
  };

  // 폼 제출 시 호출되는 핸들러
  const handleSubmit = async (e) => {
    e.preventDefault();

    const numericPrice = parseFloat(formData.price);

    if (isNaN(numericPrice) || numericPrice < 0) {
      alert('가격은 유효한 숫자여야 하며, 음수가 될 수 없습니다.');
      return;
    }
    // 체크인 날짜와 체크아웃 날짜 및 시간이 유효한지 확인
    const checkInDateTime = parseDate(
      `${formData.checkInDate} ${formData.checkInTime}`
    );
    const checkOutDateTime = parseDate(
      `${formData.checkOutDate} ${formData.checkOutTime}`
    );

    if (!checkInDateTime || !checkOutDateTime) {
      alert('유효한 체크인 및 체크아웃 날짜와 시간을 입력해주세요.');
      return;
    }

    if (checkInDateTime >= checkOutDateTime) {
      alert('체크인 날짜와 시간은 체크아웃 날짜와 시간보다 이전이어야 합니다.');
      return;
    }

    // 최종 데이터 구성
    const finalData = {
      ...formData,
      price: numericPrice, // 숫자로 저장
      checkIn: format(checkInDateTime, 'yyyy-MM-dd HH:mm'),
      checkOut: format(checkOutDateTime, 'yyyy-MM-dd HH:mm'),
      // siteName: '현장예약',
    };

    if (initialData && initialData._id) {
      // 수정 모드
      const reservationId = initialData._id;
      try {
        await onSave(reservationId, finalData); // reservationId와 finalData 전달
        // alert('예약이 성공적으로 저장되었습니다.');
        onClose();
      } catch (error) {
        alert('예약 저장에 실패했습니다. 다시 시도해주세요.');
        console.error('예약 저장 오류:', error);
      }
    } else {
      // 생성 모드
      try {
        await onSave(null, finalData); // finalData만 전달
        alert('예약이 성공적으로 저장되었습니다.');
        onClose();
      } catch (error) {
        alert('예약 저장에 실패했습니다. 다시 시도해주세요.');
        console.error('예약 저장 오류:', error);
      }
    }
  };

  return (
    <div className="guest-form-modal">
      <div className="modal-card">
        <span className="close-button" onClick={onClose}>
          &times;
        </span>
        <h2>현장 예약 입력</h2>
        <form onSubmit={handleSubmit}>
          {/* 예약번호 필드 (읽기 전용) */}
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

          {/* 예약자 이름 입력 필드 */}
          <label htmlFor="customerName">
            예약자:
            <input
              id="customerName"
              type="text"
              name="customerName"
              value={formData.customerName || ''}
              onChange={handleInputChange}
              required
            />
          </label>

          {/* 체크인 날짜 입력 필드 */}
          <label htmlFor="checkInDate">
            체크인 (오후 4시):
            <input
              id="checkInDate"
              type="date"
              name="checkInDate"
              value={formData.checkInDate || ''}
              onChange={handleCheckInDateChange}
              required
            />
          </label>

          {/* 체크아웃 날짜 입력 필드 */}
          <label htmlFor="checkOutDate">
            체크아웃 (오전 11시):
            <input
              id="checkOutDate"
              type="date"
              name="checkOutDate"
              value={formData.checkOutDate || ''}
              onChange={handleCheckOutDateChange}
              required
            />
          </label>

          {/* 예약시간 필드 (읽기 전용) */}
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

          {/* 객실타입 선택 필드 */}
          <label htmlFor="roomInfo">
            객실타입:
            <select
              id="roomInfo"
              name="roomInfo"
              value={formData.roomInfo || ''}
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

          {/* 가격 입력 필드 */}
          <label htmlFor="price">
            가격 (KRW):
            <input
              id="price"
              type="number"
              name="price"
              value={formData.price || ''}
              onChange={handleInputChange}
              min="0"
              step="1" // 소수점 없이 정수만 허용
              required
            />
          </label>

          {/* 결제방법/상태 선택 필드 */}
          <label htmlFor="paymentMethod">
            결제방법/상태:
            <select
              id="paymentMethod"
              name="paymentMethod"
              value={formData.paymentMethod || 'Pending'}
              onChange={handleInputChange}
              required
            >
              <option value="Card">Card</option>
              <option value="Cash">Cash</option>
              <option value="Account Transfer">Account Transfer</option>
              <option value="Pending">Pending</option>
            </select>
          </label>

          {/* 고객요청 입력 필드 */}
          <label htmlFor="specialRequests">
            고객요청:
            <input
              id="specialRequests"
              type="text"
              name="specialRequests"
              value={formData.specialRequests || ''}
              onChange={handleInputChange}
            />
          </label>

          {/* 모달 액션 버튼 */}
          <div className="modal-actions">
            <button type="button" onClick={onClose}>
              취소
            </button>
            <button type="submit">저장</button>
          </div>
        </form>
      </div>
    </div>
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
