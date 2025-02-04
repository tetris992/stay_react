import { defaultRoomTypes } from '../config/defaultRoomTypes';

/**
 * 문자열을 클리닝합니다.
 * - 괄호 및 그 내부의 텍스트를 제거합니다.
 * - 영문, 한글, 숫자, 공백 이외의 문자를 모두 제거합니다.
 * - 여러 공백을 하나로 축소하고 trim합니다.
 * - 결과를 소문자로 반환합니다.
 *
 * @param {string} text - 입력 문자열
 * @returns {string} - 클리닝된 문자열
 */
function cleanString(text) {
  if (!text) return '';
  // 괄호와 그 내부의 텍스트 제거
  let cleaned = text.replace(/\([^)]*\)/g, ' ');
  // 영문, 한글, 숫자, 공백 외의 문자 제거
  cleaned = cleaned.replace(/[^a-zA-Z0-9가-힣\s]/g, ' ');
  // 여러 공백 축소 및 트리밍
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned.toLowerCase();
}

/**
 * 토큰화: cleanString() 처리 후, 공백 기준으로 분리합니다.
 *
 * @param {string} text - 입력 문자열
 * @returns {Array<string>} - 토큰 배열
 */
function tokenize(text) {
  const cleaned = cleanString(text);
  return cleaned.split(' ').filter(Boolean);
}

/**
 * 두 문자열 사이의 Levenshtein Distance를 계산합니다.
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
 * 두 문자열 간의 유사도를 0~1 사이의 값으로 반환합니다.
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
 * 주어진 문자열에서 접미사 "룸"을 제거한 버전을 반환합니다.
 *
 * @param {string} str
 * @returns {string}
 */
function removeRoomSuffix(str) {
  return str.replace(/룸$/i, '').trim();
}

/**
 * 예약의 roomInfo와 호텔 세팅의 객실타입(및 별칭)을 비교하여 매칭된 객실타입 객체를 반환합니다.
 *
 * 1. 먼저, roomInfo에서 괄호 및 내부 텍스트를 제거한 후 cleanString() 처리합니다.
 * 2. 호텔 세팅의 각 객실타입과 별칭도 cleanString()한 후, 그리고 접미사 "룸"을 제거한 버전을 함께
 *    비교하여, 만약 하나라도 서로 포함되면 바로 해당 객실타입을 반환합니다.
 * 3. 정확한 매칭이 없으면, 토큰 기반 유사도(fuzzy matching)를 사용하여 매칭합니다.
 *
 * @param {string} roomInfo - 예약의 roomInfo 값
 * @param {Array} [roomTypes=defaultRoomTypes] - 객실타입 배열
 * @returns {Object|null} - 매칭된 객실타입 객체 또는 매칭되지 않으면 null
 */
export const matchRoomType = (roomInfo, roomTypes = defaultRoomTypes) => {
  if (!roomInfo) return null;

  // 0. 전처리: 괄호 및 내부 텍스트 제거하고 클리닝
  const cleanedRoomInfo = cleanString(roomInfo);
  // 또한, 접미사 "룸" 제거 버전도 생성 (예: "클래식 더블룸" → "클래식 더블")
  const cleanedRoomInfoNoRoom = removeRoomSuffix(cleanedRoomInfo);

  // 1. 정확한(부분) 매칭 시도: 호텔 세팅의 각 후보(cleanString 처리 및 접미사 제거한 값)와 비교
  for (const roomType of roomTypes) {
    const candidates = [
      roomType.type,
      roomType.nameKor,
      roomType.nameEng,
      ...(roomType.aliases || [])
    ];
    for (const candidate of candidates) {
      const cleanedCandidate = cleanString(candidate);
      const candidateNoRoom = removeRoomSuffix(cleanedCandidate);
      if (
        cleanedRoomInfo.includes(cleanedCandidate) ||
        cleanedRoomInfo.includes(candidateNoRoom) ||
        cleanedCandidate.includes(cleanedRoomInfo) ||
        candidateNoRoom.includes(cleanedRoomInfoNoRoom)
      ) {
        return roomType;
      }
    }
  }

  // 2. 토큰 기반의 유사도 매칭 (fuzzy matching)
  const roomTokens = tokenize(cleanedRoomInfo);
  let bestMatch = null;
  let bestScore = 0;
  const threshold = 0.4;

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
        // 비교 전 접미사 "룸" 제거
        const ctNoRoom = removeRoomSuffix(ct);
        let tokenMatch = false;
        for (const rt of roomTokens) {
          const rtNoRoom = removeRoomSuffix(rt);
          if (rt === ct || rtNoRoom === ctNoRoom) {
            tokenMatch = true;
            break;
          }
        }
        if (tokenMatch) {
          scoreSum += 1;
        } else {
          let maxSim = 0;
          roomTokens.forEach((rt) => {
            const rtNoRoom = removeRoomSuffix(rt);
            const sim = similarity(rtNoRoom, ctNoRoom);
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
