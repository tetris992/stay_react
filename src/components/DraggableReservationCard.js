import React, { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useDrag } from 'react-dnd';
import { differenceInSeconds, format, addHours, startOfDay } from 'date-fns';
import { FaFileInvoice } from 'react-icons/fa';
import MemoComponent from './MemoComponent';
import { checkConflict } from '../utils/checkConflict';
import { getBorderColor, getInitialFormData } from '../utils/roomGridUtils';
import { getPriceForDisplay } from '../utils/getPriceForDisplay';
import { renderActionButtons } from '../utils/renderActionButtons';
import './DraggableReservationCard.css';

const DraggableReservationCard = ({
  isUnassigned = false,
  reservation,
  hotelId,
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
  renderActionButtons: customRenderActionButtons,
  loadedReservations,
  newlyCreatedId,
  isNewlyCreatedHighlighted,
  updatedReservationId,
  isUpdatedHighlighted,
  onPartialUpdate,
  roomTypes,
  allReservations = [],
  selectedDate,
}) => {
  const [isEditingCard, setIsEditingCard] = useState(false);
  const [editedValues, setEditedValues] = useState({});
  const [isOpen, setIsOpen] = useState(false);
  const [isEditingMemo, setIsEditingMemo] = useState(false);
  const [remainingTime, setRemainingTime] = useState('');
  const [conflictDetails, setConflictDetails] = useState(null);

  // 호텔 설정에서 고정 시간 가져오기 (기본값 설정)
  const checkInTime = hotelSettings?.checkInTime || '16:00';
  const checkOutTime = hotelSettings?.checkOutTime || '11:00';

  // 날짜 파싱 개선
  const checkInDate = useMemo(() => {
    if (!reservation.checkIn) {
      console.warn(`No checkIn for reservation ${reservation._id}`);
      return null;
    }
    const date = new Date(reservation.checkIn);
    if (isNaN(date.getTime())) {
      console.warn(
        `Invalid checkIn for reservation ${reservation._id}:`,
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
    if (!reservation.checkOut) {
      console.warn(`No checkOut for reservation ${reservation._id}`);
      return null;
    }
    const date = new Date(reservation.checkOut);
    if (isNaN(date.getTime())) {
      console.warn(
        `Invalid checkOut for reservation ${reservation._id}:`,
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

  // DraggableReservationCard.js 내 canDragMemo 훅
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
      console.warn(`Invalid dates for reservation ${reservation._id}:`, {
        checkIn: reservation.checkIn,
        checkOut: reservation.checkOut,
      });
      return false;
    }

    const currentDate = startOfDay(new Date());
    const checkInDateOnly = startOfDay(checkInDate);
    const selectedDateOnly = startOfDay(selectedDate);

    // 선택된 날짜가 체크인 날짜보다 이후이고 연박 예약이면 드래그 불가
    if (checkInDateOnly < selectedDateOnly && diffDays > 0) {
      console.log(
        `Cannot drag reservation ${
          reservation._id
        }: Past check-in detected (Check-in: ${format(
          checkInDate,
          'yyyy-MM-dd'
        )}, Selected Date: ${format(
          selectedDateOnly,
          'yyyy-MM-dd'
        )}, Current Date: ${format(currentDate, 'yyyy-MM-dd')})`
      );
      return false;
    }

    let hasConflict = false;

    if (isUnassigned) {
      roomTypes.forEach((roomType) => {
        const roomNumbers = roomType.roomNumbers || [];
        roomNumbers.forEach((roomNumber) => {
          const { isConflict } = checkConflict(
            { ...reservation, checkIn: checkInDate, checkOut: checkOutDate },
            roomNumber,
            allReservations,
            selectedDate
          );
          if (isConflict) {
            console.log(
              `Conflict detected for unassigned room ${roomNumber} with ${reservation._id}`
            );
            hasConflict = true;
          }
        });
      });
    } else {
      roomTypes.forEach((roomType) => {
        if (roomType.roomInfo === reservation.roomInfo) return;
        const roomNumbers = roomType.roomNumbers || [];
        roomNumbers.forEach((roomNumber) => {
          const { isConflict } = checkConflict(
            { ...reservation, checkIn: checkInDate, checkOut: checkOutDate },
            roomNumber,
            allReservations,
            selectedDate
          );
          if (isConflict) {
            console.log(
              `Conflict detected for room ${roomNumber} with ${reservation._id}`
            );
            hasConflict = true;
          }
        });
      });
    }

    return !hasConflict;
  }, [
    reservation,
    allReservations,
    roomTypes,
    isUnassigned,
    checkInDate,
    checkOutDate,
    diffDays,
    selectedDate,
  ]);

  // 표시용 날짜 포맷팅 개선 (KST 유지)
  const displayCheckIn = useMemo(() => {
    if (!checkInDate) return '정보 없음';
    const [datePart, timePart] = reservation.checkIn.split('T');
    const time = timePart.split('+')[0].substring(0, 5); // "HH:mm" 추출
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
    if (!checkOutDate) return '정보 없음';
    const [datePart, timePart] = reservation.checkOut.split('T');
    const time = timePart.split('+')[0].substring(0, 5); // "HH:mm" 추출
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
    // "YYYY-MM-DD" 형식으로 날짜만 추출
    const dateMatch = reservation.reservationDate.match(/^\d{4}-\d{2}-\d{2}/);
    return dateMatch ? dateMatch[0] : '정보 없음';
  }, [reservation.reservationDate]);

  useEffect(() => {
    if (
      !Array.isArray(roomTypes) ||
      !Array.isArray(allReservations) ||
      roomTypes.length === 0
    ) {
      setConflictDetails(null);
      return;
    }

    let conflictInfo = null;

    if (isUnassigned) {
      roomTypes.forEach((roomType) => {
        const roomNumbers = roomType.roomNumbers || [];
        roomNumbers.forEach((roomNumber) => {
          const { isConflict, conflictingReservation } = checkConflict(
            { ...reservation, checkIn: checkInDate, checkOut: checkOutDate },
            roomNumber,
            allReservations,
            selectedDate
          );
          if (isConflict && !conflictInfo) {
            const conflictCheckIn = conflictingReservation.checkIn
              ? format(
                  new Date(conflictingReservation.checkIn),
                  'yyyy-MM-dd HH:mm'
                )
              : '정보 없음';
            const conflictCheckOut = conflictingReservation.checkOut
              ? format(
                  new Date(conflictingReservation.checkOut),
                  'yyyy-MM-dd HH:mm'
                )
              : '정보 없음';
            conflictInfo = `객실 ${roomNumber} (${
              roomType.roomInfo
            })에서 예약 기간이 겹칩니다.\n충돌 예약자: ${
              conflictingReservation.customerName || '정보 없음'
            }\n예약 기간: ${conflictCheckIn} ~ ${conflictCheckOut}`;
          }
        });
      });
    } else {
      roomTypes.forEach((roomType) => {
        if (roomType.roomInfo === reservation.roomInfo) return;
        const roomNumbers = roomType.roomNumbers || [];
        roomNumbers.forEach((roomNumber) => {
          const { isConflict, conflictingReservation } = checkConflict(
            { ...reservation, checkIn: checkInDate, checkOut: checkOutDate },
            roomNumber,
            allReservations,
            selectedDate
          );
          if (isConflict && !conflictInfo) {
            const conflictCheckIn = conflictingReservation.checkIn
              ? format(
                  new Date(conflictingReservation.checkIn),
                  'yyyy-MM-dd HH:mm'
                )
              : '정보 없음';
            const conflictCheckOut = conflictingReservation.checkOut
              ? format(
                  new Date(conflictingReservation.checkOut),
                  'yyyy-MM-dd HH:mm'
                )
              : '정보 없음';
            conflictInfo = `객실 ${roomNumber} (${
              roomType.roomInfo
            })에서 예약 기간이 겹칩니다.\n충돌 예약자: ${
              conflictingReservation.customerName || '정보 없음'
            }\n예약 기간: ${conflictCheckIn} ~ ${conflictCheckOut}`;
          }
        });
      });
    }

    setConflictDetails(conflictInfo);
  }, [
    reservation,
    allReservations,
    roomTypes,
    isUnassigned,
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
      !isEditingCard &&
      !isEditingMemo &&
      canDragMemo,
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });

  useEffect(() => {
    if (reservation.type !== 'dayUse') return;

    const calculateRemainingTime = () => {
      if (!checkOutDate) {
        setRemainingTime('계산 불가');
        return;
      }
      const now = new Date();
      const diffInSeconds = differenceInSeconds(checkOutDate, now);

      if (diffInSeconds <= 0) {
        setRemainingTime('만료됨');
        return;
      }

      const hours = Math.floor(diffInSeconds / 3600);
      const minutes = Math.floor((diffInSeconds % 3600) / 60);
      const seconds = diffInSeconds % 60;
      setRemainingTime(`${hours}시간 ${minutes}분 ${seconds}초`);
    };

    if (reservation._id === newlyCreatedId || checkOutDate) {
      calculateRemainingTime();
      const interval = setInterval(calculateRemainingTime, 1000);
      return () => clearInterval(interval);
    }
  }, [reservation.type, newlyCreatedId, reservation._id, checkOutDate]);

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

  const stayLabel = useMemo(() => {
    if (diffDays === 0) return '(대실)';
    else if (diffDays === 1 && reservation.customerName.includes('대실'))
      return '(대실)';
    else if (diffDays === 1) return '(1박)';
    else if (diffDays >= 2) return `(${diffDays}박)`;
    return '';
  }, [diffDays, reservation.customerName]);

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
    isEditingCard ? 'edit-mode' : '',
    !canDragMemo ? 'draggable-false' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const handleEditStart = () => {
    if (isOpen || isEditingMemo) return;
    setIsOpen(true);
    const initialForm = getInitialFormData(reservation, roomTypes);
    setEditedValues({
      ...initialForm,
      price: reservation.price?.toString() || initialForm.price,
      checkInDate: checkInDate
        ? format(checkInDate, 'yyyy-MM-dd')
        : initialForm.checkInDate,
      checkOutDate: checkOutDate
        ? format(checkOutDate, 'yyyy-MM-dd')
        : initialForm.checkOutDate,
      roomNumber: reservation.roomNumber,
    });
    setIsEditingCard(true);
  };

  const handleEditCancel = () => {
    setIsEditingCard(false);
    setEditedValues({});
    setIsOpen(false);
  };

  const handleEditSave = (e) => {
    e.preventDefault();

    const updatedData = {
      customerName: editedValues.customerName,
      phoneNumber: editedValues.phoneNumber,
      paymentMethod: editedValues.paymentMethod,
      specialRequests: editedValues.specialRequests,
      roomInfo: reservation.roomInfo,
      roomNumber: editedValues.roomNumber || reservation.roomNumber,
      price: editedValues.price || reservation.totalPrice,
    };

    if (reservation.siteName === '현장예약') {
      if (reservation.type === 'dayUse') {
        const currentTime = new Date();
        updatedData.checkIn = format(
          currentTime,
          "yyyy-MM-dd'T'HH:mm:ss+09:00"
        );
        const computedCheckOut = addHours(
          currentTime,
          Number(editedValues.durationHours || 4) // 기본 4시간
        );
        updatedData.checkOut = format(
          computedCheckOut,
          "yyyy-MM-dd'T'HH:mm:ss+09:00"
        );
      } else {
        updatedData.checkIn = `${editedValues.checkInDate}T${checkInTime}:00+09:00`;
        updatedData.checkOut = `${editedValues.checkOutDate}T${checkOutTime}:00+09:00`;
      }
    } else {
      const originalCheckInTime = checkInDate
        ? format(checkInDate, 'HH:mm')
        : '00:00';
      const originalCheckOutTime = checkOutDate
        ? format(checkOutDate, 'HH:mm')
        : '00:00';
      updatedData.checkIn = `${editedValues.checkInDate}T${originalCheckInTime}:00+09:00`;
      updatedData.checkOut = `${editedValues.checkOutDate}T${originalCheckOutTime}:00+09:00`;
    }

    onPartialUpdate(reservation._id, updatedData);
    setIsEditingCard(false);
    setEditedValues({});
    setIsOpen(false);
  };

  const handleFieldChange = (field, value) => {
    setEditedValues((prev) => {
      const updated = { ...prev, [field]: value };
      const fieldsAffectingPrice = ['checkInDate', 'checkOutDate'];

      if (
        fieldsAffectingPrice.includes(field) &&
        reservation.siteName === '현장예약'
      ) {
        const ci = new Date(`${updated.checkInDate}T${checkInTime}:00+09:00`);
        const co = new Date(`${updated.checkOutDate}T${checkOutTime}:00+09:00`);
        const nights = Math.max(
          1,
          Math.ceil((co - ci) / (1000 * 60 * 60 * 24))
        );
        const selectedRoom = roomTypes.find(
          (r) => r.roomInfo === reservation.roomInfo
        );

        if (selectedRoom && !updated.manualPriceOverride) {
          const newPrice = selectedRoom.price * nights;
          return {
            ...updated,
            price: newPrice.toString(),
            manualPriceOverride: false,
          };
        }
      }
      return updated;
    });
  };

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
    if (isDragging || isEditingCard || isEditingMemo) return;
    handleCardFlip(reservation._id);
  };

  const displayPrice = useMemo(() => {
    if (isEditingCard && editedValues.price !== undefined) {
      return editedValues.price;
    }
    return getPriceForDisplay(reservation);
  }, [isEditingCard, editedValues.price, reservation]);

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
        cursor:
          isEditingCard || isEditingMemo || !canDragMemo
            ? 'default'
            : 'pointer',
        transition: 'opacity 0.2s ease-in-out, transform 0.3s ease-in-out',
        opacity: isDragging ? 0.5 : 1,
        transform: isEditingCard ? 'scale(1.2)' : 'scale(1)',
        zIndex: isEditingCard ? 1000 : 'auto',
        position: isEditingCard ? 'relative' : 'static',
        backgroundColor: isUnassigned ? '#f0f0f0' : undefined,
      }}
      onClick={handleCardClick}
    >
      <div
        className={`flip-container ${isFlipped ? 'flipped' : ''}`}
        style={{
          cursor: isEditingCard || isEditingMemo ? 'default' : 'pointer',
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
                    <span className="button-group-wrapper">
                      {renderActionButtons({
                        reservation,
                        handleDeleteClickHandler,
                        handleConfirmClickHandler,
                        handleEditStart,
                      })}
                    </span>
                  </h3>
                </div>
                <p className="reservation-no">{truncatedReservationNo}</p>
                <p>예약자: {reservation.customerName || '정보 없음'}</p>
                <p>체크인: {displayCheckIn}</p>
                <p>체크아웃: {displayCheckOut}</p>
                {reservation.type === 'dayUse' && (
                  <p className="countdown">
                    남은 시간:{' '}
                    <span
                      className={remainingTime === '만료됨' ? 'expired' : ''}
                    >
                      {remainingTime || '계산 중...'}
                    </span>
                  </p>
                )}
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
      {isEditingCard && (
        <div className="edit-card-content">
          <form onSubmit={handleEditSave}>
            <div className="edit-card-header">
              <h2>예약 수정</h2>
              <button
                type="button"
                className="close-button"
                onClick={handleEditCancel}
              >
                닫기
              </button>
            </div>
            <div className="edit-card-row">
              <label>
                예약자:
                <input
                  type="text"
                  value={editedValues.customerName}
                  onChange={(e) =>
                    handleFieldChange('customerName', e.target.value)
                  }
                  required
                />
              </label>
              <label>
                전화번호:
                <input
                  type="text"
                  value={editedValues.phoneNumber}
                  onChange={(e) =>
                    handleFieldChange('phoneNumber', e.target.value)
                  }
                />
              </label>
            </div>
            <div className="edit-card-row">
              <label>
                체크인 날짜:
                <input
                  type="date"
                  value={editedValues.checkInDate}
                  onChange={(e) =>
                    handleFieldChange('checkInDate', e.target.value)
                  }
                />
              </label>
              <label>
                체크아웃 날짜:
                <input
                  type="date"
                  value={editedValues.checkOutDate}
                  onChange={(e) =>
                    handleFieldChange('checkOutDate', e.target.value)
                  }
                />
              </label>
            </div>
            <div className="edit-card-row">
              <label>
                객실타입:
                <input
                  type="text"
                  value={reservation.roomInfo}
                  readOnly
                  disabled
                />
              </label>
              <label>
                가격 (KRW):
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={editedValues.price}
                  onChange={(e) => handleFieldChange('price', e.target.value)}
                />
              </label>
            </div>
            <div className="edit-card-row">
              <label>
                결제방법/상태:
                <select
                  value={editedValues.paymentMethod || 'Pending'}
                  onChange={(e) =>
                    handleFieldChange('paymentMethod', e.target.value)
                  }
                >
                  <option value="Pending">Pending</option>
                  <option value="Card">Card</option>
                  <option value="Cash">Cash</option>
                  <option value="Account Transfer">Account Transfer</option>
                </select>
              </label>
              <label>
                고객요청:
                <input
                  type="text"
                  value={editedValues.specialRequests}
                  onChange={(e) =>
                    handleFieldChange('specialRequests', e.target.value)
                  }
                />
              </label>
            </div>
            <div className="edit-card-actions">
              <button type="submit" className="save-button">
                저장
              </button>
              <button
                type="button"
                className="cancel-button"
                onClick={handleEditCancel}
              >
                취소
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

DraggableReservationCard.propTypes = {
  isUnassigned: PropTypes.bool,
  reservation: PropTypes.object.isRequired,
  hotelId: PropTypes.string.isRequired,
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
  renderActionButtons: PropTypes.func.isRequired,
  loadedReservations: PropTypes.array,
  newlyCreatedId: PropTypes.string,
  isNewlyCreatedHighlighted: PropTypes.bool,
  updatedReservationId: PropTypes.string,
  isUpdatedHighlighted: PropTypes.bool,
  onPartialUpdate: PropTypes.func.isRequired,
  roomTypes: PropTypes.array.isRequired,
  allReservations: PropTypes.array,
  selectedDate: PropTypes.instanceOf(Date),
};

export default DraggableReservationCard;
