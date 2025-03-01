import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import PropTypes from 'prop-types';
import { format } from 'date-fns';
import { useDrop } from 'react-dnd';
import { FaCheck } from 'react-icons/fa';

import './RoomGrid.css';
import InvoiceModal from './InvoiceModal';
import DraggableReservationCard from './DraggableReservationCard';
import { isCancelledStatus } from '../utils/isCancelledStatus';
import {
  isOtaReservation,
  sortContainers,
  getPaymentMethodIcon,
} from '../utils/roomGridUtils';
import { matchRoomType } from '../utils/matchRoomType';
import {
  canMoveToRoom,
  canSwapReservations,
  computeDailyAvailability,
} from '../utils/availability';

import { checkConflict } from '../utils/checkConflict';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrashAlt, faCheck, faEdit } from '@fortawesome/free-solid-svg-icons';

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
  }) => {
    const [{ isOver, canDrop }, dropRef] = useDrop({
      accept: 'RESERVATION',
      drop: (item) => {
        const { reservationId } = item;
        if (cont.roomInfo && cont.roomNumber) {
          const draggedReservation = getReservationById(reservationId);

          // 동일 객실 드래그 시 아무것도 하지 않음
          if (
            draggedReservation.roomInfo === cont.roomInfo &&
            draggedReservation.roomNumber === cont.roomNumber
          ) {
            return;
          }

          // ✅ 여기서 checkConflict 사용하여 충돌 체크 및 상세 정보 제공
          const { isConflict, conflictReservation } = checkConflict(
            draggedReservation,
            cont.roomNumber,
            fullReservations
          );

          if (isConflict) {
            alert(
              `🚫 예약을 이동할 수 없습니다.\n\n` +
                `이동하려는 객실 (${cont.roomNumber}) 에 이미 예약이 있습니다.\n\n` +
                `충돌 예약자: ${conflictReservation.customerName}\n` +
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

            handleEditExtended(reservationId, {
              roomInfo: cont.roomInfo,
              roomNumber: cont.roomNumber,
              manualAssignment: true,
            });

            handleEditExtended(existingReservation._id, {
              roomInfo: draggedReservation.roomInfo,
              roomNumber: draggedReservation.roomNumber,
              manualAssignment: true,
            });
          } else {
            const originalRoomInfo = draggedReservation.roomInfo;
            const originalRoomNumber = draggedReservation.roomNumber;

            handleEditExtended(reservationId, {
              roomInfo: cont.roomInfo,
              roomNumber: cont.roomNumber,
              manualAssignment: true,
            });

            setTimeout(() => {
              const updatedReservations = fullReservations.map((r) =>
                r._id === draggedReservation._id
                  ? {
                      ...r,
                      roomInfo: cont.roomInfo,
                      roomNumber: cont.roomNumber,
                    }
                  : r
              );

              const availabilityByDate = computeDailyAvailability(
                updatedReservations,
                roomTypes,
                draggedReservation.parsedCheckInDate,
                draggedReservation.parsedCheckOutDate,
                gridSettings
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

              if (!canMove) {
                handleEditExtended(reservationId, {
                  roomInfo: originalRoomInfo,
                  roomNumber: originalRoomNumber,
                  manualAssignment: true,
                });

                alert(
                  `예약 이동이 취소되었습니다.\n충돌 발생 날짜: ${conflictDays.join(
                    ', '
                  )} (해당 날짜에 이미 예약이 있습니다.)`
                );
              }
            }, 100);
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
  const [autoAssigning, setAutoAssigning] = useState(false);

  const [selectedReservation, setSelectedReservation] = useState(null);

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
  );

  const getReservationById = useCallback(
    (id) => reservations.find((res) => res._id === id),
    [reservations]
  );

  const filteredReservations = useMemo(() => {
    const selectedDateString = format(selectedDate, 'yyyy-MM-dd');
    return reservations.filter((reservation) => {
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
        (res) => !res.roomNumber || res.roomNumber.trim() === ''
      ),
    [reservations]
  );

  useEffect(() => {
    if (unassignedReservations.length === 0) {
      setShowUnassignedPanel(false);
    }
  }, [unassignedReservations]);

  // (불필요한 디버깅 로그는 제거하였습니다)

  useEffect(() => {
    setAutoAssigning(true);
    if (!allContainers.length || unassignedReservations.length === 0) {
      setAutoAssigning(false);
      return;
    }
    const autoAssignTimer = setTimeout(() => {
      const typeAssignments = getTypeAssignments(reservations, roomTypes);
      const updates = [];

      unassignedReservations.forEach((res) => {
        if (isOtaReservation(res)) return;
        if (res.roomNumber && res.roomNumber.trim() !== '') return;

        const matched = matchRoomType(res.roomInfo, roomTypes);
        if (matched) {
          const typeKey = matched.roomInfo.toLowerCase();
          const containersForType = allContainers.filter(
            (cont) =>
              cont.roomInfo.toLowerCase() === typeKey &&
              cont.roomInfo !== 'none'
          );
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
        }, 10000);
        return () => clearTimeout(timeoutId);
      }
    }
  }, [newlyCreatedId, reservations]);

  useEffect(() => {
    if (isSearching && highlightedReservationIds.length > 0) {
      setIsNewlyCreatedHighlighted(false);
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

  // 모달 닫기 핸들러
  const closeModalHandler = useCallback(() => {
    setIsModalOpen(false);
    setModalType(null);
    setSelectedReservation(null);
  }, []);

  // 모달 열기 핸들러
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

  // 모달 상태 변경 감지 및 자동 열기
  useEffect(() => {
    if (selectedReservation && modalType === 'invoice' && !isModalOpen) {
      setIsModalOpen(true);
    }
  }, [selectedReservation, modalType, isModalOpen]);

  const renderActionButtons = (reservation, onEditStart) => {
    const isOTA = isOtaReservation(reservation);
    const isCancelled =
      isCancelledStatus(
        reservation.reservationStatus || '',
        reservation.customerName || ''
      ) || reservation._id.includes('Canceled');
    const isConfirmed =
      reservation.reservationStatus &&
      reservation.reservationStatus.toLowerCase() === 'confirmed';

    let canDelete = false,
      canConfirm = false,
      canEdit = false;
    if (isOTA) {
      if (!isCancelled && !isConfirmed) canDelete = true;
      if (isCancelled) canDelete = true;
    } else if (reservation.siteName === '현장예약') {
      if (!isConfirmed) canConfirm = true;
      canDelete = true;
      canEdit = true;
    }

    return (
      <span className="button-group">
        {canDelete && (
          <button
            className="action-button delete-button"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteClickHandler(reservation._id, reservation.siteName);
            }}
            data-tooltip="삭제"
          >
            <FontAwesomeIcon icon={faTrashAlt} />
          </button>
        )}
        {canConfirm && !isConfirmed && (
          <button
            className="action-button confirm-button"
            onClick={(e) => {
              e.stopPropagation();
              handleConfirmClickHandler(reservation._id);
            }}
            data-tooltip="확정"
          >
            <FontAwesomeIcon icon={faCheck} />
          </button>
        )}
        {canEdit && (
          <button
            className="action-button edit-button"
            onClick={(e) => {
              e.stopPropagation();
              onEditStart();
            }}
            data-tooltip="수정"
          >
            <FontAwesomeIcon icon={faEdit} />
          </button>
        )}
        {isConfirmed && (
          <span className="confirmed-label">
            <FaCheck title="예약 확정됨" />
          </span>
        )}
      </span>
    );
  };

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
                    onPartialUpdate={onPartialUpdate}
                    roomTypes={roomTypes}
                    isUnassigned={true}
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

// PropTypes 수정 (hotelId를 필수로 유지)
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
  flipAllMemos: PropTypes.bool.isRequired,
  sortOrder: PropTypes.string,
  selectedDate: PropTypes.instanceOf(Date),
};

export default RoomGrid;
