import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import PropTypes from 'prop-types';
import { format, startOfDay, addDays } from 'date-fns';
import { useDrop } from 'react-dnd';

import './RoomGrid.css';
import InvoiceModal from './InvoiceModal';
import DraggableReservationCard from './DraggableReservationCard';
import { renderActionButtons } from '../utils/renderActionButtons';
import MonthlyCalendar from './MonthlyCalendar';
import { sortContainers, getPaymentMethodIcon } from '../utils/roomGridUtils';
import { matchRoomType } from '../utils/matchRoomType';
import {
  canMoveToRoom,
  canSwapReservations,
  calculateRoomAvailability,
} from '../utils/availability';
import { checkConflict } from '../utils/checkConflict';
import LogViewer from './LogViewer';

const ContainerCell = React.memo(
  ({
    cont,
    isMinimalMode,
    onEdit,
    getReservationById,
    children,
    assignedReservations,
    fullReservations,
    roomTypes,
    gridSettings,
    handleEditExtended,
    handleRoomChangeAndSync,
    setAllReservations,
    filterReservationsByDate,
    selectedDate,
    hotelSettings,
  }) => {
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    const [conflictMessage, setConflictMessage] = useState(null);
    const timeoutRef = useRef(null);

    const clearConflict = useCallback(() => {
      setConflictMessage(null);
      setIsDraggingOver(false);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }, []);

    const [{ isOver, canDrop }, dropRef] = useDrop({
      accept: 'RESERVATION',
      drop: async (item, monitor) => {
        if (!monitor.isOver({ shallow: true })) return;
        if (
          item.originalContainerId &&
          item.originalContainerId === cont.containerId
        ) {
          clearConflict();
          return;
        }

        const {
          reservationId,
          reservation: draggedReservation,
          originalRoomNumber,
          originalRoomInfo,
        } = item;

        if (conflictMessage) {
          console.warn('[drop] 충돌 상태, 이동 취소');
          clearConflict();
          return;
        }
        if (!cont.roomInfo || !cont.roomNumber) return;

        const reservation = getReservationById(reservationId);
        if (!reservation) return;

        if (
          reservation.roomInfo === cont.roomInfo &&
          reservation.roomNumber === cont.roomNumber &&
          !reservation.manuallyCheckedOut
        ) {
          clearConflict();
          return;
        }

        const checkInDate = new Date(draggedReservation.checkIn);
        const checkOutDate = new Date(draggedReservation.checkOut);
        if (isNaN(checkInDate) || isNaN(checkOutDate)) {
          console.error('Invalid date in dragged reservation');
          clearConflict();
          return;
        }

        const activeReservations = fullReservations.filter(
          (res) => !res.manuallyCheckedOut
        );
        const { isConflict, conflictReservation } = checkConflict(
          {
            ...draggedReservation,
            checkIn: checkInDate,
            checkOut: checkOutDate,
          },
          cont.roomNumber,
          activeReservations
        );
        if (isConflict) {
          const conflictMsg = conflictReservation
            ? `🚫 충돌 발생!\n이미 객실 (${
                cont.roomNumber
              })에 예약이 있습니다.\n충돌 예약: ${
                conflictReservation.customerName || '정보 없음'
              }`
            : '🚫 충돌 발생!\n과거 체크인 예약은 이동할 수 없습니다.';
          setConflictMessage(conflictMsg);
          timeoutRef.current = setTimeout(clearConflict, 3000);
          return;
        }

        if (assignedReservations && assignedReservations.length > 0) {
          const confirmSwap = window.confirm(
            '이미 이 방에는 예약이 있습니다. 두 예약을 스왑하시겠습니까?'
          );
          if (!confirmSwap) {
            await handleEditExtended(reservationId, {
              roomInfo: originalRoomInfo,
              roomNumber: originalRoomNumber,
              checkIn: draggedReservation.checkIn,
              checkOut: draggedReservation.checkOut,
              manualAssignment: true,
            });
            return;
          }

          const existingReservation = assignedReservations.find(
            (res) => !res.manuallyCheckedOut
          );
          if (!existingReservation) {
            clearConflict();
            return;
          }

          const existingCheckIn = new Date(existingReservation.checkIn);
          const existingCheckOut = new Date(existingReservation.checkOut);

          const canSwapOk = canSwapReservations(
            {
              ...draggedReservation,
              checkIn: checkInDate,
              checkOut: checkOutDate,
            },
            {
              ...existingReservation,
              checkIn: existingCheckIn,
              checkOut: existingCheckOut,
            },
            fullReservations.filter((res) => !res.manuallyCheckedOut)
          );
          if (!canSwapOk) {
            setConflictMessage(
              '스왑 불가: 해당 기간 충돌하는 예약이 있습니다.'
            );
            timeoutRef.current = setTimeout(clearConflict, 3000);
            await handleEditExtended(reservationId, {
              roomInfo: originalRoomInfo,
              roomNumber: originalRoomNumber,
              manualAssignment: true,
            });
            return;
          }

          await handleRoomChangeAndSync(
            reservationId,
            cont.roomNumber,
            cont.roomInfo,
            draggedReservation.totalPrice,
            selectedDate
          );
          await handleRoomChangeAndSync(
            existingReservation._id,
            draggedReservation.roomNumber,
            draggedReservation.roomInfo,
            existingReservation.totalPrice,
            selectedDate
          );
        } else {
          await handleRoomChangeAndSync(
            reservationId,
            cont.roomNumber,
            cont.roomInfo,
            draggedReservation.totalPrice,
            selectedDate
          );

          const updatedReservations = fullReservations.map((r) =>
            r._id === draggedReservation._id
              ? { ...r, roomInfo: cont.roomInfo, roomNumber: cont.roomNumber }
              : r
          );
          const viewingDateStart = startOfDay(selectedDate);
          const viewingDateEnd = addDays(viewingDateStart, 1);
          const selectedDates = [
            format(addDays(selectedDate, -1), 'yyyy-MM-dd'),
            format(selectedDate, 'yyyy-MM-dd'),
            format(addDays(selectedDate, 1), 'yyyy-MM-dd'),
          ];

          const availByDate = calculateRoomAvailability(
            updatedReservations.filter((r) => !r.manuallyCheckedOut),
            roomTypes,
            viewingDateStart,
            viewingDateEnd,
            gridSettings,
            selectedDates
          );

          const { canMove, conflictDays } = canMoveToRoom(
            cont.roomNumber,
            cont.roomInfo.toLowerCase(),
            checkInDate,
            checkOutDate,
            availByDate,
            updatedReservations.filter((r) => !r.manuallyCheckedOut),
            draggedReservation._id
          );

          if (canMove) {
            setAllReservations((prev) => {
              const updated = prev.map((r) =>
                r._id === draggedReservation._id
                  ? {
                      ...r,
                      roomInfo: cont.roomInfo,
                      roomNumber: cont.roomNumber,
                      parsedCheckInDate: checkInDate,
                      parsedCheckOutDate: checkOutDate,
                    }
                  : r
              );
              filterReservationsByDate(updated, selectedDate);
              return updated;
            });
            console.log(
              `Reservation ${reservationId} -> ${cont.roomNumber} 이동 성공`
            );
          } else {
            const conflictMsg = `이동 불가. 충돌 발생 날짜: ${conflictDays.join(
              ', '
            )}`;
            setConflictMessage(conflictMsg);
            await handleEditExtended(reservationId, {
              roomInfo: originalRoomInfo,
              roomNumber: originalRoomNumber,
              manualAssignment: true,
            });
            timeoutRef.current = setTimeout(clearConflict, 3000);
          }
        }
      },
      hover: (item, monitor) => {
        if (!monitor.isOver({ shallow: true })) {
          clearConflict();
          return;
        }
        const { reservation: draggedReservation } = item;
        if (!cont.roomInfo || !cont.roomNumber) {
          clearConflict();
          return;
        }

        const checkInDate = new Date(draggedReservation.checkIn);
        const checkOutDate = new Date(draggedReservation.checkOut);
        if (isNaN(checkInDate) || isNaN(checkOutDate)) {
          clearConflict();
          return;
        }

        const activeReservations = fullReservations.filter(
          (res) => !res.manuallyCheckedOut
        );
        const { isConflict, conflictReservation } = checkConflict(
          {
            ...draggedReservation,
            checkIn: checkInDate,
            checkOut: checkOutDate,
          },
          cont.roomNumber,
          activeReservations
        );
        if (isConflict && !isDraggingOver) {
          const conflictMsg = conflictReservation
            ? `🚫 충돌 발생!\n객실 (${cont.roomNumber}) 예약 중.\n충돌: ${
                conflictReservation.customerName || '정보 없음'
              }`
            : '🚫 충돌 발생!\n과거 체크인 예약은 이동 불가.';
          setConflictMessage(conflictMsg);
          setIsDraggingOver(true);
          timeoutRef.current = setTimeout(clearConflict, 3000);
        } else if (isDraggingOver) {
          clearConflict();
        }
      },
      collect: (monitor) => ({
        isOver: monitor.isOver({ shallow: true }),
        canDrop: monitor.canDrop() && !conflictMessage,
      }),
    });

    const checkedOutCount = useMemo(() => {
      const uniqueCheckedOut = new Set();
      fullReservations.forEach((res) => {
        if (
          res.type === 'dayUse' &&
          res.manuallyCheckedOut &&
          res.roomNumber === cont.roomNumber &&
          format(new Date(res.checkOut), 'yyyy-MM-dd') ===
            format(selectedDate, 'yyyy-MM-dd')
        ) {
          uniqueCheckedOut.add(res._id);
        }
      });
      return uniqueCheckedOut.size;
    }, [fullReservations, cont.roomNumber, selectedDate]);

    useEffect(() => {
      if (!isOver && isDraggingOver) {
        timeoutRef.current = setTimeout(clearConflict, 3000);
      }
      return () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      };
    }, [isOver, isDraggingOver, clearConflict]);

    // 고객 이름이 "판매보류" 또는 "판매중지"인 경우 감지
    const hasSoldOutReservation = assignedReservations.some(
      (res) =>
        res.customerName === '판매보류' || res.customerName === '판매중지'
    );

    if (isMinimalMode) {
      let displayStatus = 'OFF';
      let displayColor = '#bbb';
      let containerBg = 'transparent';
      let infoText = '예약없음';

      if (hasSoldOutReservation) {
        displayStatus = '사용불가';
        displayColor = '#888';
        containerBg = '#f0f0f0'; // 연한 회색 배경
        infoText = '판매보류';
      } else if (assignedReservations && assignedReservations.length > 0) {
        displayStatus = 'ON';
        displayColor = 'green';
        containerBg = '#f0f4f8';

        if (assignedReservations.length === 1) {
          const single = assignedReservations[0];
          if (single.type === 'dayUse') {
            infoText = '대실1건';
          } else {
            const guestName = single.customerName || '이름없음';
            infoText = `숙박1건(${guestName})`;
          }
        } else {
          infoText = `예약 ${assignedReservations.length}건`;
        }
      }

      return (
        <div
          ref={dropRef}
          className="grid-cell minimal-mode"
          style={{
            border: '1px solid #ccc',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isOver && canDrop ? '#fff9e3' : containerBg,
          }}
        >
          {conflictMessage && (
            <div
              className="drop-conflict-overlay"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(255, 0, 0, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10,
                color: 'red',
                fontWeight: 'bold',
                padding: '10px',
                pointerEvents: 'none',
                whiteSpace: 'pre-line',
                fontSize: '0.9rem',
                textAlign: 'center',
                opacity: isDraggingOver ? 1 : 0,
                transition: 'opacity 0.5s ease-out',
              }}
            >
              {conflictMessage}
            </div>
          )}
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontSize: '1.5rem',
                fontWeight: 'bold',
                marginBottom: '5px',
              }}
            >
              {cont.roomNumber || '미설정'}
            </div>
            <div
              style={{
                fontSize: '0.8rem',
                color: 'gray',
              }}
            >
              {cont.roomInfo || '미설정'}
            </div>
            <div
              style={{
                marginTop: '5px',
                color: displayColor,
                fontWeight: 'bold',
              }}
            >
              {displayStatus}
            </div>
            <div
              style={{
                marginTop: '5px',
                fontSize: '0.8rem',
              }}
            >
              {infoText}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        ref={dropRef}
        className="grid-cell"
        style={{
          border: '1px solid #ccc',
          borderRadius: '8px',
          backgroundColor: isOver && canDrop ? '#fff9e3' : 'white',
          position: 'relative',
        }}
      >
        {conflictMessage && (
          <div
            className="drop-conflict-overlay"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(255, 0, 0, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
              color: 'red',
              fontWeight: 'bold',
              padding: '10px',
              pointerEvents: 'none',
              whiteSpace: 'pre-line',
              fontSize: '0.9rem',
              textAlign: 'center',
              opacity: isDraggingOver ? 1 : 0,
              transition: 'opacity 0.5s ease-out',
            }}
          >
            {conflictMessage}
          </div>
        )}
        <div
          className="container-label"
          style={{
            marginBottom: '5px',
            borderBottom: '1px solid #ddd',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '4px 8px',
            backgroundColor: hasSoldOutReservation ? '#f0f0f0' : '#f0f4f8',
            borderRadius: '8px',
            fontWeight: 'bold',
          }}
        >
          <span style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
            {cont.roomNumber || '미설정'}
          </span>
          <span
            style={{
              fontSize: '1rem',
              color: 'gray',
              marginLeft: 'auto',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {cont.roomInfo || '미설정'}
          </span>
          {hasSoldOutReservation && (
            <span
              style={{
                fontSize: '0.9rem',
                color: '#888',
                fontWeight: 'bold',
              }}
            >
              사용불가
            </span>
          )}
          {checkedOutCount > 0 && (
            <span className="checked-out-count">+{checkedOutCount}</span>
          )}
        </div>
        <div
          className="reservation-list"
          style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}
        >
          {children}
        </div>
      </div>
    );
  }
);

