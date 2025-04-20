import React, { useEffect, useState } from 'react';
import './RoomStatusChart.css';

function RoomStatusChart({ totalRooms, roomsSold, remainingRooms }) {
  const soldPercentage = (roomsSold / totalRooms) * 100;
  const soldHeight = `${soldPercentage}%`; // 판매된 객실 비율
  const remainingHeight = `${100 - soldPercentage}%`; // 잔여 객실 비율

  const [isAnimated, setIsAnimated] = useState(false);

  // 페이지 로드 시 애니메이션 시작
  useEffect(() => {
    setIsAnimated(true);
  }, []);

  return (
    <div className="room-status-tower-container">
      <div className="tower-wrapper">
        <div className="tower">
          <div
            className={`tower-filled ${isAnimated ? 'animate' : ''}`}
            style={{ height: soldHeight }}
            title={`판매된 객실: ${roomsSold} (${soldPercentage.toFixed(1)}%)`}
          />
          <div
            className="tower-remaining"
            style={{ height: remainingHeight }}
            title={`잔여 객실: ${remainingRooms}`}
          />
        </div>
        <div className="tower-percentage">
          {soldPercentage.toFixed(1)}%
        </div>
      </div>
      <div className="status-info">
        <p className="status-sub">
          판매: {roomsSold} / 잔여: {remainingRooms}
        </p>
      </div>
    </div>
  );
}

export default RoomStatusChart;