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
import './EditReservationModal.js'; // EditReservationModal 컴포넌트 추가
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
import availableOTAs from '../config/availableOTAs.js';
import { extractPrice } from '../utils/extractPrice.js';
import { isCancelledStatus } from '../utils/isCancelledStatus.js';
import { getPriceForDisplay } from '../utils/getPriceForDisplay.js';

function RoomGrid({
  reservations,
  onDelete,
  onConfirm,
  onEdit,
  loadedReservations,
  hotelId,
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
  flipAllMemos, // [추가] flipAllMemos Prop 추가
  sortOrder,
  needsConsent, // 개인정보 동의 필요 여부
}) {
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

  // 전체 방 카드 플립 상태 관리
  useEffect(() => {
    if (flipAllMemos) {
      const allIndexes = new Set();
      reservations.forEach((_, idx) => allIndexes.add(idx));
      setFlippedIndexes(allIndexes);
    } else {
      setFlippedIndexes(new Set());
    }
  }, [flipAllMemos, reservations]);

  // 인라인 수정 모드 관련 (원본에서는 editModes 관련 코드는 삭제)
  const [editedValues, setEditedValues] = useState({});
  useEffect(() => {
    if (!newlyCreatedId) return;
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
  }, [reservations, newlyCreatedId]);

  useEffect(() => {
    if (reservations.length > 0 && highlightFirstCard) {
      const firstCardIndex = 0;
      setAutoFlips((prev) => new Set(prev).add(firstCardIndex));
      const timer = setTimeout(() => {
        setAutoFlips((prev) => {
          const newSet = new Set(prev);
          newSet.delete(firstCardIndex);
          return newSet;
        });
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [reservations, highlightFirstCard]);

  useEffect(() => {
    setFlippedIndexes(new Set());
  }, [reservations]);

  useEffect(() => {
    const updateIsEvening = () => {
      const now = new Date();
      const hours = now.getHours();
      const isNowEvening = hours >= 2 && hours < 6;
      setIsEvening(isNowEvening);
      let nextTransition;
      if (isNowEvening) {
        nextTransition = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          6,
          0,
          0,
          0
        );
      } else {
        const nextDay = hours >= 6 ? now.getDate() + 1 : now.getDate();
        nextTransition = new Date(
          now.getFullYear(),
          now.getMonth(),
          nextDay,
          2,
          0,
          0,
          0
        );
      }
      const msUntilNextTransition = nextTransition - now;
      setTimeout(updateIsEvening, msUntilNextTransition);
    };
    updateIsEvening();
    return () => clearTimeout(updateIsEvening);
  }, []);

  // 초기 로드시 로컬 스토리지에서 메모 가져오기
  useEffect(() => {
    const savedMemos = JSON.parse(localStorage.getItem('localMemos') || '{}');
    setMemos(savedMemos);
  }, [setMemos]);

  // 메모 편집 모드 토글 함수
  const toggleMemoEdit = useCallback(
    (reservationId) => {
      setMemos((prev) => {
        const current = prev[reservationId] || { text: '', isEditing: false };
        const isEditing = !current.isEditing;
        const updatedMemos = {
          ...prev,
          [reservationId]: { ...current, isEditing },
        };
        if (isEditing) {
          setTimeout(() => {
            if (memoRefs.current[reservationId]) {
              memoRefs.current[reservationId].focus();
            }
          }, 0);
        }
        return updatedMemos;
      });
    },
    [setMemos]
  );

  const handleMemoChange = useCallback(
    (reservationId, value) => {
      setMemos((prev) => ({
        ...prev,
        [reservationId]: { ...prev[reservationId], text: value },
      }));
    },
    [setMemos]
  );

  const handleMemoSave = useCallback(
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

  const handleMemoCancel = useCallback(
    (reservationId) => {
      setMemos((prev) => ({
        ...prev,
        [reservationId]: { ...prev[reservationId], isEditing: false },
      }));
    },
    [setMemos]
  );

  const handleDeleteClick = async (reservationId, siteName) => {
    if (window.confirm('정말로 이 예약을 삭제하시겠습니까?')) {
      setIsProcessing(true);
      setError(null);
      try {
        await onDelete(reservationId, hotelId, siteName);
        console.log('예약이 성공적으로 삭제되었습니다.');
        setMemos((prevMemos) => {
          const updatedMemos = { ...prevMemos };
          delete updatedMemos[reservationId];
          localStorage.setItem('localMemos', JSON.stringify(updatedMemos));
          return updatedMemos;
        });
      } catch (error) {
        console.error(`예약 삭제 실패 (${reservationId}):`, error);
        setError('예약 삭제에 실패했습니다. 다시 시도해주세요.');
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleConfirmClick = async (reservationId) => {
    if (window.confirm('이 예약을 확정하시겠습니까?')) {
      setIsProcessing(true);
      setError(null);
      try {
        await onConfirm(reservationId, hotelId);
        alert('예약이 성공적으로 확정되었습니다.');
      } catch (error) {
        console.error(`예약 확정 실패 (${reservationId}):`, error);
        setError('예약 확정에 실패했습니다. 다시 시도해주세요.');
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleEditSave = useCallback(
    async (reservationId, updatedData) => {
      setIsProcessing(true);
      setError(null);
      try {
        const checkInDateStr = updatedData.checkInDate || null;
        const checkOutDateStr = updatedData.checkOutDate || null;
        if (checkInDateStr) {
          const checkInDate = new Date(checkInDateStr);
          checkInDate.setHours(14, 0, 0, 0);
          updatedData.checkIn = checkInDate.toISOString();
        }
        if (checkOutDateStr) {
          const checkOutDate = new Date(checkOutDateStr);
          checkOutDate.setHours(11, 0, 0, 0);
          updatedData.checkOut = checkOutDate.toISOString();
        }
        delete updatedData.checkInDate;
        delete updatedData.checkOutDate;
        await onEdit(reservationId, updatedData, hotelId);
        alert('예약이 성공적으로 수정되었습니다.');
        const card = document.querySelector(
          `.room-card[data-id="${reservationId}"]`
        );
        if (card) {
          card.classList.add('temporary-highlight');
          setTimeout(() => {
            card.classList.remove('temporary-highlight');
          }, 10000);
        }
        setSelectedReservation(null);
      } catch (error) {
        console.error(`예약 수정 실패 (${reservationId}):`, error);
        setError('예약 수정에 실패했습니다. 다시 시도해주세요.');
      } finally {
        setIsProcessing(false);
      }
    },
    [hotelId, onEdit]
  );

  const openInvoiceModal = (reservation) => {
    if (!isModalOpen) {
      setSelectedReservation(reservation);
      setModalType('invoice');
      setIsModalOpen(true);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedReservation(null);
    setModalType(null);
  };

  const calcNights = (checkInDate, checkOutDate) => {
    const inDate = new Date(checkInDate);
    const outDate = new Date(checkOutDate);
    const diff = outDate.getTime() - inDate.getTime();
    const nights = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return nights;
  };

  const recalcPrice = (data) => {
    const { checkInDate, checkOutDate, roomInfo } = data;
    if (!checkInDate || !checkOutDate || !roomInfo) return data.price || 0;
    const selectedRoom = roomTypes.find((r) => r.type === roomInfo);
    const nightlyPrice = selectedRoom ? selectedRoom.price : 0;
    const nights = calcNights(checkInDate, checkOutDate);
    if (nights <= 0) return 0;
    const totalPrice = nightlyPrice * nights;
    return totalPrice.toString();
  };

  const handleFieldChange = (reservationId, field, value) => {
    setEditedValues((prev) => {
      const updated = {
        ...prev[reservationId],
        [field]: value,
      };
      if (
        field === 'checkInDate' ||
        field === 'checkOutDate' ||
        field === 'roomInfo'
      ) {
        updated.price = recalcPrice(updated);
      }
      return {
        ...prev,
        [reservationId]: updated,
      };
    });
  };

  const handleCardFlip = (index, reservationId) => {
    const memo = memos[reservationId] || { isEditing: false };
    if (memo.isEditing) return;
    setFlippedIndexes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) newSet.delete(index);
      else newSet.add(index);
      return newSet;
    });
  };

  const getPaymentMethodIcon = (paymentMethod) => {
    switch (paymentMethod) {
      case 'Card':
        return <FaCreditCard className="payment-icon" title="신용카드 결제" />;
      case 'Cash':
        return <FaMoneyBillWave className="payment-icon" title="현금 결제" />;
      case 'Account Transfer':
        return <FaUniversity className="payment-icon" title="계좌 이체 결제" />;
      case 'Pending':
        return (
          <FaHourglassHalf className="payment-icon" title="결제 대기 중" />
        );
      default:
        return null;
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedReservation) {
      handleEditSave(selectedReservation._id, {
        ...selectedReservation,
        ...editedValues[selectedReservation._id],
      });
    }
  };

  // 액션 버튼 렌더링 함수 (예약 카드 상단에 버튼들을 표시)
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
    const checkInDate = reservation.parsedCheckInDate;
    const checkOutDate = reservation.parsedCheckOutDate;
    const now = new Date();
    let stayDuration = 0;
    if (checkInDate && checkOutDate) {
      stayDuration = (checkOutDate - checkInDate) / (1000 * 60 * 60 * 24);
    }
    const checkInPassed = checkInDate && now > checkInDate;
    let after7PMOnCheckInDate = false;
    if (checkInDate) {
      const sevenPM = new Date(
        checkInDate.getFullYear(),
        checkInDate.getMonth(),
        checkInDate.getDate(),
        19,
        0,
        0
      );
      after7PMOnCheckInDate = now >= sevenPM;
    }
    let isAutoConfirmed = false;
    const isDaesil =
      reservation.customerName && reservation.customerName.includes('대실');
    if (!isCancelled && !isConfirmed) {
      if (isOTA && after7PMOnCheckInDate) {
        isAutoConfirmed = true;
      } else if (stayDuration <= 1 && checkInPassed) {
        isAutoConfirmed = true;
      } else if (isDaesil) {
        const checkInPlus3h = new Date(
          checkInDate.getTime() + 3 * 60 * 60 * 1000
        );
        if (now >= checkInPlus3h) {
          isAutoConfirmed = true;
          onConfirm(reservation._id, hotelId);
        }
      }
    }
    const finalIsConfirmed = isConfirmed || isAutoConfirmed;
    let canDelete = false;
    let canConfirm = false;
    let canEdit = false;
    if (isOTA) {
      canEdit = false;
      if (isCancelled) {
        canDelete = true;
      } else if (!finalIsConfirmed) {
        canDelete = true;
      }
    } else if (reservation.siteName === '현장예약') {
      if (isCancelled || !finalIsConfirmed) {
        canDelete = true;
        canConfirm = !isCancelled;
        canEdit = true;
      } else {
        canEdit = true;
      }
    }
    return (
      <span className="button-group">
        {canDelete && (
          <button
            className="action-button delete-button small-button red-delete"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteClick(reservation._id, reservation.siteName);
            }}
            disabled={isProcessing}
            title="예약 삭제"
          >
            삭제
          </button>
        )}
        {canConfirm && (
          <button
            className="action-button confirm-button small-button blue-confirm"
            onClick={(e) => {
              e.stopPropagation();
              handleConfirmClick(reservation._id);
            }}
            disabled={isProcessing}
            title="예약 확정"
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
              const checkIn = reservation.checkIn
                ? new Date(reservation.checkIn)
                : new Date();
              const checkOut = reservation.checkOut
                ? new Date(reservation.checkOut)
                : addDays(checkIn, 1);
              const checkInDate = format(checkIn, 'yyyy-MM-dd');
              const checkOutDate = format(checkOut, 'yyyy-MM-dd');
              const reservationDate = reservation.reservationDate
                ? format(
                    parseISO(reservation.reservationDate),
                    'yyyy-MM-dd HH:mm'
                  )
                : format(new Date(), 'yyyy-MM-dd HH:mm');
              const priceVal = extractPrice(reservation.price);
              const initialData = {
                reservationNo: reservation.reservationNo || reservation._id,
                customerName: reservation.customerName || '',
                phoneNumber: reservation.phoneNumber || '',
                checkInDate,
                checkOutDate,
                reservationDate,
                roomInfo:
                  reservation.roomInfo ||
                  (roomTypes.length > 0 ? roomTypes[0].type : ''),
                price: priceVal || 0,
                paymentMethod: reservation.paymentMethod || 'Pending',
                specialRequests: reservation.specialRequests || '',
              };
              initialData.price = recalcPrice(initialData);
              setEditedValues((prev) => ({
                ...prev,
                [reservation._id]: initialData,
              }));
              setSelectedReservation({ ...reservation });
            }}
            disabled={isProcessing}
            title="예약 수정"
          >
            수정
          </button>
        )}
        {finalIsConfirmed && (
          <span className="confirmed-label">
            <FaCheck className="confirmed-icon" title="예약 확정됨" />
          </span>
        )}
      </span>
    );
  };

  const isAnyEditing = false;

  const sortedReservations = useMemo(() => {
    return [...reservations].sort((a, b) => {
      const dateA = new Date(a.checkIn);
      const dateB = new Date(b.checkIn);
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });
  }, [reservations, sortOrder]);

  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        boxSizing: 'border-box',
        position: 'relative',
      }}
    >
      <>
        <div
          className={`edit-panel-left ${
            selectedReservation && !isModalOpen ? 'open' : ''
          }`}
        >
          {selectedReservation &&
            !isModalOpen &&
            editedValues[selectedReservation._id] && (
              <form onSubmit={handleSubmit}>
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
                    {roomTypes.map((room, i) => (
                      <option key={i} value={room.type}>
                        {room.type}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  가격 (KRW):
                  <input
                    type="number"
                    value={editedValues[selectedReservation._id].price}
                    onChange={(e) =>
                      handleFieldChange(
                        selectedReservation._id,
                        'price',
                        e.target.value
                      )
                    }
                    min="0"
                    step="1"
                  />
                </label>
                <label>
                  결제방법/상태:
                  {availableOTAs.includes(selectedReservation.siteName) ? (
                    <input
                      type="text"
                      value={
                        editedValues[selectedReservation._id].paymentMethod ||
                        'OTA'
                      }
                      disabled
                      style={{ backgroundColor: '#eee' }}
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
                    value={
                      editedValues[selectedReservation._id].specialRequests
                    }
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

        <div className="grid-wrapper" ref={gridRef} style={{ flex: 1 }}>
          <div
            className={`grid-container ${isEvening ? 'evening-mode' : ''} ${
              isAnyEditing ? 'editing-active' : ''
            }`}
          >
            {sortedReservations.map((reservation, index) => {
              const displayNumber = sortedReservations.length - index;
              const isHighlighted =
                highlightedReservationIds.includes(reservation._id) &&
                isSearching;
              const isCancelled =
                isCancelledStatus(
                  reservation.reservationStatus || '',
                  reservation.customerName || ''
                ) || reservation._id.includes('Canceled');
              const isOnsiteReservation = reservation.siteName === '현장예약';
              const isFirstCard = index === 0;
              const isFlipped = flippedIndexes.has(index);
              const isEditingThisCard =
                selectedReservation &&
                selectedReservation._id === reservation._id;
              const editMode = isEditingThisCard;
              const cardClassNames = [
                'room-card',
                getBorderColor(reservation),
                isCancelled ? 'cancelled' : '',
                isHighlighted ? 'highlighted' : '',
                editMode ? 'edit-mode' : '',
              ]
                .filter(Boolean)
                .join(' ');
              const checkInDateOnly = new Date(
                reservation.parsedCheckInDate.getFullYear(),
                reservation.parsedCheckInDate.getMonth(),
                reservation.parsedCheckInDate.getDate()
              );
              const checkOutDateOnly = new Date(
                reservation.parsedCheckOutDate.getFullYear(),
                reservation.parsedCheckOutDate.getMonth(),
                reservation.parsedCheckOutDate.getDate()
              );
              const dayDifference =
                (checkOutDateOnly - checkInDateOnly) / (1000 * 60 * 60 * 24);
              let stayLabel = '';
              if (dayDifference === 0) {
                stayLabel = '(대실)';
              } else if (
                dayDifference === 1 &&
                reservation.customerName.includes('대실')
              ) {
                stayLabel = '(대실)';
              } else if (dayDifference === 1) {
                stayLabel = '(1박)';
              } else if (dayDifference >= 2) {
                stayLabel = `(${dayDifference}박)`;
              }
              const memo = memos[reservation._id] || {
                text: '',
                isEditing: false,
              };
              return (
                <div
                  key={reservation._id}
                  className={cardClassNames}
                  data-id={reservation._id}
                  style={{
                    position: 'relative',
                    cursor: editMode ? 'default' : 'pointer',
                    transition: 'opacity 0.2s ease-in-out',
                  }}
                  onClick={() => {
                    if (!memo.isEditing && !editMode)
                      handleCardFlip(index, reservation._id);
                  }}
                >
                  <div
                    className={`flip-container ${
                      isFlipped && !editMode ? 'flipped' : ''
                    } ${
                      isFirstCard && autoFlips.has(index) ? 'auto-flip' : ''
                    }`}
                    style={{
                      position: 'relative',
                      cursor: editMode ? 'default' : 'pointer',
                    }}
                  >
                    <div className="room-card-inner">
                      <div className="room-card-front">
                        <div className="card-content">
                          <div className="card-header">
                            <h3>
                              No: {displayNumber} {stayLabel}{' '}
                              {renderActionButtons(reservation)}
                            </h3>
                          </div>
                          <p>{reservation._id.replace(`${hotelId}-`, '')}</p>
                          <p>
                            예약자: {reservation.customerName || '정보 없음'}
                          </p>
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
                            {reservation.roomInfo
                              ? reservation.roomInfo.length > 30
                                ? `${reservation.roomInfo.substring(0, 21)}...`
                                : reservation.roomInfo
                              : '정보 없음'}
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
                          <p>
                            고객요청: {reservation.specialRequests || '없음'}
                          </p>
                          <p className="payment-method">
                            결제방법:{' '}
                            {getPaymentMethodIcon(reservation.paymentMethod)}{' '}
                            {reservation.paymentMethod || '정보 없음'}
                          </p>
                        </div>
                        <div className="site-info-wrapper">
                          <p className="site-info">
                            사이트:{' '}
                            <span
                              className={
                                isOnsiteReservation ? 'onsite-reservation' : ''
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
                            aria-label={`Open invoice for reservation ${reservation.customerName}`}
                            title="인보이스 보기"
                          >
                            <FaFileInvoice size={20} />
                          </button>
                        </div>
                      </div>
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
                            <div className="memo-text-display">
                              {memo.text || ''}
                            </div>
                          ) : (
                            <textarea
                              ref={(el) =>
                                (memoRefs.current[reservation._id] = el)
                              }
                              value={memo.text}
                              onChange={(e) =>
                                handleMemoChange(
                                  reservation._id,
                                  e.target.value
                                )
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
            })}
          </div>
          {isProcessing && <p>처리 중...</p>}
          {error && <p className="error-message">{error}</p>}
          {isModalOpen && modalType === 'invoice' && selectedReservation && (
            <InvoiceModal
              isOpen={isModalOpen}
              onRequestClose={closeModal}
              onSave={handleEditSave}
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
      </>
    </div>
  );
}

RoomGrid.propTypes = {
  reservations: PropTypes.array.isRequired,
  onDelete: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  onEdit: PropTypes.func.isRequired,
  loadedReservations: PropTypes.array.isRequired,
  hotelId: PropTypes.string.isRequired,
  highlightFirstCard: PropTypes.bool.isRequired,
  hotelAddress: PropTypes.string.isRequired,
  phoneNumber: PropTypes.string,
  email: PropTypes.string.isRequired,
  roomTypes: PropTypes.array.isRequired,
  highlightedReservationIds: PropTypes.arrayOf(PropTypes.string),
  isSearching: PropTypes.bool,
  newlyCreatedId: PropTypes.string,
  flipAllMemos: PropTypes.bool.isRequired,
  sortOrder: PropTypes.string.isRequired,
  needsConsent: PropTypes.bool.isRequired,
};

// Border 색상 결정 함수
function getBorderColor(reservation) {
  let checkInDate, checkOutDate;
  try {
    checkInDate = reservation.parsedCheckInDate;
    checkOutDate = reservation.parsedCheckOutDate;
    if (
      !checkInDate ||
      !checkOutDate ||
      isNaN(checkInDate.getTime()) ||
      isNaN(checkOutDate.getTime())
    ) {
      throw new Error('Invalid date format');
    }
  } catch (error) {
    console.error('Error calculating dates:', error);
    return '';
  }
  const hasDaesil =
    (reservation.customerName && reservation.customerName.includes('대실')) ||
    (reservation.roomInfo && reservation.roomInfo.includes('대실'));
  if (hasDaesil) {
    return 'border-primary-soft-green';
  }
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
  const dayDifference =
    (checkOutDateOnly - checkInDateOnly) / (1000 * 60 * 60 * 24);
  if (dayDifference === 0) {
    return 'border-primary-soft-green';
  } else if (dayDifference === 1) {
    return 'border-accent-coral';
  } else if (dayDifference >= 2) {
    return 'border-primary-deep-blue';
  }
  return '';
}

export default RoomGrid;
