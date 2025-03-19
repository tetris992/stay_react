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
import { payPerNight } from '../api/api';

const GuestFormModal = ({
  onClose,
  onSave,
  initialData,
  roomTypes,
  availabilityByDate,
  hotelSettings,
  hotelId,
  selectedDate,
  setAllReservations,
  processReservation,
  filterReservationsByDate,
  allReservations,
  setNewlyCreatedId,
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
    price: '0',
    paymentMethod: '',
    paymentDetails: [],
    specialRequests: '',
    roomNumber: '',
    manualPriceOverride: false,
    remainingBalance: 0,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPaymentDetails, setShowPaymentDetails] = useState(false);
  const [reservationId, setReservationId] = useState(null);
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
      const totalPrice = initialData.price || initialData.totalPrice || 0;
      setFormData({
        reservationNo: initialData.reservationNo || '',
        customerName: initialData.customerName || '',
        phoneNumber: initialData.phoneNumber || '',
        checkInDate: format(checkInDateObj, 'yyyy-MM-dd'),
        checkInTime: format(checkInDateObj, 'HH:mm'),
        checkOutDate: format(checkOutDateObj, 'yyyy-MM-dd'),
        checkOutTime: format(checkOutDateObj, 'HH:mm'),
        reservationDate:
          initialData.reservationDate || format(now, 'yyyy-MM-dd HH:mm'),
        roomInfo:
          initialData.roomInfo || filteredRoomTypes[0]?.roomInfo || 'Standard',
        price: String(totalPrice),
        paymentMethod:
          initialData.paymentMethod ||
          (initialData.type === 'dayUse' ? 'Cash' : 'Card'),
        paymentDetails: initialData.paymentHistory || [],
        specialRequests: initialData.specialRequests || '',
        roomNumber: initialData.roomNumber || '',
        manualPriceOverride: false, // 초기에는 false로 설정
        remainingBalance: initialData.remainingBalance || totalPrice,
      });
      setShowPaymentDetails(
        initialData.paymentMethod === 'Various' ||
          initialData.paymentMethod?.includes('PerNight')
      );
      setReservationId(initialData._id);
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
        checkInTime: defaultCheckInTime,
        checkOutDate: checkOutDateStr,
        checkOutTime: defaultCheckOutTime,
        reservationDate: format(now, 'yyyy-MM-dd HH:mm'),
        roomInfo: initialRoomInfo,
        price: String(basePrice),
        paymentMethod:
          initialData?.paymentMethod ||
          (initialData?.type === 'dayUse' ? 'Cash' : 'Card'),
        paymentDetails:
          initialData?.paymentMethod === 'Various'
            ? [
                {
                  method: 'Cash',
                  amount: 0,
                  date: format(now, 'yyyy-MM-dd'),
                  timestamp: format(now, "yyyy-MM-dd'T'HH:mm:ss+09:00"),
                },
              ]
            : [],
        specialRequests: initialData?.specialRequests || '',
        roomNumber: initialData?.roomNumber || '',
        manualPriceOverride: false,
        remainingBalance: basePrice,
      });
      setReservationId(null);
    }
    if (!hotelId) {
      console.error('[GuestFormModal] hotelId is undefined, closing modal');
      onClose();
    } else {
      console.log('[GuestFormModal] Initial hotelId:', hotelId);
    }
  }, [initialData, filteredRoomTypes, hotelSettings, hotelId, onClose]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'roomInfo' && initialData?._id) return;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
      ...(name === 'price'
        ? { manualPriceOverride: true, remainingBalance: Number(value) }
        : {}),
      ...(name === 'paymentMethod' && value === 'Various'
        ? {
            paymentDetails:
              prev.paymentDetails.length > 0
                ? prev.paymentDetails
                : [
                    {
                      method: 'Cash',
                      amount: 0,
                      date: format(new Date(), 'yyyy-MM-dd'),
                      timestamp: format(
                        new Date(),
                        "yyyy-MM-dd'T'HH:mm:ss+09:00"
                      ),
                    },
                  ],
          }
        : { paymentDetails: [] }),
    }));
    if (name === 'paymentMethod') {
      setShowPaymentDetails(value === 'Various' || value.includes('PerNight'));
    }
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
    )
      return false;
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
      if (!availForDay || availForDay.remain <= 0) return true;
      cursor = addDays(cursor, 1);
    }
    return false;
  };

  useEffect(() => {
    if (isSubmitting) return;

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
        const nights = differenceInCalendarDays(checkOutDateObj, checkInDateObj);
        let nightlyPrice;

        // 기존 예약이 있는 경우: 초기 1박당 요금을 계산
        if (initialData && initialData._id) {
          const initialCheckIn = new Date(initialData.checkIn);
          const initialCheckOut = new Date(initialData.checkOut);
          const initialNights = differenceInCalendarDays(
            initialCheckOut,
            initialCheckIn
          );
          const initialTotalPrice = Number(
            initialData.price || initialData.totalPrice || 0
          );
          nightlyPrice = initialTotalPrice / Math.max(initialNights, 1);
        } else {
          // 신규 예약: 객실 타입의 기본 요금 사용
          const selectedRoom = filteredRoomTypes.find(
            (room) => room.roomInfo === formData.roomInfo
          );
          nightlyPrice = selectedRoom?.price || 0;
        }

        // manualPriceOverride가 false일 때만 가격을 재계산
        if (!formData.manualPriceOverride) {
          const totalPrice = String(nightlyPrice * Math.max(nights, 1));
          setFormData((prev) => ({
            ...prev,
            price: totalPrice,
            remainingBalance: Number(totalPrice),
          }));
        }
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
    formData.checkInTime,
    formData.checkOutTime,
  ]);

  const handleAddPaymentDetail = () => {
    setFormData((prev) => {
      const newPaymentDetails = [
        ...prev.paymentDetails,
        {
          method: 'Cash',
          amount: 0,
          timestamp: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss+09:00"),
          date: format(new Date(), 'yyyy-MM-dd'),
        },
      ];
      return {
        ...prev,
        paymentDetails: newPaymentDetails,
        remainingBalance:
          Number(prev.price) -
          newPaymentDetails.reduce(
            (sum, detail) => sum + Number(detail.amount || 0),
            0
          ),
      };
    });
  };

  const handlePaymentDetailChange = (index, field, value) => {
    setFormData((prev) => {
      const updatedDetails = [...prev.paymentDetails];
      updatedDetails[index] = { ...updatedDetails[index], [field]: value };
      const totalPaid = updatedDetails.reduce(
        (sum, detail) => sum + Number(detail.amount || 0),
        0
      );
      return {
        ...prev,
        paymentDetails: updatedDetails,
        remainingBalance: Number(prev.price) - totalPaid,
      };
    });
  };

  const handleRemovePaymentDetail = (index) => {
    setFormData((prev) => {
      const updatedDetails = prev.paymentDetails.filter((_, i) => i !== index);
      const totalPaid = updatedDetails.reduce(
        (sum, detail) => sum + Number(detail.amount || 0),
        0
      );
      return {
        ...prev,
        paymentDetails: updatedDetails,
        remainingBalance: Number(prev.price) - totalPaid,
      };
    });
  };

  const handlePayPerNightClick = async () => {
    console.log(
      '[handlePayPerNightClick] hotelId:',
      hotelId,
      'reservationId:',
      reservationId
    );
    if (!reservationId) {
      alert('먼저 예약을 저장해주세요.');
      return;
    }

    if (!hotelId) {
      alert('호텔 ID가 없습니다. 다시 시도해주세요.');
      console.error('[handlePayPerNightClick] hotelId is undefined or invalid');
      return;
    }

    if (
      !formData.paymentMethod ||
      !formData.paymentDetails ||
      formData.paymentDetails.length === 0
    ) {
      alert(
        '결제 방법 또는 결제 기록이 설정되지 않았습니다. 먼저 예약을 저장하고 결제 세부 사항을 추가하세요.'
      );
      return;
    }

    const checkInDateTime = new Date(
      `${formData.checkInDate}T${formData.checkInTime}:00`
    );
    const checkOutDateTime = new Date(
      `${formData.checkOutDate}T${formData.checkOutTime}:00`
    );
    const nights = Math.floor(
      differenceInCalendarDays(checkOutDateTime, checkInDateTime)
    );
    if (nights <= 1) {
      alert('연박 예약만 1박씩 결제 가능합니다.');
      return;
    }
    const perNightPrice = Math.round(Number(formData.price) / nights);
    if (isNaN(perNightPrice) || perNightPrice <= 0) {
      alert('유효한 1박 결제 금액을 계산할 수 없습니다.');
      return;
    }
    const paymentMethod =
      formData.paymentMethod === 'PerNight(Card)' ? 'Card' : 'Cash';

    try {
      console.log('[handlePayPerNightClick] Calling payPerNight with:', {
        reservationId,
        hotelId,
        amount: perNightPrice,
        method: paymentMethod,
      });
      const response = await payPerNight(
        reservationId,
        hotelId,
        perNightPrice,
        paymentMethod
      );
      console.log('[handlePayPerNightClick] Full Response:', response);

      if (response && response.reservation) {
        setFormData((prev) => ({
          ...prev,
          paymentDetails: response.reservation.paymentHistory || [],
          paymentMethod:
            response.reservation.paymentMethod || prev.paymentMethod,
          remainingBalance: response.reservation.remainingBalance || 0,
        }));
        alert(
          `1박 결제 성공. 남은 금액: ${response.reservation.remainingBalance}원`
        );
        setAllReservations((prev) =>
          prev.map((res) =>
            res._id === reservationId
              ? processReservation(response.reservation)
              : res
          )
        );
        filterReservationsByDate(allReservations, selectedDate);
      } else {
        throw new Error(
          '응답에서 reservation 객체를 찾을 수 없습니다. 응답: ' +
            JSON.stringify(response)
        );
      }
    } catch (error) {
      console.error(`1박 결제 실패 (${reservationId}):`, error);
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        '1박 결제에 실패했습니다. 서버 로그를 확인해주세요.';
      alert(errorMessage);
    }
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
        if (!commonRooms) commonRooms = new Set(freeRooms);
        else
          commonRooms = new Set(
            [...commonRooms].filter((room) => freeRooms.includes(room))
          );
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
    const nights = differenceInCalendarDays(checkOutDateTime, checkInDateTime);
    const isPerNightPayment =
      formData.paymentMethod.includes('PerNight') && nights > 1;

    if (
      formData.paymentMethod === 'Various' &&
      formData.paymentDetails.length === 0
    ) {
      alert(
        '다양한 결제는 최소 한 건의 결제 기록이 필요합니다. "결제 추가" 버튼을 사용하세요.'
      );
      setIsSubmitting(false);
      return;
    }

    if (
      formData.paymentMethod === 'Various' &&
      formData.paymentDetails.length > 0
    ) {
      const totalPaid = formData.paymentDetails.reduce(
        (sum, detail) => sum + Number(detail.amount || 0),
        0
      );
      if (totalPaid > numericPrice) {
        alert(
          `분할 결제 금액(${totalPaid}원)이 총 금액(${numericPrice}원)을 초과합니다.`
        );
        setIsSubmitting(false);
        return;
      }
      const isValid = formData.paymentDetails.every(
        (detail) =>
          detail.date &&
          detail.amount !== undefined &&
          detail.amount >= 0 &&
          detail.timestamp &&
          detail.method
      );
      if (!isValid) {
        alert(
          '결제 기록에 date, amount, timestamp, method가 모두 필요하며, amount는 0 이상이어야 합니다.'
        );
        setIsSubmitting(false);
        return;
      }
    }

    const finalData = {
      ...formData,
      price: numericPrice,
      checkIn: format(checkInDateTime, "yyyy-MM-dd'T'HH:mm:ss") + '+09:00',
      checkOut: format(checkOutDateTime, "yyyy-MM-dd'T'HH:mm:ss") + '+09:00',
      roomNumber: String(selectedRoomNumber),
      siteName: '현장예약',
      type: 'stay',
      isPerNightPayment,
      paymentMethod: formData.paymentMethod,
      paymentHistory: formData.paymentDetails,
      remainingBalance: formData.remainingBalance,
    };

    console.log('[GuestFormModal] Submitting finalData:', finalData);
    try {
      let newReservationId;
      if (initialData?._id) {
        const response = await onSave(initialData._id, finalData);
        console.log('[GuestFormModal] Update response:', response);
        newReservationId = initialData._id;
        console.log('[GuestFormModal] Save successful for:', initialData._id);
      } else {
        const response = await onSave(null, finalData);
        console.log('[GuestFormModal] Save response received:', response);

        if (
          response &&
          response.createdReservationIds &&
          Array.isArray(response.createdReservationIds) &&
          response.createdReservationIds.length > 0
        ) {
          newReservationId = response.createdReservationIds[0];
          console.log(
            '[GuestFormModal] New reservation saved with ID:',
            newReservationId
          );
        } else if (
          response &&
          response.message &&
          response.message.includes('successfully')
        ) {
          newReservationId = finalData.reservationNo || `${Date.now()}`;
          console.warn(
            '[GuestFormModal] No createdReservationIds, using temporary ID:',
            newReservationId
          );
        } else if (response === undefined) {
          console.error(
            '[GuestFormModal] Response is undefined, attempting fallback'
          );
          newReservationId = finalData.reservationNo || `${Date.now()}`;
          console.warn('[GuestFormModal] Fallback ID used:', newReservationId);
        } else {
          console.error('[GuestFormModal] Unexpected response:', response);
          throw new Error(
            '응답에서 createdReservationIds를 찾을 수 없습니다. 서버 응답: ' +
              JSON.stringify(response)
          );
        }
      }
      setReservationId(newReservationId);
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

  const renderPaymentMethodDropdown = () => {
    const checkInDateObj = new Date(
      `${formData.checkInDate}T${formData.checkInTime}:00`
    );
    const checkOutDateObj = new Date(
      `${formData.checkOutDate}T${formData.checkOutTime}:00`
    );
    const nights = differenceInCalendarDays(checkOutDateObj, checkInDateObj);

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
  };

  const renderPaymentDetails = () => {
    if (!showPaymentDetails) return null;
    const perNightPrice = Math.round(
      parseFloat(formData.price) /
        differenceInCalendarDays(
          new Date(`${formData.checkOutDate}T${formData.checkOutTime}:00`),
          new Date(`${formData.checkInDate}T${formData.checkInTime}:00`)
        )
    );

    if (formData.paymentMethod.includes('PerNight')) {
      return (
        <div className="modal-row payment-details">
          <h4>1박 금액: {perNightPrice}원</h4>
          {reservationId && (
            <button
              type="button"
              onClick={handlePayPerNightClick}
              disabled={isSubmitting}
            >
              결제+1
            </button>
          )}
        </div>
      );
    }

    return (
      <div className="modal-row payment-details">
        <h4>다양한 결제 설정</h4>
        {formData.paymentDetails.map((detail, index) => (
          <div key={index} className="payment-detail-row">
            <select
              value={detail.method}
              onChange={(e) =>
                handlePaymentDetailChange(index, 'method', e.target.value)
              }
              disabled={isSubmitting}
            >
              <option value="Cash">현금</option>
              <option value="Card">카드</option>
              <option value="Account Transfer">계좌이체</option>
            </select>
            <input
              type="number"
              value={detail.amount || 0}
              onChange={(e) =>
                handlePaymentDetailChange(index, 'amount', e.target.value)
              }
              placeholder="금액"
              min="0"
              disabled={isSubmitting}
            />
            <input
              type="date"
              value={detail.date || ''}
              onChange={(e) =>
                handlePaymentDetailChange(index, 'date', e.target.value)
              }
              disabled={isSubmitting}
            />
            <input
              type="datetime-local"
              value={
                detail.timestamp
                  ? new Date(detail.timestamp).toISOString().slice(0, 16)
                  : ''
              }
              onChange={(e) =>
                handlePaymentDetailChange(
                  index,
                  'timestamp',
                  e.target.value + ':00+09:00'
                )
              }
              disabled={isSubmitting}
            />
            <button
              type="button"
              onClick={() => handleRemovePaymentDetail(index)}
              disabled={isSubmitting}
            >
              제거
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={handleAddPaymentDetail}
          disabled={isSubmitting}
        >
          결제 추가
        </button>
      </div>
    );
  };

  const isPerNightPayment = formData.paymentMethod.includes('PerNight');
  const isSaveDisabled =
    formData.paymentMethod === 'Various' &&
    formData.paymentDetails.length === 0;

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
                        {rt.roomInfo} ({rt.price}원)
                      </option>
                    );
                  })}
                </select>
              )}
            </label>
            <label htmlFor="price">
              총가격: {formData.price}
              {isPerNightPayment && ` (잔여: ${formData.remainingBalance}원)`}
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
          {renderPaymentMethodDropdown()}
          {renderPaymentDetails()}
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
              disabled={isSubmitting || isSaveDisabled}
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
  hotelId: PropTypes.string.isRequired,
  selectedDate: PropTypes.instanceOf(Date),
  setAllReservations: PropTypes.func.isRequired,
  processReservation: PropTypes.func.isRequired,
  filterReservationsByDate: PropTypes.func.isRequired,
  allReservations: PropTypes.array.isRequired,
  setNewlyCreatedId: PropTypes.func.isRequired,
};

export default GuestFormModal;