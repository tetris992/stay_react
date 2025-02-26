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
  availabilityByDate,
}) => {
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

  // filteredRoomTypes를 useMemo로 캐싱
  const filteredRoomTypes = useMemo(
    () => roomTypes.filter((rt) => rt.roomInfo.toLowerCase() !== 'none'),
    [roomTypes]
  );

  // 수정 모드: initialData가 있으면 폼 데이터 초기화 (한 번만 실행)
  useEffect(() => {
    if (initialData) {
      const checkInDateObj = new Date(initialData.checkIn);
      const checkOutDateObj = new Date(initialData.checkOut);
      setFormData({
        reservationNo: initialData.reservationNo || '',
        customerName: initialData.customerName || '', // 빈 문자열로 초기화, 수정 가능
        phoneNumber: initialData.phoneNumber || '', // 빈 문자열로 초기화, 수정 가능
        checkInDate: format(checkInDateObj, 'yyyy-MM-dd'),
        checkInTime: format(checkInDateObj, 'HH:mm'),
        checkOutDate: format(checkOutDateObj, 'yyyy-MM-dd'),
        checkOutTime: format(checkOutDateObj, 'HH:mm'),
        reservationDate: initialData.reservationDate
          ? format(new Date(initialData.reservationDate), 'yyyy-MM-dd HH:mm')
          : format(new Date(), 'yyyy-MM-dd HH:mm'),
        roomInfo:
          initialData.roomInfo ||
          (filteredRoomTypes.length > 0 ? filteredRoomTypes[0].roomInfo : ''),
        price:
          initialData.price !== undefined
            ? initialData.price.toString()
            : filteredRoomTypes.length > 0 &&
              filteredRoomTypes[0].price !== undefined
            ? filteredRoomTypes[0].price.toString()
            : '0',
        paymentMethod: initialData.paymentMethod || 'Pending',
        specialRequests: initialData.specialRequests || '',
      });
    }
  }, [initialData, filteredRoomTypes]);

  // 생성 모드: 초기 데이터가 없으면 기본값 설정 (한 번만 실행)
  useEffect(() => {
    if (!initialData) {
      const now = new Date();
      const checkInDate = format(now, 'yyyy-MM-dd');
      const checkOutDate = format(addDays(now, 1), 'yyyy-MM-dd');
      const selectedRoom = filteredRoomTypes[0];
      const initialPrice = selectedRoom?.price?.toString() || '0';

      setFormData({
        reservationNo: `${Date.now()}`,
        customerName: '', // 기본값 빈 문자열, 수정 가능
        phoneNumber: '', // 기본값 빈 문자열, 수정 가능
        checkInDate,
        checkInTime: '16:00',
        checkOutDate,
        checkOutTime: '11:00',
        reservationDate: format(now, 'yyyy-MM-dd HH:mm'),
        roomInfo: selectedRoom?.roomInfo || 'Standard',
        price: initialPrice,
        paymentMethod: 'Pending',
        specialRequests: '',
      });
    }
  }, [initialData, filteredRoomTypes]);

  // 가격 재계산 (의존성 최적화, price만 별도 상태로 관리)
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
      const totalPrice = nightlyPrice * nightsStayed;
      setPrice(totalPrice.toString());
    }
  }, [
    formData.checkInDate,
    formData.checkInTime,
    formData.checkOutDate,
    formData.checkOutTime,
    formData.roomInfo,
    filteredRoomTypes,
  ]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'roomInfo') {
      const selectedRoom = filteredRoomTypes.find(
        (room) => room.roomInfo === value
      );
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
        const totalPrice = nightlyPrice * nightsStayed;
        setPrice(totalPrice.toString());
      } else {
        setPrice(nightlyPrice.toString());
      }
      setFormData((prev) => ({ ...prev, [name]: value }));
    } else if (name !== 'price') {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

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
    const selectedRoom = filteredRoomTypes.find(
      (room) => room.roomInfo === formData.roomInfo
    );
    const nightlyPrice = selectedRoom?.price || 0;
    const totalPrice = nightlyPrice * nightsStayed;
    setPrice(totalPrice.toString());
    setFormData((prev) => ({
      ...prev,
      checkOutDate: selectedDate,
    }));
  };

  const isRoomTypeUnavailable = (roomInfo) => {
    if (!availabilityByDate || !formData.checkInDate || !formData.checkOutDate)
      return false;
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('Form Data:', formData); // 디버깅 로그 추가

    const numericPrice = parseFloat(price);
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
    const now = new Date();
    const todayStart = startOfDay(now);
    if (
      !initialData &&
      formData.customerName.includes('현장') &&
      checkInDateTime < todayStart
    ) {
      alert(
        '현장예약은 과거 예약으로 생성할 수 없습니다. 체크인 날짜를 수정해주세요.'
      );
      return;
    }

    const tKey = formData.roomInfo.toLowerCase();
    let cursor = new Date(checkInDateTime);
    let commonRooms = null;
    let missingDates = [];
    while (cursor < checkOutDateTime) {
      const ds = format(cursor, 'yyyy-MM-dd');
      const availForDay = availabilityByDate[ds]?.[tKey];
      if (!availForDay || availForDay.remain <= 0) {
        missingDates.push(ds);
      } else {
        const freeRooms = availForDay.leftoverRooms || [];
        if (commonRooms === null) {
          commonRooms = new Set(freeRooms);
        } else {
          commonRooms = new Set(
            [...commonRooms].filter((room) => freeRooms.includes(room))
          );
        }
      }
      cursor = addDays(cursor, 1);
    }

    if (missingDates.length > 0 || !commonRooms || commonRooms.size === 0) {
      const detailedMsg = getDetailedAvailabilityMessage(
        startOfDay(checkInDateTime),
        addDays(startOfDay(checkOutDateTime), -1),
        tKey,
        availabilityByDate
      );
      alert(detailedMsg);
      return;
    }

    const selectedRoomNumber = Array.from(commonRooms).sort((a, b) => a - b)[0];

    const finalData = {
      ...formData,
      price: numericPrice,
      checkIn: format(checkInDateTime, "yyyy-MM-dd'T'HH:mm:ss"),
      checkOut: format(checkOutDateTime, "yyyy-MM-dd'T'HH:mm:ss"),
      roomNumber: String(selectedRoomNumber),
      siteName: '현장예약',
    };

    try {
      if (initialData && initialData._id) {
        await onSave(initialData._id, finalData);
      } else {
        await onSave(null, finalData);
        console.log('예약이 성공적으로 저장되었습니다.');
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
        <h2>현장 예약 입력</h2>
        <form onSubmit={handleSubmit}>
          <div className="modal-row">
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
                value={formData.reservationDate || ''}
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
                {filteredRoomTypes.length > 0 ? (
                  filteredRoomTypes.map((room, index) => (
                    <option
                      key={index}
                      value={room.roomInfo}
                      style={{
                        color: isRoomTypeUnavailable(room.roomInfo)
                          ? 'red'
                          : 'inherit',
                      }}
                    >
                      {room.roomInfo.charAt(0).toUpperCase() +
                        room.roomInfo.slice(1)}
                    </option>
                  ))
                ) : (
                  <option value="">객실 타입 없음</option>
                )}
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
                min="0"
                step="1000"
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
