// src/utils/getColorForRoomType.js
export function getColorForRoomType(roomType) {
    // 객실 타입이 없으면 기본 배경색 반환
    if (!roomType) return '#f9f9f9';
    // 미리 정해진 색상 배열 (필요에 따라 추가하거나 변경 가능)
    const colors = [
      '#AED581', // 연두색
      '#81D4FA', // 하늘색
      '#FFB74D', // 주황색
      '#BA68C8', // 보라색
      '#4DB6AC', // 청록색
      '#FFD54F', // 노란색
      '#4FC3F7', // 파랑색
    ];
    let hash = 0;
    for (let i = 0; i < roomType.length; i++) {
      hash = roomType.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  }
  