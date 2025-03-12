import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import './DayUseFormModal.css';
import { format, addHours, startOfDay, addDays } from 'date-fns';
import PropTypes from 'prop-types';
import { getDetailedAvailabilityMessage } from '../utils/availability';

const DayUseFormModal = ({
  onClose,
  onSave,
  initialData,
  roomTypes,
  availabilityByDate,
  hotelSettings,
}) => {
  const [formData, setFormData] = useState({
    reservationNo: '',
    customerName: '',
    phoneNumber: '',
    checkInDate: '',
    checkInTime: '',
    durationHours: 4,
    reservationDate: '',
    roomInfo: '',
    price: '0',
    paymentMethod: 'Pending',
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

    if (initialData && initialData._id) {
      // 기존 예약 수정
      const checkInDateObj = new Date(initialData.checkIn);
      const checkOutDateObj = new Date(initialData.checkOut);
      const duration = Math.round(
        (checkOutDateObj - checkInDateObj) / (1000 * 60 * 60)
      );

      setFormData({
        reservationNo: initialData.reservationNo || '',
        customerName: initialData.customerName || '',
        phoneNumber:
          initialData.phoneNumber || hotelSettings?.phoneNumber || '',
        checkInDate: format(checkInDateObj, 'yyyy-MM-dd'),
        checkInTime: format(checkInDateObj, 'HH:mm'),
        durationHours: duration || 4,
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
      // 신규 대실 예약: 여기서만 현재 시간에 기반한 기본값을 사용합니다.
      const defaultCheckInDate = format(now, 'yyyy-MM-dd');
      const defaultCheckInTime = format(now, 'HH:mm');
      const initialRoomInfo =
        initialData?.roomInfo || filteredRoomTypes[0]?.roomInfo || 'Standard';
      const selectedRoom =
        filteredRoomTypes.find((rt) => rt.roomInfo === initialRoomInfo) ||
        filteredRoomTypes[0];
      const basePrice = Math.floor((selectedRoom?.price || 0) * 0.5);

      setFormData({
        reservationNo: initialData?.reservationNo || `${Date.now()}`,
        customerName:
          initialData?.customerName || `대실:${format(now, 'HH:mm:ss')}`,
        phoneNumber: hotelSettings?.phoneNumber || '',
        checkInDate: initialData?.checkInDate || defaultCheckInDate,
        checkInTime: initialData?.checkInTime || defaultCheckInTime, // 현재 시각 그대로
        durationHours: initialData?.durationHours || 4,
        reservationDate: format(now, 'yyyy-MM-dd HH:mm'),
        roomInfo: initialRoomInfo,
        price: String(initialData?.price || basePrice),
        paymentMethod: 'Pending',
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
    const selectedRoom = filteredRoomTypes.find(
      (room) => room.roomInfo === formData.roomInfo
    );
    const basePrice = Math.floor((selectedRoom?.price || 0) * 0.5);
    const additionalHours = Math.max(formData.durationHours - 4, 0);
    const price = String(basePrice + additionalHours * 10000);
    setFormData((prev) => ({ ...prev, price }));
  }, [
    formData.durationHours,
    formData.roomInfo,
    formData.manualPriceOverride,
    filteredRoomTypes,
    isSubmitting,
    initialData,
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

  const handleDurationChange = (increment) => {
    setFormData((prev) => ({
      ...prev,
      durationHours: Math.max(1, prev.durationHours + increment),
      manualPriceOverride: false,
    }));
  };

  const isRoomTypeUnavailable = (roomInfo) => {
    if (!availabilityByDate || !formData.checkInDate) return false;
    const ds = formData.checkInDate;
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
      setIsSubmitting(false);
      return;
    }

  // --- (1) +09:00 붙여서 Date 생성 ---
  // 예: "2025-03-13T02:37:00+09:00" 형태 => KST로 확실히 인식
  const checkInDateTime = new Date(
    `${formData.checkInDate}T${formData.checkInTime}:00+09:00`
  );

  if (isNaN(checkInDateTime.getTime())) {
    alert('유효한 체크인 날짜와 시간을 입력해주세요.');
    setIsSubmitting(false);
    return;
  }

    // 체크아웃 시간 계산: 체크인 시간 + 사용 시간
    const checkOutDateTime = addHours(checkInDateTime, formData.durationHours);

    const tKey = formData.roomInfo.toLowerCase();
    const ds = format(checkInDateTime, 'yyyy-MM-dd');
    const availForDay = availabilityByDate[ds]?.[tKey];

    if (!availForDay || availForDay.remain <= 0) {
      const detailedMsg = getDetailedAvailabilityMessage(
        startOfDay(checkInDateTime),
        addDays(startOfDay(checkInDateTime), 1),
        tKey,
        availabilityByDate
      );
      alert(detailedMsg);
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
      siteName: initialData?.siteName || '현장예약',
      type: 'dayUse',
      duration: formData.durationHours,
    };

    try {
      if (initialData?._id) {
        await onSave(initialData._id, finalData);
      } else {
        await onSave(null, finalData);
      }
      onClose();
    } catch (error) {
      console.error('[DayUseFormModal] Save Error:', error);
      alert(error.message || '예약 저장에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayCheckOut = useMemo(() => {
    if (!formData.checkInDate || !formData.checkInTime) return '';
    const checkIn = new Date(
      `${formData.checkInDate}T${formData.checkInTime}:00`
    );
    const checkOut = addHours(checkIn, formData.durationHours);
    return format(checkOut, 'yyyy-MM-dd HH:mm');
  }, [formData.checkInDate, formData.checkInTime, formData.durationHours]);

  return ReactDOM.createPortal(
    <div className="dayuse-modal">
      <div className="dayuse-modal-card">
        {isSubmitting && (
          <div className="dayuse-modal-overlay-spinner">처리 중...</div>
        )}
        <span className="dayuse-close-button" onClick={onClose}>
          ×
        </span>
        <h2>{initialData?._id ? '대실 예약 수정' : '대실 예약 입력'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="dayuse-modal-row">
            <label>
              예약번호:
              <input
                type="text"
                name="reservationNo"
                value={formData.reservationNo}
                readOnly
              />
            </label>
            <label>
              예약자:
              <input
                type="text"
                name="customerName"
                value={formData.customerName}
                onChange={handleInputChange}
                required
                disabled={isSubmitting}
              />
            </label>
          </div>
          <div className="dayuse-modal-row">
            <label>
              연락처:
              <input
                type="text"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleInputChange}
                disabled={isSubmitting}
              />
            </label>
            <label>
              체크인:
              <input
                type="date"
                name="checkInDate"
                value={formData.checkInDate}
                onChange={handleInputChange}
                required
                disabled={isSubmitting}
              />
              <input
                type="time"
                name="checkInTime"
                value={formData.checkInTime}
                onChange={handleInputChange}
                required
                disabled={isSubmitting}
              />
            </label>
          </div>
          <div className="dayuse-modal-row">
            <label>
              사용 시간:
              <div className="dayuse-duration-change-container">
                <button
                  type="button"
                  className="dayuse-duration-button plus"
                  onClick={() => handleDurationChange(1)}
                  disabled={isSubmitting}
                >
                  +
                </button>
                <span>{formData.durationHours}시간</span>
                <button
                  type="button"
                  className="dayuse-duration-button minus"
                  onClick={() => handleDurationChange(-1)}
                  disabled={isSubmitting || formData.durationHours <= 1}
                >
                  -
                </button>
              </div>
            </label>
            <label>
              체크아웃:
              <input type="text" value={displayCheckOut} readOnly />
            </label>
          </div>
          <div className="dayuse-modal-row">
            <label>
              객실타입:
              {initialData?._id ? (
                <input
                  type="text"
                  value={formData.roomInfo}
                  readOnly
                  disabled
                />
              ) : (
                <select
                  name="roomInfo"
                  value={formData.roomInfo}
                  onChange={handleInputChange}
                  required
                  disabled={isSubmitting}
                >
                  {filteredRoomTypes.map((rt) => (
                    <option
                      key={rt.roomInfo}
                      value={rt.roomInfo}
                      style={{
                        color: isRoomTypeUnavailable(rt.roomInfo)
                          ? 'red'
                          : 'inherit',
                      }}
                    >
                      {rt.roomInfo}
                    </option>
                  ))}
                </select>
              )}
            </label>
            <label>
              가격 (KRW):
              <input
                type="number"
                name="price"
                value={formData.price}
                onChange={handleInputChange}
                required
                disabled={isSubmitting}
              />
            </label>
          </div>
          <div className="dayuse-modal-row">
            <label>
              결제방법/상태:
              <select
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
            <label>
              고객요청:
              <input
                type="text"
                name="specialRequests"
                value={formData.specialRequests}
                onChange={handleInputChange}
                disabled={isSubmitting}
              />
            </label>
          </div>
          <div className="dayuse-guest-form-actions">
            <button type="button" onClick={onClose} disabled={isSubmitting}>
              취소
            </button>
            <button type="submit" disabled={isSubmitting}>
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
  hotelSettings: PropTypes.object.isRequired,
};

export default DayUseFormModal;
