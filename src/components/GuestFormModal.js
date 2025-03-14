import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import './GuestFormModal.css';
import {
  format,
  addDays,
  startOfDay,
  differenceInCalendarDays,
} from 'date-fns';
import PropTypes from 'prop-types';
import { getDetailedAvailabilityMessage } from '../utils/availability';

const GuestFormModal = ({
  onClose,
  onSave,
  initialData,
  roomTypes,
  availabilityByDate,
  hotelSettings, // 호텔 설정에서 고정된 시간 가져옴
}) => {
  const [formData, setFormData] = useState({
    reservationNo: '',
    customerName: '',
    phoneNumber: '',
    checkInDate: '',
    checkInTime: '', // 고정값으로만 사용
    checkOutDate: '',
    checkOutTime: '', // 고정값으로만 사용
    reservationDate: '',
    roomInfo: '',
    price: '0',
    paymentMethod: '',
    specialRequests: '',
    roomNumber: '',
    manualPriceOverride: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredRoomTypes = useMemo(
    () => roomTypes.filter((rt) => rt.roomInfo.toLowerCase() !== 'none'),
    [roomTypes]
  );

  useEffect(() => {
    const now = new Date();
    const defaultCheckInTime = hotelSettings?.checkInTime || '16:00';
    const defaultCheckOutTime = hotelSettings?.checkOutTime || '11:00';

    if (initialData && initialData._id) {
      const checkInDateObj = new Date(initialData.checkIn);
      const checkOutDateObj = new Date(initialData.checkOut);
      setFormData({
        reservationNo: initialData.reservationNo || '',
        customerName: initialData.customerName || '',
        phoneNumber: initialData.phoneNumber || '',
        checkInDate: format(checkInDateObj, 'yyyy-MM-dd'),
        checkInTime: format(checkInDateObj, 'HH:mm'), // 서버 값 유지
        checkOutDate: format(checkOutDateObj, 'yyyy-MM-dd'),
        checkOutTime: format(checkOutDateObj, 'HH:mm'), // 서버 값 유지
        reservationDate:
          initialData.reservationDate || format(now, 'yyyy-MM-dd HH:mm'),
        roomInfo:
          initialData.roomInfo || filteredRoomTypes[0]?.roomInfo || 'Standard',
        price: String(initialData.price || initialData.totalPrice || 0),
        paymentMethod: initialData.paymentMethod || 'Pending',
        specialRequests: initialData.specialRequests || '',
        roomNumber: initialData.roomNumber || '',
        manualPriceOverride: !!initialData.price,
      });
    } else {
      const defaultCheckIn = initialData?.checkInDate
        ? new Date(`${initialData.checkInDate}T${defaultCheckInTime}:00`)
        : new Date(
            now.setHours(
              parseInt(defaultCheckInTime.split(':')[0]),
              parseInt(defaultCheckInTime.split(':')[1]),
              0,
              0
            )
          );
      const defaultCheckOut = initialData?.checkOutDate
        ? new Date(`${initialData.checkOutDate}T${defaultCheckOutTime}:00`)
        : addDays(defaultCheckIn, 1);

      defaultCheckOut.setHours(
        parseInt(defaultCheckOutTime.split(':')[0]),
        parseInt(defaultCheckOutTime.split(':')[1]),
        0,
        0
      );

      const checkInDateStr = format(defaultCheckIn, 'yyyy-MM-dd');
      const checkOutDateStr = format(defaultCheckOut, 'yyyy-MM-dd');

      const initialRoomInfo =
        initialData?.roomInfo || filteredRoomTypes[0]?.roomInfo || 'Standard';
      const selectedRoom =
        filteredRoomTypes.find((rt) => rt.roomInfo === initialRoomInfo) ||
        filteredRoomTypes[0];
      const nights = differenceInCalendarDays(defaultCheckOut, defaultCheckIn);
      const basePrice = (selectedRoom?.price || 0) * Math.max(nights, 1);

      setFormData({
        reservationNo: initialData?.reservationNo || `${Date.now()}`,
        customerName: initialData?.customerName || '',
        phoneNumber: initialData?.phoneNumber || '',
        checkInDate: checkInDateStr,
        checkInTime: defaultCheckInTime, // 고정값
        checkOutDate: checkOutDateStr,
        checkOutTime: defaultCheckOutTime, // 고정값
        reservationDate: format(now, 'yyyy-MM-dd HH:mm'),
        roomInfo: initialRoomInfo,
        price: String(basePrice),
        paymentMethod: initialData?.paymentMethod || 'Pending',
        specialRequests: initialData?.specialRequests || '',
        roomNumber: initialData?.roomNumber || '',
        manualPriceOverride: false,
      });
    }
  }, [initialData, filteredRoomTypes, hotelSettings]);

  useEffect(() => {
    if (
      isSubmitting ||
      formData.manualPriceOverride ||
      (initialData && initialData._id)
    )
      return;

    if (formData.checkInDate && formData.checkOutDate && formData.roomInfo) {
      const checkInDateObj = new Date(
        `${formData.checkInDate}T${formData.checkInTime}:00`
      );
      const checkOutDateObj = new Date(
        `${formData.checkOutDate}T${formData.checkOutTime}:00`
      );

      if (
        checkInDateObj &&
        checkOutDateObj &&
        !isNaN(checkInDateObj) &&
        !isNaN(checkOutDateObj)
      ) {
        const nights = differenceInCalendarDays(
          checkOutDateObj,
          checkInDateObj
        );
        const selectedRoom = filteredRoomTypes.find(
          (room) => room.roomInfo === formData.roomInfo
        );
        const nightlyPrice = selectedRoom?.price || 0;
        const totalPrice = String(nightlyPrice * Math.max(nights, 1));

        setFormData((prev) => ({
          ...prev,
          price: totalPrice,
        }));
      }
    }
  }, [
    formData.checkInDate,
    formData.checkOutDate,
    formData.roomInfo,
    formData.manualPriceOverride,
    filteredRoomTypes,
    isSubmitting,
    initialData,
    formData.checkInTime, // 의존성 추가
    formData.checkOutTime, // 의존성 추가
  ]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'roomInfo' && initialData?._id) return;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
      ...(name === 'price' ? { manualPriceOverride: true } : {}),
    }));
  };

  const handleCheckInDateChange = (e) => {
    const selectedDate = e.target.value;
    setFormData((prev) => ({
      ...prev,
      checkInDate: selectedDate,
    }));
  };

  const handleCheckOutDateChange = (e) => {
    const selectedDate = e.target.value;
    setFormData((prev) => ({
      ...prev,
      checkOutDate: selectedDate,
    }));
  };

  const isRoomTypeUnavailable = (roomInfo) => {
    if (
      !availabilityByDate ||
      !formData.checkInDate ||
      !formData.checkOutDate ||
      !formData.checkInTime ||
      !formData.checkOutTime
    ) {
      return false;
    }
    const start = new Date(
      `${formData.checkInDate}T${formData.checkInTime}:00`
    );
    const end = new Date(
      `${formData.checkOutDate}T${formData.checkOutTime}:00`
    );

    if (isNaN(start) || isNaN(end)) return false;

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
    if (isSubmitting) return;
    setIsSubmitting(true);

    const numericPrice = parseFloat(formData.price);
    if (isNaN(numericPrice) || numericPrice < 0) {
      alert('가격은 유효한 숫자여야 하며 음수가 될 수 없습니다.');
      setFormData((prev) => ({ ...prev, price: '0' }));
      setIsSubmitting(false);
      return;
    }

    if (!formData.checkInDate || !formData.checkOutDate) {
      alert('체크인/체크아웃 날짜를 모두 입력해주세요.');
      setIsSubmitting(false);
      return;
    }

    const checkInDateTime = new Date(
      `${formData.checkInDate}T${formData.checkInTime}:00`
    );
    const checkOutDateTime = new Date(
      `${formData.checkOutDate}T${formData.checkOutTime}:00`
    );

    if (isNaN(checkInDateTime) || isNaN(checkOutDateTime)) {
      alert('유효한 체크인/체크아웃 날짜를 입력해주세요.');
      setIsSubmitting(false);
      return;
    }

    if (checkInDateTime >= checkOutDateTime) {
      alert('체크인 날짜는 체크아웃보다 이전이어야 합니다.');
      setIsSubmitting(false);
      return;
    }

    if (
      !initialData?._id &&
      formData.customerName.includes('현장') &&
      checkInDateTime < startOfDay(new Date())
    ) {
      alert('현장예약은 과거 날짜로 생성할 수 없습니다.');
      setIsSubmitting(false);
      return;
    }

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
      const detailedMsg = getDetailedAvailabilityMessage(
        startOfDay(checkInDateTime),
        startOfDay(checkOutDateTime),
        tKey,
        availabilityByDate
      );
      alert(detailedMsg);
      setIsSubmitting(false);
      return;
    }

    const selectedRoomNumber =
      formData.roomNumber ||
      [...commonRooms].sort((a, b) => parseInt(a) - parseInt(b))[0];

    const finalData = {
      ...formData,
      price: numericPrice,
      checkIn: format(checkInDateTime, "yyyy-MM-dd'T'HH:mm:ss"),
      checkOut: format(checkOutDateTime, "yyyy-MM-dd'T'HH:mm:ss"),
      roomNumber: String(selectedRoomNumber),
      siteName: '현장예약',
    };

    console.log('[GuestFormModal] Submitting finalData:', finalData);
    try {
      if (initialData?._id) {
        await onSave(initialData._id, finalData);
        console.log('[GuestFormModal] Save successful for:', initialData._id);
      } else {
        await onSave(null, finalData);
        console.log('[GuestFormModal] New reservation saved:', finalData);
      }
      onClose();
    } catch (error) {
      console.error('[GuestFormModal] Save Error:', error);
      const errorMessage =
        error.status === 403
          ? 'CSRF 토큰 오류: 페이지를 새로고침 후 다시 시도해주세요.'
          : error.response?.data?.message ||
            error.message ||
            '예약 저장에 실패했습니다. 다시 시도해주세요.';
      alert(errorMessage);
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
                required
                disabled={isSubmitting}
              />
            </label>
            <label htmlFor="checkInDate">
              체크인: {formData.checkInDate} {formData.checkInTime}
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
              체크아웃: {formData.checkOutDate} {formData.checkOutTime}
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
                <option value="Card">카드</option>
                <option value="Cash">현금</option>
                <option value="Account Transfer">계좌이체</option>
                <option value="Pending">미결제</option>
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
  hotelSettings: PropTypes.object,
};

export default GuestFormModal;
