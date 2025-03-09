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
import { isCancelledStatus } from '../utils/isCancelledStatus';
import { renderActionButtons } from '../utils/renderActionButtons';
import {
  isOtaReservation,
  sortContainers,
  getPaymentMethodIcon,
} from '../utils/roomGridUtils';
import { matchRoomType } from '../utils/matchRoomType';
import {
  canMoveToRoom,
  canSwapReservations,
  calculateRoomAvailability,
} from '../utils/availability';
import { checkConflict } from '../utils/checkConflict';

/* ===============================
   HELPER FUNCTIONS
=============================== */
function getTypeAssignments(reservations, roomTypes) {
  const typeAssignments = {};
  roomTypes.forEach((rt) => {
    const typeKey = rt.roomInfo.toLowerCase();
    typeAssignments[typeKey] = reservations
      .filter(
        (r) =>
          r.roomInfo &&
          r.roomInfo.toLowerCase() === typeKey &&
          r.roomNumber &&
          r.roomNumber.trim() !== ''
      )
      .map((r) => r.roomNumber);
  });
  return typeAssignments;
}

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
    setAllReservations, // 추가
    filterReservationsByDate, // 추가
    selectedDate,
  }) => {
    const [{ isOver, canDrop }, dropRef] = useDrop({
      accept: 'RESERVATION',
      drop: async (item) => {
        const { reservationId } = item;
        if (cont.roomInfo && cont.roomNumber) {
          const draggedReservation = getReservationById(reservationId);

          if (!draggedReservation) {
            console.warn(`No reservation found for ID: ${reservationId}`);
            return;
          }

          if (
            draggedReservation.roomInfo === cont.roomInfo &&
            draggedReservation.roomNumber === cont.roomNumber
          ) {
            return;
          }

          // 날짜 유효성 검사
          if (
            !draggedReservation.parsedCheckInDate ||
            !draggedReservation.parsedCheckOutDate ||
            isNaN(draggedReservation.parsedCheckInDate) ||
            isNaN(draggedReservation.parsedCheckOutDate)
          ) {
            console.error('Invalid date values for dragged reservation:', {
              checkIn: draggedReservation.checkIn,
              checkOut: draggedReservation.checkOut,
              parsedCheckInDate: draggedReservation.parsedCheckInDate,
              parsedCheckOutDate: draggedReservation.parsedCheckOutDate,
            });
            alert(
              '드래그된 예약의 날짜 정보가 유효하지 않습니다. 이동이 취소되었습니다.'
            );
            return;
          }

          const { isConflict, conflictReservation } = checkConflict(
            draggedReservation,
            cont.roomNumber,
            fullReservations
          );

          if (isConflict) {
            alert(
              `🚫 예약을 이동할 수 없습니다.\n\n` +
                `이동하려는 객실 (${cont.roomNumber}) 에 이미 예약이 있습니다.\n\n` +
                `충돌 예약자: ${
                  conflictReservation.customerName || '정보 없음'
                }\n` +
                `예약 기간: ${format(
                  new Date(conflictReservation.checkIn),
                  'yyyy-MM-dd'
                )} ~ ${format(
                  new Date(conflictReservation.checkOut),
                  'yyyy-MM-dd'
                )}`
            );
            return;
          }

          const originalRoomInfo = draggedReservation.roomInfo;
          const originalRoomNumber = draggedReservation.roomNumber;

          if (assignedReservations && assignedReservations.length > 0) {
            const confirmSwap = window.confirm(
              '이미 해당 방에 예약이 있습니다. 두 예약의 위치를 교체하시겠습니까?'
            );
            if (!confirmSwap) return;

            const existingReservation = assignedReservations[0];
            if (
              !canSwapReservations(
                draggedReservation,
                existingReservation,
                fullReservations
              )
            ) {
              alert(
                '스왑이 불가능합니다. 해당 기간에 충돌하는 예약이 있습니다.'
              );
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
            // 서버 업데이트
            await handleRoomChangeAndSync(
              reservationId,
              cont.roomNumber,
              cont.roomInfo,
              draggedReservation.totalPrice
            );

            // 임시로 상태 업데이트
            const updatedReservations = fullReservations.map((r) =>
              r._id === draggedReservation._id
                ? {
                    ...r,
                    roomInfo: cont.roomInfo,
                    roomNumber: cont.roomNumber,
                  }
                : r
            );

            // 가용성 계산 및 충돌 체크
            const viewingDateStart = startOfDay(selectedDate);
            const viewingDateEnd = addDays(viewingDateStart, 1);
            const availabilityByDate = calculateRoomAvailability(
              updatedReservations,
              roomTypes,
              viewingDateStart,
              viewingDateEnd,
              gridSettings,
              selectedDate
            );

            const { canMove, conflictDays } = canMoveToRoom(
              cont.roomNumber,
              cont.roomInfo.toLowerCase(),
              draggedReservation.parsedCheckInDate,
              draggedReservation.parsedCheckOutDate,
              availabilityByDate,
              updatedReservations,
              draggedReservation._id
            );

            if (canMove) {
              // UI 즉시 갱신
              setAllReservations((prev) => {
                const updated = prev.map((r) =>
                  r._id === draggedReservation._id
                    ? {
                        ...r,
                        roomInfo: cont.roomInfo,
                        roomNumber: cont.roomNumber,
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
              // 충돌이 있으면 원래 상태로 복구
              handleEditExtended(reservationId, {
                roomInfo: originalRoomInfo,
                roomNumber: originalRoomNumber,
                manualAssignment: true,
              });

              const conflictMessage =
                draggedReservation.type === 'dayUse'
                  ? `대실 예약 이동이 취소되었습니다.\n충돌 발생 시간: ${format(
                      draggedReservation.parsedCheckInDate,
                      'yyyy-MM-dd HH:mm'
                    )} ~ ${format(
                      draggedReservation.parsedCheckOutDate,
                      'yyyy-MM-dd HH:mm'
                    )}`
                  : `예약 이동이 취소되었습니다.\n충돌 발생 날짜: ${conflictDays.join(
                      ', '
                    )} (해당 날짜에 이미 예약이 있습니다.)`;

              alert(conflictMessage);
            }
          }
        }
      },
      collect: (monitor) => ({
        isOver: monitor.isOver(),
        canDrop: monitor.canDrop(),
      }),
    });

    return (
      <div
        ref={dropRef}
        className={`grid-cell ${cont.roomInfo === 'none' ? 'empty' : ''}`}
        style={{
          border: '1px solid #ccc',
          borderRadius: '8px',
          padding: '8px',
          position: 'relative',
          minHeight: '340px',
          minWidth: '280px',
          backgroundColor: isOver && canDrop ? '#fff9e3' : 'transparent',
        }}
      >
        {children}
      </div>
    );
  }
);

// ContainerCell PropTypes에 setAllReservations와 filterReservationsByDate 추가
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
  setAllReservations: PropTypes.func.isRequired, // 추가
  filterReservationsByDate: PropTypes.func.isRequired, // 추가
  selectedDate: PropTypes.instanceOf(Date),
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
  handleRoomChangeAndSync,
  updatedReservationId,
  setAllReservations, // 추가
  filterReservationsByDate, // 추가
}) {
  const [flippedReservationIds, setFlippedReservationIds] = useState(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [modalType, setModalType] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNewlyCreatedHighlighted, setIsNewlyCreatedHighlighted] =
    useState(false);
  const [showUnassignedPanel, setShowUnassignedPanel] = useState(true);
  // eslint-disable-next-line
  const [autoAssigning, setAutoAssigning] = useState(false); // 중요한 기능 유지

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

  const allContainers = useMemo(
    () => floors.flatMap((floor) => floor.containers || []),
    [floors]
  ); // 중요한 기능 유지

  const getReservationById = useCallback(
    (id) => reservations.find((res) => res._id === id),
    [reservations]
  );

  const filteredReservations = useMemo(() => {
    const selectedDateString = format(selectedDate, 'yyyy-MM-dd');
    return reservations.filter((reservation) => {
      // 취소된 예약 필터링: isCancelledStatus로 확인
      if (
        isCancelledStatus(
          reservation.reservationStatus || '',
          reservation.customerName || '',
          reservation.roomInfo || '',
          reservation.reservationNo || ''
        )
      ) {
        return false;
      }
      const { parsedCheckInDate, parsedCheckOutDate } = reservation;
      if (!parsedCheckInDate || !parsedCheckOutDate) return false;
      const checkInDateOnly = new Date(
        parsedCheckInDate.getFullYear(),
        parsedCheckInDate.getMonth(),
        parsedCheckInDate.getDate()
      );
      const checkOutDateOnly = new Date(
        parsedCheckOutDate.getFullYear(),
        parsedCheckOutDate.getMonth(),
        parsedCheckOutDate.getDate()
      );
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

  const unassignedReservations = useMemo(
    () =>
      reservations.filter(
        (res) =>
          (!res.roomNumber || res.roomNumber.trim() === '') &&
          !isCancelledStatus(
            res.reservationStatus || '',
            res.customerName || '',
            res.roomInfo || '',
            res.reservationNo || ''
          )
      ),
    [reservations]
  );

  useEffect(() => {
    if (unassignedReservations.length === 0) {
      setShowUnassignedPanel(false);
    }
  }, [unassignedReservations]);

  useEffect(() => {
    setAutoAssigning(true); // 중요한 기능 유지
    if (!allContainers.length || unassignedReservations.length === 0) {
      setAutoAssigning(false);
      return;
    }
    const autoAssignTimer = setTimeout(() => {
      const typeAssignments = getTypeAssignments(reservations, roomTypes); // 중요한 기능 유지
      const updates = [];

      unassignedReservations.forEach((res) => {
        if (
          isCancelledStatus(
            res.reservationStatus || '',
            res.customerName || '',
            res.roomInfo || '',
            res.reservationNo || ''
          )
        )
          return; // 취소된 예약은 자동 할당에서 제외
        if (isOtaReservation(res)) return; // 중요한 기능 유지
        if (res.roomNumber && res.roomNumber.trim() !== '') return;

        const matched = matchRoomType(res.roomInfo, roomTypes);
        if (matched) {
          const typeKey = matched.roomInfo.toLowerCase();
          const containersForType = allContainers.filter(
            (cont) =>
              cont.roomInfo.toLowerCase() === typeKey &&
              cont.roomInfo !== 'none'
          ); // 중요한 기능 유지
          const sortedContainers = sortContainers(containersForType);
          const assignedRoomNumbers = typeAssignments[typeKey] || [];
          const availableContainer = sortedContainers.find(
            (cont) => !assignedRoomNumbers.includes(cont.roomNumber)
          );
          if (availableContainer) {
            assignedRoomNumbers.push(availableContainer.roomNumber);
            typeAssignments[typeKey] = assignedRoomNumbers;
            updates.push({
              id: res._id,
              roomInfo: availableContainer.roomInfo,
              roomNumber: availableContainer.roomNumber,
            });
          }
        }
      });

      if (updates.length > 0) {
        updates.forEach((u) => {
          onEdit(u.id, {
            roomInfo: u.roomInfo,
            roomNumber: u.roomNumber,
          });
        });
      }
      setAutoAssigning(false);
    }, 1000);

    return () => {
      clearTimeout(autoAssignTimer);
      setAutoAssigning(false);
    };
  }, [unassignedReservations, allContainers, onEdit, roomTypes, reservations]);

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
        }, 10000); // 10초 후 강조 해제
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
      setIsNewlyCreatedHighlighted(false);
    },
    [onEdit]
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
      if (sortOrder === 'roomType') {
        return [...list].sort((a, b) => {
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
        return [...list].sort((a, b) => {
          const A = new Date(a.checkIn);
          const B = new Date(b.checkIn);
          return sortOrder === 'newest' ? B - A : A - B;
        });
      }
    },
    [sortOrder, roomTypes]
  );

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
                {sortReservations(unassignedReservations).map((res) => (
                  <DraggableReservationCard
                    key={res._id}
                    reservation={res}
                    hotelId={hotelId}
                    highlightedReservationIds={highlightedReservationIds || []}
                    isSearching={isSearching || false}
                    flippedReservationIds={flippedReservationIds}
                    memos={memos || {}}
                    memoRefs={memoRefs}
                    handleCardFlip={handleCardFlip}
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
                  />
                ))}
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
                  {floor.floorNum}F
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
                        setAllReservations={setAllReservations} // 추가
                        filterReservationsByDate={filterReservationsByDate} // 추가
                        selectedDate={selectedDate}
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
                          {sortedReservations.length === 0 ? (
                            <div style={{ fontStyle: 'italic', color: '#999' }}>
                              예약 없음
                            </div>
                          ) : (
                            sortedReservations.map((rsv) => (
                              <DraggableReservationCard
                                key={rsv._id}
                                reservation={rsv}
                                hotelId={hotelId}
                                highlightedReservationIds={
                                  highlightedReservationIds
                                }
                                isSearching={isSearching}
                                flippedReservationIds={flippedReservationIds}
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
                                onPartialUpdate={onPartialUpdate}
                                roomTypes={roomTypes}
                                handleDeleteClickHandler={
                                  handleDeleteClickHandler
                                }
                                handleConfirmClickHandler={
                                  handleConfirmClickHandler
                                }
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
      </div>
    </div>
  );
}

// RoomGrid PropTypes에 setAllReservations와 filterReservationsByDate 추가
RoomGrid.propTypes = {
  reservations: PropTypes.array.isRequired,
  onDelete: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  onEdit: PropTypes.func.isRequired,
  onPartialUpdate: PropTypes.func.isRequired,
  loadedReservations: PropTypes.array.isRequired,
  hotelId: PropTypes.string.isRequired,
  roomTypes: PropTypes.array.isRequired,
  highlightedReservationIds: PropTypes.arrayOf(PropTypes.string),
  isSearching: PropTypes.bool,
  newlyCreatedId: PropTypes.string,
  updatedReservationId: PropTypes.string,
  setAllReservations: PropTypes.func.isRequired, // 추가
  filterReservationsByDate: PropTypes.func.isRequired, // 추가
  flipAllMemos: PropTypes.bool.isRequired,
  sortOrder: PropTypes.string,
  selectedDate: PropTypes.instanceOf(Date),
};

export default RoomGrid;
