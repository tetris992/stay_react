// src/utils/matchRoomType.js
import { defaultRoomTypes } from '../config/defaultRoomTypes';

/**
 * 문자열을 클리닝합니다.
 * - 괄호와 그 내부의 텍스트를 제거합니다.
 * - 영문, 한글, 숫자 및 공백 이외의 문자를 모두 제거합니다.
 * - 여러 공백은 하나로 줄이고 트리밍합니다.
 *
 * @param {string} text - 입력 문자열
 * @returns {string} - 클리닝된 문자열 (소문자)
 */
function cleanString(text) {
  if (!text) return '';
  // 괄호와 그 내부의 내용을 제거
  let cleaned = text.replace(/\([^)]*\)/g, ' ');
  // 영문, 한글, 숫자, 공백 이외의 모든 문자 제거
  cleaned = cleaned.replace(/[^a-zA-Z0-9가-힣\s]/g, ' ');
  // 여러 공백을 하나로 축소 및 트리밍
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned.toLowerCase();
}

/**
 * 문자열을 토큰화합니다.
 * cleanString()을 호출하여 먼저 클리닝한 후, 공백을 기준으로 단어 배열로 분리합니다.
 *
 * @param {string} text - 입력 문자열
 * @returns {Array<string>} - 토큰 배열
 */
function tokenize(text) {
  const cleaned = cleanString(text);
  return cleaned.split(' ').filter(Boolean);
}

/**
 * 두 문자열 사이의 Levenshtein Distance를 계산하는 함수
 *
 * @param {string} a
 * @param {string} b
 * @returns {number} - 두 문자열 사이의 편집 거리
 */
function levenshteinDistance(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

/**
 * 두 문자열 간의 유사도를 0 ~ 1 사이의 값으로 반환합니다.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number} - 유사도 (1에 가까울수록 유사)
 */
function similarity(a, b) {
  const distance = levenshteinDistance(a, b);
  const maxLength = Math.max(a.length, b.length);
  return maxLength === 0 ? 1 : (maxLength - distance) / maxLength;
}

/**
 * 예약의 roomInfo와 호텔 세팅의 객실타입(및 별칭)을 비교하여 매칭된 객실타입 객체를 반환합니다.
 *
 * 1. 먼저, roomInfo를 cleanString()으로 클리닝하여 괄호 및 특수문자를 제거한 후 정확히 일치하는지 확인합니다.
 * 2. 정확한 매칭이 없으면, 토큰화한 단어 배열을 기반으로 유사도(fuzzy matching)를 계산하여 가장 유사한 객실타입을 선택합니다.
 *
 * @param {string} roomInfo - 예약의 roomInfo 값
 * @param {Array} [roomTypes=defaultRoomTypes] - 객실타입 배열
 * @returns {Object|null} - 매칭된 객실타입 객체 또는 매칭되지 않으면 null
 */
export const matchRoomType = (roomInfo, roomTypes = defaultRoomTypes) => {
  if (!roomInfo) return null;
  
  // 0. 입력 roomInfo 클리닝: 괄호 및 특수문자 제거
  const cleanedRoomInfo = cleanString(roomInfo);
  
  // 1. 정확한 매칭 시도: 호텔 세팅의 각 객실타입(및 별칭)도 클리닝 후 비교
  for (const roomType of roomTypes) {
    const candidates = [
      roomType.type,
      roomType.nameKor,
      roomType.nameEng,
      ...(roomType.aliases || [])
    ];
    for (const candidate of candidates) {
      if (cleanString(candidate) === cleanedRoomInfo) {
        return roomType;
      }
    }
  }
  
  // 2. 토큰 기반 유사도 매칭
  const roomTokens = tokenize(cleanedRoomInfo);
  let bestMatch = null;
  let bestScore = 0;
  const threshold = 0.4; // 임계치, 필요에 따라 조정
  
  roomTypes.forEach((roomType) => {
    const candidates = [
      roomType.type,
      roomType.nameKor,
      roomType.nameEng,
      ...(roomType.aliases || [])
    ].filter(Boolean);
    
    let scoreSum = 0;
    let comparisons = 0;
    
    candidates.forEach((candidate) => {
      const candidateTokens = tokenize(candidate);
      candidateTokens.forEach((ct) => {
        comparisons++;
        if (roomTokens.includes(ct)) {
          scoreSum += 1;
        } else {
          let maxSim = 0;
          roomTokens.forEach((rt) => {
            const sim = similarity(rt, ct);
            if (sim > maxSim) {
              maxSim = sim;
            }
          });
          scoreSum += maxSim;
        }
      });
    });
    
    const avgScore = comparisons > 0 ? scoreSum / comparisons : 0;
    if (avgScore > bestScore) {
      bestScore = avgScore;
      bestMatch = roomType;
    }
  });
  
  return bestScore >= threshold ? bestMatch : null;
};
