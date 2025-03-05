import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import './GuestFormModal.css'; // 동일한 스타일 사용
import { parseDate } from '../utils/dateParser';
import { format, addHours, startOfDay } from 'date-fns'; // todayStart 제거
import PropTypes from 'prop-types';
import { getDetailedAvailabilityMessage } from '../utils/availability';

const DayUseFormModal = ({
  onClose,
  onSave,
  initialData,
  roomTypes,
  availabilityByDate,
  hotelSettings, // 호텔 설정 추가 (전화번호 가져오기)
}) => {
  const [formData, setFormData] = useState({
    reservationNo: '',
    customerName: '',
    phoneNumber: '', // 기본값은 호텔 설정의 전화번호
    checkInDate: '',
    checkInTime: '',
    checkOutDate: '',
    checkOutTime: '',
    reservationDate: '',
    roomInfo: '',
    price: '0',
    paymentMethod: '',
    specialRequests: '',
    roomNumber: '',
    manualPriceOverride: false, // 사용자 가격 수정 여부
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredRoomTypes = useMemo(
    () => roomTypes.filter((rt) => rt.roomInfo.toLowerCase() !== 'none'),
    [roomTypes]
  );

  useEffect(() => {
    if (initialData && initialData._id) {
      const checkInDateObj = new Date(initialData.checkIn);
      const checkOutDateObj = new Date(initialData.checkOut);
      setFormData({
        reservationNo: initialData.reservationNo || '',
        customerName: initialData.customerName || '',
        phoneNumber:
          initialData.phoneNumber || hotelSettings?.phoneNumber || '', // 호텔 설정 전화번호
        checkInDate: format(checkInDateObj, 'yyyy-MM-dd'),
        checkInTime: format(checkInDateObj, 'HH:mm'),
        checkOutDate: format(checkOutDateObj, 'yyyy-MM-dd'),
        checkOutTime: format(checkOutDateObj, 'HH:mm'),
        reservationDate:
          initialData.reservationDate || format(new Date(), 'yyyy-MM-dd HH:mm'),
        roomInfo:
          initialData.roomInfo || filteredRoomTypes[0]?.roomInfo || 'Standard',
        price: String(initialData.price || initialData.totalPrice || 0),
        paymentMethod: initialData.paymentMethod || 'Pending',
        specialRequests: initialData.specialRequests || '',
        roomNumber: initialData.roomNumber || '',
        manualPriceOverride: !!initialData.price, // 초기 가격 있으면 수동 수정으로 간주
      });
    } else {
      const now = new Date();
      const defaultCheckIn = initialData?.checkInDate
        ? parseDate(
            `${initialData.checkInDate}T${
              initialData.checkInTime || format(now, 'HH:mm')
            }:00`
          )
        : now;
      const defaultCheckOut = addHours(defaultCheckIn, 4); // 체크인 기준 4시간 후

      const checkInDateStr = format(defaultCheckIn, 'yyyy-MM-dd');
      const checkOutDateStr = format(defaultCheckOut, 'yyyy-MM-dd');
      const checkInTimeStr = format(defaultCheckIn, 'HH:mm');
      const checkOutTimeStr = format(defaultCheckOut, 'HH:mm');
      const initialRoomInfo =
        initialData?.roomInfo || filteredRoomTypes[0]?.roomInfo || 'Standard';
      const selectedRoom =
        filteredRoomTypes.find((rt) => rt.roomInfo === initialRoomInfo) ||
        filteredRoomTypes[0];
      const basePrice = selectedRoom?.price || 0;
      const price = String(Math.floor(basePrice * 0.5)); // 숙박 가격의 절반

      setFormData({
        reservationNo: initialData?.reservationNo || `${Date.now()}`,
        customerName:
          initialData?.customerName || `대실:${format(now, 'HH:mm:ss')}`,
        phoneNumber: hotelSettings?.phoneNumber || '', // 호텔 설정 전화번호 자동 입력
        checkInDate: checkInDateStr,
        checkInTime: checkInTimeStr,
        checkOutDate: checkOutDateStr,
        checkOutTime: checkOutTimeStr,
        reservationDate: format(new Date(), 'yyyy-MM-dd HH:mm'),
        roomInfo: initialRoomInfo,
        price: price,
        paymentMethod: initialData?.paymentMethod || 'Pending',
        specialRequests: initialData?.specialRequests || '',
        roomNumber: initialData?.roomNumber || '',
        manualPriceOverride: false, // 신규 예약은 자동 계산
      });
    }
  }, [initialData, filteredRoomTypes, hotelSettings]);

  useEffect(() => {
    if (
      isSubmitting ||
      formData.manualPriceOverride ||
      (initialData && initialData._id)
    )
      return; // 수정 모드 또는 수동 수정 시 가격 계산 스킵

    if (formData.checkInDate && formData.checkInTime && formData.roomInfo) {
      const checkInDateObj = new Date(
        `${formData.checkInDate}T${formData.checkInTime}:00`
      );
      const checkOutDateObj = addHours(checkInDateObj, 4); // 4시간 후 체크아웃
      const selectedRoom = filteredRoomTypes.find(
        (room) => room.roomInfo === formData.roomInfo
      );
      const basePrice = selectedRoom?.price || 0;
      const price = String(Math.floor(basePrice * 0.5)); // 숙박 가격의 절반

      setFormData((prev) => ({
        ...prev,
        checkOutDate: format(checkOutDateObj, 'yyyy-MM-dd'),
        checkOutTime: format(checkOutDateObj, 'HH:mm'),
        price: price,
      }));
    }
  }, [
    formData.checkInDate,
    formData.checkInTime,
    formData.roomInfo,
    formData.manualPriceOverride,
    filteredRoomTypes,
    isSubmitting,
    initialData,
  ]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    // 수정 모드에서는 roomInfo 변경 방지
    if (name === 'roomInfo' && initialData?._id) return;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
      ...(name === 'price' ? { manualPriceOverride: true } : {}),
    }));
  };

  const handleCheckInDateChange = (e) => {
    const selectedDate = e.target.value;
    const now = new Date();
    const defaultCheckInTime = format(now, 'HH:mm');
    setFormData((prev) => ({
      ...prev,
      checkInDate: selectedDate,
      checkInTime: defaultCheckInTime,
    }));
  };

  const handleCheckOutDateChange = (e) => {
    const selectedDate = e.target.value;
    const checkInDateObj = new Date(
      `${formData.checkInDate}T${formData.checkInTime}:00`
    );
    const defaultCheckOut = addHours(checkInDateObj, 4);
    setFormData((prev) => ({
      ...prev,
      checkOutDate: selectedDate,
      checkOutTime: format(defaultCheckOut, 'HH:mm'),
    }));
  };

  const isRoomTypeUnavailable = (roomInfo) => {
    if (!availabilityByDate || !formData.checkInDate || !formData.checkInTime) {
      return false;
    }
    const checkInDateObj = new Date(
      `${formData.checkInDate}T${formData.checkInTime}:00`
    );

    // eslint-disable-next-line no-unused-vars
    const checkOutDate = addHours(checkInDateObj, 4);

    const ds = format(checkInDateObj, 'yyyy-MM-dd');
    const availForDay = availabilityByDate[ds]?.[roomInfo.toLowerCase()];
    return !availForDay || availForDay.remain <= 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    const numericPrice = parseFloat(formData.price);
    if (isNaN(numericPrice) || numericPrice < 0) {
      alert('가격은 유효한 숫자여야 하며 음수가 될 수 없습니다.');
      setFormData((prev) => ({ ...prev, price: '0' }));
      setIsSubmitting(false);
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
      setFormData((prev) => ({ ...prev, price: '0' }));
      setIsSubmitting(false);
      return;
    }
    if (checkInDateTime >= checkOutDateTime) {
      alert('체크인 날짜/시간은 체크아웃보다 이전이어야 합니다.');
      setFormData((prev) => ({ ...prev, price: '0' }));
      setIsSubmitting(false);
      return;
    }

    // 대실은 과거 날짜로 생성 가능
    const tKey = formData.roomInfo.toLowerCase();
    const ds = format(checkInDateTime, 'yyyy-MM-dd');
    const availForDay = availabilityByDate[ds]?.[tKey];
    if (!availForDay || availForDay.remain <= 0) {
      const detailedMsg = getDetailedAvailabilityMessage(
        startOfDay(checkInDateTime),
        startOfDay(checkOutDateTime),
        tKey,
        availabilityByDate
      );
      alert(detailedMsg);
      setFormData((prev) => ({ ...prev, price: '0' }));
      setIsSubmitting(false);
      return;
    }

    const selectedRoomNumber =
      formData.roomNumber ||
      availForDay.leftoverRooms?.sort((a, b) => parseInt(a) - parseInt(b))[0] ||
      '';

    const finalData = {
      ...formData,
      price: numericPrice,
      checkIn: format(checkInDateTime, "yyyy-MM-dd'T'HH:mm:ss"),
      checkOut: format(checkOutDateTime, "yyyy-MM-dd'T'HH:mm:ss"),
      roomNumber: String(selectedRoomNumber),
      siteName: '현장예약',
      type: 'dayUse', // 대실임을 명시
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
      setFormData((prev) => ({ ...prev, price: '0' }));
    } finally {
      setIsSubmitting(false);
    }
  };

  return ReactDOM.createPortal(
    <div className="guest-form-modal">
      <div className="modal-card">
        {isSubmitting && (
          <div className="modal-overlay-spinner">처리 중...</div>
        )}
        <span className="close-button" onClick={onClose}>
          ×
        </span>
        <h2>{initialData?._id ? '예약 수정' : '대실 예약 입력'}</h2>
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
                disabled={isSubmitting}
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
                disabled={isSubmitting}
              />
            </label>
            <label htmlFor="checkInDate">
              체크인:
              <input
                id="checkInDate"
                type="date"
                name="checkInDate"
                value={formData.checkInDate}
                onChange={handleCheckInDateChange}
                required
                disabled={isSubmitting}
              />
            </label>
          </div>
          <div className="modal-row">
            <label htmlFor="checkOutDate">
              체크아웃 (기본 4시간 후):
              <input
                id="checkOutDate"
                type="date"
                name="checkOutDate"
                value={formData.checkOutDate}
                onChange={handleCheckOutDateChange}
                required
                disabled={isSubmitting}
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
              {initialData?._id ? (
                <input
                  id="roomInfo"
                  type="text"
                  name="roomInfo"
                  value={formData.roomInfo}
                  readOnly
                  disabled
                />
              ) : (
                <select
                  id="roomInfo"
                  name="roomInfo"
                  value={formData.roomInfo}
                  onChange={handleInputChange}
                  required
                  disabled={isSubmitting}
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
              )}
            </label>
            <label htmlFor="price">
              가격 (KRW):
              <input
                id="price"
                type="number"
                name="price"
                value={formData.price}
                onChange={handleInputChange}
                required
                disabled={isSubmitting}
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
                disabled={isSubmitting}
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
                disabled={isSubmitting}
              />
            </label>
          </div>
          <div className="guest-form-actions">
            <button
              type="button"
              onClick={onClose}
              className="guest-form-button guest-form-cancel"
              disabled={isSubmitting}
            >
              취소
            </button>
            <button
              type="submit"
              className="guest-form-button guest-form-save"
              disabled={isSubmitting}
            >
              {isSubmitting ? '처리 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.getElementById('modal-root')
  );
};

DayUseFormModal.propTypes = {
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
  hotelSettings: PropTypes.object.isRequired, // 호텔 설정 추가
};

export default DayUseFormModal;
