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
  selectedDate,
  setLoadedReservations,
}) => {
  const [formData, setFormData] = useState({
    reservationNo: '',
    customerName: '',
    phoneNumber: '',
    checkInDate: '',
    checkInTime: '',
    durationHours: 3,
    reservationDate: '',
    roomInfo: '',
    price: '0',
    paymentMethod: '미결제',
    specialRequests: '',
    roomNumber: '',
    manualPriceOverride: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 'none' 객실 제외
  const filteredRoomTypes = useMemo(
    () => roomTypes.filter((rt) => rt.roomInfo.toLowerCase() !== 'none'),
    [roomTypes]
  );

  /**
   * 특정 날짜에 해당 roomInfo가 대실 가능한지(재고가 남아 있는지) 판단하는 함수
   */
  const isRoomTypeUnavailable = (roomInfo) => {
    if (!availabilityByDate || !formData.checkInDate) return false;
    const ds = formData.checkInDate;
    const availForDay = availabilityByDate[ds]?.[roomInfo.toLowerCase()];
    return !availForDay || availForDay.remain <= 0;
  };

  useEffect(() => {
    const now = new Date();
    const effectiveSelectedDate = selectedDate || now;

    console.log('[DayUseFormModal] Initial data:', initialData); // 디버깅 로그 추가

    if (initialData && initialData._id) {
      // [수정 모드] 기존 대실 예약
      const checkInDateObj = initialData.checkIn
        ? new Date(initialData.checkIn)
        : new Date();
      const checkOutDateObj = initialData.checkOut
        ? new Date(initialData.checkOut)
        : addHours(checkInDateObj, 3); // checkOut이 없으면 기본 3시간 후
      if (isNaN(checkInDateObj.getTime())) {
        console.warn(
          'Invalid checkIn date, using current date:',
          initialData.checkIn
        );
        checkInDateObj.setTime(now.getTime());
      }
      if (isNaN(checkOutDateObj.getTime())) {
        console.warn(
          'Invalid checkOut date, using default (3 hours later):',
          initialData.checkOut
        );
        checkOutDateObj.setTime(addHours(checkInDateObj, 3).getTime());
      }

      const duration = Math.round(
        (checkOutDateObj - checkInDateObj) / (1000 * 60 * 60)
      );

      setFormData({
        reservationNo: initialData.reservationNo || '',
        customerName: initialData.customerName || '',
        phoneNumber: initialData.phoneNumber || '',
        checkInDate: format(checkInDateObj, 'yyyy-MM-dd'),
        checkInTime: format(checkInDateObj, 'HH:mm'), // 체크인 시간 설정
        durationHours: duration || 3,
        reservationDate:
          initialData.reservationDate || format(now, 'yyyy-MM-dd HH:mm'),
        roomInfo:
          initialData.roomInfo || filteredRoomTypes[0]?.roomInfo || 'Standard',
        price: String(initialData.price || initialData.totalPrice || 0),
        paymentMethod: initialData.paymentMethod || 'Cash', // 대실은 기본값 "Cash"
        specialRequests: initialData.specialRequests || '',
        roomNumber: initialData.roomNumber || '',
        manualPriceOverride: !!initialData.price,
        type: initialData.type || 'dayUse',
      });
    } else {
      // [신규 대실 예약]
      const defaultCheckInDate = format(effectiveSelectedDate, 'yyyy-MM-dd');
      const defaultCheckInTime = '00:00'; // 호텔 설정과 무관하게 "00:00" 고정

      const initialRoomInfo = filteredRoomTypes[0]?.roomInfo || 'Standard';
      const selectedRoom =
        filteredRoomTypes.find((rt) => rt.roomInfo === initialRoomInfo) ||
        filteredRoomTypes[0];

      // 기본적으로 대실은 객실 정가의 50%로 계산
      const basePrice = Math.floor((selectedRoom?.price || 0) * 0.5);

      setFormData({
        reservationNo: `${Date.now()}`,
        customerName: `현장대실`,
        phoneNumber: '',
        checkInDate: defaultCheckInDate,
        checkInTime: defaultCheckInTime,
        durationHours: 3,
        reservationDate: format(now, 'yyyy-MM-dd HH:mm'),
        roomInfo: initialRoomInfo,
        price: String(basePrice),
        paymentMethod: initialData?.paymentMethod || 'Cash', // 대실은 기본값 "Cash"
        specialRequests: '',
        roomNumber: '',
        manualPriceOverride: false,
        type: 'dayUse',
      });
    }
  }, [initialData, filteredRoomTypes, selectedDate]);

  // 신규 생성 시(수정 모드가 아니고, 수동 오버라이드가 아닐 때) 자동 가격 계산
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
    const additionalHours = Math.max(formData.durationHours - 3, 0);
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

  /**
   * 입력값 변경 핸들러
   */
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    // 수정 모드 && (기존 예약)인 경우 roomInfo 변경 불가
    if (name === 'roomInfo' && initialData?._id) return;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
      ...(name === 'price' ? { manualPriceOverride: true } : {}),
    }));
  };

  /**
   * 사용 시간(대실 시간) 버튼 증감 핸들러
   */
  const handleDurationChange = (increment) => {
    setFormData((prev) => {
      const newDurationHours = Math.max(1, prev.durationHours + increment);
      const selectedRoom = filteredRoomTypes.find(
        (room) => room.roomInfo === prev.roomInfo
      );
      const basePrice = Math.floor((selectedRoom?.price || 0) * 0.5);
      const additionalHours = Math.max(newDurationHours - 3, 0);
      const newPrice = String(basePrice + additionalHours * 10000);

      return {
        ...prev,
        durationHours: newDurationHours,
        price: newPrice,
        manualPriceOverride: false,
      };
    });
  };

  /**
   * 폼 전송 핸들러
   */
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

    // 대실은 (신규 시) checkInTime = "00:00" 으로 DB에 저장하고,
    // 실제 체크인 시점에 다시 갱신하도록 설계할 수 있음
    const checkInDateTime = new Date(
      `${formData.checkInDate}T${formData.checkInTime}:00+09:00`
    );
    if (isNaN(checkInDateTime.getTime())) {
      alert('유효한 체크인 날짜/시간을 입력해주세요.');
      setIsSubmitting(false);
      return;
    }

    const checkOutDateTime = addHours(checkInDateTime, formData.durationHours);

    // 재고 확인
    const tKey = formData.roomInfo.toLowerCase();
    const ds = format(checkInDateTime, 'yyyy-MM-dd');
    const availForDay = availabilityByDate?.[ds]?.[tKey];
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

    // 가능한 객실 번호가 있으면 그 중 하나를 선택 (혹은 사용자 입력)
    const selectedRoomNumber =
      formData.roomNumber ||
      availForDay.leftoverRooms?.sort((a, b) => parseInt(a) - parseInt(b))[0] ||
      '';

    // 최종 데이터 구조
    const finalData = {
      ...formData,
      price: numericPrice,
      checkIn: format(checkInDateTime, "yyyy-MM-dd'T'HH:mm:ss"),
      checkOut: format(checkOutDateTime, "yyyy-MM-dd'T'HH:mm:ss"),
      roomNumber: String(selectedRoomNumber),
      siteName: initialData?.siteName || '현장예약',
      type: formData.type || 'dayUse',
      duration: formData.durationHours,
    };

    try {
      if (initialData?._id) {
        // 수정 모드
        await onSave(initialData._id, finalData);
      } else {
        // 신규 생성
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

  /**
   * 체크아웃 시간 미리보기
   */
  const displayCheckOut = useMemo(() => {
    if (!formData.checkInDate || !formData.checkInTime) return '';
    const checkIn = new Date(
      `${formData.checkInDate}T${formData.checkInTime}:00`
    );
    if (isNaN(checkIn.getTime())) {
      console.warn('Invalid checkIn date/time, returning empty string');
      return '';
    }
    const checkOut = addHours(checkIn, formData.durationHours);
    return format(checkOut, 'yyyy-MM-dd HH:mm');
  }, [formData.checkInDate, formData.checkInTime, formData.durationHours]);

  const handleClose = () => {
    console.log(
      `Closing DayUseFormModal, removing ${initialData?._id} from loadedReservations`
    );
    if (initialData?._id && setLoadedReservations) {
      setLoadedReservations((prev) =>
        prev.filter((id) => id !== initialData._id)
      );
    }
    onClose();
  };

  return ReactDOM.createPortal(
    <div className="dayuse-modal">
      <div className="dayuse-modal-card">
        {isSubmitting && (
          <div className="dayuse-modal-overlay-spinner">처리 중...</div>
        )}
        <span className="dayuse-close-button" onClick={handleClose}>
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
                disabled={isSubmitting || !initialData || !initialData._id}
                /* 
                  신규 예약일 때는 호텔 설정의 checkInTime을 쓰지 않도록
                  disabled = true (또는 직접 "00:00" 고정) 
                */
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
                // 수정 모드라면 객실타입은 고정
                <input
                  type="text"
                  value={formData.roomInfo}
                  readOnly
                  disabled
                />
              ) : (
                // 신규 모드라면 select로 선택 가능
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
                <option value="Card">카드</option>
                <option value="Cash">현금</option>
                <option value="Account Transfer">계좌이체</option>
                <option value="미결제">미결제</option>
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
  initialData: PropTypes.shape({
    _id: PropTypes.string,
    checkIn: PropTypes.string,
    checkOut: PropTypes.string,
    reservationNo: PropTypes.string,
    customerName: PropTypes.string,
    phoneNumber: PropTypes.string,
    reservationDate: PropTypes.string,
    roomInfo: PropTypes.string,
    price: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    paymentMethod: PropTypes.string,
    specialRequests: PropTypes.string,
    roomNumber: PropTypes.string,
    type: PropTypes.string,
  }),
  roomTypes: PropTypes.arrayOf(
    PropTypes.shape({
      roomInfo: PropTypes.string.isRequired,
      price: PropTypes.number.isRequired,
    })
  ).isRequired,
  availabilityByDate: PropTypes.object.isRequired,
  hotelSettings: PropTypes.object.isRequired,
  selectedDate: PropTypes.instanceOf(Date),
  setLoadedReservations: PropTypes.func,
};

export default DayUseFormModal;
