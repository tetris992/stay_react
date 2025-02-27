import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useDrag } from 'react-dnd';
import { format, addDays } from 'date-fns';
import { FaFileInvoice, FaPen } from 'react-icons/fa';

import availableOTAs from '../config/availableOTAs';
import { extractPrice } from '../utils/extractPrice';
import { isCancelledStatus } from '../utils/isCancelledStatus';
import { getPriceForDisplay } from '../utils/getPriceForDisplay';

const DraggableReservationCard = React.memo(
  ({
    reservation = {}, // 기본값으로 빈 객체 제공 (isRequired 제거)
    hotelId,
    highlightedReservationIds = [],
    isSearching = false,
    flippedReservationIds = new Set(),
    memos = {}, // 기본값으로 빈 객체 제공
    memoRefs = {}, // 기본값으로 빈 객체 제공
    loadedReservations = [],
    handleCardFlip = () => {}, // 기본값으로 빈 함수 제공
    toggleMemoEdit = () => {}, // 기본값으로 빈 함수 제공
    handleMemoChange = () => {}, // 기본값으로 빈 함수 제공
    handleMemoSave = () => {}, // 기본값으로 빈 함수 제공
    handleMemoCancel = () => {}, // 기본값으로 빈 함수 제공
    openInvoiceModal = () => {}, // 기본값으로 빈 함수 제공
    getPaymentMethodIcon = () => null, // 기본값으로 null 반환 함수 제공
    renderActionButtons = () => null, // 기본값으로 null 반환 함수 제공
    newlyCreatedId,
    isNewlyCreatedHighlighted = false,
    onPartialUpdate = () => {}, // 기본값으로 빈 함수 제공
    roomTypes = [], // 기본값으로 빈 배열 제공
  }) => {
    // Hook은 항상 컴포넌트 최상위에서 호출 (조건부 호출 제거)
    const [isEditingCard, setIsEditingCard] = useState(false);
    const [editedValues, setEditedValues] = useState({});
    const [isOpen, setIsOpen] = useState(false);

    // useDrag는 항상 호출되며, reservation이 유효하지 않으면 드래그 비활성화
    const [{ isDragging }, dragRef] = useDrag({
      type: 'RESERVATION',
      item: reservation._id
        ? { reservationId: reservation._id, reservationData: reservation }
        : null, // reservation이 유효하지 않으면 null 반환
      canDrag: () => !!reservation._id && !isEditingCard, // reservation._id가 있어야 드래그 가능
      collect: (monitor) => ({ isDragging: monitor.isDragging() }),
    });

    // reservation이 undefined일 경우를 안전하게 처리 (렌더링 건너뛰기 대신 기본값 제공)
    if (!reservation || !reservation._id) {
      console.warn('Reservation is undefined or missing _id, rendering placeholder.');
      return (
        <div
          className="room-card"
          style={{
            cursor: 'default',
            opacity: 0.5,
            transition: 'opacity 0.2s ease-in-out',
          }}
        >
          <p>예약 정보가 없습니다.</p>
        </div>
      );
    }

    const isHighlighted =
      highlightedReservationIds.includes(reservation._id) && isSearching;
    const isNewlyCreated =
      reservation._id === newlyCreatedId && isNewlyCreatedHighlighted;
    const isCancelled = isCancelledStatus(
      reservation.reservationStatus || '',
      reservation.customerName || ''
    ) || reservation._id.includes('Canceled');

    const ciDateOnly = reservation.parsedCheckInDate
      ? new Date(
          reservation.parsedCheckInDate.getFullYear(),
          reservation.parsedCheckInDate.getMonth(),
          reservation.parsedCheckInDate.getDate()
        )
      : new Date();
    const coDateOnly = reservation.parsedCheckOutDate
      ? new Date(
          reservation.parsedCheckOutDate.getFullYear(),
          reservation.parsedCheckOutDate.getMonth(),
          reservation.parsedCheckOutDate.getDate()
        )
      : addDays(ciDateOnly, 1);
    const diffDays = (coDateOnly - ciDateOnly) / (1000 * 60 * 60 * 24);
    let stayLabel = '';
    if (diffDays === 0) stayLabel = '(대실)';
    else if (diffDays === 1 && (reservation.customerName || '').includes('대실'))
      stayLabel = '(대실)';
    else if (diffDays === 1) stayLabel = '(1박)';
    else if (diffDays >= 2) stayLabel = `(${diffDays}박)`;

    const isFlipped = flippedReservationIds.has(reservation._id);
    const memo = memos[reservation._id] || { text: '', isEditing: false };
    const isEditingMemo = memo.isEditing;

    const borderColorClass = (() => {
      try {
        const ci = reservation.parsedCheckInDate;
        const co = reservation.parsedCheckOutDate;
        if (!ci || !co || isNaN(ci.getTime()) || isNaN(co.getTime())) {
          throw new Error('Invalid date');
        }
        const hasDaesil =
          (reservation.customerName &&
            reservation.customerName.includes('대실')) ||
          (reservation.roomInfo && reservation.roomInfo.includes('대실'));
        if (hasDaesil) return 'border-primary-soft-green';
        const ciOnly = new Date(ci.getFullYear(), ci.getMonth(), ci.getDate());
        const coOnly = new Date(co.getFullYear(), co.getMonth(), co.getDate());
        const diff = (coOnly - ciOnly) / (1000 * 60 * 60 * 24);
        if (diff === 0) return 'border-primary-soft-green';
        else if (diff === 1) return 'border-accent-coral';
        else if (diff >= 2) return 'border-primary-deep-blue';
        return '';
      } catch (err) {
        console.error('getBorderColor error', err);
        return '';
      }
    })();

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
      const d1 = checkIn ? new Date(checkIn) : new Date();
      const d2 = checkOut ? new Date(checkOut) : addDays(d1, 1);
      return Math.max(1, Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24)));
    };

    const handleEditStart = () => {
      if (isOpen) return;
      setIsOpen(true);
      const ci = reservation.checkIn ? new Date(reservation.checkIn) : new Date();
      const co = reservation.checkOut
        ? new Date(reservation.checkOut)
        : addDays(ci, 1);
      const ciDate = format(ci, 'yyyy-MM-dd');
      const coDate = format(co, 'yyyy-MM-dd');
      const resDate = reservation.reservationDate
        ? format(new Date(reservation.reservationDate), 'yyyy-MM-dd HH:mm')
        : format(new Date(), 'yyyy-MM-dd HH:mm');
      const priceVal = reservation.price ? extractPrice(reservation.price) : 0;
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
        roomInfo: reservation.roomInfo || (roomTypes[0]?.roomInfo || ''),
        price: calculatedPrice,
        paymentMethod: reservation.paymentMethod || 'Pending',
        specialRequests: reservation.specialRequests || '',
        manualPriceOverride: !!reservation.price,
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
        price: Number(editedValues.price),
        checkIn: new Date(editedValues.checkInDate).toISOString(),
        checkOut: new Date(editedValues.checkOutDate).toISOString(),
        paymentMethod: editedValues.paymentMethod,
        specialRequests: editedValues.specialRequests,
      };
      onPartialUpdate(reservation._id, updatedData);
      setIsEditingCard(false);
      setEditedValues({});
      setIsOpen(false);
    };

    const handleFieldChange = (field, value) => {
      setEditedValues((prev) => {
        const updated = { ...prev, [field]: value };
        if (
          ['checkInDate', 'checkOutDate', 'roomInfo'].includes(field) &&
          !prev.manualPriceOverride
        ) {
          const selectedRoom = roomTypes.find(
            (r) => r.roomInfo === (prev.roomInfo || roomTypes[0]?.roomInfo)
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
          cursor: isEditingCard ? 'default' : 'pointer',
          transition: 'opacity 0.2s ease-in-out, transform 0.3s ease-in-out',
          opacity: isDragging ? 0.5 : 1,
          transform: isEditingCard ? 'scale(1.2)' : 'scale(1)',
          zIndex: isEditingCard ? 1000 : 'auto',
          position: isEditingCard ? 'relative' : 'static',
        }}
        onClick={(e) => {
          if (isDragging || isEditingCard) return;
          if (reservation._id) handleCardFlip(reservation._id);
        }}
      >
        <div
          className={`flip-container ${isFlipped && !isEditingCard ? 'flipped' : ''}`}
          style={{
            cursor: isEditingCard ? 'default' : 'pointer',
          }}
        >
          <div className="room-card-inner">
            {isEditingCard ? (
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
                      {availableOTAs.includes(reservation.siteName || '') ? (
                        <input
                          type="text"
                          disabled
                          style={{ backgroundColor: '#eee' }}
                          value={editedValues.paymentMethod || 'OTA'}
                        />
                      ) : (reservation.siteName || '') === '현장예약' ? (
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
                      <p>{reservation._id.replace(`${hotelId}-`, '') || '정보 없음'}</p>
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
                          ? format(new Date(reservation.reservationDate), 'yyyy-MM-dd')
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
                              (reservation.siteName || '') === '현장예약'
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
                      if (!isEditingMemo && reservation._id) toggleMemoEdit(reservation._id);
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
                    {isEditingMemo ? (
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
                    {isEditingMemo ? (
                      <textarea
                        ref={(el) => (memoRefs.current[reservation._id] = el)}
                        value={memo.text}
                        onChange={(e) => handleMemoChange(reservation._id, e.target.value)}
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
  reservation: PropTypes.object, // isRequired 제거, 선택적 prop으로 변경
  hotelId: PropTypes.string.isRequired,
  highlightedReservationIds: PropTypes.array, // isRequired 제거
  isSearching: PropTypes.bool, // isRequired 제거
  flippedReservationIds: PropTypes.instanceOf(Set).isRequired,
  memos: PropTypes.object, // isRequired 제거
  memoRefs: PropTypes.object, // isRequired 제거
  loadedReservations: PropTypes.array, // isRequired 제거
  handleCardFlip: PropTypes.func, // isRequired 제거
  toggleMemoEdit: PropTypes.func, // isRequired 제거
  handleMemoChange: PropTypes.func, // isRequired 제거
  handleMemoSave: PropTypes.func, // isRequired 제거
  handleMemoCancel: PropTypes.func, // isRequired 제거
  openInvoiceModal: PropTypes.func, // isRequired 제거
  getPaymentMethodIcon: PropTypes.func, // isRequired 제거
  renderActionButtons: PropTypes.func, // isRequired 제거
  newlyCreatedId: PropTypes.string, // isRequired 제거
  isNewlyCreatedHighlighted: PropTypes.bool, // isRequired 제거
  onPartialUpdate: PropTypes.func.isRequired,
  roomTypes: PropTypes.array, // isRequired 제거
};

export default DraggableReservationCard;