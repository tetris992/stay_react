// eslint-disable-next-line
import React, { useState, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useDrag } from 'react-dnd';
import { format, parseISO, addDays } from 'date-fns';
import { FaFileInvoice } from 'react-icons/fa'; // FaCheck 임포트 추가
import MemoComponent from './MemoComponent';
import { getBorderColor, getInitialFormData, isOtaReservation } from '../utils/roomGridUtils';
import { getPriceForDisplay } from '../utils/getPriceForDisplay';
import { isCancelledStatus } from '../utils/isCancelledStatus'; // 필요한 함수 임포트 추가
import { FaCheck, FaTrash, FaEdit } from 'react-icons/fa'; 
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
  renderActionButtons,
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
  // 메모 편집 상태를 명시적으로 관리 (toggleMemoEdit 사용)
  const [isEditingMemo, setIsEditingMemo] = useState(false);

  // 새로 정의: toggleMemoEdit - 두 번째 인자로 newState(boolean)가 있으면 해당 값으로, 없으면 토글
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
    isUnassigned ? 'unassigned-card' : '', // 미배정 전용 클래스
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

    // reservation.price를 명확히 확인하여 price 설정
    const priceFromReservation =
      reservation.price?.toString() || initialForm.price;
    setEditedValues({
      ...initialForm,
      price: priceFromReservation, // reservation.price를 우선적으로 사용, 문자열로 설정
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
      price: parseFloat(editedValues.price), // 숫자로 변환하여 저장
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

      // 가격을 수동으로 변경하는 경우에만 manualPriceOverride 활성화
      if (field === 'price') {
        return { ...updated, manualPriceOverride: true };
      }

      // 룸타입이나 날짜가 변경되면 항상 가격을 자동 재계산
      if (fieldsAffectingPrice.includes(field)) {
        const ci = updated.checkInDate || format(new Date(), 'yyyy-MM-dd');
        const co =
          updated.checkOutDate || format(addDays(new Date(), 1), 'yyyy-MM-dd');
        const nights = Math.max(
          1,
          Math.ceil((new Date(co) - new Date(ci)) / (1000 * 60 * 60 * 24))
        );
        const selectedRoom = roomTypes.find(
          (r) => r.roomInfo === updated.roomInfo
        );

        if (selectedRoom) {
          const newPrice = selectedRoom.price * nights;
          return {
            ...updated,
            price: newPrice.toString(),
            manualPriceOverride: false,
          };
        }
      }

      return updated;
    });
  };

  // MemoComponent에 전달하는 콜백들
  const handleMemoChange = (reservationId, value) => {
    console.log(`Memo changed for ${reservationId}: ${value}`);
  };

  const handleMemoSave = (reservationId) => {
    // 저장 후 편집 모드 닫기
    toggleMemoEdit(reservationId, false);
    console.log(`Memo saved for ${reservationId}`);
    // 저장 후, 카드가 뒷면 상태라면 앞면으로 플립 (딜레이 100ms)
    if (isFlipped) {
      setTimeout(() => {
        handleCardFlip(reservation._id);
      }, 100);
    }
  };

  const handleMemoCancel = (reservationId) => {
    toggleMemoEdit(reservationId, false);
    console.log(`Memo cancelled for ${reservationId}`);
    if (isFlipped) {
      handleCardFlip(reservation._id);
    }
  };

  // 카드 전체 클릭 시 (미배정은 플립하지 않음)
  const handleCardClick = (e) => {
    if (isUnassigned) return;
    if (isDragging || isEditingCard || isEditingMemo) return;
    handleCardFlip(reservation._id);
  };

  // 내부에서 정의된 renderActionButtons (중복 선언 문제 해결)
  const renderCustomActionButtons = (reservation, onEditStart) => {
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
            }}
            data-tooltip="삭제"
          >
            <FaTrash />
          </button>
        )}
        {canConfirm && !isConfirmed && (
          <button
            className="action-button confirm-button"
            onClick={(e) => {
              e.stopPropagation();
            }}
            data-tooltip="확정"
          >
            <FaCheck />
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
            <FaEdit />
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
                      {renderCustomActionButtons(reservation, handleEditStart)}
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
                        reservationNo:
                          reservation.reservationNo || reservation._id || '',
                        hotelSettings: hotelSettings, // 호텔 설정 전체 전달
                        hotelAddress:
                          hotelAddress ||
                          hotelSettings?.hotelAddress ||
                          '주소 정보 없음',
                        phoneNumber:
                          phoneNumber ||
                          hotelSettings?.phoneNumber ||
                          '전화번호 정보 없음',
                        email:
                          email || hotelSettings?.email || '이메일 정보 없음',
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
                  value={editedValues.roomInfo} // 문자열로 설정 (예: "standard" 또는 "hinoki")
                  onChange={(e) =>
                    handleFieldChange('roomInfo', e.target.value)
                  }
                >
                  {roomTypes.map((r, i) => (
                    <option
                      key={i}
                      value={r.roomInfo} // 문자열로 설정
                    >
                      {r.roomInfo.charAt(0).toUpperCase() + r.roomInfo.slice(1)}{' '}
                      {/* 단일 객실 타입만 표시 */}
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
                <select
                  value={editedValues.paymentMethod || 'Pending'}
                  onChange={(e) =>
                    handleFieldChange('paymentMethod', e.target.value)
                  }
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
      )}
    </div>
  );
};

DraggableReservationCard.propTypes = {
  isUnassigned: PropTypes.bool, // 미배정 카드 여부
  reservation: PropTypes.object.isRequired,
  hotelId: PropTypes.string.isRequired,
  highlightedReservationIds: PropTypes.array.isRequired,
  isSearching: PropTypes.bool,
  flippedReservationIds: PropTypes.instanceOf(Set).isRequired,
  memoRefs: PropTypes.object.isRequired,
  handleCardFlip: PropTypes.func.isRequired,
  openInvoiceModal: PropTypes.func.isRequired,
  hotelSettings: PropTypes.object, // 호텔 설정 전체 추가
  hotelAddress: PropTypes.string,
  phoneNumber: PropTypes.string,
  email: PropTypes.string,
  renderActionButtons: PropTypes.func.isRequired,
  loadedReservations: PropTypes.array,
  newlyCreatedId: PropTypes.string,
  isNewlyCreatedHighlighted: PropTypes.bool,
  onPartialUpdate: PropTypes.func.isRequired,
  roomTypes: PropTypes.array.isRequired,
};

export default DraggableReservationCard;
