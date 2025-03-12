import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { format, addDays, differenceInCalendarDays, parseISO, startOfDay } from 'date-fns';
import PropTypes from 'prop-types';
import './QuickRangeModal.css';

const QuickRangeModal = ({
  onClose,
  onSave,
  initialData,
  roomTypes,
  availabilityByDate,
}) => {
  const [formData, setFormData] = useState({
    reservationNo: initialData?.reservationNo || `${Date.now()}`,
    customerName:
      initialData?.customerName || `현장:${format(new Date(), 'HH:mm:ss')}`,
    phoneNumber: initialData?.phoneNumber || '',
    checkInDate: initialData?.checkInDate || '',
    checkInTime: initialData?.checkInTime || '16:00',
    checkOutDate: initialData?.checkOutDate || '',
    checkOutTime: initialData?.checkOutTime || '11:00',
    roomInfo: initialData?.roomInfo || roomTypes[0]?.roomInfo || 'Standard',
    price: initialData?.price || '',
    paymentMethod: initialData?.paymentMethod || 'Pending',
    specialRequests: initialData?.specialRequests || '',
    roomNumber: initialData?.roomNumber || '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredRoomTypes = useMemo(
    () => roomTypes.filter((rt) => rt.roomInfo.toLowerCase() !== 'none'),
    [roomTypes]
  );

  useEffect(() => {
    const checkInDateTime = parseISO(
      `${formData.checkInDate}T${formData.checkInTime}:00`
    );
    const checkOutDateTime = parseISO(
      `${formData.checkOutDate}T${formData.checkOutTime}:00`
    );
    if (
      checkInDateTime &&
      checkOutDateTime &&
      !isNaN(checkInDateTime) &&
      !isNaN(checkOutDateTime) &&
      checkInDateTime < checkOutDateTime
    ) {
      const nights = differenceInCalendarDays(checkOutDateTime, checkInDateTime);
      const selectedRoom = filteredRoomTypes.find(
        (rt) => rt.roomInfo === formData.roomInfo
      );
      const totalPrice = (selectedRoom?.price || 0) * Math.max(nights, 1);
      setFormData((prev) => ({ ...prev, price: totalPrice.toString() }));
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
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
  
    const checkInDateTime = parseISO(`${formData.checkInDate}T${formData.checkInTime}:00`);
    const checkOutDateTime = parseISO(`${formData.checkOutDate}T${formData.checkOutTime}:00`);
  
    if (
      !checkInDateTime ||
      !checkOutDateTime ||
      isNaN(checkInDateTime) ||
      isNaN(checkOutDateTime) ||
      checkInDateTime >= checkOutDateTime
    ) {
      console.error('[QuickRangeModal] Invalid date input:', { formData });
      alert('유효한 체크인/체크아웃 날짜와 시간을 확인해주세요.');
      setIsSubmitting(false);
      return;
    }
  
    const nights = differenceInCalendarDays(checkOutDateTime, checkInDateTime);
    const tKey = formData.roomInfo.toLowerCase();
  
    // Find the selected room type data to use as fallback.
    const selectedRoom = filteredRoomTypes.find(rt => rt.roomInfo === formData.roomInfo);
    const totalStock = selectedRoom
      ? (selectedRoom.stock || (selectedRoom.roomNumbers && selectedRoom.roomNumbers.length) || 0)
      : 0;
    const allRooms = selectedRoom?.roomNumbers || [];
  
    let cursor = startOfDay(checkInDateTime);
    const endDay = startOfDay(checkOutDateTime);
    let commonRooms = null;
  
    console.log(`[QuickRangeModal] Nights: ${nights}, Room Type: ${tKey}`);
    console.log('[QuickRangeModal] availabilityByDate:', availabilityByDate);
  
    if (nights === 1) {
      const ds = format(cursor, 'yyyy-MM-dd');
      // If availability data for ds is missing, use full availability.
      const availForDay = availabilityByDate[ds]?.[tKey] || { remain: totalStock, leftoverRooms: allRooms };
      console.log(`[1박 체크] ${ds} 가용성:`, availForDay);
      if (!availForDay || availForDay.remain <= 0) {
        console.warn(`[QuickRangeModal] No availability for ${ds}:`, availForDay);
        alert(`선택한 날짜(${ds})에 ${formData.roomInfo} 객실이 부족합니다.`);
        setIsSubmitting(false);
        return;
      }
      commonRooms = new Set(availForDay.leftoverRooms || []);
    } else {
      while (cursor < endDay) {
        const ds = format(cursor, 'yyyy-MM-dd');
        // Fallback: if availabilityByDate에 ds가 없으면 assume full availability.
        const availForDay = availabilityByDate[ds]?.[tKey] || { remain: totalStock, leftoverRooms: allRooms };
        console.log(`[다중 박 체크] ${ds} 가용성:`, availForDay);
        if (!availForDay || availForDay.remain <= 0) {
          console.warn(`[QuickRangeModal] No availability for ${ds}:`, availForDay);
          alert(`선택한 기간(${ds})에 ${formData.roomInfo} 객실이 부족합니다.`);
          setIsSubmitting(false);
          return;
        }
        const freeRooms = availForDay.leftoverRooms || [];
        commonRooms = commonRooms
          ? new Set([...commonRooms].filter((r) => freeRooms.includes(r)))
          : new Set(freeRooms);
        cursor = addDays(cursor, 1);
      }
    }
  
    if (!commonRooms || commonRooms.size === 0) {
      console.warn('[QuickRangeModal] No common rooms available:', commonRooms);
      alert('선택한 기간 동안 공통으로 사용 가능한 객실이 없습니다.');
      setIsSubmitting(false);
      return;
    }
  
    const selectedRoomNumber = formData.roomNumber || [...commonRooms][0];
    const finalData = {
      ...formData,
      price: parseFloat(formData.price) || 0,
      checkIn: format(checkInDateTime, "yyyy-MM-dd'T'HH:mm:ss"),
      checkOut: format(checkOutDateTime, "yyyy-MM-dd'T'HH:mm:ss"),
      roomNumber: String(selectedRoomNumber),
      siteName: '현장예약',
    };
  
    console.log('[QuickRangeModal] Final Data to Save:', finalData);
  
    try {
      await onSave(null, finalData);
      console.log('[QuickRangeModal] Save successful');
      onClose();
    } catch (error) {
      console.error('[QuickRangeModal] Save Error:', error);
      alert('예약 저장에 실패했습니다: ' + (error.message || '알 수 없는 오류'));
    } finally {
      setIsSubmitting(false);
    }
  };
  

  return ReactDOM.createPortal(
    <div className="quick-range-modal">
      <div className="modal-card">
        <span className="close-button" onClick={onClose}>×</span>
        <h2>빠른 연박 예약</h2>
        <form onSubmit={handleSubmit}>
          <div className="modal-row">
            <label>
              예약자:
              <input
                name="customerName"
                value={formData.customerName}
                onChange={handleInputChange}
                required
              />
            </label>
            <label>
              전화번호:
              <input
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleInputChange}
              />
            </label>
          </div>
          <div className="modal-row">
            <label>
              체크인 날짜:
              <input
                type="date"
                name="checkInDate"
                value={formData.checkInDate}
                onChange={handleInputChange}
                required
              />
            </label>
            <label>
              체크인 시간:
              <input
                type="time"
                name="checkInTime"
                value={formData.checkInTime}
                onChange={handleInputChange}
                required
              />
            </label>
          </div>
          <div className="modal-row">
            <label>
              체크아웃 날짜:
              <input
                type="date"
                name="checkOutDate"
                value={formData.checkOutDate}
                onChange={handleInputChange}
                required
              />
            </label>
            <label>
              체크아웃 시간:
              <input
                type="time"
                name="checkOutTime"
                value={formData.checkOutTime}
                onChange={handleInputChange}
                required
              />
            </label>
          </div>
          <div className="modal-row">
            <label>
              객실 타입:
              <select
                name="roomInfo"
                value={formData.roomInfo}
                onChange={handleInputChange}
              >
                {filteredRoomTypes.map((rt) => (
                  <option key={rt.roomInfo} value={rt.roomInfo}>
                    {rt.roomInfo}
                  </option>
                ))}
              </select>
            </label>
            <label>
              가격:
              <input
                type="number"
                name="price"
                value={formData.price}
                onChange={handleInputChange}
                required
              />
            </label>
          </div>
          <label className="special-requests">
            고객 요청:
            <input
              name="specialRequests"
              value={formData.specialRequests}
              onChange={handleInputChange}
            />
          </label>
          <div className="guest-form-actions">
            <button
              type="button"
              className="guest-form-button guest-form-cancel"
              onClick={onClose}
              disabled={isSubmitting}
            >
              취소
            </button>
            <button
              type="submit"
              className="guest-form-button guest-form-save"
              disabled={isSubmitting}
            >
              {isSubmitting ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.getElementById('modal-root')
  );
};

QuickRangeModal.propTypes = {
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  initialData: PropTypes.object,
  roomTypes: PropTypes.array.isRequired,
  availabilityByDate: PropTypes.object.isRequired,
};

export default QuickRangeModal;