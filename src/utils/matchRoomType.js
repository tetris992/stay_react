import { defaultRoomTypes } from '../config/defaultRoomTypes';

/**
 * 입력 문자열을 클리닝합니다.
 * - 괄호 및 그 내부의 텍스트 제거
 * - 영문, 한글, 숫자, 공백 이외의 문자 제거
 * - 여러 공백 축소 및 trim 처리
 * - 소문자로 변환
 *
 * @param {string} text - 입력 문자열
 * @returns {string} - 클리닝된 문자열
 * @throws {TypeError} - text가 문자열이 아닐 경우
 */
function cleanString(text) {
  if (typeof text !== 'string') {
    throw new TypeError(`Expected a string but received ${typeof text}`);
  }
  // 괄호 및 내부 텍스트 제거
  let cleaned = text.replace(/\([^)]*\)/g, ' ');
  // 영문, 한글, 숫자, 공백 외의 문자 제거
  cleaned = cleaned.replace(/[^a-zA-Z0-9가-힣\s]/g, ' ');
  // 여러 공백 축소 및 트리밍
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned.toLowerCase();
}

/**
 * 클리닝된 문자열을 공백 기준으로 토큰화합니다.
 *
 * @param {string} text - 입력 문자열
 * @returns {Array<string>} - 토큰 배열
 * @throws {TypeError} - text가 문자열이 아닐 경우
 */
function tokenize(text) {
  if (typeof text !== 'string') {
    throw new TypeError(`Expected a string but received ${typeof text}`);
  }
  const cleaned = cleanString(text);
  return cleaned.split(' ').filter(token => token.length > 0);
}

/**
 * 두 문자열 사이의 레벤슈타인 거리를 계산합니다.
 *
 * @param {string} a - 첫 번째 문자열
 * @param {string} b - 두 번째 문자열
 * @returns {number} - 두 문자열 간의 편집 거리
 * @throws {TypeError} - a나 b가 문자열이 아닐 경우
 */
function levenshteinDistance(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    throw new TypeError('Both inputs must be strings.');
  }
  const m = a.length;
  const n = b.length;
  // dp 테이블 생성: dp[i][j]는 a의 i길이와 b의 j길이의 편집 거리
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
 * 1에 가까울수록 두 문자열이 유사함을 의미합니다.
 *
 * @param {string} a - 첫 번째 문자열
 * @param {string} b - 두 번째 문자열
 * @returns {number} - 유사도 값
 * @throws {TypeError} - a나 b가 문자열이 아닐 경우
 */
function similarity(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    throw new TypeError('Both inputs must be strings.');
  }
  const distance = levenshteinDistance(a, b);
  const maxLength = Math.max(a.length, b.length);
  return maxLength === 0 ? 1 : (maxLength - distance) / maxLength;
}

/**
 * 문자열의 접미사 "룸"을 제거합니다.
 *
 * @param {string} str - 입력 문자열
 * @returns {string} - "룸" 접미사가 제거된 문자열
 * @throws {TypeError} - str이 문자열이 아닐 경우
 */
function removeRoomSuffix(str) {
  if (typeof str !== 'string') {
    throw new TypeError('Expected a string input');
  }
  return str.replace(/룸$/i, '').trim();
}

/**
 * 예약의 roomInfo와 호텔 세팅의 객실타입(및 별칭)을 비교하여 매칭된 객실타입 객체를 반환합니다.
 *
 * 개선된 사항:
 * - 입력값에 대한 타입 및 유효성 검증
 * - 후보 문자열 및 토큰 처리 중 발생할 수 있는 예외를 개별 try-catch로 처리하여
 *   다른 후보의 매칭에 영향을 주지 않도록 함
 * - fuzzy matching 임계치를 약간 높여(0.5) 엄격하게 매칭하도록 조정 (필요 시 조정 가능)
 *
 * @param {string} roomInfo - 예약의 roomInfo 값
 * @param {Array} [roomTypes=defaultRoomTypes] - 객실타입 배열
 * @returns {Object|null} - 매칭된 객실타입 객체 또는 매칭되지 않으면 null
 */
export const matchRoomType = (roomInfo, roomTypes = defaultRoomTypes) => {
  try {
    if (typeof roomInfo !== 'string' || roomInfo.trim() === '') {
      throw new Error('Invalid roomInfo input. Expected a non-empty string.');
    }
    if (!Array.isArray(roomTypes)) {
      throw new Error('Invalid roomTypes input. Expected an array.');
    }

    // 0. 전처리: roomInfo 클리닝 및 "룸" 접미사 제거
    const cleanedRoomInfo = cleanString(roomInfo);
    const cleanedRoomInfoNoRoom = removeRoomSuffix(cleanedRoomInfo);

    // 1. 우선, 정확하거나 부분 문자열 매칭 시도
    for (const roomType of roomTypes) {
      const candidates = [
        roomType.roomInfo, // 기존 roomType.type 대신 roomType.roomInfo 사용
        roomType.nameKor,
        roomType.nameEng,
        ...(roomType.aliases || [])
      ].filter(Boolean);

      for (const candidate of candidates) {
        try {
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
        } catch (e) {
          console.error(`Error processing candidate "${candidate}": ${e.message}`);
          continue;
        }
      }
    }

    // 2. fuzzy matching: 토큰 기반 유사도 계산
    const roomTokens = tokenize(cleanedRoomInfo);
    let bestMatch = null;
    let bestScore = 0;
    const threshold = 0.5; // 필요에 따라 조정(예: 0.4 ~ 0.6)

    roomTypes.forEach((roomType) => {
      const candidates = [
        roomType.roomInfo, // 기존 roomType.type 대신 roomType.roomInfo 사용
        roomType.nameKor,
        roomType.nameEng,
        ...(roomType.aliases || [])
      ].filter(Boolean);

      let scoreSum = 0;
      let comparisons = 0;

      candidates.forEach((candidate) => {
        let candidateTokens;
        try {
          candidateTokens = tokenize(candidate);
        } catch (e) {
          console.error(`Error tokenizing candidate "${candidate}": ${e.message}`);
          return;
        }

        candidateTokens.forEach((ct) => {
          comparisons++;
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
  } catch (error) {
    console.error(`Error in matchRoomType: ${error.message}`);
    return null;
  }
};
