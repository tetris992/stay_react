// src/components/RoomGrid.js
import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import './RoomGrid.css';
import PropTypes from 'prop-types';
import InvoiceModal from './InvoiceModal';
import { format, parseISO, addDays } from 'date-fns';
import {
  FaFileInvoice,
  FaCreditCard,
  FaMoneyBillWave,
  FaUniversity,
  FaHourglassHalf,
  FaCheck,
  FaPen,
} from 'react-icons/fa';

import availableOTAs from '../config/availableOTAs';
import { extractPrice } from '../utils/extractPrice';
import { isCancelledStatus } from '../utils/isCancelledStatus';
import { getPriceForDisplay } from '../utils/getPriceForDisplay';
import { matchRoomType } from '../utils/matchRoomType';
// DnD hooks
import { useDrag, useDrop } from 'react-dnd';

/* ===============================
   HELPER FUNCTIONS
=============================== */
// OTA 예약 판별
function isOtaReservation(reservation) {
  return availableOTAs.includes(reservation.siteName);
}

// 컨테이너 배열 정렬 (숫자 우선)
function sortContainers(containers) {
  return containers.sort((a, b) => {
    const aNum = parseInt(a.roomNumber, 10);
    const bNum = parseInt(b.roomNumber, 10);
    if (!isNaN(aNum) && !isNaN(bNum)) {
      return aNum - bNum;
    }
    return a.roomNumber.localeCompare(b.roomNumber);
  });
}

// 각 객실타입별로 이미 배정된 roomNumber 목록 계산
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
   기존 getBorderColor 함수 (변경없음)
=============================== */
function getBorderColor(reservation) {
  try {
    const ci = reservation.parsedCheckInDate;
    const co = reservation.parsedCheckOutDate;
    if (!ci || !co || isNaN(ci.getTime()) || isNaN(co.getTime())) {
      throw new Error('Invalid date');
    }
    const hasDaesil =
      (reservation.customerName && reservation.customerName.includes('대실')) ||
      (reservation.roomInfo && reservation.roomInfo.includes('대실'));
    if (hasDaesil) {
      return 'border-primary-soft-green';
    }
    const ciOnly = new Date(ci.getFullYear(), ci.getMonth(), ci.getDate());
    const coOnly = new Date(co.getFullYear(), co.getMonth(), co.getDate());
    const diff = (coOnly - ciOnly) / (1000 * 60 * 60 * 24);
    if (diff === 0) {
      return 'border-primary-soft-green';
    } else if (diff === 1) {
      return 'border-accent-coral';
    } else if (diff >= 2) {
      return 'border-primary-deep-blue';
    }
    return '';
  } catch (err) {
    console.error('getBorderColor error', err);
    return '';
  }
}

