import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import PropTypes from 'prop-types';
import { useDrag } from 'react-dnd';
import {
  differenceInSeconds,
  format,
  addHours,
  startOfDay,
  differenceInCalendarDays,
} from 'date-fns';
import { FaFileInvoice } from 'react-icons/fa';
import MemoComponent from './MemoComponent';
import { checkConflict } from '../utils/checkConflict';
import { getBorderColor } from '../utils/roomGridUtils';
import { getPriceForDisplay } from '../utils/getPriceForDisplay';
import './DraggableReservationCard.css';
import { getPaymentMethodIcon } from '../utils/roomGridUtils';
import availableOTAs from '../config/availableOTAs';

// CountdownTimer 컴포넌트 (변경 없음)
const CountdownTimer = React.memo(
  ({ checkOutDate, reservationId, newlyCreatedId, isCheckedIn, duration }) => {
    const [remainingMinutes, setRemainingMinutes] = useState(null);
    const [isExpired, setIsExpired] = useState(false);
    const timerRef = useRef(null);

    useEffect(() => {
      const calculateRemainingMinutes = () => {
        if (!checkOutDate || !isCheckedIn) {
          setRemainingMinutes(null);
          setIsExpired(false);
          return;
        }
        const now = new Date();
        const diffInSeconds = differenceInSeconds(checkOutDate, now);
        const minutes = Math.floor(diffInSeconds / 60);
        setRemainingMinutes(minutes);
        setIsExpired(minutes <= 0);
      };

      if (isCheckedIn && checkOutDate) {
        calculateRemainingMinutes();
        timerRef.current = setInterval(calculateRemainingMinutes, 60000);
      } else if (!isCheckedIn && duration) {
        setRemainingMinutes(duration * 60);
        setIsExpired(false);
      }

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };
    }, [checkOutDate, reservationId, newlyCreatedId, isCheckedIn, duration]);

    const remainingTime = useMemo(() => {
      if (!isCheckedIn && !duration) return '00:00';
      if (!isCheckedIn && duration) return `${Math.floor(duration)}시간`;
      if (remainingMinutes === null) return '계산 불가';
      if (remainingMinutes <= 0) {
        const overdueMinutes = Math.abs(remainingMinutes);
        const hours = Math.floor(overdueMinutes / 60);
        const minutes = overdueMinutes % 60;
        return `-${hours}시간 ${minutes}분`;
      }
      const hours = Math.floor(remainingMinutes / 60);
      const minutes = remainingMinutes % 60;
      return `${hours}시간 ${minutes}분`;
    }, [remainingMinutes, isCheckedIn, duration]);

    return (
      <span className={`countdown ${isExpired ? 'expired' : ''}`}>
        ({remainingTime})
      </span>
    );
  }
);

