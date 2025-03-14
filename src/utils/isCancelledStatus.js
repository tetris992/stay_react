// src/utils/isCancelledStatus.js

export function isCancelledStatus(
  reservationStatus,
  customerName,
  roomInfo,
  reservationNo
) {
  const cancelKeywords = [
    '취소',
    '예약취소',
    '고객취소',
    '취소된 예약',
    'Canceled',
    'Cancelled',
    'キャンセル',
    'Annullé',
    'Anulado',
    'Abgebrochen',
  ];

  // 입력값 검증 및 기본값 설정
  const safeReservationStatus = reservationStatus || '';
  const safeCustomerName = customerName || '';
  const safeRoomInfo = roomInfo || '';
  const safeReservationNo = reservationNo || '';

  // 디버깅 로그 추가 (필요 시)
  if (process.env.NODE_ENV === 'development') {
    if (!reservationStatus) console.warn('isCancelledStatus: reservationStatus is undefined');
    if (!customerName) console.warn('isCancelledStatus: customerName is undefined');
    if (!roomInfo) console.warn('isCancelledStatus: roomInfo is undefined');
    if (!reservationNo) console.warn('isCancelledStatus: reservationNo is undefined');
  }

  // reservationStatus에서 취소 키워드 확인
  const statusCancelled = cancelKeywords.some((keyword) =>
    safeReservationStatus.toLowerCase().includes(keyword.toLowerCase())
  );

  // customerName에 '*' 포함 여부 확인
  const nameCancelled = safeCustomerName.includes('*');

  // roomInfo에서 취소 키워드 확인
  const roomInfoCancelled = cancelKeywords.some((keyword) =>
    safeRoomInfo.toLowerCase().includes(keyword.toLowerCase())
  );

  // reservationNo에서 취소 키워드 확인
  const reservationNoCancelled = cancelKeywords.some((keyword) =>
    safeReservationNo.toLowerCase().includes(keyword.toLowerCase())
  );

  return statusCancelled || nameCancelled || roomInfoCancelled || reservationNoCancelled;
}