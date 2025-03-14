import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import { useDrag } from 'react-dnd';
import { differenceInSeconds, format, addHours, startOfDay } from 'date-fns';
import { FaFileInvoice } from 'react-icons/fa';
import MemoComponent from './MemoComponent';
import { checkConflict } from '../utils/checkConflict';
import { getBorderColor } from '../utils/roomGridUtils';
import { getPriceForDisplay } from '../utils/getPriceForDisplay';
import './DraggableReservationCard.css';
import { getPaymentMethodIcon } from '../utils/roomGridUtils';

// 남은 시간 표시를 위한 별도 컴포넌트
const CountdownTimer = ({ checkOutDate, reservationId, newlyCreatedId }) => {
  const [remainingSeconds, setRemainingSeconds] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    const calculateRemainingSeconds = () => {
      if (!checkOutDate) {
        setRemainingSeconds(null);
        return;
      }
      const now = new Date();
      const diffInSeconds = differenceInSeconds(checkOutDate, now);

      if (diffInSeconds <= 0) {
        setRemainingSeconds(0);
        return;
      }

      setRemainingSeconds(diffInSeconds);
    };

    if (reservationId === newlyCreatedId || checkOutDate) {
      calculateRemainingSeconds();
      timerRef.current = setInterval(calculateRemainingSeconds, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [checkOutDate, reservationId, newlyCreatedId]);

  const remainingTime = useMemo(() => {
    if (remainingSeconds === null) return '계산 불가';
    if (remainingSeconds <= 0) return '만료됨';

    const hours = Math.floor(remainingSeconds / 3600);
    const minutes = Math.floor((remainingSeconds % 3600) / 60);
    const seconds = remainingSeconds % 60;
    return `${hours}시간 ${minutes}분 ${seconds}초`;
  }, [remainingSeconds]);

  return (
    <span className="countdown">
      <span className={remainingTime === '만료됨' ? 'expired' : ''}>
        ({remainingTime})
      </span>
    </span>
  );
};

CountdownTimer.propTypes = {
  checkOutDate: PropTypes.instanceOf(Date),
  reservationId: PropTypes.string,
  newlyCreatedId: PropTypes.string,
};

const DraggableReservationCard = ({
  isUnassigned = false,
  reservation,
  highlightedReservationIds,
  isSearching,
  flippedReservationIds,
  memoRefs,
  handleCardFlip,
  openInvoiceModal,
  hotelSettings,
  hotelAddress,
  phoneNumber,
  email,
  handleDeleteClickHandler,
  handleConfirmClickHandler,
  loadedReservations,
  newlyCreatedId,
  isNewlyCreatedHighlighted,
  updatedReservationId,
  isUpdatedHighlighted,
  onPartialUpdate,
  onEdit,
  roomTypes,
  allReservations = [],
  selectedDate,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditingMemo, setIsEditingMemo] = useState(false);
  const [conflictDetails, setConflictDetails] = useState(null);

  // 호텔 설정에서 고정 시간 가져오기 (대실에서는 무시)
  const checkInTime = hotelSettings?.checkInTime || '16:00';
  const checkOutTime = hotelSettings?.checkOutTime || '11:00';

  // 날짜 파싱 개선
  const checkInDate = useMemo(() => {
    if (!reservation.checkIn || typeof reservation.checkIn !== 'string') {
      console.warn(
        `No or invalid checkIn for reservation ${reservation._id || 'unknown'}`
      );
      return null;
    }
    const date = new Date(reservation.checkIn);
    if (isNaN(date.getTime())) {
      console.warn(
        `Invalid checkIn date for reservation ${reservation._id || 'unknown'}:`,
        reservation.checkIn
      );
      return null;
    }
    if (process.env.NODE_ENV === 'development') {
      console.log(
        `[CheckIn] Reservation ID: ${reservation._id}, checkIn: ${
          reservation.checkIn
        }, parsed: ${date.toISOString()}`
      );
    }
    return date;
  }, [reservation.checkIn, reservation._id]);

  const checkOutDate = useMemo(() => {
    if (!reservation.checkOut || typeof reservation.checkOut !== 'string') {
      console.warn(
        `No or invalid checkOut for reservation ${reservation._id || 'unknown'}`
      );
      return null;
    }
    const date = new Date(reservation.checkOut);
    if (isNaN(date.getTime())) {
      console.warn(
        `Invalid checkOut date for reservation ${
          reservation._id || 'unknown'
        }:`,
        reservation.checkOut
      );
      return null;
    }
    if (process.env.NODE_ENV === 'development') {
      console.log(
        `[CheckOut] Reservation ID: ${reservation._id}, checkOut: ${
          reservation.checkOut
        }, parsed: ${date.toISOString()}`
      );
    }
    return date;
  }, [reservation.checkOut, reservation._id]);

  // 날짜만 추출 (드래그 조건 확인용)
  const ciDateOnly = useMemo(() => {
    return checkInDate
      ? new Date(
          checkInDate.getFullYear(),
          checkInDate.getMonth(),
          checkInDate.getDate()
        )
      : null;
  }, [checkInDate]);

  const coDateOnly = useMemo(() => {
    return checkOutDate
      ? new Date(
          checkOutDate.getFullYear(),
          checkOutDate.getMonth(),
          checkOutDate.getDate()
        )
      : null;
  }, [checkOutDate]);

  const diffDays = useMemo(() => {
    return ciDateOnly && coDateOnly
      ? (coDateOnly - ciDateOnly) / (1000 * 60 * 60 * 24)
      : 0;
  }, [ciDateOnly, coDateOnly]);

  const canDragMemo = useMemo(() => {
    if (
      !Array.isArray(roomTypes) ||
      !Array.isArray(allReservations) ||
      roomTypes.length === 0
    ) {
      console.log('Invalid roomTypes or allReservations:', {
        roomTypes,
        allReservations,
      });
      return false;
    }
    if (!checkInDate || !checkOutDate) {
      console.warn(
        `Invalid dates for reservation ${reservation._id || 'unknown'}:`,
        { checkIn: reservation.checkIn, checkOut: reservation.checkOut }
      );
      return false;
    }
    const currentDate = startOfDay(new Date());
    const checkInDay = startOfDay(checkInDate);
    const checkOutDay = startOfDay(checkOutDate);
    const selectedDay = startOfDay(selectedDate);
  
    if (currentDate > checkOutDay) {
      console.log(
        `Reservation ${reservation._id || 'unknown'} has already checked out.`
      );
      return false;
    }
  
    if (checkInDay < selectedDay && diffDays > 0) {
      console.log(
        `Cannot drag reservation ${
          reservation._id || 'unknown'
        }: Past check-in detected (Check-in: ${format(
          checkInDate,
          'yyyy-MM-dd'
        )}, Selected Date: ${format(
          selectedDay,
          'yyyy-MM-dd'
        )}, Current Date: ${format(currentDate, 'yyyy-MM-dd')})`
      );
      return false;
    }
  
    let hasConflict = false;
    const validReservations = allReservations.filter(
      (res) =>
        res &&
        res.checkIn &&
        res.checkOut &&
        typeof res.checkIn === 'string' &&
        typeof res.checkOut === 'string' &&
        !isNaN(new Date(res.checkIn).getTime()) &&
        !isNaN(new Date(res.checkOut).getTime())
    ); // 취소 예약 필터링 로직 제거 (서버에 의존)
  
    roomTypes.forEach((roomType) => {
      const roomNumbers = roomType.roomNumbers || [];
      roomNumbers.forEach((roomNumber) => {
        if (checkInDate && checkOutDate) {
          const { isConflict } = checkConflict(
            { ...reservation, checkIn: checkInDate, checkOut: checkOutDate },
            roomNumber,
            validReservations,
            selectedDate
          );
          if (isConflict) {
            console.log(
              `Conflict detected for room ${roomNumber} with ${
                reservation._id || 'unknown'
              }`
            );
            hasConflict = true;
          }
        }
      });
    });
    return !hasConflict;
  }, [
    reservation,
    allReservations,
    roomTypes,
    checkInDate,
    checkOutDate,
    diffDays,
    selectedDate,
  ]);

  // 표시용 날짜 포맷팅 개선 (KST 유지)
  const stayLabel = useMemo(() => {
    if (diffDays === 0) return '(대실)';
    else if (diffDays === 1 && reservation.customerName.includes('대실'))
      return '(대실)';
    else if (diffDays === 1) return '(1박)';
    else if (diffDays >= 2) return `(${diffDays}박)`;
    return '';
  }, [diffDays, reservation.customerName]);

  const displayCheckIn = useMemo(() => {
    if (!reservation.checkIn || reservation.checkIn === '') return '미정';
    if (!checkInDate) return '정보 없음';
    const [datePart, timePart] = reservation.checkIn.split('T');
    const time = timePart ? timePart.split('+')[0].substring(0, 5) : '00:00';
    if (time === '00:00' && reservation.type === 'dayUse')
      return `${datePart} (입실 대기)`;
    if (reservation.siteName === '현장예약' && reservation.type !== 'dayUse') {
      return `${datePart} ${checkInTime}`;
    }
    return `${datePart} ${time}`;
  }, [
    checkInDate,
    checkInTime,
    reservation.siteName,
    reservation.type,
    reservation.checkIn,
  ]);

  const displayCheckOut = useMemo(() => {
    if (!reservation.checkOut || reservation.checkOut === '') return '미정';
    if (!checkOutDate) return '정보 없음';
    const [datePart, timePart] = reservation.checkOut.split('T');
    const time = timePart ? timePart.split('+')[0].substring(0, 5) : '00:00';
    if (time === '00:00' && reservation.type === 'dayUse')
      return `${datePart} (입실 대기)`;
    if (reservation.siteName === '현장예약' && reservation.type !== 'dayUse') {
      return `${datePart} ${checkOutTime}`;
    }
    return `${datePart} ${time}`;
  }, [
    checkOutDate,
    checkOutTime,
    reservation.siteName,
    reservation.type,
    reservation.checkOut,
  ]);

  // 예약일 날짜만 표시
  const displayReservationDate = useMemo(() => {
    if (!reservation.reservationDate) return '정보 없음';
    const dateMatch = reservation.reservationDate.match(/^\d{4}-\d{2}-\d{2}/);
    return dateMatch ? dateMatch[0] : '정보 없음';
  }, [reservation.reservationDate]);

  // 대실 전용 버튼 핸들러
  const handleCheckIn = useCallback(() => {
    const now = new Date();
    const checkInStr = format(now, "yyyy-MM-dd'T'HH:mm:ss+09:00");
    const durationHours =
      reservation.duration || reservation.durationHours || 3;
    const checkOutStr = format(
      addHours(now, durationHours),
      "yyyy-MM-dd'T'HH:mm:ss+09:00"
    );
    const updatedData = {
      ...reservation,
      checkIn: checkInStr,
      checkOut: checkOutStr,
      checkInTime: format(now, 'HH:mm'),
      checkOutTime: format(new Date(checkOutStr), 'HH:mm'),
      paymentMethod: 'Cash', // 대실 기본 결제 방법
    };
    console.log(
      `[handleCheckIn] Updating reservation ${reservation._id}`,
      updatedData
    );
    onPartialUpdate(reservation._id, updatedData);
  }, [reservation, onPartialUpdate]);

  const handleCheckOut = useCallback(() => {
    const now = new Date();
    const updatedData = {
      ...reservation,
      checkOut: format(now, "yyyy-MM-dd'T'HH:mm:ss+09:00"),
      checkOutTime: format(now, 'HH:mm'),
      isCheckedOut: true, // 점유 제외를 위한 플래그 추가
    };
    console.log(
      `[handleCheckOut] Updating reservation ${reservation._id}`,
      updatedData
    );
    onPartialUpdate(reservation._id, updatedData);
  }, [reservation, onPartialUpdate]);

  const handleDelete = useCallback(() => {
    if (window.confirm('대실 예약을 삭제하시겠습니까?')) {
      console.log(`[handleDelete] Deleting reservation ${reservation._id}`);
      handleDeleteClickHandler(reservation._id, reservation.siteName);
    }
  }, [reservation._id, reservation.siteName, handleDeleteClickHandler]);

  const handleEditStart = useCallback(
    (reservationId) => {
      const today = startOfDay(new Date());
      const checkoutDay = checkOutDate ? startOfDay(checkOutDate) : null;
      if (checkoutDay && today > checkoutDay) {
        console.warn(
          `Reservation ${
            reservation._id || 'unknown'
          } has already checked out. Editing is not allowed.`
        );
        return;
      }
      if (isOpen || isEditingMemo) return;
      setIsOpen(true);
  
      const defaultCheckOut = checkOutDate
        ? reservation.checkOut
        : format(addHours(new Date(), 3), "yyyy-MM-dd'T'HH:mm:ss+09:00");
  
      let initialPrice = String(
        reservation.price || reservation.totalPrice || 0
      );
      if (reservation.type === 'dayUse') {
        const roomType = roomTypes.find((rt) => rt.roomInfo === reservation.roomInfo);
        const basePricePerHour = (roomType?.price || 0) / 2;
        const durationHours = reservation.duration || reservation.durationHours || 3;
        initialPrice = String(basePricePerHour * durationHours);
      }
  
      const initialData = {
        ...reservation,
        _id: reservation._id,
        checkIn: reservation.checkIn,
        checkOut: defaultCheckOut,
        checkInDate: checkInDate ? format(checkInDate, 'yyyy-MM-dd') : '',
        checkInTime: checkInDate ? format(checkInDate, 'HH:mm') : '00:00',
        checkOutDate: checkOutDate
          ? format(checkOutDate, 'yyyy-MM-dd')
          : format(addHours(new Date(), 3), 'yyyy-MM-dd'),
        checkOutTime: checkOutDate
          ? format(checkOutDate, 'HH:mm')
          : format(addHours(new Date(), 3), 'HH:mm'),
        duration: reservation.duration || reservation.durationHours || 3,
        durationHours: reservation.duration || reservation.durationHours || 3,
        type: reservation.type || 'stay',
        reservationNo: reservation.reservationNo || reservation._id,
        customerName: reservation.customerName || '',
        phoneNumber: reservation.phoneNumber || '',
        reservationDate:
          reservation.reservationDate || format(new Date(), 'yyyy-MM-dd HH:mm'),
        roomInfo: reservation.roomInfo || 'Standard',
        price: initialPrice,
        paymentMethod:
          reservation.paymentMethod ||
          (reservation.type === 'dayUse' ? 'Cash' : 'Card'),
        specialRequests: reservation.specialRequests || '',
        roomNumber: reservation.roomNumber || '',
        isCheckedOut: reservation.isCheckedOut || false,
      };
      if (typeof onEdit === 'function') {
        console.log(
          `[DraggableReservationCard.js] Calling onEdit with reservationId: ${reservationId}, initialData:`,
          initialData
        );
        onEdit(reservationId, initialData);
      } else {
        console.error(
          `[DraggableReservationCard.js] onEdit is not a function. Received: ${typeof onEdit}, value:`,
          onEdit
        );
      }
    },
    [checkOutDate, reservation, onEdit, checkInDate, isEditingMemo, isOpen, roomTypes]
  );

  useEffect(() => {
    if (
      !Array.isArray(roomTypes) ||
      !Array.isArray(allReservations) ||
      roomTypes.length === 0
    ) {
      setConflictDetails(null);
      return;
    }
    const validReservations = allReservations.filter(
      (res) =>
        res &&
        res.checkIn &&
        res.checkOut &&
        typeof res.checkIn === 'string' &&
        typeof res.checkOut === 'string' &&
        !isNaN(new Date(res.checkIn).getTime()) &&
        !isNaN(new Date(res.checkOut).getTime())
    );
    if (validReservations.length !== allReservations.length) {
      console.warn('Invalid reservations detected in allReservations:', {
        invalidCount: allReservations.length - validReservations.length,
        sampleInvalid: allReservations
          .filter(
            (res) =>
              !res ||
              !res.checkIn ||
              !res.checkOut ||
              typeof res.checkIn !== 'string' ||
              typeof res.checkOut !== 'string' ||
              isNaN(new Date(res.checkIn).getTime()) ||
              isNaN(new Date(res.checkOut).getTime())
          )
          .slice(0, 5),
      });
    }

    let conflictInfo = null;
    roomTypes.forEach((roomType) => {
      const roomNumbers = roomType.roomNumbers || [];
      roomNumbers.forEach((roomNumber) => {
        if (checkInDate && checkOutDate) {
          const { isConflict, conflictingReservation } = checkConflict(
            { ...reservation, checkIn: checkInDate, checkOut: checkOutDate },
            roomNumber,
            validReservations,
            selectedDate
          );
          if (isConflict && !conflictInfo && conflictingReservation) {
            const conflictCheckIn = conflictingReservation?.checkIn
              ? format(
                  new Date(conflictingReservation.checkIn),
                  'yyyy-MM-dd HH:mm'
                )
              : '정보 없음';
            const conflictCheckOut = conflictingReservation?.checkOut
              ? format(
                  new Date(conflictingReservation.checkOut),
                  'yyyy-MM-dd HH:mm'
                )
              : '정보 없음';
            conflictInfo = `객실 ${roomNumber} (${
              roomType.roomInfo
            })에서 예약 기간이 겹칩니다.\n충돌 예약자: ${
              conflictingReservation?.customerName || '정보 없음'
            }\n예약 기간: ${conflictCheckIn} ~ ${conflictCheckOut}`;
          }
        }
      });
    });
    setConflictDetails(conflictInfo);
  }, [
    reservation,
    allReservations,
    roomTypes,
    checkInDate,
    checkOutDate,
    selectedDate,
  ]);

  const [{ isDragging }, dragRef] = useDrag({
    type: 'RESERVATION',
    item: {
      reservationId: reservation._id,
      reservation: {
        ...reservation,
        checkIn: checkInDate,
        checkOut: checkOutDate,
      },
      originalRoomNumber: reservation.roomNumber,
      originalRoomInfo: reservation.roomInfo,
    },
    canDrag:
      !flippedReservationIds.has(reservation._id) &&
      !isEditingMemo &&
      canDragMemo,
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });

  const toggleMemoEdit = (reservationId, newState) => {
    if (typeof newState === 'boolean') {
      setIsEditingMemo(newState);
    } else {
      setIsEditingMemo((prev) => !prev);
    }
  };

  const isFlipped = flippedReservationIds.has(reservation._id);
  const isHighlighted =
    highlightedReservationIds.includes(reservation._id) && isSearching;
  const isNewlyCreated =
    reservation._id === newlyCreatedId && isNewlyCreatedHighlighted;
  const isUpdated =
    reservation._id === updatedReservationId && isUpdatedHighlighted;
  const isCancelled =
    reservation._id.includes('Canceled') ||
    (reservation.reservationStatus || '').toLowerCase() === 'cancelled';

  const truncatedReservationNo = reservation.reservationNo
    ? reservation.reservationNo.length > 20
      ? `${reservation.reservationNo.substring(0, 20)}...`
      : reservation.reservationNo
    : '정보 없음';

  const cardClassNames = [
    'room-card',
    getBorderColor(reservation),
    isCancelled ? 'cancelled' : '',
    isUnassigned ? 'unassigned-card' : '',
    isHighlighted ? 'highlighted' : '',
    isNewlyCreated || isUpdated ? 'onsite-created' : '',
    !canDragMemo ? 'draggable-false' : '',
    reservation.isCheckedOut ? 'checked-out' : '',
    isOpen ? 'editing' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const handleMemoChange = (reservationId, value) => {
    console.log(`Memo changed for ${reservationId}: ${value}`);
  };

  const handleMemoSave = (reservationId) => {
    toggleMemoEdit(reservationId, false);
    console.log(`Memo saved for ${reservationId}`);
    if (isFlipped) {
      setTimeout(() => handleCardFlip(reservation._id), 100);
    }
  };

  const handleMemoCancel = (reservationId) => {
    toggleMemoEdit(reservationId, false);
    console.log(`Memo cancelled for ${reservationId}`);
    if (isFlipped) {
      handleCardFlip(reservation._id);
    }
  };

  const handleCardClick = (e) => {
    if (e.target.closest('.memo-component')) return;
    if (isUnassigned) return;
    if (isDragging || isEditingMemo) return;
    handleCardFlip(reservation._id);
  };

  const displayPrice = useMemo(() => {
    return getPriceForDisplay(reservation);
  }, [reservation]);

  const paymentMethodInfo = useMemo(() => {
    const defaultMethod = reservation.type === 'dayUse' ? 'Cash' : 'Card';
    return getPaymentMethodIcon(reservation.paymentMethod || defaultMethod);
  }, [reservation.type, reservation.paymentMethod]);

  // 대실 전용 버튼 렌더링 함수 (메모이제이션 적용)
  const renderDayUseButtons = useMemo(() => {
    console.log(
      `[renderDayUseButtons] checkIn: ${reservation.checkIn}, isCheckedOut: ${reservation.isCheckedOut}`
    );
    return (
      <span className="button-group-wrapper">
        {reservation.type === 'dayUse' && !reservation.checkIn?.trim() && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleCheckIn();
            }}
            className="action-btn checkin-btn"
          >
            입실
          </button>
        )}
        {reservation.checkIn?.trim() && !reservation.isCheckedOut && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleCheckOut();
            }}
            className="action-btn checkout-btn"
          >
            퇴실
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleEditStart(reservation._id);
          }}
          className="action-btn edit-btn"
        >
          수정
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDelete();
          }}
          className="action-btn delete-btn"
        >
          삭제
        </button>
      </span>
    );
  }, [
    reservation.type,
    reservation.checkIn,
    reservation.isCheckedOut,
    reservation._id,
    handleCheckIn,
    handleCheckOut,
    handleDelete,
    handleEditStart,
  ]);

  return (
    <div
      ref={dragRef}
      className={cardClassNames}
      data-id={reservation._id}
      title={
        canDragMemo
          ? ''
          : conflictDetails ||
            '해당 기간에 이미 예약이 있어 이동할 수 없습니다.'
      }
      style={{
        cursor: isEditingMemo || !canDragMemo ? 'default' : 'pointer',
        transition: 'opacity 0.2s ease-in-out, transform 0.3s ease-in-out',
        opacity: isDragging ? 0.5 : 1,
        transform: 'scale(1)',
        zIndex: 'auto',
        position: 'static',
        backgroundColor: isUnassigned ? '#f0f0f0' : undefined,
      }}
      onClick={handleCardClick}
    >
      <div
        className={`flip-container ${isFlipped ? 'flipped' : ''}`}
        style={{
          cursor: isEditingMemo ? 'default' : 'pointer',
          perspective: '1000px',
        }}
      >
        <div className="room-card-inner" style={{ backgroundColor: '#f0f0f0' }}>
          <div
            className="room-card-front"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <div className="content-footer-wrapper">
              <div className="card-content">
                <div className="card-header">
                  <h3 className="no-break">
                    <span className="stay-label">{stayLabel}</span>
                    {/* 대실 전용 버튼 보장 */}
                    {reservation.type === 'dayUse' && renderDayUseButtons}
                    {reservation.type !== 'dayUse' && (
                      <span className="button-group-wrapper">
                        {reservation.reservationStatus !== 'Confirmed' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleConfirmClickHandler(reservation._id);
                            }}
                            className="action-btn confirm-btn"
                            data-tooltip="확정"
                          >
                            확정
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditStart(reservation._id);
                          }}
                          className="action-btn edit-btn"
                          data-tooltip="수정"
                        >
                          수정
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClickHandler(
                              reservation._id,
                              reservation.siteName
                            );
                          }}
                          className="action-btn delete-btn"
                          data-tooltip="삭제"
                        >
                          삭제
                        </button>
                      </span>
                    )}
                  </h3>
                </div>
                <p className="reservation-no">{truncatedReservationNo}</p>
                <p>
                  예약자: {reservation.customerName || '정보 없음'}{' '}
                  {reservation.type === 'dayUse' && (
                    <CountdownTimer
                      checkOutDate={checkOutDate}
                      reservationId={reservation._id}
                      newlyCreatedId={newlyCreatedId}
                    />
                  )}
                </p>
                <p>체크인: {displayCheckIn}</p>
                <p>체크아웃: {displayCheckOut}</p>
                <p>가격: {displayPrice}</p>
                <p>
                  객실 정보:{' '}
                  {reservation.roomInfo && reservation.roomInfo.length > 30
                    ? `${reservation.roomInfo.substring(0, 21)}...`
                    : reservation.roomInfo || '정보 없음'}
                </p>
                <p>예약일: {displayReservationDate}</p>
                {reservation.phoneNumber && (
                  <p>전화번호: {reservation.phoneNumber}</p>
                )}
                <p className="payment-method">
                  결제방법:{' '}
                  {paymentMethodInfo.icon && (
                    <>
                      {paymentMethodInfo.icon} {paymentMethodInfo.text}
                    </>
                  )}
                </p>
                <p>고객요청: {reservation.specialRequests || '없음'}</p>
              </div>
              <div className="site-info-footer">
                <div className="site-info-wrapper">
                  <p className="site-info">
                    사이트:{' '}
                    <span
                      className={
                        reservation.siteName === '현장예약'
                          ? 'onsite-reservation'
                          : ''
                      }
                    >
                      {reservation.siteName || '정보 없음'}
                    </span>
                  </p>
                  <button
                    type="button"
                    className="invoice-icon-button-back"
                    onClick={(e) => {
                      e.stopPropagation();
                      openInvoiceModal({
                        ...reservation,
                        reservationNo:
                          reservation.reservationNo || reservation._id || '',
                        hotelSettings,
                        hotelAddress:
                          hotelAddress ||
                          hotelSettings?.hotelAddress ||
                          '주소 정보 없음',
                        phoneNumber:
                          phoneNumber ||
                          hotelSettings?.phoneNumber ||
                          '전화번호 정보 없음',
                        email:
                          email || hotelSettings?.email || '이메일 정보 없음',
                      });
                    }}
                    title="인보이스 보기"
                  >
                    <FaFileInvoice size={20} />
                  </button>
                </div>
              </div>
            </div>
          </div>
          {isFlipped && (
            <div
              className="room-card-back"
              style={{ backfaceVisibility: 'hidden' }}
              onClick={(e) => {
                e.stopPropagation();
                handleCardClick(e);
              }}
            >
              <MemoComponent
                reservationId={reservation._id}
                reservationName={reservation.customerName || '예약자 없음'}
                isEditingMemo={isEditingMemo}
                memoRefs={memoRefs}
                onMemoChange={handleMemoChange}
                onMemoSave={handleMemoSave}
                onMemoCancel={handleMemoCancel}
                onToggleMemoEdit={toggleMemoEdit}
              />
            </div>
          )}
        </div>
      </div>
      {loadedReservations.includes(reservation._id) && (
        <div className="fade-in-overlay"></div>
      )}
    </div>
  );
};

