// src/components/GuestFormModal.js
import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import './GuestFormModal.css';
import { parseDate } from '../utils/dateParser';
import { format, addDays, startOfDay } from 'date-fns';
import PropTypes from 'prop-types';
import { getDetailedAvailabilityMessage } from '../utils/availability';

const GuestFormModal = ({
  onClose,
  onSave,
  initialData,
  roomTypes,
  availabilityByDate, // 월간/일간 계산 결과
}) => {
  // 폼 상태
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
    roomNumber: '', // 직접 객실번호 지정 가능(필요시)
  });

  // 'none' 타입 제외
  const filteredRoomTypes = useMemo(
    () => roomTypes.filter((rt) => rt.roomInfo.toLowerCase() !== 'none'),
    [roomTypes]
  );

  // 모달 초기화: 수정모드 vs 생성모드
  useEffect(() => {
    if (initialData && initialData._id) {
      // 수정모드
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
        reservationDate:
          initialData.reservationDate || format(new Date(), 'yyyy-MM-dd HH:mm'),
        roomInfo:
          initialData.roomInfo || filteredRoomTypes[0]?.roomInfo || 'Standard',
        price: initialData.price
          ? String(initialData.price)
          : String(filteredRoomTypes[0]?.price || 0),
        paymentMethod: initialData.paymentMethod || 'Pending',
        specialRequests: initialData.specialRequests || '',
        roomNumber: initialData.roomNumber || '',
      });
    } else {
      // 생성모드
      const now = new Date();
      const checkIn = new Date(now);
      checkIn.setHours(16, 0, 0, 0);
      const checkOut = addDays(checkIn, 1);
      checkOut.setHours(11, 0, 0, 0);

      setFormData({
        reservationNo: initialData?.reservationNo || `${Date.now()}`,
        customerName: initialData?.customerName || '', // 현장예약 시 자동명 가능
        phoneNumber: '',
        checkInDate: format(checkIn, 'yyyy-MM-dd'),
        checkInTime: '16:00',
        checkOutDate: format(checkOut, 'yyyy-MM-dd'),
        checkOutTime: '11:00',
        reservationDate: format(new Date(), 'yyyy-MM-dd HH:mm'),
        roomInfo:
          initialData?.roomInfo || filteredRoomTypes[0]?.roomInfo || 'Standard',
        price: String(filteredRoomTypes[0]?.price || 0),
        paymentMethod: 'Pending',
        specialRequests: '',
        roomNumber: '',
      });
    }
  }, [initialData, filteredRoomTypes]);

  // 가격 계산 (의존성: 체크인/체크아웃 날짜, 객실타입 등)
  const [price, setPrice] = useState('0');
  useEffect(() => {
    if (formData.checkInDate && formData.checkOutDate && formData.roomInfo) {
      const checkInDateObj = new Date(
        `${formData.checkInDate}T${formData.checkInTime}:00`
      );
      const checkOutDateObj = new Date(
        `${formData.checkOutDate}T${formData.checkOutTime}:00`
      );
      const nightsStayed = Math.ceil(
        (checkOutDateObj - checkInDateObj) / (1000 * 60 * 60 * 24)
      );
      const selectedRoom = filteredRoomTypes.find(
        (room) => room.roomInfo === formData.roomInfo
      );
      const nightlyPrice = selectedRoom?.price || 0;
      setPrice(String(nightlyPrice * nightsStayed));
    }
  }, [
    formData.checkInDate,
    formData.checkInTime,
    formData.checkOutDate,
    formData.checkOutTime,
    formData.roomInfo,
    filteredRoomTypes,
  ]);

  // input 변경 핸들러
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'roomInfo') {
      const selectedRoom = filteredRoomTypes.find((r) => r.roomInfo === value);
      const nightlyPrice = selectedRoom?.price || 0;
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
        setPrice(String(nightlyPrice * nightsStayed));
      } else {
        setPrice(String(nightlyPrice));
      }
    }
    if (name !== 'price') {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  // 체크인 날짜 변경
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

  // 체크아웃 날짜 변경
  const handleCheckOutDateChange = (e) => {
    const selectedDate = e.target.value;
    const checkInDateObj = new Date(
      `${formData.checkInDate}T${formData.checkInTime}:00`
    );
    const checkOutDateObj = new Date(`${selectedDate}T11:00:00`);
    const nightsStayed = Math.ceil(
      (checkOutDateObj - checkInDateObj) / (1000 * 60 * 60 * 24)
    );
    const selectedRoom = filteredRoomTypes.find(
      (r) => r.roomInfo === formData.roomInfo
    );
    const nightlyPrice = selectedRoom?.price || 0;
    setPrice(String(nightlyPrice * nightsStayed));
    setFormData((prev) => ({
      ...prev,
      checkOutDate: selectedDate,
      checkOutTime: '11:00',
    }));
  };

  // 객실타입 <select>에서 빨간색 표시: 재고 없으면 빨간색
  const isRoomTypeUnavailable = (roomInfo) => {
    if (
      !availabilityByDate ||
      !formData.checkInDate ||
      !formData.checkOutDate
    ) {
      return false;
    }
    const start = new Date(
      `${formData.checkInDate}T${formData.checkInTime}:00`
    );
    const end = new Date(
      `${formData.checkOutDate}T${formData.checkOutTime}:00`
    );

    let cursor = start;
    while (cursor < end) {
      const ds = format(cursor, 'yyyy-MM-dd');
      const availForDay = availabilityByDate[ds]?.[roomInfo.toLowerCase()];
      if (!availForDay || availForDay.remain <= 0) {
        return true;
      }
      cursor = addDays(cursor, 1);
    }
    return false;
  };

  // 폼 제출 → 재고 확인 후 onSave
  const handleSubmit = async (e) => {
    e.preventDefault();
    const numericPrice = parseFloat(formData.price);
    if (isNaN(numericPrice) || numericPrice < 0) {
      alert('가격은 유효한 숫자여야 하며 음수가 될 수 없습니다.');
      return;
    }

    const checkInDateTime = parseDate(
      `${formData.checkInDate}T${formData.checkInTime}:00`
    );
    const checkOutDateTime = parseDate(
      `${formData.checkOutDate}T${formData.checkOutTime}:00`
    );
    if (!checkInDateTime || !checkOutDateTime) {
      alert('유효한 체크인/체크아웃 날짜와 시간을 입력해주세요.');
      return;
    }
    if (checkInDateTime >= checkOutDateTime) {
      alert('체크인 날짜/시간은 체크아웃보다 이전이어야 합니다.');
      return;
    }

    // 현장예약 과거 날짜 제한 (생성모드에서만)
    if (
      !initialData?._id &&
      formData.customerName.includes('현장') &&
      checkInDateTime < startOfDay(new Date())
    ) {
      alert('현장예약은 과거 날짜로 생성할 수 없습니다.');
      return;
    }

    // 재고 확인: [checkIn, checkOut) 범위 순회
    const tKey = formData.roomInfo.toLowerCase();
    let cursor = new Date(checkInDateTime);
    let missingDates = [];
    let commonRooms = null;
    while (cursor < checkOutDateTime) {
      const ds = format(cursor, 'yyyy-MM-dd');
      const availForDay = availabilityByDate[ds]?.[tKey];
      if (!availForDay || availForDay.remain <= 0) {
        missingDates.push(ds);
      } else {
        const freeRooms = availForDay.leftoverRooms || [];
        if (!commonRooms) {
          commonRooms = new Set(freeRooms);
        } else {
          commonRooms = new Set(
            [...commonRooms].filter((room) => freeRooms.includes(room))
          );
        }
      }
      cursor = addDays(cursor, 1);
    }

    if (!commonRooms || commonRooms.size === 0 || missingDates.length > 0) {
      // 재고 부족 상세 메시지
      const detailedMsg = getDetailedAvailabilityMessage(
        startOfDay(checkInDateTime),
        startOfDay(checkOutDateTime),
        tKey,
        availabilityByDate
      );
      alert(detailedMsg);
      return;
    }

    // 교집합 중 가장 작은 객실번호 선택 (직접 form에 roomNumber 필드 추가 가능)
    const selectedRoomNumber =
      formData.roomNumber ||
      [...commonRooms].sort((a, b) => parseInt(a) - parseInt(b))[0];

    // 최종 예약 데이터
    const finalData = {
      ...formData,
      price: numericPrice,
      checkIn: format(checkInDateTime, "yyyy-MM-dd'T'HH:mm:ss"),
      checkOut: format(checkOutDateTime, "yyyy-MM-dd'T'HH:mm:ss"),
      roomNumber: String(selectedRoomNumber),
      siteName: '현장예약',
    };

    try {
      if (initialData?._id) {
        await onSave(initialData._id, finalData);
      } else {
        await onSave(null, finalData);
      }
      onClose();
    } catch (error) {
      const errorMessage =
        error.status === 403
          ? 'CSRF 토큰 오류: 페이지를 새로고침 후 다시 시도해주세요.'
          : error.response?.data?.message ||
            error.message ||
            '예약 저장에 실패했습니다. 다시 시도해주세요.';
      alert(errorMessage);
      console.error('예약 저장 오류:', error);
    }
  };

  return ReactDOM.createPortal(
    <div className="guest-form-modal">
      <div className="modal-card">
        <span className="close-button" onClick={onClose}>
          ×
        </span>
        <h2>{initialData?._id ? '예약 수정' : '현장 예약 입력'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="modal-row">
            <label htmlFor="reservationNo">
              예약번호:
              <input
                id="reservationNo"
                type="text"
                name="reservationNo"
                value={formData.reservationNo}
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
          </div>
          <div className="modal-row">
            <label htmlFor="phoneNumber">
              연락처:
              <input
                id="phoneNumber"
                type="text"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleInputChange}
                required
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
          </div>
          <div className="modal-row">
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
                value={formData.reservationDate}
                readOnly
              />
            </label>
          </div>
          <div className="modal-row">
            <label htmlFor="roomInfo">
              객실타입:
              <select
                id="roomInfo"
                name="roomInfo"
                value={formData.roomInfo}
                onChange={handleInputChange}
                required
              >
                {filteredRoomTypes.map((rt) => {
                  const unavailable = isRoomTypeUnavailable(rt.roomInfo);
                  return (
                    <option
                      key={rt.roomInfo}
                      value={rt.roomInfo}
                      style={{ color: unavailable ? 'red' : 'inherit' }}
                    >
                      {rt.roomInfo}
                    </option>
                  );
                })}
              </select>
            </label>
            <label htmlFor="price">
              가격 (KRW):
              <input
                id="price"
                type="number"
                name="price"
                value={price}
                readOnly
                required
              />
            </label>
          </div>
          <div className="modal-row">
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
          </div>
          <div className="guest-form-actions">
            <button
              type="button"
              onClick={onClose}
              className="guest-form-button guest-form-cancel"
            >
              취소
            </button>
            <button type="submit" className="guest-form-button guest-form-save">
              저장
            </button>
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
      roomInfo: PropTypes.string.isRequired,
      price: PropTypes.number.isRequired,
    })
  ).isRequired,
  availabilityByDate: PropTypes.object.isRequired,
};

export default GuestFormModal;
