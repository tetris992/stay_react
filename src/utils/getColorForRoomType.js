// src/utils/getColorForRoomType.js
export function getColorForRoomType(roomType) {
  // 객실 타입이 없으면 기본 배경색 반환
  if (!roomType) return '#f9f9f9';

  // 20가지 이상의 파스텔 톤 색상 배열
  const colors = [
    '#F8E1E9', // 연한 핑크
    '#E1F8E5', // 연한 민트
    '#E8F0FE', // 연한 블루
    '#FFF3E0', // 연한 오렌지
    '#F3E5F5', // 연한 라벤더
    '#E0F7FA', // 연한 시안
    '#FFF9C4', // 연한 옐로우
    '#DCE8F5', // 연한 하늘색
    '#FCE4EC', // 연한 로즈
    '#E6EEFA', // 연한 코랄블루
    '#F1F8E9', // 연한 라임
    '#FFEBEE', // 연한 레드
    '#E0F2F1', // 연한 아쿠아
    '#F9FBE7', // 연한 라이트그린
    '#EDE7F6', // 연한 퍼플
    '#FFF8E1', // 연한 크림
    '#E0ECE4', // 연한 민트그린
    '#F6E0E7', // 연한 피치
    '#E8F5E9', // 연한 셀러던
    '#E1F5FE', // 연한 스카이블루
    '#FBE9E7', // 연한 코랄
    '#E0F4F8', // 연한 터코이즈
    '#FFFDE7', // 연한 버터옐로우
    '#F3E0E8', // 연한 라일락
  ];

  // 해시 계산으로 색상 선택
  let hash = 0;
  for (let i = 0; i < roomType.length; i++) {
    hash = roomType.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}