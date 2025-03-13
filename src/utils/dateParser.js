import { parse, isValid, format } from 'date-fns';
import { ko, enUS } from 'date-fns/locale';

const parsedDateCache = {};

const cleanString = (str) => {
  if (typeof str !== 'string') {
    str = String(str);
  }
  return str
    .replace(/\([^)]*\)/g, '')
    .replace(/[-]+$/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/미리예약/g, '')
    .trim();
};
/**
 * 날짜 문자열을 파싱하여 Date 객체로 반환
 * @param {string} dateString - 파싱할 날짜 문자열
 * @param {object} [hotelSettings] - 호텔 설정 객체 (checkInTime, checkOutTime 포함)
 * @param {boolean} [isCheckIn=true] - 체크인인지 체크아웃인지 여부
 * @returns {Date|null} - 파싱된 Date 객체 또는 null
 */
export const parseDate = (dateString, hotelSettings = null, isCheckIn = true) => {
  if (!dateString) return null;

  if (parsedDateCache[dateString] !== undefined) {
    return parsedDateCache[dateString];
  }

  let cleanedDateString = cleanString(dateString);

  if (process.env.NODE_ENV === 'development') {
    console.log(`Cleaned Date String: "${cleanedDateString}" [length: ${cleanedDateString.length}]`);
  }

  const dateFormats = [
    "yyyy-MM-dd'T'HH:mm:ss.SSS",
    "yyyy-MM-dd'T'HH:mm:ss",
    "yyyy-MM-dd'T'HH:mm",
    'yyyy년 M월 d일 HH:mm',
    'yyyy년 MM월 dd일 HH:mm',
    'yyyy년 M월 d일',
    'yyyy년 MM월 dd일',
    'yyyy.MM.dd HH:mm',
    'yyyy.MM.dd',
    'yyyy.MM.dd HH:mm:ss',
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
  const defaultCheckInTime = '16:00';
  const defaultCheckOutTime = '11:00';

  let parsedDate = null;
  for (let locale of locales) {
    for (let formatString of dateFormats) {
      const parsed = parse(cleanedDateString, formatString, new Date(), { locale });
      if (isValid(parsed)) {
        const hasTime = formatString.includes('HH') || formatString.includes('mm');
        if (!hasTime && hotelSettings) {
          const time = isCheckIn
            ? hotelSettings.checkInTime || defaultCheckInTime
            : hotelSettings.checkOutTime || defaultCheckOutTime;
          const [hours, minutes] = time.split(':');
          parsed.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
        }
        parsedDate = parsed;
        parsedDateCache[dateString] = parsedDate;
        if (process.env.NODE_ENV === 'development') {
          console.log(`Parsed Date: ${format(parsedDate, 'yyyy-MM-dd HH:mm:ss')}`);
        }
        return parsedDate;
      }
    }
  }

  try {
    const directParsed = new Date(cleanedDateString);
    if (isValid(directParsed)) {
      const hasTime = cleanedDateString.match(/\d{2}:\d{2}/);
      if (!hasTime && hotelSettings) {
        const time = isCheckIn
          ? hotelSettings.checkInTime || defaultCheckInTime
          : hotelSettings.checkOutTime || defaultCheckOutTime;
        const [hours, minutes] = time.split(':');
        directParsed.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
      }
      parsedDate = directParsed;
      parsedDateCache[dateString] = parsedDate;
      if (process.env.NODE_ENV === 'development') {
        console.log(`Direct Parsed Date: ${format(parsedDate, 'yyyy-MM-dd HH:mm:ss')}`);
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

export const formatDate = (date, formatString = 'yyyy-MM-dd HH:mm:ss') => {
  if (!date) return '정보 없음';
  try {
    return format(date, formatString);
  } catch (error) {
    console.error(`Error formatting date: ${date}`, error);
    return '정보 없음';
  }
};