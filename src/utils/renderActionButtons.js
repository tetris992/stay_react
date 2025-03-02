// ../utils/renderActionButtons

import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrashAlt, faCheck, faEdit } from '@fortawesome/free-solid-svg-icons';
import { isOtaReservation } from './roomGridUtils';
import { isCancelledStatus } from './isCancelledStatus';

/**
 * 예약 카드 액션 버튼을 렌더링하는 공통 유틸 함수
 */
export const renderActionButtons = ({
  reservation,
  handleDeleteClickHandler,
  handleConfirmClickHandler,
  handleEditStart,
}) => {
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
    canDelete = !isConfirmed || isCancelled;
  } else if (reservation.siteName === '현장예약') {
    canConfirm = !isConfirmed;
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
      {canEdit && (
        <button
          className="action-button edit-button"
          onClick={(e) => {
            e.stopPropagation();
            handleEditStart();
          }}
          data-tooltip="수정"
        >
          <FontAwesomeIcon icon={faEdit} />
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
      {isConfirmed && (
        <span className="confirmed-label">
          <FontAwesomeIcon icon={faCheck} title="예약 확정됨" />
        </span>
      )}
    </span>
  );
};
