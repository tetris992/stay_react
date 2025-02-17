// CustomDragLayer.js
import React from 'react';
import { useDragLayer } from 'react-dnd';
import { format, parseISO } from 'date-fns';

const layerStyles = {
  position: 'fixed',
  pointerEvents: 'none',
  zIndex: 100,
  left: 0,
  top: 0,
  width: '100%',
  height: '100%',
};

// 여기서는 현재 포인터 위치와 드래그 시작 시 드래그 소스의 위치(initialSourceClientOffset)를 이용해 차이를 계산합니다.
function getItemStyles(initialOffset, currentOffset) {
    if (!initialOffset || !currentOffset) {
      return { display: 'none' };
    }
    // 현재 마우스 위치에서 오른쪽 50px, 아래로 40px 추가
    const transform = `translate(${currentOffset.x - 25}px, ${currentOffset.y - 5}px)`;
    return {
      transform,
      WebkitTransform: transform,
    };
  }

function DragPreviewCard({ reservationData, hotelId, getPriceForDisplay }) {
  // 필요에 따라 stayLabel 계산 로직을 추가할 수 있습니다.
  const stayLabel = ''; // 예시에서는 빈 문자열

  return (
    <div className="room-card drag-preview" style={{ width: '300px' }}>
      <div className="flip-container">
        <div className="room-card-inner">
          <div className="room-card-front">
            <div className="content-footer-wrapper">
              <div className="card-content">
                <div className="card-header">
                  <h3>{stayLabel}</h3>
                </div>
                <p>{reservationData._id.replace(`${hotelId}-`, '')}</p>
                <p>예약자: {reservationData.customerName || '정보 없음'}</p>
                <p>
                  체크인:{' '}
                  {reservationData.parsedCheckInDate
                    ? format(new Date(reservationData.parsedCheckInDate), 'yyyy-MM-dd HH:mm')
                    : '정보 없음'}
                </p>
                <p>
                  체크아웃:{' '}
                  {reservationData.parsedCheckOutDate
                    ? format(new Date(reservationData.parsedCheckOutDate), 'yyyy-MM-dd HH:mm')
                    : '정보 없음'}
                </p>
                <p>가격: {getPriceForDisplay(reservationData)}</p>
                <p>객실 정보: {reservationData.roomInfo || '정보 없음'}</p>
                <p>
                  예약일:{' '}
                  {reservationData.reservationDate
                    ? format(parseISO(reservationData.reservationDate), 'yyyy-MM-dd')
                    : '정보 없음'}
                </p>
                {reservationData.phoneNumber && (
                  <p>전화번호: {reservationData.phoneNumber}</p>
                )}
                <p>고객요청: {reservationData.specialRequests || '없음'}</p>
              </div>
              <div className="site-info-footer">
                <div className="site-info-wrapper">
                  <p className="site-info">
                    사이트:{' '}
                    <span
                      className={
                        reservationData.siteName === '현장예약'
                          ? 'onsite-reservation'
                          : ''
                      }
                    >
                      {reservationData.siteName || '정보 없음'}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>
          {/* 필요에 따라 카드 뒷면 내용도 추가 가능 */}
        </div>
      </div>
    </div>
  );
}

export default function CustomDragLayer({ hotelId, getPriceForDisplay }) {
  const { item, isDragging, currentOffset, initialSourceClientOffset } = useDragLayer((monitor) => ({
    item: monitor.getItem(),
    isDragging: monitor.isDragging(),
    currentOffset: monitor.getClientOffset(),
    initialSourceClientOffset: monitor.getInitialSourceClientOffset(),
  }));

  if (!isDragging) {
    return null;
  }

  return (
    <div style={layerStyles}>
      <div style={getItemStyles(initialSourceClientOffset, currentOffset)}>
        <DragPreviewCard
          reservationData={item.reservationData}
          hotelId={hotelId}
          getPriceForDisplay={getPriceForDisplay}
        />
      </div>
    </div>
  );
}
