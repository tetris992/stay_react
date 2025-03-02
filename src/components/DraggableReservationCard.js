// src/components/DraggableReservationCard.js
import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useDrag } from 'react-dnd';
import { format, parseISO, addDays } from 'date-fns';
import { FaFileInvoice } from 'react-icons/fa';
import MemoComponent from './MemoComponent';
import {
  getBorderColor,
  getInitialFormData,
} from '../utils/roomGridUtils';
import { getPriceForDisplay } from '../utils/getPriceForDisplay';
import { renderActionButtons } from '../utils/renderActionButtons'; // 공통 유틸 임포트
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
  renderActionButtons: customRenderActionButtons, // 기존 renderActionButtons 프롭 유지
  loadedReservations,
  newlyCreatedId,
  isNewlyCreatedHighlighted,
  onPartialUpdate,
  roomTypes,
}) => {
  const [{ isDragging }, dragRef] = useDrag({
    type: 'RESERVATION',
    item: { reservationId: reservation._id, reservationData: reservation },
    canDrag: () =>
      !flippedReservationIds.has(reservation._id) &&
      !isEditingCard &&
      !isEditingMemo, // 입력 모드에서는 드래그 비활성화
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });

  const [isEditingCard, setIsEditingCard] = useState(false);
  const [editedValues, setEditedValues] = useState({});
  const [isOpen, setIsOpen] = useState(false);
  const [isEditingMemo, setIsEditingMemo] = useState(false);

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
  const isCancelled =
    reservation._id.includes('Canceled') ||
    (reservation.reservationStatus || '').toLowerCase() === 'cancelled';

  const ciDateOnly = useMemo(
    () =>
      new Date(
        reservation.parsedCheckInDate.getFullYear(),
        reservation.parsedCheckInDate.getMonth(),
        reservation.parsedCheckInDate.getDate()
      ),
    [reservation.parsedCheckInDate]
  );

  const coDateOnly = useMemo(
    () =>
      new Date(
        reservation.parsedCheckOutDate.getFullYear(),
        reservation.parsedCheckOutDate.getMonth(),
        reservation.parsedCheckOutDate.getDate()
      ),
    [reservation.parsedCheckOutDate]
  );

  const diffDays = useMemo(
    () => (coDateOnly - ciDateOnly) / (1000 * 60 * 60 * 24),
    [ciDateOnly, coDateOnly]
  );

  const stayLabel = useMemo(() => {
    if (diffDays === 0) return '(대실)';
    else if (diffDays === 1 && reservation.customerName.includes('대실'))
      return '(대실)';
    else if (diffDays === 1) return '(1박)';
    else if (diffDays >= 2) return `(${diffDays}박)`;
    return '';
  }, [diffDays, reservation.customerName]);

  const cardClassNames = [
    'room-card',
    getBorderColor(reservation),
    isCancelled ? 'cancelled' : '',
    isUnassigned ? 'unassigned-card' : '',
    isHighlighted ? 'highlighted' : '',
    isNewlyCreated ? 'onsite-created' : '',
    isEditingCard ? 'edit-mode' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const handleEditStart = () => {
    if (isOpen || isEditingMemo) return;
    setIsOpen(true);
    const initialForm = getInitialFormData(reservation, roomTypes);

    const priceFromReservation = reservation.price?.toString() || initialForm.price;
    setEditedValues({
      ...initialForm,
      price: priceFromReservation,
      checkInDate: initialForm.checkInDate,
      checkOutDate: initialForm.checkOutDate,
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
      price: parseFloat(editedValues.price),
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
      const fieldsAffectingPrice = ['checkInDate', 'checkOutDate', 'roomInfo'];

      if (field === 'price') {
        return { ...updated, manualPriceOverride: true };
      }

      if (fieldsAffectingPrice.includes(field)) {
        const ci = updated.checkInDate || format(new Date(), 'yyyy-MM-dd');
        const co = updated.checkOutDate || format(addDays(new Date(), 1), 'yyyy-MM-dd');
        const nights = Math.max(1, Math.ceil((new Date(co) - new Date(ci)) / (1000 * 60 * 60 * 24)));
        const selectedRoom = roomTypes.find((r) => r.roomInfo === updated.roomInfo);

        if (selectedRoom) {
          const newPrice = selectedRoom.price * nights;
          return { ...updated, price: newPrice.toString(), manualPriceOverride: false };
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
    if (isUnassigned) return;
    if (isDragging || isEditingCard || isEditingMemo) return;
    handleCardFlip(reservation._id);
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
                    ? format(parseISO(reservation.reservationDate), 'yyyy-MM-dd')
                    : '정보 없음'}
                </p>
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
                        reservationNo: reservation.reservationNo || reservation._id || '',
                        hotelSettings,
                        hotelAddress: hotelAddress || hotelSettings?.hotelAddress || '주소 정보 없음',
                        phoneNumber: phoneNumber || hotelSettings?.phoneNumber || '전화번호 정보 없음',
                        email: email || hotelSettings?.email || '이메일 정보 없음',
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
                  onChange={(e) => handleFieldChange('customerName', e.target.value)}
                  required
                />
              </label>
              <label>
                전화번호:
                <input
                  type="text"
                  value={editedValues.phoneNumber}
                  onChange={(e) => handleFieldChange('phoneNumber', e.target.value)}
                />
              </label>
            </div>
            <div className="edit-card-row">
              <label>
                체크인 날짜:
                <input
                  type="date"
                  value={editedValues.checkInDate}
                  onChange={(e) => handleFieldChange('checkInDate', e.target.value)}
                />
              </label>
              <label>
                체크아웃 날짜:
                <input
                  type="date"
                  value={editedValues.checkOutDate}
                  onChange={(e) => handleFieldChange('checkOutDate', e.target.value)}
                />
              </label>
            </div>
            <div className="edit-card-row">
              <label>
                객실타입:
                <select
                  value={editedValues.roomInfo}
                  onChange={(e) => handleFieldChange('roomInfo', e.target.value)}
                >
                  {roomTypes.map((r, i) => (
                    <option key={i} value={r.roomInfo}>
                      {r.roomInfo.charAt(0).toUpperCase() + r.roomInfo.slice(1)}
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
                    setEditedValues((prev) => ({ ...prev, manualPriceOverride: true }));
                  }}
                />
              </label>
            </div>
            <div className="edit-card-row">
              <label>
                결제방법/상태:
                <select
                  value={editedValues.paymentMethod || 'Pending'}
                  onChange={(e) => handleFieldChange('paymentMethod', e.target.value)}
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
                  onChange={(e) => handleFieldChange('specialRequests', e.target.value)}
                />
              </label>
            </div>
            <div className="edit-card-actions">
              <button type="submit" className="save-button">
                저장
              </button>
              <button type="button" className="cancel-button" onClick={handleEditCancel}>
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
  onPartialUpdate: PropTypes.func.isRequired,
  roomTypes: PropTypes.array.isRequired,
};

export default DraggableReservationCard;