CountdownTimer.propTypes = {
  checkOutDate: PropTypes.instanceOf(Date),
  reservationId: PropTypes.string,
  newlyCreatedId: PropTypes.string,
  isCheckedIn: PropTypes.bool.isRequired,
  duration: PropTypes.number,
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
  newlyCreatedId,
  isNewlyCreatedHighlighted, //이부분이 비활성화된 것도 연관있는지 확인해야함. 
  updatedReservationId,
  isUpdatedHighlighted,
  onPartialUpdate,
  onEdit,
  roomTypes,
  allReservations = [],
  selectedDate,
  filterReservationsByDate,
  setAllReservations,
}) => {
  const [isEditingMemo, setIsEditingMemo] = useState(false);
  const [conflictDetails, setConflictDetails] = useState(null);
  const [pausedHighlight, setPausedHighlight] = useState(false);
  const [keepPulse, setKeepPulse] = useState(false);
  // 하이라이트 중지 상태 추가

useLayoutEffect(() => {
  if (reservation._id === newlyCreatedId) {
    setKeepPulse(true);
    setPausedHighlight(false);
    const timer = setTimeout(() => setKeepPulse(false), 50_000);
    return () => clearTimeout(timer);
  }
}, [reservation._id, newlyCreatedId]);

  // 새로 생성된 카드일 때만 10초간 하이라이트
  // useLayoutEffect(() => {
  //   if (reservation._id === newlyCreatedId) {
  //     setKeepPulse(true);
  //     const timer = setTimeout(() => setKeepPulse(false), 10_000);
  //     return () => clearTimeout(timer);
  //   }
  // }, [reservation._id, newlyCreatedId]);

  const normalizedReservation = useMemo(
    () => ({
      ...reservation,
      isCheckedIn: reservation.isCheckedIn ?? false,
      isCheckedOut: reservation.isCheckedOut ?? false,
      duration: reservation.duration || reservation.durationHours || 3,
      type: reservation.type || 'stay',
    }),
    [reservation]
  );

  const isSoldOut =
    (reservation.customerName || '').replace(/\s/g, '') === '판매보류' ||
    (reservation.customerName || '').replace(/\s/g, '') === '판매중단' ||
    (reservation.customerName || '').replace(/\s/g, '') === '판매중지' ||
    (reservation.customerName || '').replace(/\s/g, '') === '판매금지';

  const shouldPulse = keepPulse && !pausedHighlight;

  const checkInTime = hotelSettings?.checkInTime || '16:00';
  const checkOutTime = hotelSettings?.checkOutTime || '11:00';

  const checkInDate = useMemo(() => {
    if (
      !normalizedReservation.checkIn ||
      typeof normalizedReservation.checkIn !== 'string'
    ) {
      console.warn(
        `No or invalid checkIn for reservation ${
          normalizedReservation._id || 'unknown'
        }`
      );
      return null;
    }
    const date = new Date(normalizedReservation.checkIn);
    if (isNaN(date.getTime())) {
      console.warn(
        `Invalid checkIn date for reservation ${
          normalizedReservation._id || 'unknown'
        }:`,
        normalizedReservation.checkIn
      );
      return null;
    }
    return date;
  }, [normalizedReservation.checkIn, normalizedReservation._id]);

  const checkOutDate = useMemo(() => {
    if (
      !normalizedReservation.checkOut ||
      typeof normalizedReservation.checkOut !== 'string'
    ) {
      console.warn(
        `No or invalid checkOut for reservation ${
          normalizedReservation._id || 'unknown'
        }`
      );
      return null;
    }
    const date = new Date(normalizedReservation.checkOut);
    if (isNaN(date.getTime())) {
      console.warn(
        `Invalid checkOut date for reservation ${
          normalizedReservation._id || 'unknown'
        }:`,
        normalizedReservation.checkOut
      );
      return null;
    }
    return date;
  }, [normalizedReservation.checkOut, normalizedReservation._id]);

  const ciDateOnly = useMemo(
    () =>
      checkInDate
        ? new Date(
            checkInDate.getFullYear(),
            checkInDate.getMonth(),
            checkInDate.getDate()
          )
        : null,
    [checkInDate]
  );
  const coDateOnly = useMemo(
    () =>
      checkOutDate
        ? new Date(
            checkOutDate.getFullYear(),
            checkOutDate.getMonth(),
            checkOutDate.getDate()
          )
        : null,
    [checkOutDate]
  );
  const diffDays = useMemo(
    () =>
      ciDateOnly && coDateOnly
        ? (coDateOnly - ciDateOnly) / (1000 * 60 * 60 * 24)
        : 0,
    [ciDateOnly, coDateOnly]
  );

  const canDragMemo = useMemo(() => {
    if (
      !normalizedReservation.roomNumber ||
      normalizedReservation.roomNumber.trim() === ''
    )
      return true;
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
        `Invalid dates for reservation ${
          normalizedReservation._id || 'unknown'
        }:`,
        {
          checkIn: normalizedReservation.checkIn,
          checkOut: normalizedReservation.checkOut,
        }
      );
      return false;
    }
    const currentDate = startOfDay(new Date());
    const checkOutDay = startOfDay(checkOutDate);
    const checkInDay = startOfDay(checkInDate);
    const selectedDateStart = startOfDay(selectedDate);

    if (currentDate > checkOutDay) {
      console.log(
        `Reservation ${
          normalizedReservation._id || 'unknown'
        } has already checked out.`
      );
      return false;
    }

    const isMultiNight = differenceInCalendarDays(checkOutDay, checkInDay) > 1;
    if (isMultiNight && selectedDateStart > checkInDay) {
      console.log(
        `Reservation ${
          normalizedReservation._id || 'unknown'
        } is a multi-night reservation. Only the first day (${format(
          checkInDay,
          'yyyy-MM-dd'
        )}) can be dragged. Current selected date: ${format(
          selectedDateStart,
          'yyyy-MM-dd'
        )}`
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
    );

    const currentRoomNumber = normalizedReservation.roomNumber;
    if (checkInDate && checkOutDate && currentRoomNumber) {
      const { isConflict } = checkConflict(
        {
          ...normalizedReservation,
          checkIn: checkInDate,
          checkOut: checkOutDate,
        },
        currentRoomNumber,
        validReservations,
        selectedDate
      );
      if (isConflict) {
        console.log(
          `Conflict detected for room ${currentRoomNumber} with ${
            normalizedReservation._id || 'unknown'
          }`
        );
        hasConflict = true;
      }
    }

    return !hasConflict;
  }, [
    normalizedReservation,
    allReservations,
    roomTypes,
    checkInDate,
    checkOutDate,
    selectedDate,
  ]);

  const stayLabel = useMemo(() => {
    if (normalizedReservation.type === 'dayUse') return '(대실)';
    else if (normalizedReservation.type === 'stay' && diffDays === 1)
      return '(1박)';
    else if (normalizedReservation.type === 'stay' && diffDays >= 2)
      return `(${Math.floor(diffDays)}박)`;
    else if (
      normalizedReservation.type === 'dayUse' &&
      normalizedReservation.customerName &&
      normalizedReservation.customerName.includes('대실')
    )
      return '(대실)';
    return '';
  }, [
    diffDays,
    normalizedReservation.type,
    normalizedReservation.customerName,
  ]);

  const displayCheckIn = useMemo(() => {
    if (!normalizedReservation.checkIn || normalizedReservation.checkIn === '')
      return '미정';
    if (!checkInDate) return '정보 없음';
    const [datePart, timePart] = normalizedReservation.checkIn.split('T');
    const time = timePart ? timePart.split('+')[0].substring(0, 5) : '00:00';
    if (time === '00:00' && normalizedReservation.type === 'dayUse')
      return `${datePart} (입실 대기)`;
    if (
      normalizedReservation.siteName === '현장예약' &&
      normalizedReservation.type !== 'dayUse'
    )
      return `${datePart} ${checkInTime}`;
    return `${datePart} ${time}`;
  }, [
    checkInDate,
    checkInTime,
    normalizedReservation.siteName,
    normalizedReservation.type,
    normalizedReservation.checkIn,
  ]);

  const displayCheckOut = useMemo(() => {
    if (
      !normalizedReservation.checkOut ||
      normalizedReservation.checkOut === ''
    )
      return '미정';
    if (!checkOutDate) return '정보 없음';
    const [datePart, timePart] = normalizedReservation.checkOut.split('T');
    const time = timePart ? timePart.split('+')[0].substring(0, 5) : '00:00';
    if (time === '00:00' && normalizedReservation.type === 'dayUse')
      return `${datePart} (입실 대기)`;
    if (
      normalizedReservation.siteName === '현장예약' &&
      normalizedReservation.type !== 'dayUse'
    )
      return `${datePart} ${checkOutTime}`;
    return `${datePart} ${time}`;
  }, [
    checkOutDate,
    checkOutTime,
    normalizedReservation.siteName,
    normalizedReservation.type,
    normalizedReservation.checkOut,
  ]);

  const displayReservationDate = useMemo(() => {
    if (!normalizedReservation.reservationDate) return '정보 없음';
    const dateMatch =
      normalizedReservation.reservationDate.match(/^\d{4}-\d{2}-\d{2}/);
    return dateMatch ? dateMatch[0] : '정보 없음';
  }, [normalizedReservation.reservationDate]);

  const handleCheckIn = useCallback(() => {
    const reservationCheckIn = new Date(normalizedReservation.checkIn);
    const currentDate = startOfDay(new Date());
    const isToday = startOfDay(reservationCheckIn) <= currentDate;

    const baseDate = isToday ? new Date() : reservationCheckIn;
    const checkInStr = format(baseDate, "yyyy-MM-dd'T'HH:mm:ss+09:00");
    const durationHours = normalizedReservation.duration || 3;
    const checkOutStr = format(
      addHours(baseDate, durationHours),
      "yyyy-MM-dd'T'HH:mm:ss+09:00"
    );
    const updatedData = {
      ...normalizedReservation,
      checkIn: normalizedReservation.isCheckedIn
        ? normalizedReservation.checkIn
        : checkInStr,
      checkOut: normalizedReservation.isCheckedIn
        ? normalizedReservation.checkOut
        : checkOutStr,
      checkInTime: format(baseDate, 'HH:mm'),
      checkOutTime: format(new Date(checkOutStr), 'HH:mm'),
      paymentMethod: 'Cash',
      isCheckedIn: true,
      isCheckedOut: false,
      selectedDate: selectedDate.toISOString(),
    };
    console.log(
      `[handleCheckIn] Updating ${normalizedReservation._id}`,
      updatedData
    );
    onPartialUpdate(normalizedReservation._id, updatedData)
      .then(() => {
        if (typeof setAllReservations === 'function') {
          setAllReservations((prev) =>
            prev.map((res) =>
              res._id === normalizedReservation._id
                ? { ...res, ...updatedData }
                : res
            )
          );
        }
        if (typeof filterReservationsByDate === 'function') {
          filterReservationsByDate(
            allReservations.map((res) =>
              res._id === normalizedReservation._id
                ? { ...res, ...updatedData }
                : res
            ),
            selectedDate
          );
        }
      })
      .catch((error) => console.error(`[handleCheckIn] Error:`, error));
  }, [
    normalizedReservation,
    onPartialUpdate,
    allReservations,
    filterReservationsByDate,
    selectedDate,
    setAllReservations,
  ]);

  const handleCheckOut = useCallback(() => {
    const now = new Date();
    const updatedData = {
      ...normalizedReservation,
      checkOut: format(now, "yyyy-MM-dd'T'HH:mm:ss+09:00"),
      checkOutTime: format(now, 'HH:mm'),
      isCheckedOut: true,
      manuallyCheckedOut: true,
      isCheckedIn: false,
      selectedDate: selectedDate.toISOString(),
    };
    console.log(
      `[handleCheckOut] Updating reservation ${
        normalizedReservation._id
      }, isCheckedOut: ${updatedData.isCheckedOut}, totalPrice: ${
        normalizedReservation.totalPrice || 0
      }`,
      updatedData
    );

    const currentReservation = allReservations.find(
      (res) => res._id === normalizedReservation._id
    );
    if (!currentReservation) {
      console.warn(
        `[handleCheckOut] Reservation ${normalizedReservation._id} not found in allReservations. Attempting to update anyway.`
      );
      onPartialUpdate(normalizedReservation._id, updatedData)
        .then(() => {
          console.log(
            `[handleCheckOut] Successfully updated reservation ${normalizedReservation._id} despite not being in allReservations.`
          );
          if (typeof setAllReservations === 'function') {
            setAllReservations((prev) => {
              const updatedReservations = prev.filter(
                (res) => res._id !== normalizedReservation._id
              );
              return [...updatedReservations, updatedData];
            });
          }
          if (typeof filterReservationsByDate === 'function') {
            filterReservationsByDate(
              [...allReservations, updatedData],
              selectedDate
            );
          }
        })
        .catch((error) => {
          console.error(
            `[handleCheckOut] Failed to update reservation ${normalizedReservation._id}:`,
            error
          );
          alert(
            '퇴실 처리에 실패했습니다. 예약 데이터를 새로고침 후 다시 시도해주세요.'
          );
        });
      return;
    }

    onPartialUpdate(normalizedReservation._id, updatedData)
      .then(() => {
        if (typeof setAllReservations === 'function') {
          setAllReservations((prev) =>
            prev.map((res) =>
              res._id === normalizedReservation._id
                ? { ...res, ...updatedData }
                : res
            )
          );
        }
        if (typeof filterReservationsByDate === 'function') {
          filterReservationsByDate(
            allReservations.map((res) =>
              res._id === normalizedReservation._id
                ? { ...res, ...updatedData }
                : res
            ),
            selectedDate
          );
        }
      })
      .catch((error) => {
        console.error(
          `[handleCheckOut] Failed to update reservation ${normalizedReservation._id}:`,
          error
        );
        alert('퇴실 처리에 실패했습니다. 다시 시도해주세요.');
      });
  }, [
    normalizedReservation,
    onPartialUpdate,
    allReservations,
    filterReservationsByDate,
    selectedDate,
    setAllReservations,
  ]);

  const handleDelete = useCallback(() => {
    if (window.confirm('예약을 삭제하시겠습니까?')) {
      console.log(
        `[handleDelete] Deleting reservation ${normalizedReservation._id}`
      );
      if (typeof handleDeleteClickHandler === 'function') {
        handleDeleteClickHandler(
          normalizedReservation._id,
          normalizedReservation.siteName
        );
      }
    }
  }, [
    normalizedReservation._id,
    normalizedReservation.siteName,
    handleDeleteClickHandler,
  ]);

  const handleEditStart = useCallback(
    (reservationId) => {
      const today = startOfDay(new Date());
      const checkoutDay = checkOutDate ? startOfDay(checkOutDate) : null;
      if (checkoutDay && today > checkoutDay) {
        console.warn(
          `Reservation ${
            normalizedReservation._id || 'unknown'
          } has already checked out. Editing is not allowed.`
        );
        return;
      }
      if (isEditingMemo) return;

      const defaultCheckOut = checkOutDate
        ? normalizedReservation.checkOut
        : format(
            addHours(new Date(), normalizedReservation.duration || 3),
            "yyyy-MM-dd'T'HH:mm:ss+09:00"
          );

      let initialPrice = String(
        normalizedReservation.price || normalizedReservation.totalPrice || 0
      );
      if (normalizedReservation.type === 'dayUse') {
        const roomType = roomTypes.find(
          (rt) => rt.roomInfo === normalizedReservation.roomInfo
        );
        const basePricePerHour = (roomType?.price || 0) / 2;
        const durationHours =
          normalizedReservation.duration ||
          normalizedReservation.durationHours ||
          3;
        initialPrice = String(basePricePerHour * durationHours);
      }

      const initialData = {
        ...normalizedReservation,
        _id: normalizedReservation._id,
        checkIn: normalizedReservation.checkIn,
        checkOut: defaultCheckOut,
        checkInDate: checkInDate ? format(checkInDate, 'yyyy-MM-dd') : '',
        checkInTime: checkInDate ? format(checkInDate, 'HH:mm') : '00:00',
        checkOutDate: checkOutDate
          ? format(checkOutDate, 'yyyy-MM-dd')
          : format(
              addHours(new Date(), normalizedReservation.duration || 3),
              'yyyy-MM-dd'
            ),
        checkOutTime: checkOutDate
          ? format(checkOutDate, 'HH:mm')
          : format(
              addHours(new Date(), normalizedReservation.duration || 3),
              'HH:mm'
            ),
        duration:
          normalizedReservation.duration ||
          normalizedReservation.durationHours ||
          3,
        durationHours:
          normalizedReservation.duration ||
          normalizedReservation.durationHours ||
          3,
        type: normalizedReservation.type || 'stay',
        reservationNo:
          normalizedReservation.reservationNo || normalizedReservation._id,
        customerName: normalizedReservation.customerName || '',
        phoneNumber: normalizedReservation.phoneNumber || '',
        reservationDate:
          normalizedReservation.reservationDate ||
          format(new Date(), 'yyyy-MM-dd HH:mm'),
        roomInfo: normalizedReservation.roomInfo || 'Standard',
        price: initialPrice,
        paymentMethod:
          normalizedReservation.paymentMethod ||
          (normalizedReservation.type === 'dayUse' ? 'Cash' : 'Card'),
        specialRequests: normalizedReservation.specialRequests || '',
        roomNumber: normalizedReservation.roomNumber || '',
        isCheckedOut: normalizedReservation.isCheckedOut,
      };

      try {
        if (typeof onEdit === 'function') {
          console.log(
            `[DraggableReservationCard.js] Calling onEdit with reservationId: ${reservationId}, initialData:`,
            initialData
          );
          onEdit(reservationId, initialData);
        } else {
          throw new Error(
            `[DraggableReservationCard.js] onEdit is not a function. Received: ${typeof onEdit}, value: ${onEdit}`
          );
        }
      } catch (error) {
        console.error(error.message);
      }
    },
    [
      checkOutDate,
      normalizedReservation,
      onEdit,
      checkInDate,
      isEditingMemo,
      roomTypes,
    ]
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
            {
              ...normalizedReservation,
              checkIn: checkInDate,
              checkOut: checkOutDate,
            },
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
    normalizedReservation,
    allReservations,
    roomTypes,
    checkInDate,
    checkOutDate,
    selectedDate,
  ]);

  const [{ isDragging }, dragRef] = useDrag({
    type: 'RESERVATION',
    item: {
      reservationId: normalizedReservation._id,
      reservation: {
        ...normalizedReservation,
        checkIn: checkInDate,
        checkOut: checkOutDate,
      },
      originalRoomNumber: normalizedReservation.roomNumber,
      originalRoomInfo: normalizedReservation.roomInfo,
      originalContainerId: normalizedReservation.containerId,
    },
    canDrag:
      !flippedReservationIds.has(normalizedReservation._id) &&
      !isEditingMemo &&
      canDragMemo,
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });

  const toggleMemoEdit = (reservationId, newState) => {
    if (typeof newState === 'boolean') setIsEditingMemo(newState);
    else setIsEditingMemo((prev) => !prev);
  };

  const isFlipped = flippedReservationIds.has(normalizedReservation._id);
  const isHighlighted =
    highlightedReservationIds.includes(normalizedReservation._id) &&
    isSearching;
  const isUpdated =
    normalizedReservation._id === updatedReservationId && isUpdatedHighlighted;
  const isCancelled =
    normalizedReservation._id.includes('Canceled') ||
    (normalizedReservation.reservationStatus || '').toLowerCase() ===
      'cancelled';

  const truncatedReservationNo = normalizedReservation.reservationNo
    ? normalizedReservation.reservationNo.length > 20
      ? `${normalizedReservation.reservationNo.substring(0, 20)}...`
      : normalizedReservation.reservationNo
    : '정보 없음';

  const checkOutThreshold = useMemo(() => {
    if (!checkOutDate || normalizedReservation.type === 'dayUse') return null;
    const threshold = new Date(checkOutDate);
    threshold.setHours(9, 0, 0, 0);
    return threshold;
  }, [checkOutDate, normalizedReservation.type]);

  const isOTA = availableOTAs.includes(normalizedReservation.siteName);
  const isAssigned =
    normalizedReservation.roomNumber &&
    normalizedReservation.roomNumber.trim() !== '';
  const isDayUseExpired = useMemo(() => {
    if (
      normalizedReservation.type !== 'dayUse' ||
      !checkOutDate ||
      !normalizedReservation.isCheckedIn
    )
      return false;
    return new Date() > checkOutDate;
  }, [
    normalizedReservation.type,
    checkOutDate,
    normalizedReservation.isCheckedIn,
  ]);

  const cardClassNames = [
    'room-card',
    getBorderColor(normalizedReservation),
    isCancelled ? 'cancelled' : '',
    isUnassigned ? 'unassigned-card' : '',
    isHighlighted ? 'highlighted' : '',
    isUpdated ? 'onsite-created' : '',
    !canDragMemo ? 'draggable-false' : '',
    normalizedReservation.isCheckedOut ? 'checked-out' : '',
    isDayUseExpired ? 'expired-blink' : '',
    isSoldOut ? 'sold-out' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const handleMemoChange = (reservationId, value) => {
    console.log(`Memo changed for ${reservationId}: ${value}`);
  };

  const handleMemoSave = (reservationId) => {
    toggleMemoEdit(reservationId, false);
    console.log(`Memo saved for ${reservationId}`);
    if (isFlipped)
      setTimeout(() => handleCardFlip(normalizedReservation._id), 100);
  };

  const handleMemoCancel = (reservationId) => {
    toggleMemoEdit(reservationId, false);
    console.log(`Memo cancelled for ${reservationId}`);
    if (isFlipped) handleCardFlip(normalizedReservation._id);
  };

  const handleCardClick = (e) => {
    if (e.target.closest('.memo-component')) return;
    if (isUnassigned) return;
    if (isDragging || isEditingMemo) return;

    // 한번 clicked 하면 플래스 멈추기
    if (keepPulse) {
      setPausedHighlight(true);
    }

    handleCardFlip(normalizedReservation._id);
  };

  const textStyleIfSoldOut = useMemo(
    () => (isSoldOut ? { color: 'red', fontWeight: 'bold' } : {}),
    [isSoldOut]
  );

  const displayPrice = useMemo(
    () => (isSoldOut ? '0원' : getPriceForDisplay(normalizedReservation)),
    [normalizedReservation, isSoldOut]
  );

  const paymentMethodInfo = useMemo(() => {
    const defaultMethod =
      normalizedReservation.type === 'dayUse' ? 'Cash' : 'Card';
    return getPaymentMethodIcon(
      normalizedReservation.paymentMethod || defaultMethod
    );
  }, [normalizedReservation.type, normalizedReservation.paymentMethod]);

  const renderDayUseButtons = useMemo(() => {
    if (normalizedReservation.type !== 'dayUse') return null;
    const isDayUse = normalizedReservation.type === 'dayUse';
    const isCheckedIn = normalizedReservation.isCheckedIn;
    const isCheckedOut = normalizedReservation.isCheckedOut;
    const currentDate = startOfDay(new Date());
    const checkInDay = checkInDate ? startOfDay(checkInDate) : null;
    const checkOutDay = checkOutDate ? startOfDay(checkOutDate) : null;
    const isCheckInToday =
      checkInDay && currentDate.getTime() === checkInDay.getTime();
    const isPastCheckout = checkOutDay && currentDate > checkOutDay;

    return (
      <span className="button-group-wrapper">
        {!isPastCheckout && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleEditStart(normalizedReservation._id);
            }}
            className="action-btn edit-btn"
            data-tooltip="➖"
          >
            수정
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDelete();
          }}
          className="action-btn delete-btn"
          data-tooltip="➖"
        >
          삭제
        </button>
        {isDayUse && !isCheckedIn && isCheckInToday && !isPastCheckout && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleCheckIn();
            }}
            className="action-btn checkin-btn"
            data-tooltip="➖"
          >
            입실
          </button>
        )}
        {isDayUse && isCheckedIn && !isCheckedOut && !isPastCheckout && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleCheckOut();
            }}
            className="action-btn checkout-btn"
            data-tooltip="➖"
          >
            퇴실
          </button>
        )}
      </span>
    );
  }, [
    normalizedReservation,
    checkInDate,
    checkOutDate,
    handleCheckIn,
    handleCheckOut,
    handleEditStart,
    handleDelete,
  ]);

  const buttonGroup = useMemo(() => {
    if (
      normalizedReservation.type !== 'dayUse' &&
      (!isOTA || (isOTA && isAssigned)) &&
      !(checkOutThreshold && new Date() > checkOutThreshold)
    ) {
      return (
        <span className="button-group-wrapper">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleEditStart(normalizedReservation._id);
            }}
            className="action-btn edit-btn"
            data-tooltip="➖"
          >
            수정
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteClickHandler(
                normalizedReservation._id,
                normalizedReservation.siteName
              );
            }}
            className="action-btn delete-btn"
            data-tooltip="➖"
          >
            삭제
          </button>
        </span>
      );
    }
    return null;
  }, [
    normalizedReservation,
    isOTA,
    isAssigned,
    checkOutThreshold,
    handleEditStart,
    handleDeleteClickHandler,
  ]);

  const renderSoldOutButtons = useMemo(() => {
    return (
      <span className="button-group-wrapper">
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleEditStart(normalizedReservation._id);
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
  }, [normalizedReservation._id, handleEditStart, handleDelete]);

  const renderSoldOutFront = () => {
    const stopReason = normalizedReservation.specialRequests || '사유 없음';
    const displayPeriod =
      !checkInDate || !checkOutDate
        ? '기간 정보 없음'
        : `${format(checkInDate, 'yyyy-MM-dd HH:mm')} ~ ${format(
            checkOutDate,
            'yyyy-MM-dd HH:mm'
          )}`;

    return (
      <div className="content-footer-wrapper sold-out-content">
        <div className="card-content">
          <div className="card-header">
            <h3 className="no-break">
              <span className="stay-label">(판매중단)</span>
              {renderSoldOutButtons}
            </h3>
          </div>
          <p className="sold-out-text">
            {normalizedReservation.customerName || '판매중단'}
          </p>
          <p>기간: {displayPeriod}</p>
          <p>가격: 0원</p>
          <p>
            객실타입:{' '}
            {normalizedReservation.roomInfo &&
            normalizedReservation.roomInfo.length > 30
              ? `${normalizedReservation.roomInfo.substring(0, 21)}...`
              : normalizedReservation.roomInfo || '정보 없음'}
          </p>
          <p>판매중단일: {displayReservationDate}</p>
          <p>중단이유: {stopReason}</p>
        </div>
        {renderSiteInfoFooter()}
      </div>
    );
  };

  const renderNormalFront = () => {
    const formatCouponInfo = (couponInfo) => {
      if (!couponInfo || !couponInfo.name) return '없음';
      const parts = couponInfo.name.split('-');
      const cleanName =
        parts.length > 1 ? parts.slice(1).join('-').trim() : couponInfo.name;
      const discountText =
        couponInfo.discountType === 'percentage'
          ? `${couponInfo.discountValue}% 할인`
          : `${couponInfo.discountValue.toLocaleString()}원 할인`;
      return `${cleanName} (${discountText})`;
    };

    return (
      <div className="content-footer-wrapper">
        <div className="card-content">
          <div className="card-header">
            <h3 className="no-break">
              <span className="stay-label">{stayLabel}</span>
              {normalizedReservation.type === 'dayUse'
                ? renderDayUseButtons
                : buttonGroup}
            </h3>
          </div>
          <p className="reservation-no">{truncatedReservationNo}</p>
          <p style={textStyleIfSoldOut}>
            예약자: {normalizedReservation.customerName || '정보 없음'}{' '}
            {normalizedReservation.type === 'dayUse' && (
              <CountdownTimer
                checkOutDate={checkOutDate}
                reservationId={normalizedReservation._id}
                newlyCreatedId={newlyCreatedId}
                isCheckedIn={normalizedReservation.isCheckedIn}
                duration={normalizedReservation.duration}
              />
            )}
          </p>
          <p className={isSoldOut ? 'sold-out-date' : ''}>
            체크인: {displayCheckIn}
          </p>
          <p className={isSoldOut ? 'sold-out-date' : ''}>
            체크아웃: {displayCheckOut}
          </p>
          <p style={textStyleIfSoldOut}>
            가격: {displayPrice}
            {normalizedReservation.paymentMethod?.includes('PerNight') &&
              normalizedReservation.remainingBalance > 0 && (
                <span style={{ color: 'red' }}>
                  (잔여:{' '}
                  {normalizedReservation.remainingBalance.toLocaleString()})
                </span>
              )}
          </p>
          <p>
            할인 정보:{' '}
            <span style={{ color: '#2ecc71', fontWeight: 'bold' }}>
              {formatCouponInfo(normalizedReservation.couponInfo)}
            </span>
          </p>
          <p>
            객실 정보:{' '}
            {normalizedReservation.roomInfo &&
            normalizedReservation.roomInfo.length > 30
              ? `${normalizedReservation.roomInfo.substring(0, 21)}...`
              : normalizedReservation.roomInfo || '정보 없음'}
          </p>
          <p>예약일: {displayReservationDate}</p>
          {normalizedReservation.phoneNumber && (
            <p>전화번호: {normalizedReservation.phoneNumber}</p>
          )}
          <p className="payment-method">
            결제방법:{' '}
            {paymentMethodInfo.icon && (
              <>
                {paymentMethodInfo.icon} {paymentMethodInfo.text}
              </>
            )}
          </p>
          <p>고객요청: {normalizedReservation.specialRequests || '없음'}</p>
        </div>
        {renderSiteInfoFooter()}
      </div>
    );
  };

  const renderSiteInfoFooter = () => {
    return (
      <div className="site-info-footer">
        <div className="site-info-wrapper">
          <p className="site-info">
            사이트:{' '}
            <span
              className={
                normalizedReservation.siteName === '현장예약'
                  ? 'onsite-reservation'
                  : ''
              }
            >
              {normalizedReservation.siteName || '정보 없음'}
            </span>
          </p>
          <button
            type="button"
            className="invoice-icon-button-back"
            onClick={(e) => {
              e.stopPropagation();
              openInvoiceModal({
                ...normalizedReservation,
                reservationNo:
                  normalizedReservation.reservationNo ||
                  normalizedReservation._id ||
                  '',
                hotelSettings,
                hotelAddress:
                  hotelAddress ||
                  hotelSettings?.hotelAddress ||
                  '주소 정보 없음',
                phoneNumber:
                  phoneNumber ||
                  hotelSettings?.phoneNumber ||
                  '전화번호 정보 없음',
                email: email || hotelSettings?.email || '이메일 정보 없음',
              });
            }}
            title="인보이스 보기"
          >
            <FaFileInvoice size={20} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div
      ref={dragRef}
      className={cardClassNames}
      data-id={normalizedReservation._id}
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
        <div className="room-card-inner">
          {/* shouldPulse가 true일 때만 danjam-highlight 클래스를 붙여 줍니다 */}
          <div
            className={`room-card-front${
              shouldPulse ? ' danjam-highlight' : ''
            }`}
            style={{ backfaceVisibility: 'hidden' }}
          >
            {isSoldOut ? renderSoldOutFront() : renderNormalFront()}
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
                reservationId={normalizedReservation._id}
                reservationName={
                  normalizedReservation.customerName || '예약자 없음'
                }
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
  newlyCreatedId: PropTypes.string,
  isNewlyCreatedHighlighted: PropTypes.bool,
  updatedReservationId: PropTypes.string,
  isUpdatedHighlighted: PropTypes.bool,
  onPartialUpdate: PropTypes.func.isRequired,
  onEdit: PropTypes.func.isRequired,
  roomTypes: PropTypes.array.isRequired,
  allReservations: PropTypes.array,
  selectedDate: PropTypes.instanceOf(Date),
  filterReservationsByDate: PropTypes.func,
  setAllReservations: PropTypes.func,
  reservation: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    checkIn: PropTypes.string,
    checkOut: PropTypes.string,
    customerName: PropTypes.string,
    roomInfo: PropTypes.string,
    reservationNo: PropTypes.string,
    type: PropTypes.string,
    duration: PropTypes.number,
    durationHours: PropTypes.number,
    isCheckedOut: PropTypes.bool,
    isCheckedIn: PropTypes.bool,
  }).isRequired,
};

export default DraggableReservationCard;
