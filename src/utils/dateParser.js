import { parse, isValid } from 'date-fns';
import { ko, enUS } from 'date-fns/locale';
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';

// KST 시간대 설정
const TIMEZONE = 'Asia/Seoul';

// 캐싱을 위한 객체
const parsedDateCache = {};

// 전처리 함수
const cleanString = (str) => {
  return str
    .replace(/\([^)]*\)/g, '') // 괄호 안의 내용 제거
    .replace(/[-]+$/g, '') // 문자열 끝의 하이픈 제거
    .replace(/\s+/g, ' ') // 연속된 공백을 단일 공백으로 대체
    .replace(/\n/g, ' ') // 줄바꿈 문자 제거
    .replace(/미리예약/g, '') // 불필요한 텍스트 제거
    .trim(); // 앞뒤 공백 제거
};

export const parseDate = (dateString) => {
  if (!dateString) return null;

  // 캐시에 있는 경우 반환
  if (parsedDateCache[dateString] !== undefined) {
    return parsedDateCache[dateString];
  }

  // ISO 형식에서 시간대 정보를 유지하며 처리
  let cleanedDateString = cleanString(dateString);

  // 개발 모드에서 전처리된 문자열 로그 출력
  if (process.env.NODE_ENV === 'development') {
    console.log(
      `Cleaned Date String: "${cleanedDateString}" [length: ${cleanedDateString.length}]`
    );
  }

  const dateFormats = [
    "yyyy-MM-dd'T'HH:mm:ss.SSS", // ISO 형식 (시간대 포함 가능)
    "yyyy-MM-dd'T'HH:mm:ss",
    "yyyy-MM-dd'T'HH:mm",
    'yyyy년 M월 d일 HH:mm',
    'yyyy년 MM월 dd일 HH:mm',
    'yyyy년 M월 d일',
    'yyyy년 MM월 dd일',
    'yyyy.MM.dd HH:mm',
    'yyyy.MM.dd',
    'yyyy.MM.dd HH:mm:ss',
    // 영어 형식
    'dd MMM yyyy HH:mm',
    'dd MMM yyyy',
    'MMM dd, yyyy HH:mm',
    'MMM dd, yyyy',
    'MMM dd yyyy',
    'MMMM dd, yyyy',
    'd MMM yyyy',
    'd MMM yyyy HH:mm',
    'd MMM yyyy HH:mm:ss',
    'MMM d, yyyy',
    'MMM d, yyyy HH:mm',
    // 기타 형식
    'yyyy-MM-dd HH:mm',
    'yyyy-MM-dd HH:mm:ss',
    'yyyy-MM-dd',
    'yyyy/MM/dd HH:mm',
    'yyyy/MM/dd HH:mm:ss',
    'yyyy/MM/dd',
    'dd-MM-yyyy HH:mm',
    'dd-MM-yyyy',
    'dd.MM.yyyy HH:mm',
    'dd.MM.yyyy',
    'dd/MM/yyyy HH:mm',
    'dd/MM/yyyy',
  ];

  const locales = [ko, enUS];

  let parsedDate = null;
  for (let locale of locales) {
    for (let formatString of dateFormats) {
      const parsed = parse(cleanedDateString, formatString, new Date(), {
        locale,
      });
      if (isValid(parsed)) {
        // 파싱된 날짜를 KST로 변환
        parsedDate = toZonedTime(parsed, TIMEZONE);
        parsedDateCache[dateString] = parsedDate;

        if (process.env.NODE_ENV === 'development') {
          console.log(`Parsed Date (KST): ${formatInTimeZone(parsedDate, TIMEZONE, 'yyyy-MM-dd HH:mm:ssXXX')}`);
        }
        return parsedDate;
      }
    }
  }

  // ISO 형식으로 직접 파싱 시도
  try {
    const directParsed = new Date(cleanedDateString);
    if (isValid(directParsed)) {
      parsedDate = toZonedTime(directParsed, TIMEZONE);
      parsedDateCache[dateString] = parsedDate;

      if (process.env.NODE_ENV === 'development') {
        console.log(`Direct Parsed Date (KST): ${formatInTimeZone(parsedDate, TIMEZONE, 'yyyy-MM-dd HH:mm:ssXXX')}`);
      }
      return parsedDate;
    }
  } catch (error) {
    console.error(`Failed to directly parse date: "${dateString}"`, error);
  }

  if (process.env.NODE_ENV === 'development') {
    console.error(`Failed to parse date: "${dateString}"`);
  }
  parsedDateCache[dateString] = null;
  return null;
};

// 날짜 포맷팅 함수 (KST 기준)
export const formatDate = (date, formatString = 'yyyy-MM-dd HH:mm:ss') => {
  if (!date) return '정보 없음';
  try {
    return formatInTimeZone(date, TIMEZONE, formatString);
  } catch (error) {
    console.error(`Error formatting date: ${date}`, error);
    return '정보 없음';
  }
};