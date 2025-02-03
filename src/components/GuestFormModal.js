import React, { useState, useEffect } from 'react';
import './GuestFormModal.css';
import { parseDate } from '../utils/dateParser.js';
import { format, addDays } from 'date-fns';
import PropTypes from 'prop-types';

/**
 * GuestFormModal 컴포넌트
 * - 현장 예약 생성 또는 수정 시 예약 정보를 입력하는 모달 폼입니다.
 * - 초기 데이터(initialData)가 있으면 수정 모드, 없으면 생성 모드로 작동합니다.
 */
const GuestFormModal = ({ onClose, onSave, initialData, roomTypes }) => {
  // 기본 formData 구조 (전화번호 필드 추가)
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

  // 수정 모드: initialData가 있다면 formData 초기화
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
        roomInfo:
          initialData.roomInfo ||
          (roomTypes.length > 0 ? roomTypes[0].type : ''),
        price: initialData.price ? initialData.price.toString() : '',
        paymentMethod: initialData.paymentMethod || 'Pending',
        specialRequests: initialData.specialRequests || '',
      });
    }
  }, [initialData, roomTypes]);

  // 생성 모드: 초기 데이터가 없을 경우 기본값 설정
  useEffect(() => {
    if (!initialData) {
      const now = new Date();
      setFormData((prev) => ({
        ...prev,
        reservationNo: `${Date.now()}`,
        checkInDate: format(now, 'yyyy-MM-dd'),
        checkInTime: '16:00', // 기본 오후 4시
        checkOutDate: format(addDays(now, 1), 'yyyy-MM-dd'),
        checkOutTime: '11:00', // 기본 오전 11시
        reservationDate: format(now, 'yyyy-MM-dd HH:mm'),
        roomInfo: roomTypes.length > 0 ? roomTypes[0].type : 'Standard',
        price: roomTypes.length > 0 ? roomTypes[0].price.toString() : '',
        paymentMethod: 'Pending',
      }));
    }
  }, [initialData, roomTypes]);

  // 가격 증감을 위한 핸들러 (1,000원 단위)
  const handlePriceIncrement = () => {
    const currentPrice = parseInt(formData.price || '0', 10);
    const newPrice = currentPrice + 1000;
    setFormData((prev) => ({ ...prev, price: newPrice.toString() }));
  };

  const handlePriceDecrement = () => {
    const currentPrice = parseInt(formData.price || '0', 10);
    const newPrice = currentPrice - 1000;
    if (newPrice >= 0) {
      setFormData((prev) => ({ ...prev, price: newPrice.toString() }));
    }
  };

  // 입력 변화 핸들러: roomInfo 변경 시 자동 가격 계산 로직 포함
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
        setFormData((prev) => ({
          ...prev,
          [name]: value,
          price: totalPrice.toString(),
        }));
      } else {
        setFormData((prev) => ({
          ...prev,
          [name]: value,
          price: nightlyPrice.toString(),
        }));
      }
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  // 체크인 날짜 변경 시, 체크아웃 날짜와 시간도 자동 업데이트
  const handleCheckInDateChange = (e) => {
    const selectedDate = e.target.value;
    const defaultCheckInTime = '16:00';
    const checkInDateObj = new Date(`${selectedDate}T${defaultCheckInTime}:00`);
    const checkOutDateObj = addDays(checkInDateObj, 1);
    checkOutDateObj.setHours(11, 0, 0, 0);
    setFormData((prev) => ({
      ...prev,
      checkInDate: selectedDate,
      checkInTime: defaultCheckInTime,
      checkOutDate: format(checkOutDateObj, 'yyyy-MM-dd'),
      checkOutTime: '11:00',
    }));
  };

  // 체크아웃 날짜 변경 시, 가격 재계산
  const handleCheckOutDateChange = (e) => {
    const selectedDate = e.target.value;
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
    setFormData((prev) => ({
      ...prev,
      checkOutDate: selectedDate,
      price: totalPrice.toString(),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // 1. 가격 유효성 검사
    const numericPrice = parseFloat(formData.price);
    if (isNaN(numericPrice) || numericPrice < 0) {
      alert('가격은 유효한 숫자여야 하며 음수가 될 수 없습니다.');
      return;
    }

    // 2. 체크인/체크아웃 날짜와 시간을 파싱 (ISO 형식 사용)
    const checkInDateTime = parseDate(
      `${formData.checkInDate}T${formData.checkInTime}:00`
    );
    const checkOutDateTime = parseDate(
      `${formData.checkOutDate}T${formData.checkOutTime}:00`
    );

    // 3. 날짜 파싱 실패 검사
    if (!checkInDateTime || !checkOutDateTime) {
      alert('유효한 체크인/체크아웃 날짜와 시간을 입력해주세요.');
      return;
    }

    // 4. 체크인 시간이 체크아웃 시간보다 이전인지 검사
    if (checkInDateTime >= checkOutDateTime) {
      alert('체크인 날짜/시간은 체크아웃보다 이전이어야 합니다.');
      return;
    }

    // 5. 현장예약(퀵예약)인 경우, 신규 예약 시 체크인 날짜는 오늘 이후여야 함.
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    if (!initialData && formData.customerName.includes('현장')) {
      if (checkInDateTime < todayStart) {
        alert(
          '현장예약은 과거 예약으로 생성할 수 없습니다. 체크인 날짜를 수정해주세요.'
        );
        return;
      }
    }

    // 6. 최종 데이터 구성
    const finalData = {
      ...formData,
      price: numericPrice,
      checkIn: format(checkInDateTime, "yyyy-MM-dd'T'HH:mm"),
      checkOut: format(checkOutDateTime, "yyyy-MM-dd'T'HH:mm"),
    };

    // 7. 저장 요청 및 에러 처리
    try {
      if (initialData && initialData._id) {
        await onSave(initialData._id, finalData);
      } else {
        await onSave(null, finalData);
        alert('예약이 성공적으로 저장되었습니다.');
      }
      onClose();
    } catch (error) {
      // 서버에서 전달된 구체적인 에러 메시지가 있다면 사용
      const errorMessage =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        '예약 저장에 실패했습니다. 다시 시도해주세요.';
      alert(errorMessage);
      console.error('예약 저장 오류:', error);
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
