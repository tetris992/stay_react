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
// import { isCancelledStatus } from '../utils/isCancelledStatus';
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

/* ===============================
   [B] ContainerCell
=============================== */
const ContainerCell = React.memo(
  ({
    cont,
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
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    }, []);

    const [{ isOver, canDrop }, dropRef] = useDrop({
      accept: 'RESERVATION',
      drop: async (item, monitor) => {
        if (!monitor.isOver({ shallow: true })) return;

        const {
          reservationId,
          reservation: draggedReservation,
          originalRoomNumber,
          originalRoomInfo,
        } = item;

        if (conflictMessage) {
          console.warn('[drop] 충돌 상태이므로 이동을 취소합니다.');
          clearConflict();
          return;
        }

        if (!cont.roomInfo || !cont.roomNumber) return;

        const reservation = getReservationById(reservationId);
        if (!reservation) {
          console.warn(`No reservation found for ID: ${reservationId}`);
          return;
        }

        if (
          reservation.roomInfo === cont.roomInfo &&
          reservation.roomNumber === cont.roomNumber
        ) {
          clearConflict();
          return;
        }

        const checkInDate = new Date(draggedReservation.checkIn);
        const checkOutDate = new Date(draggedReservation.checkOut);
        if (isNaN(checkInDate) || isNaN(checkOutDate)) {
          console.error('Invalid date values for dragged reservation:', {
            checkIn: draggedReservation.checkIn,
            checkOut: draggedReservation.checkOut,
          });
          clearConflict();
          return;
        }

        if (assignedReservations && assignedReservations.length > 0) {
          const confirmSwap = window.confirm(
            '이미 해당 방에 예약이 있습니다. 두 예약의 위치를 교체하시겠습니까?'
          );
          if (!confirmSwap) {
            await handleEditExtended(reservationId, {
              roomInfo: originalRoomInfo,
              roomNumber: originalRoomNumber,
              checkIn: draggedReservation.checkIn, // 기존 체크인 값 전달
              checkOut: draggedReservation.checkOut, // 기존 체크아웃 값 전달
              manualAssignment: true,
            });
            return;
          }

          const existingReservation = assignedReservations[0];
          const existingCheckInDate = new Date(existingReservation.checkIn);
          const existingCheckOutDate = new Date(existingReservation.checkOut);

          const canSwap = canSwapReservations(
            {
              ...draggedReservation,
              checkIn: checkInDate,
              checkOut: checkOutDate,
            },
            {
              ...existingReservation,
              checkIn: existingCheckInDate,
              checkOut: existingCheckOutDate,
            },
            fullReservations,
            selectedDate
          );
          if (!canSwap) {
            setConflictMessage(
              '스왑이 불가능합니다. 해당 기간에 충돌하는 예약이 있습니다.'
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
            draggedReservation.totalPrice
          );
          await handleRoomChangeAndSync(
            existingReservation._id,
            draggedReservation.roomNumber,
            draggedReservation.roomInfo,
            existingReservation.totalPrice
          );
        } else {
          await handleRoomChangeAndSync(
            reservationId,
            cont.roomNumber,
            cont.roomInfo,
            draggedReservation.totalPrice
          );

          const updatedReservations = fullReservations.map((r) =>
            r._id === draggedReservation._id
              ? {
                  ...r,
                  roomInfo: cont.roomInfo,
                  roomNumber: cont.roomNumber,
                }
              : r
          );

          const viewingDateStart = startOfDay(selectedDate);
          const viewingDateEnd = addDays(viewingDateStart, 1);
          const selectedDates = [
            format(addDays(selectedDate, -1), 'yyyy-MM-dd'),
            format(selectedDate, 'yyyy-MM-dd'),
            format(addDays(selectedDate, 1), 'yyyy-MM-dd'),
          ];

          const availabilityByDate = calculateRoomAvailability(
            updatedReservations,
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
            availabilityByDate,
            updatedReservations,
            draggedReservation._id,
            selectedDate,
            draggedReservation
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
              `Successfully moved reservation ${reservationId} to ${cont.roomNumber}`
            );
          } else {
            const conflictMsg =
              draggedReservation._id === conflictDays.conflictReservation?._id
                ? `과거 체크인 예약은 현재 날짜에서 이동할 수 없습니다.\n체크인 날짜: ${format(
                    checkInDate,
                    'yyyy-MM-dd'
                  )}`
                : draggedReservation.type === 'dayUse'
                ? `대실 예약 이동이 취소되었습니다.\n충돌 발생 시간: ${format(
                    checkInDate,
                    'yyyy-MM-dd HH:mm'
                  )} ~ ${format(checkOutDate, 'yyyy-MM-dd HH:mm')}`
                : `예약 이동이 취소되었습니다.\n충돌 발생 날짜: ${conflictDays.join(
                    ', '
                  )} (해당 날짜에 이미 예약이 있습니다.)`;

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

        const { isConflict } = checkConflict(
          {
            ...draggedReservation,
            checkIn: checkInDate,
            checkOut: checkOutDate,
          },
          cont.roomNumber,
          fullReservations,
          selectedDate
        );

        if (isConflict && !isDraggingOver) {
          const conflictMsg = `🚫 충돌 발생!\n이동하려는 객실 (${cont.roomNumber})에 예약이 있습니다.`;
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

    useEffect(() => {
      if (!isOver && isDraggingOver) {
        timeoutRef.current = setTimeout(clearConflict, 3000);
      }
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }, [isOver, isDraggingOver, clearConflict]);

    return (
      <div
        ref={dropRef}
        className={`grid-cell ${cont.roomInfo === 'none' ? 'empty' : ''}`}
        style={{
          border: '1px solid #ccc',
          borderRadius: '8px',
          padding: '8px',
          position: 'relative',
          minHeight: '400px',
          minWidth: '330px',
          backgroundColor: isOver && canDrop ? '#fff9e3' : 'transparent',
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
        {children}
      </div>
    );
  }
);

ContainerCell.propTypes = {
  cont: PropTypes.object.isRequired,
  onEdit: PropTypes.func.isRequired,
  getReservationById: PropTypes.func.isRequired,
  children: PropTypes.node,
  assignedReservations: PropTypes.array,
  fullReservations: PropTypes.array.isRequired,
  roomTypes: PropTypes.array.isRequired,
  gridSettings: PropTypes.object,
  handleEditExtended: PropTypes.func.isRequired,
  handleRoomChangeAndSync: PropTypes.func.isRequired,
  setAllReservations: PropTypes.func.isRequired,
  filterReservationsByDate: PropTypes.func.isRequired,
  selectedDate: PropTypes.instanceOf(Date),
  hotelSettings: PropTypes.object,
};

/* ===============================
   RoomGrid 컴포넌트
=============================== */
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
  logs, // 프롭으로 전달받음
  isLogViewerOpen, // 프롭으로 전달받음
  onCloseLogViewer, // 프롭으로 전달받음
}) {
  const [flippedReservationIds, setFlippedReservationIds] = useState(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [modalType, setModalType] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNewlyCreatedHighlighted, setIsNewlyCreatedHighlighted] =
    useState(false);
  const [showUnassignedPanel, setShowUnassignedPanel] = useState(true);
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [isUpdatedHighlighted, setIsUpdatedHighlighted] = useState(false);

  const invoiceRef = useRef();
  const gridRef = useRef();
  const memoRefs = useRef({});

  const floors = useMemo(() => {
    const loadedFloors = hotelSettings?.gridSettings?.floors || [];
    return loadedFloors.map((floor) => ({
      ...floor,
      containers: sortContainers([...(floor.containers || [])]),
    }));
  }, [hotelSettings]);

  const getReservationById = useCallback(
    (id) => reservations.find((res) => res._id === id),
    [reservations]
  );

  const filteredReservations = useMemo(() => {
    const selectedDateString = format(selectedDate, 'yyyy-MM-dd');
    return (reservations || [])
      .filter(
        (reservation) => reservation !== null && reservation !== undefined
      )
      .filter((reservation) => reservation._id) // _id가 있는 항목만 필터링
      .filter((reservation) => {
        const checkInDate = new Date(reservation.checkIn);
        const checkOutDate = new Date(reservation.checkOut);
        if (isNaN(checkInDate) || isNaN(checkOutDate)) {
          console.warn('Invalid dates in reservation:', reservation);
          return false;
        }
        return true;
      })
      .filter((reservation) => {
        const checkInDate = new Date(reservation.checkIn);
        const checkOutDate = new Date(reservation.checkOut);
        const checkInDateOnly = startOfDay(checkInDate);
        const checkOutDateOnly = startOfDay(checkOutDate);

        const isIncluded =
          selectedDateString >= format(checkInDateOnly, 'yyyy-MM-dd') &&
          selectedDateString < format(checkOutDateOnly, 'yyyy-MM-dd');

        const isSameDayStay =
          format(checkInDateOnly, 'yyyy-MM-dd') ===
            format(checkOutDateOnly, 'yyyy-MM-dd') &&
          selectedDateString === format(checkInDateOnly, 'yyyy-MM-dd');

        return isIncluded || isSameDayStay;
      });
  }, [reservations, selectedDate]);

  // 선택된 날짜의 예약을 콘솔에 출력
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.groupCollapsed(
        `Reservations for Selected Date: ${format(selectedDate, 'yyyy-MM-dd')}`
      );
      console.table(
        filteredReservations.map((res) => ({
          ID: res._id,
          Customer: res.customerName || '정보 없음',
          CheckIn: format(new Date(res.checkIn), 'yyyy-MM-dd HH:mm'),
          CheckOut: format(new Date(res.checkOut), 'yyyy-MM-dd HH:mm'),
          RoomNumber: res.roomNumber || '미배정',
          RoomInfo: res.roomInfo || '정보 없음',
          Status: res.reservationStatus || '정보 없음',
        }))
      );
      console.groupEnd();
    }
  }, [filteredReservations, selectedDate]);

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

  const unassignedReservations = useMemo(
    () =>
      reservations.filter(
        (res) => !res.roomNumber || res.roomNumber.trim() === ''
      ),
    [reservations]
  );

  useEffect(() => {
    if (unassignedReservations.length === 0) {
      setShowUnassignedPanel(false);
    }
  }, [unassignedReservations]);

  useEffect(() => {
    if (flipAllMemos) {
      const allIds = reservations.map((r) => r._id);
      setFlippedReservationIds(new Set(allIds));
    } else {
      setFlippedReservationIds(new Set());
    }
  }, [flipAllMemos, reservations]);

  useEffect(() => {
    if (newlyCreatedId) {
      setIsNewlyCreatedHighlighted(true);
      const card = document.querySelector(
        `.room-card[data-id="${newlyCreatedId}"]`
      );
      if (card) {
        card.classList.add('onsite-created');
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const timeoutId = setTimeout(() => {
          card.classList.remove('onsite-created');
          setIsNewlyCreatedHighlighted(false);
        }, 10000);
        return () => clearTimeout(timeoutId);
      }
    }
  }, [newlyCreatedId]);

  useEffect(() => {
    if (updatedReservationId) {
      setIsUpdatedHighlighted(true);
      const card = document.querySelector(
        `.room-card[data-id="${updatedReservationId}"]`
      );
      if (card) {
        card.classList.add('onsite-created');
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const timeoutId = setTimeout(() => {
          card.classList.remove('onsite-created');
          setIsUpdatedHighlighted(false);
        }, 10000);
        return () => clearTimeout(timeoutId);
      }
    }
  }, [updatedReservationId]);

  useEffect(() => {
    if (isSearching && highlightedReservationIds.length > 0) {
      setIsNewlyCreatedHighlighted(false);
      setIsUpdatedHighlighted(false);
    }
  }, [isSearching, highlightedReservationIds]);

  const handleCardFlip = (resId) => {
    setFlippedReservationIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(resId)) newSet.delete(resId);
      else newSet.add(resId);
      return newSet;
    });
  };

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
    async (reservationId, updatedData) => {
      await onEdit(reservationId, updatedData);
      setAllReservations((prev) =>
        prev.map((res) =>
          res._id === reservationId ? { ...res, ...updatedData } : res
        )
      );
      filterReservationsByDate(reservations, selectedDate);
      setIsNewlyCreatedHighlighted(false);
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
      // null/undefined 값들을 먼저 제거한 후 정렬
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
        <div>
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
              {showUnassignedPanel && unassignedReservations.length > 0 ? (
                <div
                  className="unassigned-section"
                  style={{ marginBottom: '2rem' }}
                >
                  <div
                    className="unassigned-header"
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <h3>당일 미배정 예약: {unassignedReservations.length}건</h3>
                    <button
                      className="unassigned-header-title-button"
                      onClick={() => setShowUnassignedPanel(false)}
                    >
                      닫기
                    </button>
                  </div>
                  <div
                    className="unassigned-list"
                    style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}
                  >
                    {sortReservations(unassignedReservations).map(
                      (res, index) => (
                        <DraggableReservationCard
                          key={`${res._id || res.reservationNo}-${index}`}
                          reservation={res}
                          hotelId={hotelId}
                          highlightedReservationIds={
                            highlightedReservationIds || []
                          }
                          isSearching={isSearching || false}
                          flippedReservationIds={flippedReservationIds}
                          memos={memos || {}}
                          memoRefs={memoRefs}
                          handleCardFlip={handleCardFlip}
                          onEdit={(reservationId, initialData) => {
                            console.log(
                              `[RoomGrid.js] onEdit prop received in unassigned: ${typeof onEdit}, value:`,
                              onEdit
                            );
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
                          isUpdatedHighlighted={isUpdatedHighlighted}
                          onPartialUpdate={onPartialUpdate}
                          roomTypes={roomTypes}
                          isUnassigned={true}
                          handleDeleteClickHandler={handleDeleteClickHandler}
                          handleConfirmClickHandler={handleConfirmClickHandler}
                          selectedDate={selectedDate}
                        />
                      )
                    )}
                  </div>
                </div>
              ) : (
                unassignedReservations.length > 0 && (
                  <button
                    className="unassigned-header-title-button"
                    onClick={() => setShowUnassignedPanel(true)}
                    style={{
                      cursor: 'pointer',
                      marginLeft: '50px',
                      marginBottom: '15px',
                    }}
                  >
                    당일 미배정 열기
                  </button>
                )
              )}
              {floors
                .slice()
                .reverse()
                .map((floor) => (
                  <div key={floor.floorNum} className="floor-section">
                    <h3 style={{ marginLeft: '10px', color: 'lightslategray' }}>
                      {/* {floor.floorNum}F */}
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
                            getReservationById={getReservationById}
                            assignedReservations={reservationsForCont}
                            fullReservations={reservations}
                            roomTypes={roomTypes}
                            gridSettings={hotelSettings?.gridSettings}
                            handleEditExtended={handleEditExtended}
                            handleRoomChangeAndSync={handleRoomChangeAndSync}
                            setAllReservations={setAllReservations}
                            filterReservationsByDate={filterReservationsByDate}
                            selectedDate={selectedDate}
                            hotelSettings={hotelSettings}
                          >
                            <div
                              className="container-label"
                              style={{
                                marginLeft: '5px',
                                marginBottom: '5px',
                                borderBottom: '1px solid #ddd',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                              }}
                            >
                              <span
                                style={{
                                  fontSize: '1.5rem',
                                  fontWeight: 'bold',
                                  textAlign: 'left',
                                }}
                              >
                                {cont.roomNumber || '미설정'}
                              </span>
                              <span
                                style={{
                                  fontSize: '1rem',
                                  color: 'gray',
                                  marginLeft: '15%',
                                }}
                              >
                                {cont.roomInfo || '미설정'}
                              </span>
                            </div>
                            <div
                              className="reservation-list"
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '5px',
                              }}
                            >
                              {sortedReservations.filter(
                                (rsv) => rsv !== null && rsv !== undefined
                              ).length === 0 ? (
                                <div
                                  style={{ fontStyle: 'italic', color: '#999' }}
                                >
                                  예약 없음
                                </div>
                              ) : (
                                sortedReservations
                                  .filter(
                                    (rsv) => rsv !== null && rsv !== undefined
                                  )
                                  .map((rsv, index) => (
                                    <DraggableReservationCard
                                      key={`${
                                        rsv._id || rsv.reservationNo
                                      }-${index}`}
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
                                      getPaymentMethodIcon={
                                        getPaymentMethodIcon
                                      }
                                      renderActionButtons={renderActionButtons}
                                      loadedReservations={loadedReservations}
                                      newlyCreatedId={newlyCreatedId}
                                      isNewlyCreatedHighlighted={
                                        isNewlyCreatedHighlighted
                                      }
                                      updatedReservationId={
                                        updatedReservationId
                                      }
                                      isUpdatedHighlighted={
                                        isUpdatedHighlighted
                                      }
                                      onPartialUpdate={onPartialUpdate}
                                      onEdit={(reservationId, initialData) => {
                                        console.log(
                                          `[RoomGrid.js] onEdit prop received in floor: ${typeof onEdit}, value:`,
                                          onEdit
                                        );
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
                                    />
                                  ))
                              )}
                            </div>
                          </ContainerCell>
                        );
                      })}
                    </div>
                  </div>
                ))}
            </>
          )}
        </div>
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
          <LogViewer logs={logs} onClose={() => onCloseLogViewer()} />
        )}
      </div>
    </div>
  );
}

RoomGrid.propTypes = {
  reservations: PropTypes.array.isRequired,
  onDelete: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  onEdit: PropTypes.func.isRequired,
  onPartialUpdate: PropTypes.func.isRequired,
  loadedReservations: PropTypes.array.isRequired,
  hotelId: PropTypes.string.isRequired,
  hotelSettings: PropTypes.object.isRequired,
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
};

export default RoomGrid;
