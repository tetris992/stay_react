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
import { useDrag, useDrop } from 'react-dnd';
import {
  canMoveToRoom,
  canSwapReservations,
  computeDailyAvailability,
} from '../utils/availability';

/* ===============================
   HELPER FUNCTIONS
=============================== */

function isOtaReservation(reservation) {
  return availableOTAs.includes(reservation.siteName || '');
}

function sortContainers(containers) {
  return containers.sort((a, b) => {
    const aNum = parseInt(a.roomNumber || '', 10);
    const bNum = parseInt(b.roomNumber || '', 10);
    if (!isNaN(aNum) && !isNaN(bNum)) {
      return aNum - bNum;
    }
    return (a.roomNumber || '').localeCompare(b.roomNumber || '');
  });
}

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
   [A] DraggableReservationCard
=============================== */
const DraggableReservationCard = React.memo(
  ({
    reservation,
    hotelId,
    highlightedReservationIds,
    isSearching,
    flippedReservationIds,
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
    newlyCreatedId,
    isNewlyCreatedHighlighted,
    onPartialUpdate,
    roomTypes,
  }) => {
    const [{ isDragging }, dragRef] = useDrag({
      type: 'RESERVATION',
      item: { reservationId: reservation._id, reservationData: reservation },
      canDrag: () => !isEditingMemo && !isEditingCard,
      collect: (monitor) => ({ isDragging: monitor.isDragging() }),
    });

    // 전역 상태로 수정 모드 관리 (RoomGrid에서 단일 수정 모드 관리)
    const [isEditingCard, setIsEditingCard] = useState(false);
    const [editedValues, setEditedValues] = useState({});
    const [isOpen, setIsOpen] = useState(false); // 팝업 열림 상태

    const isHighlighted =
      highlightedReservationIds.includes(reservation._id) && isSearching;
    const isNewlyCreated =
      reservation._id === newlyCreatedId && isNewlyCreatedHighlighted;
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
    if (diffDays === 0) stayLabel = '(대실)';
    else if (diffDays === 1 && reservation.customerName.includes('대실'))
      stayLabel = '(대실)';
    else if (diffDays === 1) stayLabel = '(1박)';
    else if (diffDays >= 2) stayLabel = `(${diffDays}박)`;

    const isFlipped = flippedReservationIds.has(reservation._id);
    const memo = memos[reservation._id] || { text: '', isEditing: false };
    const isEditingMemo = memo.isEditing;
    const borderColorClass = getBorderColor(reservation);

    const cardClassNames = [
      'room-card',
      borderColorClass,
      isCancelled ? 'cancelled' : '',
      isHighlighted ? 'highlighted' : '',
      isNewlyCreated ? 'onsite-created' : '',
      isEditingCard ? 'edit-mode' : '',
    ]
      .filter(Boolean)
      .join(' ');

    const calcNights = (checkIn, checkOut) => {
      const d1 = new Date(checkIn);
      const d2 = new Date(checkOut);
      return Math.max(1, Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24)));
    };

    const handleEditStart = () => {
      if (isOpen) return; // 이미 열려 있으면 새로 열지 않음
      setIsOpen(true); // 팝업 열림 상태 설정
      // 기존 reservation 객체의 모든 필드를 그대로 사용
      const ci = reservation.checkIn
        ? new Date(reservation.checkIn)
        : new Date();
      const co = reservation.checkOut
        ? new Date(reservation.checkOut)
        : addDays(ci, 1);
      const ciDate = format(ci, 'yyyy-MM-dd');
      const coDate = format(co, 'yyyy-MM-dd');
      const resDate = reservation.reservationDate
        ? format(parseISO(reservation.reservationDate), 'yyyy-MM-dd HH:mm')
        : format(new Date(), 'yyyy-MM-dd HH:mm');
      // 가격을 reservation.price에서 직접 가져오고, extractPrice로 처리
      const priceVal = reservation.price ? extractPrice(reservation.price) : 0;
      // roomTypes에서 현재 roomInfo에 해당하는 가격을 찾아 기본값으로 설정
      const selectedRoom = roomTypes.find(
        (r) => r.roomInfo === reservation.roomInfo
      );
      const basePrice = selectedRoom ? selectedRoom.price : 0;
      const nights = calcNights(ciDate, coDate);
      const calculatedPrice = reservation.price ? priceVal : basePrice * nights;

      setEditedValues({
        customerName: reservation.customerName || '',
        phoneNumber: reservation.phoneNumber || '',
        checkInDate: ciDate,
        checkOutDate: coDate,
        reservationDate: resDate,
        roomInfo: reservation.roomInfo || roomTypes[0]?.type || '',
        price: calculatedPrice, // 기존 가격 또는 roomTypes 기반 가격
        paymentMethod: reservation.paymentMethod || 'Pending',
        specialRequests: reservation.specialRequests || '',
        manualPriceOverride: !!reservation.price, // 기존 가격이 있으면 수동 오버라이드 플래그 설정
      });
      setIsEditingCard(true);
    };

    const handleEditCancel = () => {
      setIsEditingCard(false);
      setEditedValues({});
      setIsOpen(false); // 팝업 닫기
    };

    const handleEditSave = (e) => {
      e.preventDefault();
      const updatedData = {
        customerName: editedValues.customerName,
        phoneNumber: editedValues.phoneNumber,
        price: Number(editedValues.price),
        checkIn: new Date(editedValues.checkInDate).toISOString(),
        checkOut: new Date(editedValues.checkOutDate).toISOString(),
        paymentMethod: editedValues.paymentMethod,
        specialRequests: editedValues.specialRequests,
      };
      onPartialUpdate(reservation._id, updatedData);
      setIsEditingCard(false);
      setEditedValues({});
      setIsOpen(false); // 팝업 닫기
    };

    const handleFieldChange = (field, value) => {
      /**
       * @param {Object} prev - The previous state of editedValues
       * @returns {Object} - The updated editedValues state
       */
      setEditedValues((prev) => {
        const updated = { ...prev, [field]: value };
        if (
          ['checkInDate', 'checkOutDate', 'roomInfo'].includes(field) &&
          !prev.manualPriceOverride
        ) {
          const selectedRoom = roomTypes.find(
            (r) => r.roomInfo === (prev.roomInfo || roomTypes[0]?.type)
          );
          if (selectedRoom) {
            const nights = calcNights(
              prev.checkInDate || new Date(),
              prev.checkOutDate || addDays(new Date(), 1)
            );
            const newPrice = selectedRoom.price * nights;
            return { ...updated, price: newPrice };
          }
        }
        return updated;
      });
    };

    return (
      <div
        ref={dragRef}
        className={cardClassNames}
        data-id={reservation._id}
        style={{
          cursor: isEditingCard || isEditingMemo ? 'default' : 'pointer',
          transition: 'opacity 0.2s ease-in-out, transform 0.3s ease-in-out',
          opacity: isDragging ? 0.5 : 1,
          transform: isEditingCard ? 'scale(1.2)' : 'scale(1)', // 수정 모드 시 커짐
          zIndex: isEditingCard ? 1000 : 'auto', // 수정 모드 시 상위 레이어
          position: isEditingCard ? 'relative' : 'static', // 팝업 효과
        }}
        onClick={(e) => {
          if (isDragging || isEditingCard) return;
          if (!memo.isEditing) handleCardFlip(reservation._id);
        }}
      >
        <div
          className={`flip-container ${
            isFlipped && !isEditingCard ? 'flipped' : ''
          }`}
          style={{
            cursor: isEditingCard || isEditingMemo ? 'default' : 'pointer',
          }}
        >
          <div className="room-card-inner">
            {isEditingCard ? (
              // 수정 모드 UI
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
                      <select
                        value={editedValues.roomInfo}
                        onChange={(e) =>
                          handleFieldChange('roomInfo', e.target.value)
                        }
                      >
                        {roomTypes.map((r, i) => (
                          <option key={i} value={r.roomInfo}>
                            {r.roomInfo} - {r.price.toLocaleString()} KRW/박
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
                        value={editedValues.price}
                        onChange={(e) => {
                          handleFieldChange('price', e.target.value);
                          setEditedValues((prev) => ({
                            ...prev,
                            manualPriceOverride: true,
                          }));
                        }}
                      />
                    </label>
                  </div>
                  <div className="edit-card-row">
                    <label>
                      결제방법/상태:
                      {availableOTAs.includes(reservation.siteName) ? (
                        <input
                          type="text"
                          disabled
                          style={{ backgroundColor: '#eee' }}
                          value={editedValues.paymentMethod || 'OTA'}
                        />
                      ) : reservation.siteName === '현장예약' ? (
                        <select
                          value={editedValues.paymentMethod || 'Pending'}
                          onChange={(e) =>
                            handleFieldChange('paymentMethod', e.target.value)
                          }
                        >
                          <option value="Card">Card</option>
                          <option value="Cash">Cash</option>
                          <option value="Account Transfer">
                            Account Transfer
                          </option>
                          <option value="Pending">Pending</option>
                        </select>
                      ) : (
                        <select
                          value={editedValues.paymentMethod || 'Pending'}
                          onChange={(e) =>
                            handleFieldChange('paymentMethod', e.target.value)
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
            ) : (
              // 기본 보기 모드 (기존 코드 유지)
              <>
                <div className="room-card-front">
                  <div className="content-footer-wrapper">
                    <div className="card-content">
                      <div className="card-header">
                        <h3 className="no-break">
                          <span className="stay-label">{stayLabel}</span>
                          <span className="button-group-wrapper">
                            {renderActionButtons(reservation, handleEditStart)}
                          </span>
                        </h3>
                      </div>
                      <p>{reservation._id.replace(`${hotelId}-`, '')}</p>
                      <p>예약자: {reservation.customerName || '정보 없음'}</p>
                      <p>
                        체크인:{' '}
                        {reservation.parsedCheckInDate
                          ? format(
                              reservation.parsedCheckInDate,
                              'yyyy-MM-dd HH:mm'
                            )
                          : '정보 없음'}
                      </p>
                      <p>
                        체크아웃:{' '}
                        {reservation.parsedCheckOutDate
                          ? format(
                              reservation.parsedCheckOutDate,
                              'yyyy-MM-dd HH:mm'
                            )
                          : '정보 없음'}
                      </p>
                      <p>가격: {getPriceForDisplay(reservation)}</p>
                      <p>
                        객실 정보:{' '}
                        {reservation.roomInfo &&
                        reservation.roomInfo.length > 30
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
                        결제방법:{' '}
                        {getPaymentMethodIcon(reservation.paymentMethod)}{' '}
                        {reservation.paymentMethod || '정보 없음'}
                      </p>
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
                            openInvoiceModal(reservation);
                          }}
                          title="인보이스 보기"
                        >
                          <FaFileInvoice size={20} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="room-card-back">
                  <div
                    className="memo-header"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!memo.isEditing) toggleMemoEdit(reservation._id);
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <span>Memo</span>
                    {reservation.roomNumber && (
                      <span
                        className="memo-room-number"
                        style={{ marginLeft: '10px' }}
                      >
                        #{reservation.roomNumber}
                      </span>
                    )}
                    {memo.isEditing ? (
                      <button
                        className="memo-cancel-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMemoCancel(reservation._id);
                        }}
                      >
                        X
                      </button>
                    ) : (
                      <button
                        className="memo-edit-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleMemoEdit(reservation._id);
                        }}
                      >
                        <FaPen />
                      </button>
                    )}
                  </div>
                  <div className="memo-body">
                    {memo.isEditing ? (
                      <textarea
                        ref={(el) => (memoRefs.current[reservation._id] = el)}
                        value={memo.text}
                        onChange={(e) =>
                          handleMemoChange(reservation._id, e.target.value)
                        }
                        className="memo-textarea"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleMemoSave(reservation._id);
                          }
                        }}
                      />
                    ) : (
                      <div className="memo-text-display">
                        {memo.text || '(클릭하여 메모입력)'}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
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
  hotelId: PropTypes.string.isRequired,
  highlightedReservationIds: PropTypes.array.isRequired,
  isSearching: PropTypes.bool,
  flippedReservationIds: PropTypes.instanceOf(Set).isRequired,
  memos: PropTypes.object.isRequired,
  memoRefs: PropTypes.object.isRequired,
  handleCardFlip: PropTypes.func.isRequired,
  toggleMemoEdit: PropTypes.func.isRequired,
  handleMemoChange: PropTypes.func.isRequired,
  handleMemoSave: PropTypes.func.isRequired,
  handleMemoCancel: PropTypes.func.isRequired,
  openInvoiceModal: PropTypes.func.isRequired,
  getPaymentMethodIcon: PropTypes.func.isRequired,
  renderActionButtons: PropTypes.func.isRequired,
  loadedReservations: PropTypes.array,
  newlyCreatedId: PropTypes.string,
  isNewlyCreatedHighlighted: PropTypes.bool,
  onPartialUpdate: PropTypes.func.isRequired,
  roomTypes: PropTypes.array.isRequired,
};
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

          if (
            draggedReservation.roomInfo === cont.roomInfo &&
            draggedReservation.roomNumber === cont.roomNumber
          )
            return;

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
              const updatedReservations = (fullReservations || []).map((r) =>
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
  const [autoAssigning, setAutoAssigning] = useState(false); // eslint-disable-line no-unused-vars

  const invoiceRef = useRef();
  const gridRef = useRef();
  const memoRefs = useRef({});

  const floors = useMemo(() => {
    const loadedFloors = hotelSettings?.gridSettings?.floors || [];
    console.log('[RoomGrid] Loaded floors:', loadedFloors);
    return loadedFloors.map((floor) => ({
      ...floor,
      containers: sortContainers([...(floor.containers || [])]),
    }));
  }, [hotelSettings]);

  const allContainers = useMemo(() => {
    return floors.flatMap((floor) => floor.containers || []);
  }, [floors]);

  const getReservationById = useCallback(
    (id) => reservations.find((res) => res._id === id),
    [reservations]
  );

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

  const unassignedReservations = useMemo(() => {
    return reservations.filter(
      (res) => !res.roomNumber || res.roomNumber.trim() === ''
    );
  }, [reservations]);

  useEffect(() => {
    if (unassignedReservations.length === 0) setShowUnassignedPanel(false);
  }, [unassignedReservations]);

  useEffect(() => {
    console.log('전체 예약:', reservations);
    console.log('일간 예약 (filteredReservations):', filteredReservations);
    console.log('미배정 예약 수:', unassignedReservations.length);
  }, [reservations, filteredReservations, unassignedReservations]);

  useEffect(() => {
    setAutoAssigning(true);
    let autoAssignTimer = null;

    if (!allContainers.length || unassignedReservations.length === 0) {
      setAutoAssigning(false);
      return;
    }

    autoAssignTimer = setTimeout(() => {
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
      if (autoAssignTimer) clearTimeout(autoAssignTimer);
      setAutoAssigning(false);
    };
  }, [
    unassignedReservations,
    floors,
    onEdit,
    roomTypes,
    reservations,
    allContainers,
  ]);

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

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('localMemos') || '{}');
    setMemos(saved);
  }, [setMemos]);

  const toggleMemoEditHandler = useCallback(
    (reservationId) => {
      /**
       * @param {Object} prev - The previous state of memos
       * @returns {Object} - The updated memos state
       */
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
      setFlippedReservationIds((prev) => {
        const copy = new Set(prev);
        copy.delete(reservationId);
        return copy;
      });
    },
    [setMemos, setFlippedReservationIds]
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

  const handleCardFlip = (resId) => {
    const memo = memos[resId] || { isEditing: false };
    if (memo.isEditing) return;
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

  const openInvoiceModalHandler = (reservation) => {
    if (!isModalOpen) {
      setModalType('invoice');
      setIsModalOpen(true);
      return reservation; // InvoiceModal에 전달할 reservation 반환
    }
    return null;
  };

  const closeModalHandler = () => {
    setIsModalOpen(false);
    setModalType(null);
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

  const renderActionButtons = (reservation, onEditStart) => {
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
        {canConfirm && !isConfirmed && (
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
              onEditStart(); // 수정 모드 시작
            }}
          >
            수정
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
                    toggleMemoEdit={toggleMemoEditHandler}
                    handleMemoChange={handleMemoChangeHandler}
                    handleMemoSave={handleMemoSaveHandler}
                    handleMemoCancel={handleMemoCancelHandler}
                    openInvoiceModal={openInvoiceModalHandler}
                    getPaymentMethodIcon={getPaymentMethodIcon}
                    renderActionButtons={renderActionButtons}
                    loadedReservations={loadedReservations || []}
                    newlyCreatedId={newlyCreatedId}
                    isNewlyCreatedHighlighted={isNewlyCreatedHighlighted}
                    onPartialUpdate={onPartialUpdate}
                    roomTypes={roomTypes}
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
                  {floor.floorNum}_Floor
                </h3>
                <div className="layout-grid">
                  {(floor.containers || []).map((cont) => {
                    const arr = floorReservations[cont.containerId] || [];
                    const sortedArr = sortReservations(arr);
                    return (
                      <ContainerCell
                        key={cont.containerId}
                        cont={cont}
                        onEdit={onEdit}
                        getReservationById={getReservationById}
                        assignedReservations={arr}
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
                          {sortedArr.length === 0 ? (
                            <div style={{ fontStyle: 'italic', color: '#999' }}>
                              예약 없음
                            </div>
                          ) : (
                            sortedArr.map((rsv) => (
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
                                toggleMemoEdit={toggleMemoEditHandler}
                                handleMemoChange={handleMemoChangeHandler}
                                handleMemoSave={handleMemoSaveHandler}
                                handleMemoCancel={handleMemoCancelHandler}
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
        {isModalOpen && modalType === 'invoice' && (
          <InvoiceModal
            isOpen={isModalOpen}
            onRequestClose={closeModalHandler}
            invoiceRef={invoiceRef}
            hotelAddress={
              hotelAddress || hotelSettings?.hotelAddress || '주소 정보 없음'
            }
            phoneNumber={
              phoneNumber || hotelSettings?.phoneNumber || '전화번호 정보 없음'
            }
            email={email || hotelSettings?.email || '이메일 정보 없음'}
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
  hotelAddress: PropTypes.string,
  phoneNumber: PropTypes.string,
  email: PropTypes.string,
  roomTypes: PropTypes.array.isRequired,
  highlightedReservationIds: PropTypes.arrayOf(PropTypes.string),
  isSearching: PropTypes.bool,
  newlyCreatedId: PropTypes.string,
  flipAllMemos: PropTypes.bool.isRequired,
  sortOrder: PropTypes.string,
  selectedDate: PropTypes.instanceOf(Date),
};

export default RoomGrid;
