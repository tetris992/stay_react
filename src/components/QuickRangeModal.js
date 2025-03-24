import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { format, addDays, differenceInCalendarDays, parseISO, startOfDay } from 'date-fns';
import PropTypes from 'prop-types';
import './QuickRangeModal.css';
import { getDetailedAvailabilityMessage } from '../utils/availability';

const QuickRangeModal = ({ onClose, onSave, initialData, roomTypes, availabilityByDate }) => {
  // (불필요한 변수는 eslint 경고가 발생하므로 제거하거나 주석처리)
  // const existingReservationId = initialData?._id || null;

  const [formData, setFormData] = useState({
    reservationNo: initialData?.reservationNo || `${Date.now()}`,
    customerName: initialData?.customerName || `현장:${format(new Date(), 'HH:mm:ss')}`,
    phoneNumber: initialData?.phoneNumber || '',
    checkInDate: initialData?.checkInDate || '',
    checkInTime: initialData?.checkInTime || '16:00',
    checkOutDate: initialData?.checkOutDate || '',
    checkOutTime: initialData?.checkOutTime || '11:00',
    roomInfo: initialData?.roomInfo || (roomTypes[0]?.roomInfo || 'Standard'),
    price: initialData?.price || '',
    // 기본 결제방식을 'Card'로 설정 (수정 모드인 경우 기존 값 유지)
    paymentMethod: initialData?.paymentMethod || 'Card',
    specialRequests: initialData?.specialRequests || '',
    roomNumber: initialData?.roomNumber || '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 'none'이 아닌 객실타입만 필터링
  const filteredRoomTypes = useMemo(
    () => roomTypes.filter(rt => rt.roomInfo.toLowerCase() !== 'none'),
    [roomTypes]
  );

  // 숙박일수(nights)를 계산 (체크인/체크아웃 날짜가 모두 유효할 때)
  const nights = useMemo(() => {
    const checkInDateTime = parseISO(`${formData.checkInDate}T${formData.checkInTime}:00`);
    const checkOutDateTime = parseISO(`${formData.checkOutDate}T${formData.checkOutTime}:00`);
    if (!isNaN(checkInDateTime) && !isNaN(checkOutDateTime) && checkInDateTime < checkOutDateTime) {
      return differenceInCalendarDays(checkOutDateTime, checkInDateTime);
    }
    return 0;
  }, [formData.checkInDate, formData.checkInTime, formData.checkOutDate, formData.checkOutTime]);

  // 체크인/체크아웃 날짜 변경 시 자동 가격 업데이트
  useEffect(() => {
    const checkInDateTime = parseISO(`${formData.checkInDate}T${formData.checkInTime}:00`);
    const checkOutDateTime = parseISO(`${formData.checkOutDate}T${formData.checkOutTime}:00`);
    if (
      checkInDateTime &&
      checkOutDateTime &&
      !isNaN(checkInDateTime) &&
      !isNaN(checkOutDateTime) &&
      checkInDateTime < checkOutDateTime
    ) {
      const selectedRoom = filteredRoomTypes.find(rt => rt.roomInfo === formData.roomInfo);
      const totalPrice = (selectedRoom?.price || 0) * Math.max(nights, 1);
      setFormData(prev => ({ ...prev, price: totalPrice.toString() }));
    }
  }, [formData.checkInDate, formData.checkInTime, formData.checkOutDate, formData.checkOutTime, formData.roomInfo, filteredRoomTypes, nights]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // 결제방식 드롭다운 렌더링 함수 (nights 변수를 사용)
  const renderPaymentMethodDropdown = useCallback(() => {
    return (
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
            {nights > 1 && (
              <>
                <option value="PerNight(Card)">1박씩(카드)</option>
                <option value="PerNight(Cash)">1박씩(현금)</option>
                <option value="Various">다양한 결제</option>
              </>
            )}
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
    );
  }, [formData, isSubmitting, nights]);

  // 기존 가용성 체크 및 충돌 검사 로직은 그대로 사용합니다.
  const checkAvailability = useCallback(
    (checkInDateTime, checkOutDateTime, excludeReservationId = null) => {
      const tKey = formData.roomInfo.toLowerCase();
      let cursor = new Date(checkInDateTime);
      let missingDates = [];
      let commonRooms = null;
      while (cursor < checkOutDateTime) {
        const ds = format(cursor, 'yyyy-MM-dd');
        const availForDay = availabilityByDate[ds]?.[tKey];
        if (!availForDay) {
          missingDates.push(ds);
          continue;
        }
        let adjustedRemain = availForDay.remain;
        let adjustedLeftoverRooms = [...(availForDay.leftoverRooms || [])];
        if (excludeReservationId && availForDay.reservations) {
          const selfReservation = availForDay.reservations.find(res => res._id === excludeReservationId);
          if (selfReservation) {
            adjustedRemain += 1;
            if (selfReservation.roomNumber && !adjustedLeftoverRooms.includes(selfReservation.roomNumber)) {
              adjustedLeftoverRooms.push(selfReservation.roomNumber);
            }
          }
        }
        if (adjustedRemain <= 0) {
          missingDates.push(ds);
        } else {
          const freeRooms = adjustedLeftoverRooms;
          if (!commonRooms) commonRooms = new Set(freeRooms);
          else {
            commonRooms = new Set([...commonRooms].filter(r => freeRooms.includes(r)));
          }
        }
        cursor = addDays(cursor, 1);
      }
      if (!commonRooms || commonRooms.size === 0 || missingDates.length > 0) {
        return getDetailedAvailabilityMessage(
          startOfDay(checkInDateTime),
          startOfDay(checkOutDateTime),
          tKey,
          availabilityByDate
        );
      }
      return { commonRooms };
    },
    [formData.roomInfo, availabilityByDate]
  );

  const buildFinalData = useCallback(
    (checkInDateTime, checkOutDateTime, commonRooms) => {
      const selectedRoomNumber =
        formData.roomNumber ||
        [...commonRooms].sort((a, b) => parseInt(a) - parseInt(b))[0];
      return {
        ...formData,
        price: Number(formData.price),
        checkIn: format(checkInDateTime, "yyyy-MM-dd'T'HH:mm:ss") + '+09:00',
        checkOut: format(checkOutDateTime, "yyyy-MM-dd'T'HH:mm:ss") + '+09:00',
        roomNumber: String(selectedRoomNumber),
        siteName: '현장예약',
      };
    },
    [formData]
  );

  const doSave = useCallback(
    async (finalData) => {
      const response = initialData?._id
        ? await onSave(initialData._id, finalData)
        : await onSave(null, finalData);
      console.log('[QuickRangeModal] Save response:', response);
      if (!initialData?._id) {
        if (
          response?.createdReservationIds &&
          Array.isArray(response.createdReservationIds) &&
          response.createdReservationIds.length > 0
        ) {
          const newId = response.createdReservationIds[0];
          console.log('[QuickRangeModal] New reservation saved with ID:', newId);
        } else if (response?.message?.includes('successfully')) {
          const newId = `현장예약-${formData.reservationNo}`;
          console.warn('[QuickRangeModal] No createdReservationIds, using ID:', newId);
        } else if (response === undefined) {
          console.error('[QuickRangeModal] Response is undefined, attempting fallback');
          const newId = `현장예약-${formData.reservationNo}`;
          console.warn('[QuickRangeModal] Fallback ID used:', newId);
        } else {
          console.error('[QuickRangeModal] Unexpected response:', response);
          throw new Error('응답에서 createdReservationIds를 찾을 수 없습니다. 서버 응답: ' + JSON.stringify(response));
        }
      }
    },
    [initialData, formData.reservationNo, onSave]
  );

  const validateForm = useCallback(() => {
    const numericPrice = parseFloat(formData.price);
    if (isNaN(numericPrice) || numericPrice < 0) {
      alert('가격은 유효한 숫자여야 하며 음수가 될 수 없습니다.');
      return false;
    }
    if (!formData.checkInDate || !formData.checkOutDate) {
      alert('체크인/체크아웃 날짜를 모두 입력해주세요.');
      return false;
    }
    if (!formData.phoneNumber.trim()) {
      alert('연락처는 필수 입력 항목입니다.');
      return false;
    }
    const checkInDateTime = new Date(`${formData.checkInDate}T${formData.checkInTime}:00`);
    const checkOutDateTime = new Date(`${formData.checkOutDate}T${formData.checkOutTime}:00`);
    if (isNaN(checkInDateTime) || isNaN(checkOutDateTime)) {
      alert('유효한 체크인/체크아웃 날짜를 입력해주세요.');
      return false;
    }
    if (checkInDateTime >= checkOutDateTime) {
      alert('체크인 날짜는 체크아웃보다 이전이어야 합니다.');
      return false;
    }
    if (
      !initialData?._id &&
      formData.customerName.includes('현장') &&
      checkInDateTime < startOfDay(new Date())
    ) {
      alert('현장예약은 과거 날짜로 생성할 수 없습니다.');
      return false;
    }
    if (
      formData.paymentMethod === 'Various' &&
      formData.paymentDetails && formData.paymentDetails.length === 0
    ) {
      alert('다양한 결제는 최소 한 건의 결제 기록이 필요합니다. "결제 추가" 버튼을 사용하세요.');
      return false;
    }
    if (
      formData.paymentMethod === 'Various' &&
      formData.paymentDetails && formData.paymentDetails.length > 0
    ) {
      const totalPaid = formData.paymentDetails.reduce((sum, detail) => sum + Number(detail.amount || 0), 0);
      if (totalPaid > numericPrice) {
        alert(`분할 결제 금액(${totalPaid}원)이 총 금액(${numericPrice}원)을 초과합니다.`);
        return false;
      }
      const isValid = formData.paymentDetails.every(
        detail =>
          detail.date &&
          detail.amount !== undefined &&
          detail.amount >= 0 &&
          detail.timestamp &&
          detail.method
      );
      if (!isValid) {
        alert('결제 기록에 date, amount, timestamp, method가 모두 필요하며, amount는 0 이상이어야 합니다.');
        return false;
      }
    }
    return true;
  }, [formData, initialData]);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (isSubmitting) return;
      setIsSubmitting(true);
      if (!validateForm()) {
        setIsSubmitting(false);
        return;
      }
      const checkInDateTime = new Date(`${formData.checkInDate}T${formData.checkInTime}:00`);
      const checkOutDateTime = new Date(`${formData.checkOutDate}T${formData.checkOutTime}:00`);
  
      const availabilityResult = checkAvailability(checkInDateTime, checkOutDateTime, initialData?._id);
      if (availabilityResult && typeof availabilityResult === 'string') {
        alert(availabilityResult);
        setIsSubmitting(false);
        return;
      }
      const finalData = buildFinalData(checkInDateTime, checkOutDateTime, availabilityResult.commonRooms);
      console.log('[QuickRangeModal] Submitting finalData:', finalData);
      try {
        await doSave(finalData);
        onClose();
      } catch (error) {
        console.error('[QuickRangeModal] Save Error:', error);
        const errorMessage =
          error.status === 403
            ? 'CSRF 토큰 오류: 페이지를 새로고침 후 다시 시도해주세요.'
            : error.response?.data?.message || error.message || '예약 저장에 실패했습니다. 다시 시도해주세요.';
        alert(errorMessage);
      } finally {
        setIsSubmitting(false);
      }
    },
    [isSubmitting, formData, onClose, initialData?._id, validateForm, checkAvailability, buildFinalData, doSave]
  );

  return ReactDOM.createPortal(
    <div className="quick-range-modal">
      <div className="modal-card">
        {isSubmitting && (
          <div className="modal-overlay-spinner">처리 중...</div>
        )}
        <span className="close-button" onClick={onClose}>×</span>
        <h2>빠른 연박 예약</h2>
        <form onSubmit={handleSubmit}>
          {/* 예약자 정보 */}
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
          {/* 체크인/체크아웃 */}
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
          {/* 객실 타입 및 가격 */}
          <div className="modal-row">
            <label>
              객실 타입:
              <select name="roomInfo" value={formData.roomInfo} onChange={handleInputChange}>
                {filteredRoomTypes.map(rt => (
                  <option key={rt.roomInfo} value={rt.roomInfo}>
                    {rt.roomInfo} ({rt.price}원)
                  </option>
                ))}
              </select>
            </label>
            <label>
              가격:
              <input type="number" name="price" value={formData.price} onChange={handleInputChange} required />
            </label>
          </div>
          {/* 결제방법 드롭다운 */}
          {renderPaymentMethodDropdown()}
          {/* 하단 버튼 영역 */}
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
