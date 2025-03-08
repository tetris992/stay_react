import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import './GuestFormModal.css';
import { parseDate } from '../utils/dateParser';
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
    checkInTime: '16:00',
    durationHours: 4,
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
    const defaultCheckInDate = initialData?.checkInDate || format(now, 'yyyy-MM-dd'); // 보고 있는 날짜 우선
    if (initialData && initialData._id) {
      const checkInDateObj = new Date(initialData.checkIn);
      setFormData({
        reservationNo: initialData.reservationNo || '',
        customerName: initialData.customerName || '',
        phoneNumber: initialData.phoneNumber || hotelSettings?.phoneNumber || '',
        checkInDate: format(checkInDateObj, 'yyyy-MM-dd'),
        checkInTime: format(checkInDateObj, 'HH:mm'),
        durationHours: initialData.duration || 4,
        reservationDate: initialData.reservationDate || format(now, 'yyyy-MM-dd HH:mm'),
        roomInfo: initialData.roomInfo || filteredRoomTypes[0]?.roomInfo || 'Standard',
        price: String(initialData.price || initialData.totalPrice || 0),
        paymentMethod: initialData.paymentMethod || 'Pending',
        specialRequests: initialData.specialRequests || '',
        roomNumber: initialData.roomNumber || '',
        manualPriceOverride: !!initialData.price,
      });
    } else {
      const initialRoomInfo = initialData?.roomInfo || filteredRoomTypes[0]?.roomInfo || 'Standard';
      const selectedRoom = filteredRoomTypes.find((rt) => rt.roomInfo === initialRoomInfo) || filteredRoomTypes[0];
      const basePrice = Math.floor((selectedRoom?.price || 0) * 0.5); // 대실 기본 가격

      setFormData({
        reservationNo: initialData?.reservationNo || `${Date.now()}`,
        customerName: initialData?.customerName || `대실:${format(now, 'HH:mm:ss')}`,
        phoneNumber: hotelSettings?.phoneNumber || '',
        checkInDate: defaultCheckInDate, // 보고 있는 날짜로 설정
        checkInTime: initialData?.checkInTime || '16:00',
        durationHours: 4,
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
    if (isSubmitting || formData.manualPriceOverride || (initialData && initialData._id)) return;
    const selectedRoom = filteredRoomTypes.find((room) => room.roomInfo === formData.roomInfo);
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

    console.log('[DayUseFormModal] handleSubmit - Form Data:', formData);
    console.log('[DayUseFormModal] availabilityByDate:', availabilityByDate);
    console.log('[DayUseFormModal] roomTypes:', roomTypes);

    const numericPrice = parseFloat(formData.price);
    if (isNaN(numericPrice) || numericPrice < 0) {
      alert('가격은 유효한 숫자여야 하며 음수가 될 수 없습니다.');
      setIsSubmitting(false);
      return;
    }

    const checkInDateTime = parseDate(`${formData.checkInDate}T${formData.checkInTime}:00`);
    if (!checkInDateTime) {
      alert('유효한 체크인 날짜와 시간을 입력해주세요.');
      setIsSubmitting(false);
      return;
    }

    const checkOutDateTime = addHours(checkInDateTime, formData.durationHours);

    const tKey = formData.roomInfo.toLowerCase();
    const ds = format(checkInDateTime, 'yyyy-MM-dd');
    const availForDay = availabilityByDate[ds]?.[tKey];
    console.log(`[DayUseFormModal] Checking availability for ${ds}, roomType: ${tKey}`, availForDay);

    if (!availForDay || availForDay.remain <= 0) {
      const detailedMsg = getDetailedAvailabilityMessage(
        startOfDay(checkInDateTime),
        addDays(startOfDay(checkInDateTime), 1),
        tKey,
        availabilityByDate
      );
      console.log('[DayUseFormModal] Availability Message:', detailedMsg);
      alert(detailedMsg);
      setIsSubmitting(false);
      return;
    }

    const selectedRoomNumber =
      formData.roomNumber ||
      availForDay.leftoverRooms?.sort((a, b) => parseInt(a) - parseInt(b))[0] ||
      '';
    console.log('[DayUseFormModal] Selected Room Number:', selectedRoomNumber);

    const finalData = {
      ...formData,
      price: numericPrice,
      checkIn: format(checkInDateTime, "yyyy-MM-dd'T'HH:mm:ss"),
      checkOut: format(checkOutDateTime, "yyyy-MM-dd'T'HH:mm:ss"),
      roomNumber: String(selectedRoomNumber),
      siteName: '현장예약',
      type: 'dayUse',
      duration: formData.durationHours,
    };

    console.log('[DayUseFormModal] Final Data to Save:', finalData);

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
    const checkIn = parseDate(`${formData.checkInDate}T${formData.checkInTime}:00`);
    const checkOut = addHours(checkIn, formData.durationHours);
    return format(checkOut, 'yyyy-MM-dd HH:mm');
  }, [formData.checkInDate, formData.checkInTime, formData.durationHours]);

  return ReactDOM.createPortal(
    <div className="guest-form-modal">
      <div className="modal-card">
        {isSubmitting && <div className="modal-overlay-spinner">처리 중...</div>}
        <span className="close-button" onClick={onClose}>×</span>
        <h2>{initialData?._id ? '대실 예약 수정' : '대실 예약 입력'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="modal-row">
            <label>
              예약번호:
              <input type="text" name="reservationNo" value={formData.reservationNo} readOnly />
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
          <div className="modal-row">
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
          <div className="modal-row">
            <label>
              사용 시간:
              <button
                type="button"
                onClick={() => handleDurationChange(-1)}
                disabled={isSubmitting || formData.durationHours <= 1}
              >
                -
              </button>
              <span>{formData.durationHours}시간</span>
              <button
                type="button"
                onClick={() => handleDurationChange(1)}
                disabled={isSubmitting}
              >
                +
              </button>
            </label>
            <label>
              체크아웃:
              <input type="text" value={displayCheckOut} readOnly />
            </label>
          </div>
          <div className="modal-row">
            <label>
              객실타입:
              {initialData?._id ? (
                <input type="text" value={formData.roomInfo} readOnly disabled />
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
                      style={{ color: isRoomTypeUnavailable(rt.roomInfo) ? 'red' : 'inherit' }}
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
          <div className="modal-row">
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
          <div className="guest-form-actions">
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