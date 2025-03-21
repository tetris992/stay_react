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

        // 만약 드래그한 아이템의 원래 컨테이너와 현재 대상 컨테이너가 같다면 아무 작업도 하지 않음.
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

        // 자기 자신에게 드랍하는 경우에도 경고 없이 리턴 (추가 안전 체크)
        if (
          reservation.roomInfo === cont.roomInfo &&
          reservation.roomNumber === cont.roomNumber &&
          !reservation.manuallyCheckedOut
        ) {
          clearConflict();
          return;
        }

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
          console.error('Invalid date values for dragged reservation:', {
            checkIn: draggedReservation.checkIn,
            checkOut: draggedReservation.checkOut,
          });
          clearConflict();
          return;
        }

        // 먼저 checkConflict로 충돌 여부 확인
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
            ? `🚫 충돌 발생!\n이동하려는 객실 (${
                cont.roomNumber
              })에 예약이 있습니다.\n충돌 예약: ${
                conflictReservation.customerName || '정보 없음'
              } (${format(
                new Date(conflictReservation.checkIn),
                'yyyy-MM-dd'
              )} ~ ${format(
                new Date(conflictReservation.checkOut),
                'yyyy-MM-dd'
              )})`
            : '🚫 충돌 발생!\n과거 체크인 예약은 이동할 수 없습니다.';
          setConflictMessage(conflictMsg);
          timeoutRef.current = setTimeout(clearConflict, 3000);
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
            fullReservations.filter((res) => !res.manuallyCheckedOut)
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
            availabilityByDate,
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
            ? `🚫 충돌 발생!\n이동하려는 객실 (${
                cont.roomNumber
              })에 예약이 있습니다.\n충돌 예약: ${
                conflictReservation.customerName || '정보 없음'
              } (${format(
                new Date(conflictReservation.checkIn),
                'yyyy-MM-dd'
              )} ~ ${format(
                new Date(conflictReservation.checkOut),
                'yyyy-MM-dd'
              )})`
            : '🚫 충돌 발생!\n과거 체크인 예약은 이동할 수 없습니다.';
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

    // 퇴실된 대실 수 계산 (날짜 이동 시 유지)
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
        <div
          className="container-label"
          style={{
            marginLeft: '5px',
            marginBottom: '5px',
            borderBottom: '1px solid #ddd',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '4px 8px',
            backgroundColor: '#f0f4f8',
            borderRadius: '8px',
            fontWeight: 'bold',
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
              flexGrow: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {cont.roomInfo || '미설정'}
          </span>
          {checkedOutCount > 0 && (
            <span className="checked-out-count">+{checkedOutCount}</span>
          )}
        </div>
        <div
          className="reservation-list"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '5px',
          }}
        >
          {children}
        </div>
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
  logs,
  isLogViewerOpen,
  onCloseLogViewer,
  fullReservations,
  allReservations,
  showGuestForm,
}) {
  const [flippedReservationIds, setFlippedReservationIds] = useState(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [modalType, setModalType] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNewlyCreatedHighlighted, setIsNewlyCreatedHighlighted] =
    useState(false);
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

  // 필터링된 예약 (UI에서 퇴실된 대실 제외)
  const filteredReservations = useMemo(() => {
    const selectedDateString = format(selectedDate, 'yyyy-MM-dd');
    return (reservations || [])
      .filter(
        (reservation) => reservation !== null && reservation !== undefined
      )
      .filter((reservation) => reservation._id)
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
        // UI에서 퇴실된 대실 제외
        if (reservation.type === 'dayUse' && reservation.manuallyCheckedOut) {
          return false;
        }
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
      .filter((res) => !res.roomNumber || res.roomNumber.trim() === '') // 미배정 예약 필터링
      .filter((res) => !res.manuallyCheckedOut) // 퇴실된 예약 제외
      .filter((res) => {
        const checkInDate = new Date(res.checkIn);
        const checkOutDate = new Date(res.checkOut);
        if (isNaN(checkInDate) || isNaN(checkOutDate)) {
          console.warn('Invalid dates in unassigned reservation:', res);
          return false;
        }
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
  }, [fullReservations, selectedDate]);

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
        <div
          style={{
            padding: '10px',
            backgroundColor: '#f0f4f8',
            borderRadius: '8px',
            marginBottom: '10px',
          }}
        >
          {/* 매출 표시 제거: App.js에서 SideBar로 전달됨 */}
        </div>
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
              {/* 미배정 예약 렌더링 섹션 추가 */}
              {filteredUnassignedReservations.length > 0 && (
                <div
                  className="unassigned-section"
                  style={{ marginBottom: '2rem' }}
                >
                  <h3>
                    현재 날짜 미배정 예약:{' '}
                    {filteredUnassignedReservations.length}건
                  </h3>
                  <div
                    className="unassigned-list"
                    style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}
                  >
                    {sortReservations(filteredUnassignedReservations).map(
                      (res, index) => (
                        <div
                          key={`${res._id || res.reservationNo}-${index}`}
                          style={{ width: '320px' }}
                        >
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
                            isNewlyCreatedHighlighted={
                              isNewlyCreatedHighlighted
                            }
                            updatedReservationId={updatedReservationId}
                            isUpdatedHighlighted={isUpdatedHighlighted}
                            onPartialUpdate={onPartialUpdate}
                            roomTypes={roomTypes}
                            isUnassigned={true}
                            handleDeleteClickHandler={handleDeleteClickHandler}
                            handleConfirmClickHandler={
                              handleConfirmClickHandler
                            }
                            selectedDate={selectedDate}
                            filterReservationsByDate={filterReservationsByDate}
                            allReservations={reservations}
                            setAllReservations={setAllReservations}
                            fullReservations={fullReservations}
                          />
                        </div>
                      )
                    )}
                  </div>
                </div>
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
                            fullReservations={fullReservations}
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
                                      filterReservationsByDate={
                                        filterReservationsByDate
                                      }
                                      allReservations={allReservations}
                                      setAllReservations={setAllReservations}
                                      fullReservations={fullReservations}
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
  showGuestForm: PropTypes.bool,
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
  fullReservations: PropTypes.array.isRequired,
  allReservations: PropTypes.array.isRequired,
};

export default RoomGrid;