/* ===============================
   [A] DraggableReservationCard 컴포넌트 (변경없음)
=============================== */
const DraggableReservationCard = React.memo(
  ({
    reservation,
    globalIndex,
    hotelId,
    highlightedReservationIds,
    isSearching,
    flippedIndexes,
    autoFlips,
    memos,
    memoRefs,
    loadedReservations,
    handleCardFlip,
    toggleMemoEdit,
    handleMemoChange,
    handleMemoSave,
    handleMemoCancel,
    openInvoiceModal,
    getPaymentMethodIcon,
    renderActionButtons,
  }) => {
    const [{ isDragging }, dragRef] = useDrag({
      type: 'RESERVATION',
      item: {
        reservationId: reservation._id,
        reservationData: reservation,
      },
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
    });

    const isHighlighted =
      highlightedReservationIds.includes(reservation._id) && isSearching;
    const isCancelled =
      isCancelledStatus(
        reservation.reservationStatus || '',
        reservation.customerName || ''
      ) || reservation._id.includes('Canceled');

    const ciDateOnly = new Date(
      reservation.parsedCheckInDate.getFullYear(),
      reservation.parsedCheckInDate.getMonth(),
      reservation.parsedCheckInDate.getDate()
    );
    const coDateOnly = new Date(
      reservation.parsedCheckOutDate.getFullYear(),
      reservation.parsedCheckOutDate.getMonth(),
      reservation.parsedCheckOutDate.getDate()
    );
    const diffDays = (coDateOnly - ciDateOnly) / (1000 * 60 * 60 * 24);
    let stayLabel = '';
    if (diffDays === 0) {
      stayLabel = '(대실)';
    } else if (diffDays === 1 && reservation.customerName.includes('대실')) {
      stayLabel = '(대실)';
    } else if (diffDays === 1) {
      stayLabel = '(1박)';
    } else if (diffDays >= 2) {
      stayLabel = `(${diffDays}박)`;
    }

    const isEditing = false; // 이 컴포넌트에서는 편집 모드 관련 처리는 하지 않음
    const isFirstCard = globalIndex === 0;
    const isFlipped = flippedIndexes.has(globalIndex);
    const memo = memos[reservation._id] || { text: '', isEditing: false };

    const borderColorClass = getBorderColor(reservation);
    const cardClassNames = [
      'room-card',
      borderColorClass,
      isCancelled ? 'cancelled' : '',
      isHighlighted ? 'highlighted' : '',
      isEditing ? 'edit-mode' : '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div
        ref={dragRef}
        className={cardClassNames}
        data-id={reservation._id}
        style={{
          cursor: isEditing ? 'default' : 'pointer',
          transition: 'opacity 0.2s ease-in-out',
          opacity: isDragging ? 0.5 : 1,
        }}
        onClick={() => {
          if (!memo.isEditing && !isEditing) {
            handleCardFlip(globalIndex, reservation._id);
          }
        }}
      >
        <div
          className={`flip-container ${
            isFlipped && !isEditing ? 'flipped' : ''
          } ${isFirstCard && autoFlips.has(globalIndex) ? 'auto-flip' : ''}`}
          style={{ cursor: isEditing ? 'default' : 'pointer' }}
        >
          <div className="room-card-inner">
            {/* 카드 앞면 */}
            <div className="room-card-front">
              <div className="card-content">
                <div className="card-header">
                  <h3>
                    {`No.${globalIndex + 1}`} {stayLabel}{' '}
                    {renderActionButtons(reservation)}
                  </h3>
                </div>
                <p>{reservation._id.replace(`${hotelId}-`, '')}</p>
                <p>예약자: {reservation.customerName || '정보 없음'}</p>
                <p>
                  체크인:{' '}
                  {reservation.parsedCheckInDate
                    ? format(reservation.parsedCheckInDate, 'yyyy-MM-dd HH:mm')
                    : '정보 없음'}
                </p>
                <p>
                  체크아웃:{' '}
                  {reservation.parsedCheckOutDate
                    ? format(reservation.parsedCheckOutDate, 'yyyy-MM-dd HH:mm')
                    : '정보 없음'}
                </p>
                <p>가격: {getPriceForDisplay(reservation)}</p>
                <p>
                  객실 정보:{' '}
                  {reservation.roomInfo && reservation.roomInfo.length > 30
                    ? `${reservation.roomInfo.substring(0, 21)}...`
                    : reservation.roomInfo || '정보 없음'}
                </p>
                <p>
                  예약일:{' '}
                  {reservation.reservationDate
                    ? format(
                        parseISO(reservation.reservationDate),
                        'yyyy-MM-dd'
                      )
                    : '정보 없음'}
                </p>
                {reservation.phoneNumber && (
                  <p>전화번호: {reservation.phoneNumber}</p>
                )}
                <p>고객요청: {reservation.specialRequests || '없음'}</p>
                <p className="payment-method">
                  결제방법: {getPaymentMethodIcon(reservation.paymentMethod)}{' '}
                  {reservation.paymentMethod || '정보 없음'}
                </p>
              </div>
              <div
                className="site-info-wrapper"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  borderTop: '1px solid #ddd',
                  paddingTop: '5px',
                }}
              >
                <p className="site-info" style={{ margin: 0 }}>
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
                    openInvoiceModal(reservation);
                  }}
                  title="인보이스 보기"
                  style={{ display: 'inline-flex', verticalAlign: 'middle' }}
                >
                  <FaFileInvoice size={20} />
                </button>
              </div>
            </div>
            {/* 카드 뒷면 (메모 영역) */}
            <div className="room-card-back">
              <div className="memo-header">
                <span>Memo</span>
                {!memo.isEditing ? (
                  <button
                    className="memo-edit-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMemoEdit(reservation._id);
                    }}
                  >
                    <FaPen />
                  </button>
                ) : (
                  <span className="memo-edit-actions">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMemoSave(reservation._id);
                      }}
                    >
                      Save
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMemoCancel(reservation._id);
                      }}
                    >
                      Cancel
                    </button>
                  </span>
                )}
              </div>
              <div className="memo-body">
                {!memo.isEditing ? (
                  <div className="memo-text-display">{memo.text || ''}</div>
                ) : (
                  <textarea
                    ref={(el) => (memoRefs.current[reservation._id] = el)}
                    value={memo.text}
                    onChange={(e) =>
                      handleMemoChange(reservation._id, e.target.value)
                    }
                    className="memo-textarea"
                  />
                )}
              </div>
            </div>
          </div>
        </div>
        {loadedReservations.includes(reservation._id) && (
          <div className="fade-in-overlay"></div>
        )}
      </div>
    );
  }
);