DraggableReservationCard.propTypes = {
  isUnassigned: PropTypes.bool,
  highlightedReservationIds: PropTypes.array.isRequired,
  isSearching: PropTypes.bool,
  flippedReservationIds: PropTypes.instanceOf(Set).isRequired,
  memoRefs: PropTypes.object.isRequired,
  handleCardFlip: PropTypes.func.isRequired,
  openInvoiceModal: PropTypes.func.isRequired,
  hotelSettings: PropTypes.object,
  hotelAddress: PropTypes.string,
  phoneNumber: PropTypes.string,
  email: PropTypes.string,
  handleDeleteClickHandler: PropTypes.func.isRequired,
  handleConfirmClickHandler: PropTypes.func.isRequired,
  loadedReservations: PropTypes.array,
  newlyCreatedId: PropTypes.string,
  isNewlyCreatedHighlighted: PropTypes.bool,
  updatedReservationId: PropTypes.string,
  isUpdatedHighlighted: PropTypes.bool,
  onPartialUpdate: PropTypes.func.isRequired,
  onEdit: PropTypes.func.isRequired,
  roomTypes: PropTypes.array.isRequired,
  allReservations: PropTypes.array,
  selectedDate: PropTypes.instanceOf(Date),
  reservation: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    checkIn: PropTypes.string.isRequired,
    checkOut: PropTypes.string.isRequired,
    customerName: PropTypes.string,
    roomInfo: PropTypes.string,
    reservationNo: PropTypes.string,
    type: PropTypes.string,
    duration: PropTypes.number,
    durationHours: PropTypes.number,
    isCheckedOut: PropTypes.bool,
  }).isRequired,
};

export default DraggableReservationCard;