function RoomGrid({
  reservations,
  onDelete,
  onConfirm,
  onEdit,
  onPartialUpdate,
  loadedReservations,
  hotelId,
  hotelSettings,
  roomTypes,
  highlightedReservationIds,
  isSearching,
  memos,
  setMemos,
  newlyCreatedId,
  flipAllMemos,
  sortOrder,
  selectedDate,
  setSelectedDate,
  handleRoomChangeAndSync,
  updatedReservationId,
  setAllReservations,
  filterReservationsByDate,
  availabilityByDate,
  onQuickCreateRange,
  logs,
  isLogViewerOpen,
  onCloseLogViewer,
  fullReservations,
  allReservations,
  showGuestForm,
  isMinimalModeEnabled,
  handleCardFlip,
  flippedReservationIds,
}) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [modalType, setModalType] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNewlyCreatedHighlighted, setIsNewlyCreatedHighlighted] =
    useState(false);
  const [selectedReservation, setSelectedReservation] = useState(null);

  // 재고 0이면 자동 단축 모드
  const [floorMinimalMode, setFloorMinimalMode] = useState({});
  const [floorManualDisableMinimal, setFloorManualDisableMinimal] = useState(
    {}
  );

  const invoiceRef = useRef();
  const gridRef = useRef();
  const memoRefs = useRef({});

  const floors = useMemo(() => {
    const loadedFloors = hotelSettings?.gridSettings?.floors || [];
    return loadedFloors
      .filter((floor) => (floor.containers || []).length > 0) // ← 빈 층 제거
      .map((floor) => ({
        ...floor,
        containers: sortContainers([...(floor.containers || [])]),
      }));
  }, [hotelSettings]);

  const floorInventories = useMemo(() => {
    const inventories = {};
    floors.forEach((floor) => {
      const floorNum = floor.floorNum;
      let totalRemain = 0;
      (floor.containers || []).forEach((cont) => {
        if (cont.roomInfo === 'none') return;
        const roomTypeKey = cont.roomInfo.toLowerCase();
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const availForDay = availabilityByDate?.[dateStr]?.[roomTypeKey];
        if (availForDay) {
          totalRemain += availForDay.remain || 0;
        }
      });
      inventories[floorNum] = totalRemain;
    });
    return inventories;
  }, [floors, availabilityByDate, selectedDate]);

  useEffect(() => {
    const newFloorMinimalMode = {};
    Object.entries(floorInventories).forEach(([floorNum, remain]) => {
      newFloorMinimalMode[floorNum] = remain === 0;
    });
    setFloorMinimalMode(newFloorMinimalMode);
  }, [floorInventories]);

  const handleToggleFloorMinimal = useCallback((floorNum) => {
    setFloorManualDisableMinimal((prev) => ({
      ...prev,
      [floorNum]: !prev[floorNum],
    }));
  }, []);

  const filteredReservations = useMemo(() => {
    const selectedDateString = format(selectedDate, 'yyyy-MM-dd');
    return (reservations || [])
      .filter((r) => r && r._id)
      .filter((r) => {
        const ci = new Date(r.checkIn);
        const co = new Date(r.checkOut);
        if (isNaN(ci) || isNaN(co)) return false;
        return true;
      })
      .filter((r) => {
        if (r.type === 'dayUse' && r.manuallyCheckedOut) {
          return false;
        }
        const ciOnly = startOfDay(new Date(r.checkIn));
        const coOnly = startOfDay(new Date(r.checkOut));
        const isIncluded =
          selectedDateString >= format(ciOnly, 'yyyy-MM-dd') &&
          selectedDateString < format(coOnly, 'yyyy-MM-dd');
        const isSameDayStay =
          format(ciOnly, 'yyyy-MM-dd') === format(coOnly, 'yyyy-MM-dd') &&
          selectedDateString === format(ciOnly, 'yyyy-MM-dd');
        return isIncluded || isSameDayStay;
      });
  }, [reservations, selectedDate]);

  const floorReservations = useMemo(() => {
    const map = {};
    floors.forEach((floor) => {
      floor.containers
        .filter((cont) => cont.roomInfo !== 'none')
        .forEach((cont) => {
          map[cont.containerId] = filteredReservations.filter(
            (res) => res.roomNumber === cont.roomNumber
          );
        });
    });
    return map;
  }, [floors, filteredReservations]);

  const filteredUnassignedReservations = useMemo(() => {
    const selectedDateString = format(selectedDate, 'yyyy-MM-dd');
    return (fullReservations || [])
      .filter((res) => !res.roomNumber || res.roomNumber.trim() === '')
      .filter((res) => !res.manuallyCheckedOut)
      .filter((res) => {
        const ci = new Date(res.checkIn);
        const co = new Date(res.checkOut);
        if (isNaN(ci) || isNaN(co)) return false;
        const ciOnly = startOfDay(ci);
        const coOnly = startOfDay(co);
        const isIncluded =
          selectedDateString >= format(ciOnly, 'yyyy-MM-dd') &&
          selectedDateString < format(coOnly, 'yyyy-MM-dd');
        const isSameDayStay =
          format(ciOnly, 'yyyy-MM-dd') === format(coOnly, 'yyyy-MM-dd') &&
          selectedDateString === format(ciOnly, 'yyyy-MM-dd');
        return isIncluded || isSameDayStay;
      });
  }, [fullReservations, selectedDate]);

  const handleDeleteClickHandler = async (resId, siteName) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    setIsProcessing(true);
    setError(null);
    try {
      await onDelete(resId, hotelId, siteName);
      setMemos((prev) => {
        const c = { ...prev };
        delete c[resId];
        localStorage.setItem('localMemos', JSON.stringify(c));
        return c;
      });
    } catch (err) {
      console.error('삭제 실패', err);
      setError('삭제 실패');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmClickHandler = async (resId) => {
    if (!window.confirm('예약을 확정하시겠습니까?')) return;
    setIsProcessing(true);
    setError(null);
    try {
      await onConfirm(resId, hotelId);
      alert('예약이 확정되었습니다.');
    } catch (err) {
      console.error('확정 실패', err);
      setError('확정 실패');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEditExtended = useCallback(
    async (reservationId, updatedData, onComplete) => {
      try {
        await onEdit(reservationId, updatedData);
        setAllReservations((prev) =>
          prev.map((res) =>
            res._id === reservationId ? { ...res, ...updatedData } : res
          )
        );
        filterReservationsByDate(reservations, selectedDate);
        setIsNewlyCreatedHighlighted(false);
        if (typeof onComplete === 'function') {
          onComplete();
        }
      } catch (error) {
        console.error(`Failed to edit reservation ${reservationId}:`, error);
      }
    },
    [
      onEdit,
      setAllReservations,
      filterReservationsByDate,
      reservations,
      selectedDate,
    ]
  );

  const closeModalHandler = useCallback(() => {
    setIsModalOpen(false);
    setModalType(null);
    setSelectedReservation(null);
  }, []);

  const openInvoiceModalHandler = (reservation) => {
    if (isModalOpen) {
      closeModalHandler();
      setTimeout(() => {
        setSelectedReservation({
          ...reservation,
          reservationNo: reservation.reservationNo || reservation._id || '',
        });
        setModalType('invoice');
      }, 300);
    } else {
      setSelectedReservation({
        ...reservation,
        reservationNo: reservation.reservationNo || reservation._id || '',
      });
      setModalType('invoice');
    }
  };

  useEffect(() => {
    if (selectedReservation && modalType === 'invoice' && !isModalOpen) {
      setIsModalOpen(true);
    }
  }, [selectedReservation, modalType, isModalOpen]);

  const sortReservations = useCallback(
    (list) => {
      const validList = list.filter((r) => r !== null && r !== undefined);
      if (sortOrder === 'roomType') {
        return [...validList].sort((a, b) => {
          const aMatch = matchRoomType(a.roomInfo, roomTypes);
          const bMatch = matchRoomType(b.roomInfo, roomTypes);
          const getKey = (mObj, info) => {
            const infoStr = info || '';
            if (
              !mObj ||
              !infoStr ||
              (infoStr.toLowerCase && infoStr.toLowerCase().includes('대실'))
            ) {
              return 'zzz';
            }
            return mObj.roomInfo ? mObj.roomInfo.toLowerCase() : '';
          };
          const keyA = getKey(aMatch, a.roomInfo);
          const keyB = getKey(bMatch, b.roomInfo);
          if (keyA < keyB) return -1;
          if (keyA > keyB) return 1;
          return new Date(a.checkIn) - new Date(b.checkIn);
        });
      } else {
        return [...validList].sort((a, b) => {
          const A = new Date(a.checkIn);
          const B = new Date(b.checkIn);
          return sortOrder === 'newest'
            ? (B?.getTime() || 0) - (A?.getTime() || 0)
            : (A?.getTime() || 0) - (B?.getTime() || 0);
        });
      }
    },
    [sortOrder, roomTypes]
  );

  const [isMonthlyView, setIsMonthlyView] = useState(false);
  const toggleMonthlyView = () => setIsMonthlyView(!isMonthlyView);

  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        boxSizing: 'border-box',
        position: 'relative',
      }}
    >
      <div className="grid-wrapper" ref={gridRef} style={{ flex: 1 }}>
        {isMonthlyView ? (
          <MonthlyCalendar
            reservations={reservations}
            roomTypes={roomTypes}
            availabilityByDate={availabilityByDate}
            gridSettings={hotelSettings?.gridSettings || {}}
            onRangeSelect={onQuickCreateRange}
            onReturnView={toggleMonthlyView}
            onDateNavigate={(date) => {
              setIsMonthlyView(false);
              setSelectedDate(date);
            }}
          />
        ) : (
          <>
            {filteredUnassignedReservations.length > 0 && (
              <div
                className="unassigned-section"
                style={{ marginBottom: '2rem' }}
              >
                <h3>
                  현재 날짜 미배정 예약: {filteredUnassignedReservations.length}
                  건
                </h3>
                <div
                  className="unassigned-list"
                  style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}
                >
                  {sortReservations(filteredUnassignedReservations).map(
                    (res, index) => (
                      <div
                        key={`${res._id || res.reservationNo}-${index}`}
                        style={{
                          flex: '0 0 320px',
                          width: '320px',
                          boxSizing: 'border-box',
                        }}
                      >
                        <DraggableReservationCard
                          key={`${res._id || res.reservationNo}-${index}`}
                          reservation={res}
                          hotelId={hotelId}
                          highlightedReservationIds={
                            highlightedReservationIds || []
                          }
                          isSearching={isSearching}
                          flippedReservationIds={flippedReservationIds}
                          memos={memos || {}}
                          memoRefs={memoRefs}
                          handleCardFlip={handleCardFlip}
                          onEdit={(reservationId, initialData) => {
                            if (typeof onEdit === 'function') {
                              onEdit(reservationId, initialData);
                            } else {
                              console.error(
                                'onEdit is not a function in unassigned section'
                              );
                            }
                          }}
                          openInvoiceModal={openInvoiceModalHandler}
                          hotelSettings={hotelSettings}
                          renderActionButtons={renderActionButtons}
                          loadedReservations={loadedReservations || []}
                          newlyCreatedId={newlyCreatedId}
                          isNewlyCreatedHighlighted={isNewlyCreatedHighlighted}
                          updatedReservationId={updatedReservationId}
                          // isUpdatedHighlighted={isUpdatedHighlighted}
                          onPartialUpdate={onPartialUpdate}
                          roomTypes={roomTypes}
                          isUnassigned={true}
                          handleDeleteClickHandler={handleDeleteClickHandler}
                          handleConfirmClickHandler={handleConfirmClickHandler}
                          selectedDate={selectedDate}
                          filterReservationsByDate={filterReservationsByDate}
                          allReservations={reservations}
                          setAllReservations={setAllReservations}
                          fullReservations={fullReservations}
                          isMinimalMode={isMinimalModeEnabled}
                        />
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

            {floors
              .filter((floor) => (floor.containers || []).length > 0)
              .slice()
              .reverse()
              .map((floor) => {
                const isFloorAutoMinimal = floorMinimalMode[floor.floorNum];
                const isManualDisabled =
                  floorManualDisableMinimal[floor.floorNum] || false;
                const isFloorMinimalMode =
                  isMinimalModeEnabled &&
                  isFloorAutoMinimal &&
                  !isManualDisabled;

                return (
                  <div key={floor.floorNum} className="floor-section">
                    <h3 style={{ marginLeft: '10px', color: 'lightslategray' }}>
                      {floor.floorNum}F
                      {isMinimalModeEnabled && isFloorAutoMinimal && (
                        <span
                          style={{
                            color: 'green',
                            marginLeft: '10px',
                            cursor: 'pointer',
                            fontSize: '1.2rem',
                          }}
                          onClick={() =>
                            handleToggleFloorMinimal(floor.floorNum)
                          }
                        >
                          {floorManualDisableMinimal[floor.floorNum]
                            ? '▲'
                            : '▼'}
                        </span>
                      )}
                    </h3>
                    <div className="layout-grid">
                      {(floor.containers || []).map((cont) => {
                        const reservationsForCont =
                          floorReservations[cont.containerId] || [];
                        const sortedReservations =
                          sortReservations(reservationsForCont);

                        return (
                          <ContainerCell
                            key={cont.containerId}
                            cont={cont}
                            onEdit={onEdit}
                            getReservationById={(id) =>
                              reservations.find((r) => r._id === id)
                            }
                            assignedReservations={reservationsForCont}
                            fullReservations={fullReservations}
                            roomTypes={roomTypes}
                            gridSettings={hotelSettings?.gridSettings}
                            handleEditExtended={handleEditExtended}
                            handleRoomChangeAndSync={handleRoomChangeAndSync}
                            setAllReservations={setAllReservations}
                            filterReservationsByDate={filterReservationsByDate}
                            selectedDate={selectedDate}
                            hotelSettings={hotelSettings}
                            isMinimalMode={isFloorMinimalMode}
                          >
                            <div
                              className="reservation-list"
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '5px',
                              }}
                            >
                              {sortedReservations.length === 0 ? (
                                <div
                                  style={{ fontStyle: 'italic', color: '#999' }}
                                >
                                  예약 없음
                                </div>
                              ) : (
                                sortedReservations.map((rsv, idx) => (
                                  <DraggableReservationCard
                                    key={`${
                                      rsv._id || rsv.reservationNo
                                    }-${idx}`}
                                    reservation={rsv}
                                    hotelId={hotelId}
                                    highlightedReservationIds={
                                      highlightedReservationIds
                                    }
                                    isSearching={isSearching}
                                    flippedReservationIds={
                                      flippedReservationIds
                                    }
                                    memos={memos}
                                    memoRefs={memoRefs}
                                    handleCardFlip={handleCardFlip}
                                    openInvoiceModal={openInvoiceModalHandler}
                                    getPaymentMethodIcon={getPaymentMethodIcon}
                                    renderActionButtons={renderActionButtons}
                                    loadedReservations={loadedReservations}
                                    newlyCreatedId={newlyCreatedId}
                                    isNewlyCreatedHighlighted={
                                      isNewlyCreatedHighlighted
                                    }
                                    updatedReservationId={updatedReservationId}
                                    // isUpdatedHighlighted={isUpdatedHighlighted}
                                    onPartialUpdate={onPartialUpdate}
                                    onEdit={(reservationId, initialData) => {
                                      if (typeof onEdit === 'function') {
                                        onEdit(reservationId, initialData);
                                      } else {
                                        console.error(
                                          'onEdit is not a function in floor section'
                                        );
                                      }
                                    }}
                                    roomTypes={roomTypes}
                                    hotelSettings={hotelSettings}
                                    handleDeleteClickHandler={
                                      handleDeleteClickHandler
                                    }
                                    handleConfirmClickHandler={
                                      handleConfirmClickHandler
                                    }
                                    selectedDate={selectedDate}
                                    filterReservationsByDate={
                                      filterReservationsByDate
                                    }
                                    allReservations={allReservations}
                                    setAllReservations={setAllReservations}
                                    fullReservations={fullReservations}
                                    isMinimalMode={isFloorMinimalMode}
                                  />
                                ))
                              )}
                            </div>
                          </ContainerCell>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
          </>
        )}

        {isProcessing && <p>처리 중...</p>}
        {error && <p className="error-message">{error}</p>}

        {isModalOpen && modalType === 'invoice' && selectedReservation && (
          <InvoiceModal
            isOpen={isModalOpen}
            onRequestClose={closeModalHandler}
            invoiceRef={invoiceRef}
            reservationNo={selectedReservation.reservationNo}
            reservation={selectedReservation}
            hotelId={hotelId}
          />
        )}

        {isLogViewerOpen && (
          <LogViewer logs={logs} onClose={onCloseLogViewer} />
        )}
      </div>
    </div>
  );
}

// RoomGrid.js

RoomGrid.propTypes = {
  reservations: PropTypes.array.isRequired,
  onDelete: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  onEdit: PropTypes.func.isRequired,
  showGuestForm: PropTypes.bool,
  onPartialUpdate: PropTypes.func.isRequired,
  loadedReservations: PropTypes.array.isRequired,
  hotelId: PropTypes.string.isRequired,
  hotelSettings: PropTypes.shape({
    hotelId: PropTypes.string,
    totalRooms: PropTypes.number,
    roomTypes: PropTypes.arrayOf(
      PropTypes.shape({
        roomInfo: PropTypes.string,
        nameKor: PropTypes.string,
        nameEng: PropTypes.string,
        price: PropTypes.number,
        stock: PropTypes.number,
        aliases: PropTypes.arrayOf(PropTypes.string),
        floorSettings: PropTypes.object,
        startRoomNumbers: PropTypes.object,
      })
    ),
    otas: PropTypes.arrayOf(
      PropTypes.shape({
        name: PropTypes.string,
        isActive: PropTypes.bool,
      })
    ),
    otaCredentials: PropTypes.object,
    gridSettings: PropTypes.shape({
      floors: PropTypes.arrayOf(
        PropTypes.shape({
          floorNum: PropTypes.number,
          containers: PropTypes.arrayOf(
            PropTypes.shape({
              containerId: PropTypes.string,
              roomInfo: PropTypes.string,
              roomNumber: PropTypes.string,
              price: PropTypes.number,
              isActive: PropTypes.bool,
            })
          ),
        })
      ),
    }),
    checkInTime: PropTypes.string,
    checkOutTime: PropTypes.string,
    hotelAddress: PropTypes.string,
    phoneNumber: PropTypes.string,
    email: PropTypes.string,
    hotelName: PropTypes.string,
  }), // 필수 항목 아님
  roomTypes: PropTypes.array.isRequired,
  highlightedReservationIds: PropTypes.arrayOf(PropTypes.string),
  isSearching: PropTypes.bool,
  memos: PropTypes.object,
  setMemos: PropTypes.func.isRequired,
  newlyCreatedId: PropTypes.string,
  flipAllMemos: PropTypes.bool.isRequired,
  sortOrder: PropTypes.string,
  selectedDate: PropTypes.instanceOf(Date),
  setSelectedDate: PropTypes.func.isRequired,
  handleRoomChangeAndSync: PropTypes.func.isRequired,
  updatedReservationId: PropTypes.string,
  setAllReservations: PropTypes.func.isRequired,
  filterReservationsByDate: PropTypes.func.isRequired,
  availabilityByDate: PropTypes.object,
  onQuickCreateRange: PropTypes.func.isRequired,
  logs: PropTypes.arrayOf(
    PropTypes.shape({
      timestamp: PropTypes.string.isRequired,
      message: PropTypes.string.isRequired,
      selectedDate: PropTypes.string.isRequired,
    })
  ).isRequired,
  isLogViewerOpen: PropTypes.bool.isRequired,
  onCloseLogViewer: PropTypes.func.isRequired,
  fullReservations: PropTypes.array.isRequired,
  allReservations: PropTypes.array.isRequired,
  isMinimalModeEnabled: PropTypes.bool.isRequired,
  toggleMinimalMode: PropTypes.func.isRequired,
  handleCardFlip: PropTypes.func.isRequired,
};

export default RoomGrid;