DraggableReservationCard.propTypes = {
  reservation: PropTypes.object.isRequired,
  globalIndex: PropTypes.number.isRequired,
  hotelId: PropTypes.string.isRequired,
  highlightedReservationIds: PropTypes.array.isRequired,
  isSearching: PropTypes.bool,
  flippedIndexes: PropTypes.instanceOf(Set).isRequired,
  autoFlips: PropTypes.instanceOf(Set).isRequired,
  memos: PropTypes.object.isRequired,
  memoRefs: PropTypes.object.isRequired, // 추가
  handleCardFlip: PropTypes.func.isRequired,
  toggleMemoEdit: PropTypes.func.isRequired,
  handleMemoChange: PropTypes.func.isRequired,
  handleMemoSave: PropTypes.func.isRequired,
  handleMemoCancel: PropTypes.func.isRequired,
  openInvoiceModal: PropTypes.func.isRequired,
  getPaymentMethodIcon: PropTypes.func.isRequired,
  renderActionButtons: PropTypes.func.isRequired,
  loadedReservations: PropTypes.array, // 선택적
};

/* ===============================
   [B] ContainerCell 컴포넌트 (변경없음)
=============================== */
const ContainerCell = React.memo(
  ({ cont, onEdit, getReservationById, children, assignedReservations }) => {
    const [{ isOver, canDrop }, dropRef] = useDrop({
      accept: 'RESERVATION',
      drop: (item) => {
        const { reservationId } = item;
        if (cont.roomInfo && cont.roomNumber) {
          const draggedReservation = getReservationById(reservationId);
          if (assignedReservations && assignedReservations.length > 0) {
            const confirmSwap = window.confirm(
              '이미 해당 방에 예약이 있습니다. 두 예약의 위치를 교체하시겠습니까?'
            );
            if (!confirmSwap) return;
            const existingReservation = assignedReservations[0];
            console.log(
              `[Drop] Before move: Reservation ${reservationId} is in room ${draggedReservation?.roomNumber} (${draggedReservation?.roomInfo})`
            );
            onEdit(reservationId, {
              roomInfo: cont.roomInfo,
              roomNumber: cont.roomNumber,
              manualAssignment: true,
            });
            if (
              draggedReservation &&
              existingReservation &&
              draggedReservation.roomNumber &&
              draggedReservation.roomInfo
            ) {
              onEdit(existingReservation._id, {
                roomInfo: draggedReservation.roomInfo,
                roomNumber: draggedReservation.roomNumber,
                manualAssignment: true,
              });
              console.log(
                `[Drop] After move: Reservation ${reservationId} is now in room ${cont.roomNumber} (${cont.roomInfo})`
              );
            }
          } else {
            if (
              draggedReservation &&
              draggedReservation.roomInfo === cont.roomInfo &&
              draggedReservation.roomNumber === cont.roomNumber
            ) {
              return;
            }
            console.log(
              `[Drop] Moving reservation ${reservationId} to room ${cont.roomNumber} (${cont.roomInfo})`
            );
            onEdit(reservationId, {
              roomInfo: cont.roomInfo,
              roomNumber: cont.roomNumber,
              manualAssignment: true,
            });
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
        className="grid-cell"
        style={{
          border: '1px solid #ccc',
          borderRadius: '8px',
          padding: '8px',
          position: 'relative',
          minHeight: '200px',
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
};

/* ===============================
   RoomGrid 컴포넌트 (자동 배정 로직 리팩토링)
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
  highlightFirstCard,
  hotelAddress,
  phoneNumber,
  email,
  roomTypes,
  highlightedReservationIds,
  isSearching,
  memos,
  setMemos,
  newlyCreatedId,
  flipAllMemos,
  sortOrder,
  needsConsent,
  selectedDate,
}) {
  // state 및 ref 선언 (변경없음)
  const [isEvening, setIsEvening] = useState(false);
  const [flippedIndexes, setFlippedIndexes] = useState(new Set());
  const [autoFlips, setAutoFlips] = useState(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [modalType, setModalType] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState(null);

  const invoiceRef = useRef();
  const gridRef = useRef();
  const memoRefs = useRef({});

  const [editedValues, setEditedValues] = useState({});
  const [autoAssigning, setAutoAssigning] = useState(false);

  const { gridSettings = {} } = hotelSettings || {};
  const { rows = 7, cols = 7, containers = [] } = gridSettings;

  const getReservationById = useCallback(
    (id) => reservations.find((res) => res._id === id),
    [reservations]
  );

  const fixedContainers = useMemo(() => {
    if (containers && containers.length > 0) {
      return containers;
    }
    const defaultContainers = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        defaultContainers.push({
          containerId: `${r}-${c}`,
          row: r,
          col: c,
          roomInfo: '',
          roomNumber: '',
          price: 0,
        });
      }
    }
    return defaultContainers;
  }, [containers, rows, cols]);

  // 당일 예약 목록 계산 (filteredReservations)
  const filteredReservations = useMemo(() => {
    const selectedDateString = format(selectedDate, 'yyyy-MM-dd');
    return reservations.filter((reservation) => {
      const checkInDate = reservation.parsedCheckInDate;
      const checkOutDate = reservation.parsedCheckOutDate;
      if (!checkInDate || !checkOutDate) return false;
      const checkInDateOnly = new Date(
        checkInDate.getFullYear(),
        checkInDate.getMonth(),
        checkInDate.getDate()
      );
      const checkOutDateOnly = new Date(
        checkOutDate.getFullYear(),
        checkOutDate.getMonth(),
        checkOutDate.getDate()
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

  useEffect(() => {
    console.log('당일 예약:', filteredReservations);
  }, [filteredReservations]);

  const containerReservations = useMemo(() => {
    const map = {};
    fixedContainers.forEach((cont) => {
      map[cont.containerId] = [];
    });
    filteredReservations.forEach((res) => {
      const matched = fixedContainers.find(
        (c) =>
          (c.roomInfo || '').toLowerCase() ===
            (res.roomInfo || '').toLowerCase() &&
          c.roomNumber === res.roomNumber
      );
      if (matched) {
        map[matched.containerId].push(res);
      }
    });
    return map;
  }, [fixedContainers, filteredReservations]);

  // 미배정 예약 목록 계산 (한 번만 선언)
  const unassignedReservations = useMemo(() => {
    // 단순히 roomNumber가 빈 경우에만 미배정으로 간주합니다.
    const unassigned = reservations.filter(
      (res) => !res.roomNumber || res.roomNumber.trim() === ''
    );
    // _id 기준 중복 제거 (선택사항)
    const uniqueUnassigned = Array.from(new Map(unassigned.map(res => [res._id, res])).values());
    return uniqueUnassigned;
  }, [reservations]);
  
  

  useEffect(() => {
    console.log('미배정 예약:', unassignedReservations);
  }, [unassignedReservations]);

  // -------------------------------
  // 자동 배정 로직 (중복 코드 리팩토링)
  // -------------------------------
  const autoAssignTimerRef = useRef(null);
  useEffect(() => {
    setAutoAssigning(true);
    if (autoAssignTimerRef.current) {
      clearTimeout(autoAssignTimerRef.current);
    }
    if (!fixedContainers.length) {
      console.log('[RoomGrid] No fixedContainers, skip auto-assignment');
      setAutoAssigning(false);
      return;
    }
    if (unassignedReservations.length === 0) {
      console.log('[RoomGrid] No unassignedReservations, skip auto-assignment');
      setAutoAssigning(false);
      return;
    }
    console.log('[RoomGrid] Auto-assignment useEffect triggered.');

    autoAssignTimerRef.current = setTimeout(() => {
      // 1. 각 타입별로 이미 배정된 roomNumber 목록 계산
      const typeAssignments = getTypeAssignments(reservations, roomTypes);
      const updates = [];

      // 2. 미배정 예약 순회
      unassignedReservations.forEach((res) => {
        if (isOtaReservation(res)) {
          console.log(
            `[RoomGrid] Skipping auto-assignment for OTA reservation: ${res._id}`
          );
          return;
        }
        if (res.roomNumber && res.roomNumber.trim() !== '') {
          console.log(
            '[RoomGrid] Skip auto-assign because roomNumber is already set:',
            res._id,
            res.roomNumber
          );
          return;
        }
        console.log('[RoomGrid] Trying matchRoomType with:', res.roomInfo);
        const matched = matchRoomType(res.roomInfo, roomTypes);
        console.log('[RoomGrid] matched =>', matched);
        if (matched) {
          const typeKey = matched.roomInfo.toLowerCase();
          const containersForType = fixedContainers.filter(
            (cont) => cont.roomInfo.toLowerCase() === typeKey
          );
          const sortedContainers = sortContainers(containersForType);
          const assignedRoomNumbers = typeAssignments[typeKey] || [];
          const availableContainer = sortedContainers.find(
            (cont) => !assignedRoomNumbers.includes(cont.roomNumber)
          );
          if (availableContainer) {
            console.log(
              '[RoomGrid] Auto-assign found container:',
              availableContainer,
              ' for reservation:',
              res._id
            );
            assignedRoomNumbers.push(availableContainer.roomNumber);
            typeAssignments[typeKey] = assignedRoomNumbers;
            updates.push({
              id: res._id,
              roomInfo: availableContainer.roomInfo,
              roomNumber: availableContainer.roomNumber,
            });
          } else {
            console.log(
              '[RoomGrid] No available container found for type:',
              matched.roomInfo
            );
          }
        }
      });

      // 3. 업데이트가 있으면 onEdit 호출
      if (updates.length > 0) {
        console.log(
          '[RoomGrid] Will batch update these unassigned reservations =>',
          updates
        );
        updates.forEach((update) => {
          console.log('[RoomGrid] onEdit called with:', update);
          onEdit(update.id, {
            roomInfo: update.roomInfo,
            roomNumber: update.roomNumber,
          });
        });
      } else {
        console.log('[RoomGrid] No updates to make in auto-assignment.');
      }
      setAutoAssigning(false);
    }, 1000);

    return () => {
      if (autoAssignTimerRef.current) {
        clearTimeout(autoAssignTimerRef.current);
        setAutoAssigning(false);
      }
    };
  }, [
    unassignedReservations,
    fixedContainers,
    onEdit,
    roomTypes,
    reservations,
    containers,
  ]);

  // -------------------------------
  // 나머지 효과 및 렌더링 (변경없음)
  // -------------------------------
  useEffect(() => {
    if (flipAllMemos) {
      const allIndexes = new Set();
      reservations.forEach((_, idx) => allIndexes.add(idx));
      setFlippedIndexes(allIndexes);
    } else {
      setFlippedIndexes(new Set());
    }
  }, [flipAllMemos, reservations]);

  useEffect(() => {
    if (newlyCreatedId) {
      const card = document.querySelector(
        `.room-card[data-id="${newlyCreatedId}"]`
      );
      if (card) {
        card.classList.add('onsite-created');
        setTimeout(() => {
          card.classList.remove('onsite-created');
        }, 10000);
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [reservations, newlyCreatedId]);

  useEffect(() => {
    if (reservations.length > 0 && highlightFirstCard) {
      const firstIndex = 0;
      setAutoFlips((prev) => {
        const next = new Set(prev);
        next.add(firstIndex);
        return next;
      });
      const t = setTimeout(() => {
        setAutoFlips((prev) => {
          const next = new Set(prev);
          next.delete(firstIndex);
          return next;
        });
      }, 4000);
      return () => clearTimeout(t);
    }
  }, [reservations, highlightFirstCard]);

  useEffect(() => {
    const updateIsEvening = () => {
      const now = new Date();
      const hour = now.getHours();
      const night = hour >= 2 && hour < 6;
      setIsEvening(night);
      let nextT;
      if (night) {
        nextT = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          6,
          0,
          0,
          0
        );
      } else {
        const tomorrow = hour >= 6 ? now.getDate() + 1 : now.getDate();
        nextT = new Date(
          now.getFullYear(),
          now.getMonth(),
          tomorrow,
          2,
          0,
          0,
          0
        );
      }
      const diff = nextT - now;
      setTimeout(updateIsEvening, diff);
    };
    updateIsEvening();
  }, []);

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('localMemos') || '{}');
    setMemos(saved);
  }, [setMemos]);

  const toggleMemoEditHandler = useCallback(
    (reservationId) => {
      setMemos((prev) => {
        const cur = prev[reservationId] || { text: '', isEditing: false };
        const nextEditing = !cur.isEditing;
        const updated = {
          ...prev,
          [reservationId]: { ...cur, isEditing: nextEditing },
        };
        if (nextEditing) {
          setTimeout(() => {
            if (memoRefs.current[reservationId]) {
              memoRefs.current[reservationId].focus();
            }
          }, 0);
        }
        return updated;
      });
    },
    [setMemos]
  );

  const handleMemoChangeHandler = useCallback(
    (reservationId, value) => {
      setMemos((prev) => ({
        ...prev,
        [reservationId]: { ...prev[reservationId], text: value },
      }));
    },
    [setMemos]
  );

  const handleMemoSaveHandler = useCallback(
    (reservationId) => {
      setMemos((prev) => {
        const updated = {
          ...prev,
          [reservationId]: { ...prev[reservationId], isEditing: false },
        };
        localStorage.setItem('localMemos', JSON.stringify(updated));
        return updated;
      });
    },
    [setMemos]
  );

  const handleMemoCancelHandler = useCallback(
    (reservationId) => {
      setMemos((prev) => ({
        ...prev,
        [reservationId]: { ...prev[reservationId], isEditing: false },
      }));
    },
    [setMemos]
  );

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

  const handleEditSaveHandler = useCallback(
    async (resId, updated) => {
      setIsProcessing(true);
      setError(null);
      try {
        const ciStr = updated.checkInDate || null;
        const coStr = updated.checkOutDate || null;
        if (ciStr) {
          const d = new Date(ciStr);
          d.setHours(14, 0, 0, 0);
          updated.checkIn = d.toISOString();
        }
        if (coStr) {
          const d = new Date(coStr);
          d.setHours(11, 0, 0, 0);
          updated.checkOut = d.toISOString();
        }
        delete updated.checkInDate;
        delete updated.checkOutDate;
        await onEdit(resId, updated, hotelId);
        alert('예약이 수정되었습니다.');
        const card = document.querySelector(`.room-card[data-id="${resId}"]`);
        if (card) {
          card.classList.add('temporary-highlight');
          setTimeout(() => {
            card.classList.remove('temporary-highlight');
          }, 10000);
        }
        setSelectedReservation(null);
      } catch (err) {
        console.error('예약 수정 실패', err);
        setError('예약 수정 실패');
      } finally {
        setIsProcessing(false);
      }
    },
    [hotelId, onEdit]
  );

  const openInvoiceModalHandler = (res) => {
    if (!isModalOpen) {
      setSelectedReservation(res);
      setModalType('invoice');
      setIsModalOpen(true);
    }
  };
  const closeModalHandler = () => {
    setIsModalOpen(false);
    setSelectedReservation(null);
    setModalType(null);
  };

  const handleSubmitForm = (e) => {
    e.preventDefault();
    if (!selectedReservation) return;
    const reservationId = selectedReservation._id;
    const editedData = editedValues[reservationId];
    const updatedData = {
      customerName: editedData.customerName,
      phoneNumber: editedData.phoneNumber,
      price: Number(editedData.price),
      checkIn: new Date(editedData.checkInDate).toISOString(),
      checkOut: new Date(editedData.checkOutDate).toISOString(),
      paymentMethod: editedData.paymentMethod,
      specialRequests: editedData.specialRequests,
    };
    onPartialUpdate(reservationId, updatedData);
    setSelectedReservation(null);
  };

  const calcNights = (ci, co) => {
    const d1 = new Date(ci);
    const d2 = new Date(co);
    return Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24));
  };

  const recalcPrice = (data) => {
    const { checkInDate, checkOutDate, roomInfo } = data;
    if (!checkInDate || !checkOutDate || !roomInfo) return data.price || 0;
    // OTA 예약은 가격이 변하면 안 되므로 기존 가격 반환
    const currentReservation = reservations.find(
      (r) => r._id === data.reservationNo
    );
    if (currentReservation && availableOTAs.includes(currentReservation.siteName)) {
      return currentReservation.price;
    }
    const selRoom = roomTypes.find(
      (r) => r.roomInfo.toLowerCase() === roomInfo.toLowerCase()
    );
    const nightly = selRoom ? selRoom.price : 0;
    const nights = calcNights(checkInDate, checkOutDate);
    if (nights <= 0) return 0;
    return (nightly * nights).toString();
  };
  

  const handleFieldChange = (resId, field, val) => {
    setEditedValues((prev) => {
      const currentData = prev[resId] || {};
      let updatedData = { ...currentData, [field]: val };

      if (field === 'price') {
        updatedData.manualPriceOverride = true;
      } else if (['checkInDate', 'checkOutDate', 'roomInfo'].includes(field)) {
        const currentReservation = reservations.find((r) => r._id === resId);
        // OTA 예약의 경우, 가격은 변경하지 않음
        if (
          currentReservation &&
          availableOTAs.includes(currentReservation.siteName)
        ) {
          // Do nothing for price recalculation
        } else {
          if (!currentData.manualPriceOverride) {
            updatedData.price = recalcPrice(updatedData);
          }
        }
      }
      return { ...prev, [resId]: updatedData };
    });
  };

  const handleCardFlip = (gIndex, resId) => {
    const memo = memos[resId] || { isEditing: false };
    if (memo.isEditing) return;
    setFlippedIndexes((prev) => {
      const n = new Set(prev);
      if (n.has(gIndex)) n.delete(gIndex);
      else n.add(gIndex);
      return n;
    });
  };

  const getPaymentMethodIcon = (pm) => {
    switch (pm) {
      case 'Card':
        return <FaCreditCard className="payment-icon" />;
      case 'Cash':
        return <FaMoneyBillWave className="payment-icon" />;
      case 'Account Transfer':
        return <FaUniversity className="payment-icon" />;
      case 'Pending':
        return <FaHourglassHalf className="payment-icon" />;
      default:
        return null;
    }
  };

  const renderActionButtons = (reservation) => {
    const isOTA = availableOTAs.includes(reservation.siteName);
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
    const finalIsConfirmed = isConfirmed;

    return (
      <span className="button-group">
        {canDelete && (
          <button
            className="action-button delete-button small-button red-delete"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteClickHandler(reservation._id, reservation.siteName);
            }}
          >
            삭제
          </button>
        )}
        {canConfirm && !finalIsConfirmed && (
          <button
            className="action-button confirm-button small-button blue-confirm"
            onClick={(e) => {
              e.stopPropagation();
              handleConfirmClickHandler(reservation._id);
            }}
          >
            확정
          </button>
        )}
        {canEdit && (
          <button
            className="action-button edit-button small-button green-edit"
            onClick={(e) => {
              e.stopPropagation();
              if (isOTA) {
                alert('OTA 예약은 수정할 수 없습니다.');
                return;
              }
              const ci = reservation.checkIn
                ? new Date(reservation.checkIn)
                : new Date();
              const co = reservation.checkOut
                ? new Date(reservation.checkOut)
                : addDays(ci, 1);
              const ciDate = format(ci, 'yyyy-MM-dd');
              const coDate = format(co, 'yyyy-MM-dd');
              const resDate = reservation.reservationDate
                ? format(
                    parseISO(reservation.reservationDate),
                    'yyyy-MM-dd HH:mm'
                  )
                : format(new Date(), 'yyyy-MM-dd HH:mm');
              const priceVal = extractPrice(reservation.price);
              const initData = {
                reservationNo: reservation.reservationNo || reservation._id,
                customerName: reservation.customerName || '',
                phoneNumber: reservation.phoneNumber || '',
                checkInDate: ciDate,
                checkOutDate: coDate,
                reservationDate: resDate,
                roomInfo: reservation.roomInfo || roomTypes[0]?.type || '',
                price: priceVal || 0,
                paymentMethod: reservation.paymentMethod || 'Pending',
                specialRequests: reservation.specialRequests || '',
              };
              initData.price = recalcPrice(initData);
              setEditedValues((prev) => ({
                ...prev,
                [reservation._id]: initData,
              }));
              setSelectedReservation({ ...reservation });
            }}
          >
            수정
          </button>
        )}
        {finalIsConfirmed && (
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
            if (!mObj || !info || info.toLowerCase().includes('대실'))
              return 'zzz';
            return mObj.roomInfo.toLowerCase();
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

  const originalDataRef = useRef(null);
  useEffect(() => {
    originalDataRef.current = {
      hotelId,
      roomTypes: JSON.parse(JSON.stringify(roomTypes)),
      gridSettings: JSON.parse(JSON.stringify(gridSettings)),
    };
  }, [hotelId, roomTypes, gridSettings]);

  const isAnyEditing = false;
  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        boxSizing: 'border-box',
        position: 'relative',
      }}
    >
      {/* 왼쪽 편집 패널 */}
      <div
        className={`edit-panel-left ${
          selectedReservation && !isModalOpen ? 'open' : ''
        }`}
      >
        {selectedReservation &&
          !isModalOpen &&
          editedValues[selectedReservation._id] && (
            <form onSubmit={handleSubmitForm}>
              <h2>예약 수정</h2>
              <label>
                예약자:
                <input
                  type="text"
                  value={editedValues[selectedReservation._id].customerName}
                  onChange={(e) =>
                    handleFieldChange(
                      selectedReservation._id,
                      'customerName',
                      e.target.value
                    )
                  }
                  required
                />
              </label>
              <label>
                전화번호:
                <input
                  type="text"
                  value={editedValues[selectedReservation._id].phoneNumber}
                  onChange={(e) =>
                    handleFieldChange(
                      selectedReservation._id,
                      'phoneNumber',
                      e.target.value
                    )
                  }
                />
              </label>
              <label>
                체크인 날짜:
                <input
                  type="date"
                  value={editedValues[selectedReservation._id].checkInDate}
                  onChange={(e) =>
                    handleFieldChange(
                      selectedReservation._id,
                      'checkInDate',
                      e.target.value
                    )
                  }
                />
              </label>
              <label>
                체크아웃 날짜:
                <input
                  type="date"
                  value={editedValues[selectedReservation._id].checkOutDate}
                  onChange={(e) =>
                    handleFieldChange(
                      selectedReservation._id,
                      'checkOutDate',
                      e.target.value
                    )
                  }
                />
              </label>
              <label>
                객실타입:
                <select
                  value={editedValues[selectedReservation._id].roomInfo}
                  onChange={(e) =>
                    handleFieldChange(
                      selectedReservation._id,
                      'roomInfo',
                      e.target.value
                    )
                  }
                >
                  {roomTypes.map((r, i) => (
                    <option key={i} value={r.roomInfo}>
                      {r.roomInfo}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                가격 (KRW):
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={editedValues[selectedReservation._id].price}
                  onChange={(e) =>
                    handleFieldChange(
                      selectedReservation._id,
                      'price',
                      e.target.value
                    )
                  }
                />
              </label>
              <label>
                결제방법/상태:
                {availableOTAs.includes(selectedReservation.siteName) ? (
                  <input
                    type="text"
                    disabled
                    style={{ backgroundColor: '#eee' }}
                    value={
                      editedValues[selectedReservation._id].paymentMethod ||
                      'OTA'
                    }
                  />
                ) : selectedReservation.siteName === '현장예약' ? (
                  <select
                    value={
                      editedValues[selectedReservation._id].paymentMethod ||
                      'Pending'
                    }
                    onChange={(e) =>
                      handleFieldChange(
                        selectedReservation._id,
                        'paymentMethod',
                        e.target.value
                      )
                    }
                  >
                    <option value="Card">Card</option>
                    <option value="Cash">Cash</option>
                    <option value="Account Transfer">Account Transfer</option>
                    <option value="Pending">Pending</option>
                  </select>
                ) : (
                  <select
                    value={
                      editedValues[selectedReservation._id].paymentMethod ||
                      'Pending'
                    }
                    onChange={(e) =>
                      handleFieldChange(
                        selectedReservation._id,
                        'paymentMethod',
                        e.target.value
                      )
                    }
                  >
                    <option value="Pending">Pending</option>
                  </select>
                )}
              </label>
              <label>
                고객요청:
                <input
                  type="text"
                  value={editedValues[selectedReservation._id].specialRequests}
                  onChange={(e) =>
                    handleFieldChange(
                      selectedReservation._id,
                      'specialRequests',
                      e.target.value
                    )
                  }
                />
              </label>
              <div className="panel-actions">
                <button type="submit" className="save-button">
                  저장
                </button>
                <button
                  type="button"
                  className="cancel-button"
                  onClick={() => setSelectedReservation(null)}
                >
                  취소
                </button>
              </div>
            </form>
          )}
      </div>

      {/* 오른쪽 메인 영역: 예약 그리드 */}
      <div className="grid-wrapper" ref={gridRef} style={{ flex: 1 }}>
        <div
          className={`grid-container ${isEvening ? 'evening-mode' : ''} ${
            isAnyEditing ? 'editing-active' : ''
          }`}
          style={{ marginBottom: 20 }}
        >
          {/* (1) 미배정 예약 섹션 */}
          {!autoAssigning && unassignedReservations.length > 0 && (
            <div
              className="unassigned-section"
              style={{ marginBottom: '2rem' }}
            >
              <h2>미배정 예약</h2>
              <div
                className="unassigned-list"
                style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}
              >
                {sortReservations(unassignedReservations).map((res, idx) => {
                  const globalIndex = idx;
                  return (
                    <DraggableReservationCard
                      key={res._id}
                      reservation={res}
                      globalIndex={globalIndex}
                      hotelId={hotelId}
                      highlightedReservationIds={highlightedReservationIds}
                      isSearching={isSearching}
                      flippedIndexes={flippedIndexes}
                      autoFlips={autoFlips}
                      memos={memos}
                      memoRefs={memoRefs}
                      handleCardFlip={handleCardFlip}
                      toggleMemoEdit={toggleMemoEditHandler}
                      handleMemoChange={handleMemoChangeHandler}
                      handleMemoSave={handleMemoSaveHandler}
                      handleMemoCancel={handleMemoCancelHandler}
                      openInvoiceModal={openInvoiceModalHandler}
                      getPaymentMethodIcon={getPaymentMethodIcon}
                      renderActionButtons={renderActionButtons}
                      loadedReservations={loadedReservations}
                    />
                  );
                })}
              </div>
            </div>
          )}
          {/* (2) 컨테이너별 예약 영역 */}
          <div
            className="layout-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
              gridAutoRows: '1fr',
              gap: '10px',
            }}
          >
            {fixedContainers.map((cont, cIndex) => {
              const arr = containerReservations[cont.containerId] || [];
              const sortedArr = sortReservations(arr);
              return (
                <ContainerCell
                  key={cont.containerId}
                  cont={cont}
                  onEdit={onEdit}
                  getReservationById={getReservationById}
                  assignedReservations={
                    containerReservations[cont.containerId] || []
                  }
                >
                  <div
                    className="container-label"
                    style={{
                      marginLeft: '10px',
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
                        marginLeft: '30px',
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
                    {sortedArr.length === 0 ? (
                      <div style={{ fontStyle: 'italic', color: '#999' }}>
                        예약 없음
                      </div>
                    ) : (
                      sortedArr.map((rsv, rIndex) => {
                        const globalIndex = cIndex * 100 + rIndex;
                        return (
                          <DraggableReservationCard
                            key={rsv._id}
                            reservation={rsv}
                            globalIndex={globalIndex}
                            hotelId={hotelId}
                            highlightedReservationIds={
                              highlightedReservationIds
                            }
                            isSearching={isSearching}
                            flippedIndexes={flippedIndexes}
                            autoFlips={autoFlips}
                            memos={memos}
                            memoRefs={memoRefs}
                            handleCardFlip={handleCardFlip}
                            toggleMemoEdit={toggleMemoEditHandler}
                            handleMemoChange={handleMemoChangeHandler}
                            handleMemoSave={handleMemoSaveHandler}
                            handleMemoCancel={handleMemoCancelHandler}
                            openInvoiceModal={openInvoiceModalHandler}
                            getPaymentMethodIcon={getPaymentMethodIcon}
                            renderActionButtons={renderActionButtons}
                            loadedReservations={loadedReservations}
                          />
                        );
                      })
                    )}
                  </div>
                </ContainerCell>
              );
            })}
          </div>
        </div>
        {isProcessing && <p>처리 중...</p>}
        {error && <p className="error-message">{error}</p>}
        {isModalOpen && modalType === 'invoice' && selectedReservation && (
          <InvoiceModal
            isOpen={isModalOpen}
            onRequestClose={closeModalHandler}
            onSave={handleEditSaveHandler}
            invoiceRef={invoiceRef}
            reservationNo={
              selectedReservation.reservationNo || selectedReservation._id
            }
            reservation={selectedReservation}
            hotelAddress={hotelAddress}
            phoneNumber={phoneNumber}
            email={email}
          />
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
  hotelSettings: PropTypes.object,
  highlightFirstCard: PropTypes.bool.isRequired,
  phoneNumber: PropTypes.string,
  roomTypes: PropTypes.array.isRequired,
  highlightedReservationIds: PropTypes.arrayOf(PropTypes.string),
  isSearching: PropTypes.bool,
  newlyCreatedId: PropTypes.string,
  flipAllMemos: PropTypes.bool.isRequired,
  needsConsent: PropTypes.bool.isRequired,
};

export default RoomGrid;
