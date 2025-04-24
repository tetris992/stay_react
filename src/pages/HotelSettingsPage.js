// frontend/src/pages/HotelSettingsPage.js

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Chart } from 'chart.js/auto';
import {
  fetchHotelSettings,
  updateHotelSettings,
  registerHotel,
  fetchUserInfo,
  updateUser,
} from '../api/api';
import { defaultRoomTypes } from '../config/defaultRoomTypes';
import DEFAULT_AMENITIES from '../config/defaultAmenities';
import { getColorForRoomType } from '../utils/getColorForRoomType';
import './HotelSettingsPage.css';
import iconMap from '../config/iconMap'; // 아이콘 맵을 별도의 파일로 분리하여 import
import {
  FaBed,
  FaMinus,
  FaPlus,
  FaTrash,
  FaUndo,
  FaCamera,
} from 'react-icons/fa';
import { parseDate, formatDate } from '../utils/dateParser'

import extractCoordinates from './extractCoordinates';
import { FaMapMarkerAlt } from 'react-icons/fa';

import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { v4 as uuidv4 } from 'uuid';
import { format, toZonedTime } from 'date-fns-tz'; // addDays를 올바르게 임포트
import { addDays } from 'date-fns';
import api from '../api/api';

// import {
//   validateDiscountDates,
//   validateDiscountValue,
//   DiscountFormFields,
//   RandomDiscountFields,
//   ConditionFields,
//   DiscountListItem,
// } from '../components/DiscountFormFields';

// 기본 층 설정
const DEFAULT_FLOORS = [2, 3, 4, 5, 6, 7, 8];
// 전역 스코프에 extractCoordinates 노출
window.extractCoordinates = extractCoordinates;

// 기타 시설 서브 카테고리 목록
const FACILITY_SUB_CATEGORIES = [
  'lobby',
  'restaurant',
  'pool',
  'gym',
  'parkingLot',
  'laundryRoom',
  'loungeArea',
  'terrace',
  'rooftop',
  'spaSauna',
  'businessCenter',
  'meetingRoom',
  'banquetHall',
  'kidsClub',
  'barLounge',
  'cafe',
  'convenienceStore',
  'garden',
  'others',
];
// 표시용 이름 매핑 (한국어와 영어 지원)
const FACILITY_SUB_CATEGORY_NAMES = {
  lobby: { kor: '로비', eng: 'Lobby' },
  restaurant: { kor: '레스토랑', eng: 'Restaurant' },
  pool: { kor: '수영장', eng: 'Pool' },
  gym: { kor: '체육관', eng: 'Gym' },
  parkingLot: { kor: '주차장', eng: 'Parking Lot' },

  laundryRoom: { kor: '세탁실', eng: 'Laundry Room' },
  loungeArea: { kor: '라운지', eng: 'Lounge Area' },
  terrace: { kor: '테라스', eng: 'Terrace' },
  rooftop: { kor: '루프탑', eng: 'Rooftop' },
  spaSauna: { kor: '스파/사우나', eng: 'Spa/Sauna' },
  businessCenter: { kor: '비즈니스 센터', eng: 'Business Center' },
  meetingRoom: { kor: '회의실', eng: 'Meeting Room' },
  banquetHall: { kor: '연회장', eng: 'Banquet Hall' },
  kidsClub: { kor: '키즈 클럽', eng: 'Kids Club' },
  barLounge: { kor: '바/라운지', eng: 'Bar/Lounge' },
  cafe: { kor: '카페', eng: 'Cafe' },
  convenienceStore: { kor: '편의점', eng: 'Convenience Store' },
  garden: { kor: '정원', eng: 'Garden' },
  others: { kor: '기타', eng: 'Others' },
};

// 사진 업로드 관련 상수
const DEFAULT_PASSWORD = '1111';
const ALLOWED_FORMATS = ['image/jpeg', 'image/png', 'image/webp'];
// 사진 업로드 관련 상수 (2024년 스마트폰 기준)
const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB
const MAX_RESOLUTION = { width: 1440, height: 1440 }; // 1440x1440

// 초기 객실 타입 설정 – DEFAULT_AMENITIES에서 in‑room만 필터링
const initializedDefaultRoomTypes = defaultRoomTypes.map((rt) => ({
  ...rt,
  isBaseRoom: false, // 기본 객실 플래그 초기값 false
  aliases: [],
  roomNumbers:
    rt.startRoomNumbers && Object.keys(rt.floorSettings).length > 0
      ? Array.from(
          { length: rt.stock },
          (_, i) =>
            `${
              parseInt(rt.startRoomNumbers[Object.keys(rt.floorSettings)[0]]) +
              i
            }`
        )
      : [],
  roomAmenities: DEFAULT_AMENITIES.filter(
    (amenity) => amenity.type === 'in-room'
  ).map((a) => ({
    nameKor: a.nameKor,
    nameEng: a.nameEng,
    icon: a.icon,
    type: a.type,
    isActive: false,
  })),
  photos: [],
}));

// 객실 번호 생성 유틸리티
function buildRoomTypesWithNumbers(roomTypes, containers) {
  const cloned = roomTypes.map((rt) => ({
    ...rt,
    roomNumbers: [],
    stock: 0, // 초기 stock 값을 0으로 설정
  }));

  containers.forEach((cont) => {
    const tKey = (cont.roomInfo || '').toLowerCase();
    const found = cloned.find(
      (rt) => (rt.roomInfo || '').toLowerCase() === tKey
    );
    if (found && cont.roomNumber && cont.isActive) {
      found.roomNumbers.push(cont.roomNumber);
    }
  });

  // roomNumbers를 기반으로 stock 값을 업데이트
  cloned.forEach((rt) => {
    rt.roomNumbers = [...new Set(rt.roomNumbers)]; // 중복 제거
    rt.roomNumbers.sort((a, b) => parseInt(a, 10) - parseInt(b, 10)); // 정렬
    rt.stock = rt.roomNumbers.length; // stock 값을 roomNumbers 길이로 설정
  });

  return cloned;
}

// (참고: 필요하다면 공용 iconMap을 import하여 사용할 수 있습니다.)
function AmenitiesSection({
  amenities,
  setAmenities,
  roomTypes,
  setRoomTypes,
  onSave,
  language,
}) {
  // on-site (호텔 공통) 시설 목록 필터링
  const onSiteAmenities = amenities.filter(
    (amenity) => amenity.type === 'on-site'
  );

  // 객실내(in-room) 시설 목록 필터링 함수
  const getInRoomAmenities = (amenityList) =>
    amenityList.filter((amenity) => amenity.type === 'in-room');

  const handleAmenityChange = (index) => {
    setAmenities((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        isActive: !updated[index].isActive,
      };
      return updated;
    });
  };

  // 기본 객실 설정 함수
  const handleSetBaseRoom = (roomIndex) => {
    setRoomTypes((prev) => {
      const updated = [...prev];
      // 모든 객실의 isBaseRoom을 false로 설정 후 선택된 객실만 true로 설정
      updated.forEach((rt, idx) => {
        rt.isBaseRoom = idx === roomIndex;
      });
      alert(
        language === 'kor'
          ? '기본 객실이 설정되었습니다.'
          : 'Base room has been set.'
      );
      return updated;
    });
  };

  // 기본 객실의 어메니티를 모든 객실에 적용하는 함수
  const applyBaseRoomAmenities = (baseRoomAmenities) => {
    setRoomTypes((prev) => {
      const updated = [...prev];
      updated.forEach((rt) => {
        rt.roomAmenities = rt.roomAmenities.map((amenity) => {
          const baseAmenity = baseRoomAmenities.find(
            (ba) => ba.nameKor === amenity.nameKor
          );
          return {
            ...amenity,
            isActive: baseAmenity ? baseAmenity.isActive : amenity.isActive,
          };
        });
      });
      return updated;
    });
  };

  // 객실별 어메니티 변경 함수
  const handleRoomAmenityChange = (roomIndex, amenityNameKor) => {
    setRoomTypes((prev) => {
      const updated = [...prev];

      // 현재 객실의 어메니티 상태 토글
      updated[roomIndex] = {
        ...updated[roomIndex],
        roomAmenities: updated[roomIndex].roomAmenities.map((amenity) =>
          amenity.nameKor === amenityNameKor
            ? { ...amenity, isActive: !amenity.isActive }
            : amenity
        ),
      };

      // 현재 객실이 기본 객실이면 모든 객실에 적용
      if (updated[roomIndex].isBaseRoom) {
        applyBaseRoomAmenities(updated[roomIndex].roomAmenities);
      }

      return updated;
    });
  };

  // 기본 객실이 설정되었는지 확인
  const isBaseRoomSet = roomTypes.some((rt) => rt.isBaseRoom);

  return (
    <section
      className="amenities-section"
      aria-label={
        language === 'kor' ? '호텔 시설 섹션' : 'Hotel Amenities Section'
      }
    >
      <h2>{language === 'kor' ? '◉ 호텔 공통 시설' : 'On-Site Facilities'}</h2>
      <div className="amenities-container">
        {onSiteAmenities.map((amenity, index) => (
          <label key={`on-site-${index}`} className="amenity-item">
            <input
              type="checkbox"
              checked={amenity.isActive}
              onChange={() => handleAmenityChange(index)}
            />
            {iconMap[amenity.icon] || <span>❓</span>}
            <span title={amenity.nameEng}>
              {language === 'kor' ? amenity.nameKor : amenity.nameEng}
            </span>
          </label>
        ))}
      </div>

      <h2>{language === 'kor' ? '◉ 객실별 시설 설정' : 'In-Room Amenities'}</h2>
      {roomTypes.map((rt, roomIdx) => (
        <div
          key={`room-${roomIdx}`}
          className="room-amenities"
          aria-label={
            language === 'kor' ? '객실별 시설 설정' : 'Room Amenities Settings'
          }
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <h4 style={{ marginRight: '10px' }}>
              {language === 'kor' ? rt.nameKor : rt.nameEng} ({rt.nameEng})
            </h4>
            {/* 기본 객실이 설정되지 않았거나 현재 객실이 기본 객실인 경우에만 버튼 표시 */}
            {(!isBaseRoomSet || rt.isBaseRoom) && (
              <button
                onClick={() => handleSetBaseRoom(roomIdx)}
                style={{
                  backgroundColor: rt.isBaseRoom ? '#4CAF50' : '#ccc',
                  color: 'white',
                  border: 'none',
                  padding: '5px 10px',
                  borderRadius: '5px',
                  cursor: 'pointer',
                }}
              >
                {rt.isBaseRoom
                  ? language === 'kor'
                    ? '기본 객실'
                    : 'Base Room'
                  : language === 'kor'
                  ? '기본 객실로 설정'
                  : 'Set as Base Room'}
              </button>
            )}
          </div>
          <div className="amenities-list">
            {getInRoomAmenities(rt.roomAmenities).map((amenity) => (
              <label
                key={`room-${roomIdx}-amenity-${amenity.nameEng}`}
                className="amenity-item"
              >
                <input
                  type="checkbox"
                  checked={amenity.isActive || false}
                  onChange={() =>
                    handleRoomAmenityChange(roomIdx, amenity.nameKor)
                  }
                />
                {iconMap[amenity.icon] || <span>❓</span>}
                <span title={amenity.nameEng}>
                  {language === 'kor' ? amenity.nameKor : amenity.nameEng}
                </span>
              </label>
            ))}
          </div>
        </div>
      ))}
      <div className="tab-actions"></div>
    </section>
  );
}

// HotelInfoSection 컴포넌트 (부분 저장 버튼 포함)
function HotelInfoSection({
  hotelId,
  setHotelId,
  isExisting,
  hotelName,
  setHotelName,
  totalRooms,
  hotelAddress,
  setHotelAddress,
  email,
  setEmail,
  phoneNumber,
  setPhoneNumber,
  checkInTime,
  setCheckInTime,
  checkOutTime,
  setCheckOutTime,
  onCoordinatesUpdate,
  initialCoordinates,
  language = 'kor', // 언어 prop 추가
}) {
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState('');
  const [coordinates, setCoordinates] = useState(
    initialCoordinates || { latitude: null, longitude: null }
  );

  // 좌표 추출 핸들러
  const handleExtractCoordinates = async () => {
    if (!hotelAddress || hotelAddress.trim() === '') {
      setError(
        language === 'kor'
          ? '주소를 먼저 입력해주세요.'
          : 'Please enter the address first.'
      );
      return;
    }

    setIsFetching(true);
    setError('');
    try {
      console.log('[handleExtractCoordinates] Address:', hotelAddress);
      const { latitude, longitude } = await extractCoordinates(hotelAddress);
      console.log('[handleExtractCoordinates] Result:', {
        latitude,
        longitude,
      });

      if (!latitude || !longitude) {
        throw new Error(
          language === 'kor'
            ? '유효한 좌표를 추출할 수 없습니다.'
            : 'Unable to extract valid coordinates.'
        );
      }

      setCoordinates({ latitude, longitude });
      if (onCoordinatesUpdate) {
        onCoordinatesUpdate({ latitude, longitude });
      }
    } catch (err) {
      console.error('[handleExtractCoordinates] Error:', err.message);
      setError(
        language === 'kor'
          ? `좌표 추출 실패: ${err.message}`
          : `Failed to extract coordinates: ${err.message}`
      );
    } finally {
      setIsFetching(false);
    }
  };

  // 입력 유효성 검사 (예: 이메일 형식)
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // 이메일 변경 핸들러
  const handleEmailChange = (e) => {
    const value = e.target.value;
    setEmail(value);
    if (value && !validateEmail(value)) {
      setError(
        language === 'kor'
          ? '유효한 이메일 형식을 입력해주세요.'
          : 'Please enter a valid email format.'
      );
    } else {
      setError('');
    }
  };

  // 전화번호 유효성 검사 (예: 숫자와 하이픈만 허용)
  const validatePhoneNumber = (phone) => {
    const phoneRegex = /^[0-9\-+]+$/;
    return phoneRegex.test(phone);
  };

  // 전화번호 변경 핸들러
  const handlePhoneNumberChange = (e) => {
    const value = e.target.value;
    setPhoneNumber(value);
    if (value && !validatePhoneNumber(value)) {
      setError(
        language === 'kor'
          ? '유효한 전화번호 형식을 입력해주세요 (숫자, 하이픈, +만 허용).'
          : 'Please enter a valid phone number format (numbers, hyphens, + only).'
      );
    } else {
      setError('');
    }
  };

  return (
    <section
      className="hotel-info-section"
      aria-label={
        language === 'kor'
          ? '호텔 기본 정보 섹션'
          : 'Hotel Basic Information Section'
      }
    >
      <div className="info-columns">
        <div className="basic-info">
          <h2>
            {language === 'kor' ? '호텔 기본 정보' : 'Hotel Basic Information'}
          </h2>
          {error && (
            <p style={{ color: 'red', marginBottom: '10px' }} role="alert">
              {error}
            </p>
          )}
          <div className="info-columns-split">
            <div className="info-column">
              <label>
                {language === 'kor' ? '호텔 ID:' : 'Hotel ID:'}
                <input
                  value={hotelId || ''}
                  onChange={(e) => setHotelId(e.target.value)}
                  disabled={isExisting}
                  aria-label={
                    language === 'kor' ? '호텔 ID 입력' : 'Hotel ID input'
                  }
                  placeholder={language === 'kor' ? '호텔 ID' : 'Hotel ID'}
                  required
                />
              </label>
              <label>
                {language === 'kor' ? '호텔 이름:' : 'Hotel Name:'}
                <input
                  value={hotelName || ''}
                  onChange={(e) => setHotelName(e.target.value)}
                  placeholder={
                    language === 'kor'
                      ? '호텔 이름을 입력하세요'
                      : 'Enter hotel name'
                  }
                  aria-label={
                    language === 'kor' ? '호텔 이름 입력' : 'Hotel name input'
                  }
                  required
                />
              </label>
              <label>
                {language === 'kor' ? '총 객실 수:' : 'Total Rooms:'}
                <input
                  value={totalRooms || 0}
                  readOnly
                  aria-label={language === 'kor' ? '총 객실 수' : 'Total rooms'}
                />
              </label>
              <label>
                {language === 'kor' ? '호텔 주소:' : 'Hotel Address:'}
                <input
                  value={hotelAddress || ''}
                  onChange={(e) => setHotelAddress(e.target.value)}
                  placeholder={
                    language === 'kor'
                      ? '호텔 주소를 입력하세요'
                      : 'Enter hotel address'
                  }
                  aria-label={
                    language === 'kor'
                      ? '호텔 주소 입력'
                      : 'Hotel address input'
                  }
                  required
                />
              </label>
              <button
                onClick={handleExtractCoordinates}
                disabled={isFetching || !hotelAddress}
                style={{
                  backgroundColor:
                    isFetching || !hotelAddress ? '#ccc' : '#4CAF50',
                  color: 'white',
                  border: 'none',
                  padding: '5px 10px',
                  borderRadius: '5px',
                  cursor:
                    isFetching || !hotelAddress ? 'not-allowed' : 'pointer',
                  marginTop: '10px',
                  display: 'flex',
                  alignItems: 'center',
                }}
                aria-label={
                  language === 'kor'
                    ? '좌표 추출 버튼'
                    : 'Extract coordinates button'
                }
              >
                <FaMapMarkerAlt style={{ marginRight: '5px' }} />
                {isFetching
                  ? language === 'kor'
                    ? '좌표 추출 중...'
                    : 'Extracting Coordinates...'
                  : language === 'kor'
                  ? '좌표 추출'
                  : 'Extract Coordinates'}
              </button>
              {coordinates.latitude && coordinates.longitude && (
                <div style={{ marginTop: '10px' }}>
                  <p>
                    {language === 'kor' ? '위도:' : 'Latitude:'}{' '}
                    {coordinates.latitude},{' '}
                    {language === 'kor' ? '경도:' : 'Longitude:'}{' '}
                    {coordinates.longitude}
                  </p>
                </div>
              )}
            </div>
            <div className="info-column">
              <label>
                {language === 'kor' ? '이메일:' : 'Email:'}
                <input
                  type="email"
                  value={email || ''}
                  onChange={handleEmailChange}
                  placeholder={
                    language === 'kor' ? '이메일을 입력하세요' : 'Enter email'
                  }
                  aria-label={
                    language === 'kor' ? '이메일 입력' : 'Email input'
                  }
                  required
                />
              </label>
              <label>
                {language === 'kor' ? '전화번호:' : 'Phone Number:'}
                <input
                  value={phoneNumber || ''}
                  onChange={handlePhoneNumberChange}
                  placeholder={
                    language === 'kor'
                      ? '전화번호를 입력하세요'
                      : 'Enter phone number'
                  }
                  aria-label={
                    language === 'kor' ? '전화번호 입력' : 'Phone number input'
                  }
                  required
                />
              </label>
              <label>
                {language === 'kor' ? '체크인 시간:' : 'Check-In Time:'}
                <input
                  type="time"
                  value={checkInTime || '16:00'}
                  onChange={(e) => setCheckInTime(e.target.value)}
                  aria-label={
                    language === 'kor'
                      ? '체크인 시간 입력'
                      : 'Check-in time input'
                  }
                  required
                />
              </label>
              <label>
                {language === 'kor' ? '체크아웃 시간:' : 'Check-Out Time:'}
                <input
                  type="time"
                  value={checkOutTime || '11:00'}
                  onChange={(e) => setCheckOutTime(e.target.value)}
                  aria-label={
                    language === 'kor'
                      ? '체크아웃 시간 입력'
                      : 'Check-out time input'
                  }
                  required
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function RoomTypeEditor({ roomTypes, setRoomTypes, amenities, onSave }) {
  // 시설 탭에서 활성화된 on‑site 시설만 읽어옴 (수정 불가, 읽기 전용)
  const activeOnSiteAmenities = amenities.filter(
    (amenity) => amenity.type === 'on-site' && amenity.isActive
  );

  // 객실 타입 추가
  const addRoomType = () => {
    setRoomTypes((prev) => [
      ...prev,
      {
        roomInfo: '',
        nameKor: '',
        nameEng: '',
        price: 0,
        stock: 0,
        aliases: [],
        roomNumbers: [],
        floorSettings: {},
        startRoomNumbers: {},
        // 객실별 시설은 in‑room만 (초기에는 모두 비활성)
        roomAmenities: amenities
          .filter((a) => a.type === 'in-room')
          .map((a) => ({ ...a, isActive: false })),
        photos: [],
      },
    ]);
  };

  // 객실 타입 정보 변경
  const updateRoomType = (index, field, value, aliasIndex = null) => {
    setRoomTypes((prev) => {
      const updated = [...prev];
      if (field === 'price') {
        const numValue = Number(value);
        if (isNaN(numValue) && value !== '') {
          alert('유효한 가격을 입력해주세요.');
          return prev;
        }
        updated[index].price = numValue || 0;
      } else if (field === 'nameKor' || field === 'nameEng') {
        updated[index][field] = value;
        // roomInfo는 nameEng가 우선, 없으면 nameKor
        updated[index].roomInfo = (
          field === 'nameEng'
            ? value
            : updated[index].nameEng || updated[index].nameKor
        ).toLowerCase();
      } else if (field === 'aliases' && aliasIndex !== null) {
        updated[index].aliases[aliasIndex] = value;
      }
      return updated;
    });
  };

  // 가격 증가/감소 함수
  const incrementPrice = (index) => {
    setRoomTypes((prev) => {
      const updated = [...prev];
      updated[index].price = (updated[index].price || 0) + 1000;
      return updated;
    });
  };

  const decrementPrice = (index) => {
    setRoomTypes((prev) => {
      const updated = [...prev];
      updated[index].price = Math.max(0, (updated[index].price || 0) - 1000);
      return updated;
    });
  };

  // 객실 타입 삭제
  const removeRoomType = (index) => {
    setRoomTypes((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <section className="room-types-section" aria-label="객실 타입 설정 섹션">
      {/* (A) 공통 시설 읽기 전용 섹션 */}
      <h2>◉ 공통 시설</h2>
      <div className="common-amenities-section">
        <div className="common-amenities-container">
          {activeOnSiteAmenities.map((amenity, idx) => (
            <span key={`common-amenity-${idx}`} className="common-amenity-item">
              {iconMap[amenity.icon] || <span>❓</span>}
              <span title={amenity.nameEng}>{amenity.nameKor}</span>
            </span>
          ))}
        </div>
      </div>

      {/* (B) 객실 타입(= in-room 시설) 편집 섹션 */}
      <h2>◉ 객실 타입</h2>
      <div className="room-types-container">
        {roomTypes.map((rt, idx) => (
          <div key={idx} className="room-type-item">
            <div className="room-type-header">
              <FaBed /> 객실 타입 {idx + 1}
              <button
                className="remove-btn"
                onClick={() => removeRoomType(idx)}
                aria-label={`객실 타입 ${idx + 1} 삭제`}
              >
                <FaTrash />
              </button>
            </div>
            <div className="room-type-fields">
              <div className="field-row">
                <input
                  className="name-kor"
                  type="text"
                  placeholder="한글 이름"
                  value={rt.nameKor || ''}
                  onChange={(e) =>
                    updateRoomType(idx, 'nameKor', e.target.value)
                  }
                  aria-label="한글 이름 입력"
                />
                <input
                  className="name-eng"
                  type="text"
                  placeholder="영어 이름"
                  value={rt.nameEng || ''}
                  onChange={(e) =>
                    updateRoomType(idx, 'nameEng', e.target.value)
                  }
                  aria-label="영어 이름 입력"
                />
              </div>
              <div className="field-row price-row">
                <div className="price-input-container">
                  <input
                    className="price"
                    type="number"
                    placeholder="가격"
                    value={rt.price || 0}
                    onChange={(e) =>
                      updateRoomType(idx, 'price', e.target.value)
                    }
                    style={{
                      width: '100px',
                      paddingRight: '0',
                      border: 'none',
                      borderRadius: '0',
                    }}
                    aria-label="가격 입력"
                  />
                  <div className="price-buttons">
                    <button
                      className="price-btn increment"
                      onClick={() => incrementPrice(idx)}
                      aria-label="가격 증가"
                    >
                      <FaPlus />
                    </button>
                    <button
                      className="price-btn decrement"
                      onClick={() => decrementPrice(idx)}
                      aria-label="가격 감소"
                    >
                      <FaMinus />
                    </button>
                  </div>
                </div>
                <input
                  className="stock"
                  type="number"
                  placeholder="객실 수"
                  value={rt.stock || 0}
                  readOnly
                  style={{ marginLeft: '10px' }}
                  aria-label="객실 수"
                />
              </div>
            </div>
            <div className="room-type-aliases" aria-label="별칭 입력 섹션">
              <div className="field-row">
                <input
                  type="text"
                  placeholder="별칭 1"
                  value={rt.aliases[0] || ''}
                  onChange={(e) =>
                    updateRoomType(idx, 'aliases', e.target.value, 0)
                  }
                  aria-label="별칭 1 입력"
                />
                <input
                  type="text"
                  placeholder="별칭 2"
                  value={rt.aliases[1] || ''}
                  onChange={(e) =>
                    updateRoomType(idx, 'aliases', e.target.value, 1)
                  }
                  aria-label="별칭 2 입력"
                />
              </div>
              <div className="field-row">
                <input
                  type="text"
                  placeholder="별칭 3"
                  value={rt.aliases[2] || ''}
                  onChange={(e) =>
                    updateRoomType(idx, 'aliases', e.target.value, 2)
                  }
                  aria-label="별칭 3 입력"
                />
                <input
                  type="text"
                  placeholder="별칭 4"
                  value={rt.aliases[3] || ''}
                  onChange={(e) =>
                    updateRoomType(idx, 'aliases', e.target.value, 3)
                  }
                  aria-label="별칭 4 입력"
                />
              </div>
            </div>
            <div className="room-numbers" aria-label="객실 번호 목록">
              <h4>객실 번호 배열</h4>
              <div>
                {rt.roomNumbers?.length > 0
                  ? rt.roomNumbers.join(', ')
                  : '아직 생성되지 않음'}
              </div>
            </div>
            <div
              className="room-amenities-display"
              aria-label="활성화된 객실 시설"
            >
              <h4>활성화된 객실 시설</h4>
              <div className="amenities-list">
                {rt.roomAmenities
                  .filter((amenity) => amenity.isActive)
                  .map((amenity, aIdx) => (
                    <span key={aIdx} className="amenity-item">
                      {iconMap[amenity.icon] || <span>❓</span>}
                      <span title={amenity.nameEng}>{amenity.nameKor}</span>
                    </span>
                  ))}
                {rt.roomAmenities.every((amenity) => !amenity.isActive) && (
                  <span>활성화된 시설이 없습니다.</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="room-type-actions">
        <button
          className="hotel-settings-room-add-btn"
          onClick={addRoomType}
          aria-label="객실 타입 추가"
        >
          + 타입 추가
        </button>
      </div>
    </section>
  );
}

// LayoutEditor 컴포넌트 (부분 저장 버튼 포함)
function LayoutEditor({ roomTypes, setRoomTypes, floors, setFloors, onSave }) {
  const previousFloorsRef = useRef([]);
  const [isAdding, setIsAdding] = useState(false);

  const addFloor = () => {
    if (isAdding) return;
    setIsAdding(true);
    try {
      const maxFloorNum =
        floors.length > 0 ? Math.max(...floors.map((f) => f.floorNum)) : 0;
      const newFloorNum = maxFloorNum + 1;
      if (floors.some((f) => f.floorNum === newFloorNum)) {
        alert('이미 존재하는 층 번호입니다. 다른 번호를 사용하세요.');
        return;
      }
      setFloors((prev) => [...prev, { floorNum: newFloorNum, containers: [] }]);
    } catch (error) {
      console.error('[LayoutEditor] Error adding floor:', error);
      alert('층 추가 중 오류가 발생했습니다.');
    } finally {
      setIsAdding(false);
    }
  };

  const updateContainer = (floorNum, containerId, field, value) => {
    setFloors((prev) => {
      const updated = [...prev];
      const floorIdx = updated.findIndex((f) => f.floorNum === floorNum);
      if (floorIdx === -1) return prev;
      const containerIdx = updated[floorIdx].containers.findIndex(
        (c) => c.containerId === containerId
      );
      if (containerIdx === -1) return prev;
      const container = updated[floorIdx].containers[containerIdx];
      const oldRoomInfo = container.roomInfo;
      if (field === 'price') {
        const numValue = Number(value);
        if (isNaN(numValue) && value !== '') {
          alert('유효한 가격을 입력해주세요.');
          return prev;
        }
        container[field] = numValue || 0;
      } else {
        container[field] = value;
      }
      if (field === 'roomInfo') {
        if (!value || value === '') return prev;
        if (!container.roomNumber) {
          const allRooms = updated.flatMap((f) =>
            f.containers.filter((c) => c.roomInfo && c.roomNumber)
          );
          const existingNumbers = new Set(allRooms.map((c) => c.roomNumber));
          let lastNum = parseInt(`${floorNum}01`, 10) - 1;
          const floorRooms = allRooms.filter((c) =>
            c.roomNumber.startsWith(floorNum.toString())
          );
          if (floorRooms.length > 0) {
            lastNum = Math.max(
              ...floorRooms.map((c) => parseInt(c.roomNumber, 10))
            );
          }
          let nextNum = lastNum + 1;
          while (
            existingNumbers.has(
              `${floorNum}${(nextNum - floorNum * 100)
                .toString()
                .padStart(2, '0')}`
            )
          ) {
            nextNum++;
          }
          container.roomNumber = `${floorNum}${(nextNum - floorNum * 100)
            .toString()
            .padStart(2, '0')}`;
        }
        const matchingType = roomTypes.find((rt) => rt.roomInfo === value);
        container.price = matchingType ? matchingType.price : 0;
        const uniqueId = uuidv4();
        container.containerId = `${floorNum}-${value}-${
          container.roomNumber
        }-${Date.now()}-${uniqueId}`;
        setRoomTypes((prevTypes) => {
          const updatedTypes = [...prevTypes];
          if (oldRoomInfo && container.roomNumber) {
            const oldIdx = updatedTypes.findIndex(
              (rt) => rt.roomInfo === oldRoomInfo
            );
            if (oldIdx !== -1) {
              updatedTypes[oldIdx].roomNumbers = updatedTypes[
                oldIdx
              ].roomNumbers.filter((num) => num !== container.roomNumber);
              updatedTypes[oldIdx].stock =
                updatedTypes[oldIdx].roomNumbers.length;
            }
          }
          if (container.roomNumber) {
            const newIdx = updatedTypes.findIndex(
              (rt) => rt.roomInfo === value
            );
            if (
              newIdx !== -1 &&
              !updatedTypes[newIdx].roomNumbers.includes(container.roomNumber)
            ) {
              updatedTypes[newIdx].roomNumbers.push(container.roomNumber);
              updatedTypes[newIdx].roomNumbers.sort(
                (a, b) => parseInt(a, 10) - parseInt(b, 10)
              );
              updatedTypes[newIdx].stock =
                updatedTypes[newIdx].roomNumbers.length;
            }
          }
          return updatedTypes;
        });
        updated[floorIdx].containers.sort(
          (a, b) => parseInt(a.roomNumber, 10) - parseInt(b.roomNumber, 10)
        );
      }
      return updated;
    });
  };

  const incrementContainerPrice = (floorNum, containerId) => {
    setFloors((prev) => {
      const updated = [...prev];
      const floorIdx = updated.findIndex((f) => f.floorNum === floorNum);
      if (floorIdx === -1) return prev;
      const containerIdx = updated[floorIdx].containers.findIndex(
        (c) => c.containerId === containerId
      );
      if (containerIdx === -1) return prev;
      updated[floorIdx].containers[containerIdx].price =
        (updated[floorIdx].containers[containerIdx].price || 0) + 1000;
      return updated;
    });
  };

  const decrementContainerPrice = (floorNum, containerId) => {
    setFloors((prev) => {
      const updated = [...prev];
      const floorIdx = updated.findIndex((f) => f.floorNum === floorNum);
      if (floorIdx === -1) return prev;
      const containerIdx = updated[floorIdx].containers.findIndex(
        (c) => c.containerId === containerId
      );
      if (containerIdx === -1) return prev;
      updated[floorIdx].containers[containerIdx].price = Math.max(
        0,
        (updated[floorIdx].containers[containerIdx].price || 0) - 1000
      );
      return updated;
    });
  };

  const removeFloor = (floorNum) => {
    setFloors((prev) => {
      if (!prev) return prev;
      previousFloorsRef.current = [...prev];
      const updated = prev.filter((f) => f.floorNum !== floorNum);
      setRoomTypes((prevTypes) =>
        prevTypes.map((rt) => ({
          ...rt,
          roomNumbers: rt.roomNumbers.filter(
            (num) => !num.startsWith(String(floorNum))
          ),
          stock: rt.roomNumbers.filter(
            (num) => !num.startsWith(String(floorNum))
          ).length,
        }))
      );
      return updated;
    });
  };

  const undoRemoveFloor = () => {
    if (previousFloorsRef.current.length > 0) {
      setFloors([...previousFloorsRef.current]);
      previousFloorsRef.current = [];
    } else {
      alert('되돌릴 삭제가 없습니다.');
    }
  };

  const addRoomToFloor = async (floorNum) => {
    if (isAdding) return;
    setIsAdding(true);
    try {
      const defaultRoomType = initializedDefaultRoomTypes[0];
      let newRoomNumber;
      setFloors((prev) => {
        const updated = [...prev];
        const floorIdx = updated.findIndex((f) => f.floorNum === floorNum);
        if (floorIdx === -1) return prev;
        const activeRooms = updated[floorIdx].containers.filter(
          (c) => c.roomInfo && c.roomNumber
        );
        const allRooms = updated.flatMap((f) =>
          f.containers.filter((c) => c.roomInfo && c.roomNumber)
        );
        const existingNumbers = new Set(allRooms.map((c) => c.roomNumber));
        let lastNum = parseInt(`${floorNum}01`, 10) - 1;
        if (activeRooms.length > 0) {
          const floorRooms = allRooms.filter((c) =>
            c.roomNumber.startsWith(floorNum.toString())
          );
          if (floorRooms.length > 0) {
            lastNum = Math.max(
              ...floorRooms.map((c) => parseInt(c.roomNumber, 10))
            );
          }
        }
        let nextNum = lastNum + 1;
        while (
          existingNumbers.has(
            `${floorNum}${(nextNum - floorNum * 100)
              .toString()
              .padStart(2, '0')}`
          )
        ) {
          nextNum++;
        }
        newRoomNumber = `${floorNum}${(nextNum - floorNum * 100)
          .toString()
          .padStart(2, '0')}`;
        const kstNow = toZonedTime(new Date(), 'Asia/Seoul');
        const uniqueId = uuidv4();
        const newContainer = {
          containerId: `${floorNum}-${
            defaultRoomType.roomInfo
          }-${newRoomNumber}-${kstNow.getTime()}-${uniqueId}`,
          roomInfo: defaultRoomType.roomInfo,
          roomNumber: newRoomNumber,
          price: defaultRoomType.price,
          isActive: true,
        };
        if (!existingNumbers.has(newRoomNumber)) {
          updated[floorIdx].containers.push(newContainer);
          updated[floorIdx].containers.sort(
            (a, b) => parseInt(a.roomNumber, 10) - parseInt(b.roomNumber, 10)
          );
        }
        return updated;
      });
      setRoomTypes((prevTypes) => {
        const updatedTypes = [...prevTypes];
        const typeIdx = updatedTypes.findIndex(
          (rt) => rt.roomInfo === defaultRoomType.roomInfo
        );
        if (
          typeIdx !== -1 &&
          !updatedTypes[typeIdx].roomNumbers.includes(newRoomNumber)
        ) {
          updatedTypes[typeIdx].roomNumbers = (
            updatedTypes[typeIdx].roomNumbers || []
          ).concat([newRoomNumber]);
          updatedTypes[typeIdx].roomNumbers.sort(
            (a, b) => parseInt(a, 10) - parseInt(b, 10)
          );
          updatedTypes[typeIdx].stock =
            updatedTypes[typeIdx].roomNumbers.length;
        }
        return updatedTypes;
      });
    } catch (error) {
      console.error('[LayoutEditor] Error adding room:', error);
      alert('객실 추가 중 오류가 발생했습니다.');
    } finally {
      setIsAdding(false);
    }
  };

  const removeContainer = (floorNum, containerId) => {
    setFloors((prev) => {
      const updated = [...prev];
      const floorIdx = updated.findIndex((f) => f.floorNum === floorNum);
      if (floorIdx === -1) return prev;
      const containers = updated[floorIdx].containers;
      const containerIdx = containers.findIndex(
        (c) => c.containerId === containerId
      );
      if (containerIdx === -1) return prev;
      const removed = containers[containerIdx];
      containers.splice(containerIdx, 1);
      if (removed.roomInfo && removed.roomNumber) {
        setRoomTypes((prevTypes) => {
          const updatedTypes = [...prevTypes];
          const typeIdx = updatedTypes.findIndex(
            (rt) => rt.roomInfo === removed.roomInfo
          );
          if (typeIdx !== -1) {
            updatedTypes[typeIdx].roomNumbers = updatedTypes[
              typeIdx
            ].roomNumbers.filter((num) => num !== removed.roomNumber);
            updatedTypes[typeIdx].roomNumbers = [
              ...new Set(updatedTypes[typeIdx].roomNumbers),
            ];
            updatedTypes[typeIdx].roomNumbers.sort(
              (a, b) => parseInt(a, 10) - parseInt(b, 10)
            );
            updatedTypes[typeIdx].stock =
              updatedTypes[typeIdx].roomNumbers.length;
          }
          return updatedTypes;
        });
      }
      const uniqueContainers = [];
      const seenNumbers = new Set();
      containers.forEach((container) => {
        if (
          container.roomInfo &&
          container.roomNumber &&
          !seenNumbers.has(container.roomNumber)
        ) {
          seenNumbers.add(container.roomNumber);
          uniqueContainers.push(container);
        }
      });
      uniqueContainers.sort(
        (a, b) => parseInt(a.roomNumber, 10) - parseInt(b.roomNumber, 10)
      );
      uniqueContainers.forEach((container, idx) => {
        const newRoomNumber = `${floorNum}${(idx + 1)
          .toString()
          .padStart(2, '0')}`;
        container.roomNumber = newRoomNumber;
        const kstNow = toZonedTime(new Date(), 'Asia/Seoul');
        container.containerId = `${floorNum}-${
          container.roomInfo
        }-${newRoomNumber}-${kstNow.getTime()}-${Math.random()
          .toString(36)
          .substr(2, 9)}`;
      });
      updated[floorIdx].containers = uniqueContainers;
      return updated;
    });
  };

  const generateInitialLayout = () => {
    // 디폴트 설정 로딩: defaultRoomTypes를 기반으로 roomTypes 초기화
    const defaultRoomTypesCopy = defaultRoomTypes.map((rt) => ({
      ...rt,
      aliases: [],
      roomNumbers: [],
      roomAmenities: DEFAULT_AMENITIES.map((a) => ({ ...a, isActive: false })),
      photos: [],
    }));

    // 디폴트 설정 기반으로 floors 생성
    const newFloors = DEFAULT_FLOORS.map((floorNum) => {
      const containers = [];
      const roomType = defaultRoomTypesCopy.find(
        (rt) => rt.floorSettings[floorNum] > 0
      );
      if (roomType) {
        const stock = roomType.floorSettings[floorNum] || 0;
        const startNum = parseInt(
          roomType.startRoomNumbers[floorNum] || `${floorNum}01`,
          10
        );
        for (let i = 0; i < stock; i++) {
          const roomNum = `${startNum + i}`;
          containers.push({
            containerId: `${floorNum}-${
              roomType.roomInfo
            }-${roomNum}-${Date.now()}`,
            roomInfo: roomType.roomInfo,
            roomNumber: roomNum,
            price: roomType.price,
            isActive: true,
          });
          roomType.roomNumbers.push(roomNum);
        }
      }
      containers.sort(
        (a, b) => parseInt(a.roomNumber, 10) - parseInt(b.roomNumber, 10)
      );
      return { floorNum, containers };
    });

    // roomNumbers 중복 제거 및 정렬
    defaultRoomTypesCopy.forEach((rt) => {
      rt.roomNumbers = [...new Set(rt.roomNumbers)];
      rt.roomNumbers.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
      rt.stock = rt.roomNumbers.length;
    });

    // 상태 업데이트
    setRoomTypes(defaultRoomTypesCopy);
    setFloors(newFloors);

    // totalRooms 계산 및 상위 컴포넌트에 반영
    const newTotal = newFloors.reduce(
      (sum, f) =>
        sum +
        (f.containers || []).filter((c) => c.roomInfo && c.roomNumber).length,
      0
    );
    // onSave를 통해 상위 컴포넌트에서 totalRooms 업데이트
    if (onSave) {
      onSave({ totalRooms: newTotal });
    }

    alert('디폴트 레이아웃이 생성되었습니다.');
  };

  return (
    <section
      className="layout-editor-section"
      aria-label="객실 레이아웃 편집 섹션"
    >
      <div className="layout-header">
        <h2>◉ 객실 레이아웃 편집</h2>
        <button
          className="hotel-settings-btn generate-btn"
          onClick={generateInitialLayout}
          title="디폴트 레이아웃 생성"
          aria-label="디폴트 레이아웃 생성"
        >
          디폴트 레이아웃 생성
        </button>
        <button
          className="hotel-settings-btn undo-btn"
          onClick={undoRemoveFloor}
          title="되돌리기"
          aria-label="삭제 되돌리기"
        >
          <FaUndo />
        </button>
        <button
          className="hotel-settings-btn add-floor-btn"
          onClick={addFloor}
          disabled={isAdding}
          title="층 추가"
          aria-label="층 추가"
        >
          <FaPlus /> 층 추가
        </button>
      </div>
      <div className="floor-grid">
        {floors
          .slice()
          .reverse()
          .map((floor) => (
            <div key={floor.floorNum} className="floor-row">
              <div className="floor-header">
                <h3 style={{ marginLeft: '10px', color: 'lightslategray' }}>
                  {floor.floorNum}F
                  <FaMinus
                    onClick={() => removeFloor(floor.floorNum)}
                    className="remove-icon"
                    title="객실 층 삭제"
                    aria-label={`층 ${floor.floorNum} 삭제`}
                  />
                </h3>
              </div>
              <div className="containers">
                {floor.containers.map((cont, index) => (
                  <React.Fragment key={cont.containerId}>
                    <div
                      className="container-box"
                      style={{
                        backgroundColor: getColorForRoomType(cont.roomInfo),
                      }}
                    >
                      <select
                        value={cont.roomInfo}
                        onChange={(e) =>
                          updateContainer(
                            floor.floorNum,
                            cont.containerId,
                            'roomInfo',
                            e.target.value
                          )
                        }
                        aria-label={`객실 유형 선택 ${index + 1}`}
                      >
                        {roomTypes.map((rt) => (
                          <option key={rt.roomInfo} value={rt.roomInfo}>
                            {rt.roomInfo}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={cont.roomNumber}
                        onChange={(e) =>
                          updateContainer(
                            floor.floorNum,
                            cont.containerId,
                            'roomNumber',
                            e.target.value
                          )
                        }
                        placeholder="객실 번호"
                        aria-label="객실 번호 입력"
                      />
                      <div className="price-row">
                        <div className="price-input-container">
                          <input
                            type="number"
                            value={cont.price || 0}
                            onChange={(e) =>
                              updateContainer(
                                floor.floorNum,
                                cont.containerId,
                                'price',
                                e.target.value
                              )
                            }
                            placeholder="가격"
                            style={{
                              width: '100px',
                              paddingRight: '0',
                              border: 'none',
                              borderRadius: '0',
                            }}
                            aria-label="가격 입력"
                          />
                          <div className="price-buttons">
                            <button
                              className="hotel-settings-btn price-btn increment"
                              onClick={() =>
                                incrementContainerPrice(
                                  floor.floorNum,
                                  cont.containerId
                                )
                              }
                              aria-label="가격 증가"
                            >
                              <FaPlus />
                            </button>
                            <button
                              className="hotel-settings-btn price-btn decrement"
                              onClick={() =>
                                decrementContainerPrice(
                                  floor.floorNum,
                                  cont.containerId
                                )
                              }
                              aria-label="가격 감소"
                            >
                              <FaMinus />
                            </button>
                          </div>
                        </div>
                      </div>
                      <button
                        className="hotel-settings-layout-btn delete-btn"
                        onClick={() =>
                          removeContainer(floor.floorNum, cont.containerId)
                        }
                        aria-label={`객실 ${cont.roomNumber} 삭제`}
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </React.Fragment>
                ))}
                <button
                  className="hotel-settings-layout-btn add-room-btn"
                  onClick={() => addRoomToFloor(floor.floorNum)}
                  disabled={isAdding}
                  title="객실 추가"
                  aria-label={`층 ${floor.floorNum}에 객실 추가`}
                >
                  <FaPlus />
                </button>
              </div>
            </div>
          ))}
      </div>
      <div className="tab-actions"></div>
    </section>
  );
}

// PhotoUploadSection은 업로드/삭제 시 바로 API 호출되므로 저장 버튼 없음
function PhotoUploadSection({ hotelId, roomTypes, hotelInfo, language }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [roomPhotos, setRoomPhotos] = useState({});
  const [exteriorPhotos, setExteriorPhotos] = useState([]);
  const [facilityPhotos, setFacilityPhotos] = useState({});
  const [roomFiles, setRoomFiles] = useState({});
  const [exteriorFiles, setExteriorFiles] = useState([]);
  const [facilityFiles, setFacilityFiles] = useState({});

  const handlePasswordSubmit = async () => {
    try {
      const response = await api.post('/api/auth/validate-upload-password', {
        hotelId,
        password,
      });
      if (response.data.valid || password === DEFAULT_PASSWORD) {
        setIsAuthenticated(true);
      } else {
        setPasswordError(
          language === 'kor'
            ? '비밀번호가 올바르지 않습니다.'
            : 'Invalid password.'
        );
      }
    } catch (err) {
      if (password === DEFAULT_PASSWORD) {
        setIsAuthenticated(true);
      } else {
        setPasswordError(
          language === 'kor'
            ? '비밀번호 인증 실패: ' +
                (err.response?.data?.message || err.message)
            : 'Password authentication failed: ' +
                (err.response?.data?.message || err.message)
        );
      }
    }
  };

  useEffect(() => {
    if (!hotelId || !roomTypes) {
      setError(
        language === 'kor'
          ? '호텔 ID 또는 객실 타입 정보가 없습니다.'
          : 'Hotel ID or room type information is missing.'
      );
      return;
    }
    const initialRoomPhotos = {};
    roomTypes.forEach((rt) => {
      initialRoomPhotos[rt.roomInfo] = [];
    });
    setRoomPhotos(initialRoomPhotos);
    setRoomFiles(
      roomTypes.reduce((acc, rt) => {
        acc[rt.roomInfo] = [];
        return acc;
      }, {})
    );
    const initialFacilityPhotos = {};
    FACILITY_SUB_CATEGORIES.forEach((subCat) => {
      initialFacilityPhotos[subCat] = [];
    });
    setFacilityPhotos(initialFacilityPhotos);
    setFacilityFiles(
      FACILITY_SUB_CATEGORIES.reduce((acc, subCat) => {
        acc[subCat] = [];
        return acc;
      }, {})
    );
    const fetchPhotos = async () => {
      try {
        const response = await api.get('/api/hotel-settings/photos', {
          params: { hotelId },
        });
        console.log('[PhotoUploadSection] Fetched photos:', response.data); // 디버깅 로그 추가

        // commonPhotos와 roomPhotos를 직접 사용
        const commonPhotos = response.data.commonPhotos || [];
        const roomPhotosData = response.data.roomPhotos || [];

        // roomPhotos 처리
        const newRoomPhotos = { ...initialRoomPhotos };
        roomPhotosData.forEach((photo) => {
          if (newRoomPhotos[photo.subCategory]) {
            newRoomPhotos[photo.subCategory].push({
              photoUrl: photo.photoUrl,
              order: photo.order,
            });
          }
        });
        setRoomPhotos(newRoomPhotos);

        // exteriorPhotos 처리 (commonPhotos에서 exterior 필터링)
        const newExteriorPhotos = commonPhotos
          .filter((photo) => photo.category === 'exterior')
          .map((photo) => ({ photoUrl: photo.photoUrl, order: photo.order }));
        setExteriorPhotos(newExteriorPhotos);

        // facilityPhotos 처리 (commonPhotos에서 facility 필터링)
        const newFacilityPhotos = { ...initialFacilityPhotos };
        commonPhotos
          .filter((photo) => photo.category === 'facility')
          .forEach((photo) => {
            if (newFacilityPhotos[photo.subCategory]) {
              newFacilityPhotos[photo.subCategory].push({
                photoUrl: photo.photoUrl,
                order: photo.order,
              });
            }
          });
        setFacilityPhotos(newFacilityPhotos);
      } catch (err) {
        setError(
          language === 'kor'
            ? '사진 로드 실패: ' + (err.response?.data?.message || err.message)
            : 'Failed to load photos: ' +
                (err.response?.data?.message || err.message)
        );
      }
    };
    fetchPhotos();
  }, [hotelId, roomTypes, language]);

  const validateFile = (file) => {
    if (!ALLOWED_FORMATS.includes(file.type)) {
      return language === 'kor'
        ? `허용된 파일 형식은 ${ALLOWED_FORMATS.join(
            ', '
          )}입니다. (현재 파일: ${file.type})`
        : `Allowed file formats are ${ALLOWED_FORMATS.join(
            ', '
          )}. (Current file: ${file.type})`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return language === 'kor'
        ? `파일 크기는 ${
            MAX_FILE_SIZE / 1024 / 1024
          }MB를 초과할 수 없습니다. (현재 크기: ${(
            file.size /
            1024 /
            1024
          ).toFixed(2)}MB)`
        : `File size cannot exceed ${
            MAX_FILE_SIZE / 1024 / 1024
          }MB. (Current size: ${(file.size / 1024 / 1024).toFixed(2)}MB)`;
    }
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        if (
          img.width > MAX_RESOLUTION.width ||
          img.height > MAX_RESOLUTION.height
        ) {
          reject(
            language === 'kor'
              ? `해상도는 ${MAX_RESOLUTION.width}x${MAX_RESOLUTION.height}을 초과할 수 없습니다. (현재 해상도: ${img.width}x${img.height})`
              : `Resolution cannot exceed ${MAX_RESOLUTION.width}x${MAX_RESOLUTION.height}. (Current resolution: ${img.width}x${img.height})`
          );
        } else {
          resolve();
        }
        URL.revokeObjectURL(img.src);
      };
      img.onerror = () =>
        reject(
          language === 'kor' ? '이미지 로드 실패' : 'Failed to load image'
        );
    });
  };

  const resizeImage = (file) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        let { width, height } = img;

        // 해상도 조정
        if (width > MAX_RESOLUTION.width || height > MAX_RESOLUTION.height) {
          const ratio = Math.min(
            MAX_RESOLUTION.width / width,
            MAX_RESOLUTION.height / height
          );
          width = width * ratio;
          height = height * ratio;
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        // WebP 포맷으로 변환, 품질 조정
        canvas.toBlob(
          (blob) => {
            if (blob.size > MAX_FILE_SIZE) {
              // 품질을 더 낮춰 재시도
              canvas.toBlob(
                (smallerBlob) => {
                  if (smallerBlob.size > MAX_FILE_SIZE) {
                    reject(
                      language === 'kor'
                        ? '조정 후에도 파일 크기가 3MB를 초과합니다.'
                        : 'File size exceeds 3MB even after resizing.'
                    );
                  } else {
                    const resizedFile = new File(
                      [smallerBlob],
                      file.name.replace(/\.[^/.]+$/, '.webp'),
                      {
                        type: 'image/webp',
                        lastModified: Date.now(),
                      }
                    );
                    resolve(resizedFile);
                  }
                },
                'image/webp',
                0.6 // 품질 60%로 설정
              );
            } else {
              const resizedFile = new File(
                [blob],
                file.name.replace(/\.[^/.]+$/, '.webp'),
                {
                  type: 'image/webp',
                  lastModified: Date.now(),
                }
              );
              resolve(resizedFile);
            }
          },
          'image/webp',
          0.8 // 초기 품질 80%로 설정
        );
        URL.revokeObjectURL(img.src);
      };
      img.onerror = () =>
        reject(
          language === 'kor' ? '이미지 로드 실패' : 'Failed to load image'
        );
    });
  };

  const handleFileChange = async (category, subCategory, e) => {
    const files = Array.from(e.target.files);
    const resizedFiles = await Promise.all(
      files.map(async (file) => {
        try {
          const validationError = await validateFile(file);
          if (validationError) {
            throw new Error(validationError);
          }
          return file;
        } catch (err) {
          if (
            err.message.includes('파일 크기는') ||
            err.message.includes('해상도는')
          ) {
            setError(
              language === 'kor'
                ? err.message + ' - 자동으로 크기를 조정합니다.'
                : err.message + ' - Automatically resizing the image.'
            );
            return await resizeImage(file);
          }
          throw err;
        }
      })
    );
    try {
      if (category === 'room') {
        setRoomFiles((prev) => ({
          ...prev,
          [subCategory]: resizedFiles.map((file) => ({ file, order: 1 })),
        }));
      } else if (category === 'exterior') {
        setExteriorFiles(resizedFiles.map((file) => ({ file, order: 1 })));
      } else if (category === 'facility') {
        setFacilityFiles((prev) => ({
          ...prev,
          [subCategory]: resizedFiles.map((file) => ({ file, order: 1 })),
        }));
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleOrderChange = (category, subCategory, index, value) => {
    const order = Math.max(1, Math.min(100, parseInt(value, 10) || 1));
    if (category === 'room') {
      setRoomFiles((prev) => {
        const updatedFiles = [...prev[subCategory]];
        updatedFiles[index] = { ...updatedFiles[index], order };
        return { ...prev, [subCategory]: updatedFiles };
      });
    } else if (category === 'exterior') {
      setExteriorFiles((prev) => {
        const updatedFiles = [...prev];
        updatedFiles[index] = { ...updatedFiles[index], order };
        return updatedFiles;
      });
    } else if (category === 'facility') {
      setFacilityFiles((prev) => {
        const updatedFiles = [...prev[subCategory]];
        updatedFiles[index] = { ...updatedFiles[index], order };
        return { ...prev, [subCategory]: updatedFiles };
      });
    }
  };

  const handleUpload = async (category, subCategory) => {
    const files =
      category === 'room'
        ? roomFiles[subCategory]
        : category === 'exterior'
        ? exteriorFiles
        : facilityFiles[subCategory];
    if (!files || files.length === 0) {
      setError(
        language === 'kor' ? '파일을 선택하세요.' : 'Please select a file.'
      );
      return;
    }
    try {
      const formData = new FormData();
      files.forEach((fileObj, index) => {
        formData.append('photo', fileObj.file);
        formData.append(`order[${index}]`, fileObj.order);
      });
      formData.append('hotelId', hotelId);
      formData.append('category', category);
      formData.append('subCategory', subCategory);
      const response = await api.post('/api/hotel-settings/photos', formData);
      const newPhotos = response.data.photos;
      if (category === 'room') {
        setRoomPhotos((prev) => ({
          ...prev,
          [subCategory]: [...prev[subCategory], ...newPhotos],
        }));
        setRoomFiles((prev) => ({ ...prev, [subCategory]: [] }));
      } else if (category === 'exterior') {
        setExteriorPhotos((prev) => [...prev, ...newPhotos]);
        setExteriorFiles([]);
      } else if (category === 'facility') {
        setFacilityPhotos((prev) => ({
          ...prev,
          [subCategory]: [...prev[subCategory], ...newPhotos],
        }));
        setFacilityFiles((prev) => ({ ...prev, [subCategory]: [] }));
      }
      setMessage(
        language === 'kor'
          ? '사진이 성공적으로 업로드되었습니다.'
          : 'Photo uploaded successfully.'
      );
      setError('');
    } catch (err) {
      const errorMsg =
        err.response?.data?.message ||
        err.message ||
        (language === 'kor'
          ? '사진 업로드에 실패했습니다. 서버 오류입니다.'
          : 'Failed to upload photo. Server error.');
      setError(
        language === 'kor'
          ? `업로드 실패: ${errorMsg} (${
              err.response?.status || '알 수 없는 상태 코드'
            })`
          : `Upload failed: ${errorMsg} (${
              err.response?.status || 'Unknown status code'
            })`
      );
      setMessage('');
    }
  };

  const handleDelete = async (category, subCategory, photoUrl) => {
    try {
      await api.delete('/api/hotel-settings/photos', {
        data: { hotelId, category, subCategory, photoUrl },
      });
      if (category === 'room') {
        setRoomPhotos((prev) => ({
          ...prev,
          [subCategory]: prev[subCategory].filter(
            (photo) => photo.photoUrl !== photoUrl
          ),
        }));
      } else if (category === 'exterior') {
        setExteriorPhotos((prev) =>
          prev.filter((photo) => photo.photoUrl !== photoUrl)
        );
      } else if (category === 'facility') {
        setFacilityPhotos((prev) => ({
          ...prev,
          [subCategory]: prev[subCategory].filter(
            (photo) => photo.photoUrl !== photoUrl
          ),
        }));
      }
      setMessage(
        language === 'kor'
          ? '사진이 삭제되었습니다.'
          : 'Photo has been deleted.'
      );
      setError('');
    } catch (err) {
      const errorMsg =
        err.response?.data?.message ||
        (language === 'kor' ? '알 수 없는 오류' : 'Unknown error');
      setError(
        language === 'kor'
          ? `삭제 실패: ${errorMsg}`
          : `Delete failed: ${errorMsg}`
      );
      setMessage('');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="photo-upload-container">
        <div className="password-card">
          <h1>
            {language === 'kor' ? '호텔 사진 관리' : 'Hotel Photo Management'}
          </h1>
          <div className="password-prompt">
            <label htmlFor="password">
              {language === 'kor'
                ? '관리자 비밀번호 입력'
                : 'Enter Admin Password'}
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={
                language === 'kor' ? '비밀번호를 입력하세요' : 'Enter password'
              }
            />
            <button
              className="photo-upload-submit-password-btn"
              onClick={handlePasswordSubmit}
            >
              {language === 'kor' ? '확인' : 'Submit'}
            </button>
            {passwordError && <p className="error-message">{passwordError}</p>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="photo-upload-container">
      <div className="hotel-info-section">
        <div className="hotel-info-box">
          <h2>{language === 'kor' ? '호텔 정보' : 'Hotel Information'}</h2>
          {hotelInfo ? (
            <div className="hotel-details">
              <p>
                <strong>{language === 'kor' ? '호텔 ID:' : 'Hotel ID:'}</strong>{' '}
                {hotelInfo.hotelId}
              </p>
              <p>
                <strong>
                  {language === 'kor' ? '호텔 이름:' : 'Hotel Name:'}
                </strong>{' '}
                {hotelInfo.hotelName}
              </p>
              <p>
                <strong>{language === 'kor' ? '주소:' : 'Address:'}</strong>{' '}
                {hotelInfo.address}
              </p>
              <p>
                <strong>
                  {language === 'kor' ? '관리자 이름:' : 'Admin Name:'}
                </strong>{' '}
                {hotelInfo.adminName}
              </p>
              <p>
                <strong>{language === 'kor' ? '이메일:' : 'Email:'}</strong>{' '}
                {hotelInfo.email}
              </p>
              <p>
                <strong>
                  {language === 'kor' ? '전화번호:' : 'Phone Number:'}
                </strong>{' '}
                {hotelInfo.phoneNumber}
              </p>
            </div>
          ) : (
            <p>
              {language === 'kor'
                ? '호텔 정보를 로드할 수 없습니다.'
                : 'Unable to load hotel information.'}
            </p>
          )}
        </div>
      </div>
      {error && <p className="error-message center-text">{error}</p>}
      {message && <p className="success-message center-text">{message}</p>}
      <section className="photo-upload-section">
        <h2 className="section-title">
          {language === 'kor' ? '객실 사진' : 'Room Photos'}
        </h2>
        {roomTypes &&
          roomTypes.map((rt) => (
            <div key={rt.roomInfo} className="photo-upload-card">
              <div className="photo-upload-header">
                <h3>
                  {language === 'kor' ? rt.nameKor : rt.nameEng} ({rt.nameEng})
                </h3>
              </div>
              <div className="photo-upload-input">
                <input
                  type="file"
                  id={`room-file-${rt.roomInfo}`}
                  accept="image/*"
                  multiple
                  onChange={(e) => handleFileChange('room', rt.roomInfo, e)}
                />
                {roomFiles[rt.roomInfo]?.map((fileObj, index) => (
                  <div key={index} className="file-order-input">
                    <span>{fileObj.file.name}</span>
                    <input
                      type="number"
                      value={fileObj.order}
                      onChange={(e) =>
                        handleOrderChange(
                          'room',
                          rt.roomInfo,
                          index,
                          e.target.value
                        )
                      }
                      min="1"
                      max="100"
                      placeholder={language === 'kor' ? '순서' : 'Order'}
                      className="order-input"
                    />
                  </div>
                ))}
                <button
                  className="photo-upload-upload-btn"
                  onClick={() => handleUpload('room', rt.roomInfo)}
                >
                  <FaCamera /> {language === 'kor' ? '업로드' : 'Upload'}
                </button>
              </div>
              <div className="photo-thumbnails">
                {roomPhotos[rt.roomInfo]?.map((photo, index) => (
                  <div key={index} className="thumbnail">
                    <img src={photo.photoUrl} alt={`Thumbnail ${index}`} />
                    <button
                      className="photo-upload-delete-btn"
                      onClick={() =>
                        handleDelete('room', rt.roomInfo, photo.photoUrl)
                      }
                      aria-label={
                        language === 'kor' ? '사진 삭제' : 'Delete photo'
                      }
                    >
                      <FaTrash />
                    </button>
                    <span className="thumbnail-order">
                      {language === 'kor' ? '순서:' : 'Order:'} {photo.order}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
      </section>
      <section className="photo-upload-section">
        <h2 className="section-title">
          {language === 'kor' ? '호텔 전경 사진' : 'Hotel Exterior Photos'}
        </h2>
        <div className="photo-upload-card">
          <div className="photo-upload-input">
            <input
              type="file"
              id="exterior-file"
              accept="image/*"
              multiple
              onChange={(e) => handleFileChange('exterior', 'default', e)}
            />
            {exteriorFiles.map((fileObj, index) => (
              <div key={index} className="file-order-input">
                <span>{fileObj.file.name}</span>
                <input
                  type="number"
                  value={fileObj.order}
                  onChange={(e) =>
                    handleOrderChange(
                      'exterior',
                      'default',
                      index,
                      e.target.value
                    )
                  }
                  min="1"
                  max="100"
                  placeholder={language === 'kor' ? '순서' : 'Order'}
                  className="order-input"
                />
              </div>
            ))}
            <button
              className="photo-upload-upload-btn"
              onClick={() => handleUpload('exterior', 'default')}
            >
              <FaCamera /> {language === 'kor' ? '업로드' : 'Upload'}
            </button>
          </div>
          <div className="photo-thumbnails">
            {exteriorPhotos.map((photo, index) => (
              <div key={index} className="thumbnail">
                <img src={photo.photoUrl} alt={`Thumbnail ${index}`} />
                <button
                  className="photo-upload-delete-btn"
                  onClick={() =>
                    handleDelete('exterior', 'default', photo.photoUrl)
                  }
                  aria-label={language === 'kor' ? '사진 삭제' : 'Delete photo'}
                >
                  <FaTrash />
                </button>
                <span className="thumbnail-order">
                  {language === 'kor' ? '순서:' : 'Order:'} {photo.order}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="photo-upload-section">
        <h2 className="section-title">
          {language === 'kor' ? '기타 시설 사진' : 'Facility Photos'}
        </h2>
        {Object.keys(facilityPhotos).map((subCat) => (
          <div key={subCat} className="photo-upload-card">
            <div className="photo-upload-header">
              <h3>{FACILITY_SUB_CATEGORY_NAMES[subCat][language]}</h3>
            </div>
            <div className="photo-upload-input">
              <input
                type="file"
                id={`facility-file-${subCat}`}
                accept="image/*"
                multiple
                onChange={(e) => handleFileChange('facility', subCat, e)}
              />
              {facilityFiles[subCat]?.map((fileObj, index) => (
                <div key={index} className="file-order-input">
                  <span>{fileObj.file.name}</span>
                  <input
                    type="number"
                    value={fileObj.order}
                    onChange={(e) =>
                      handleOrderChange(
                        'facility',
                        subCat,
                        index,
                        e.target.value
                      )
                    }
                    min="1"
                    max="100"
                    placeholder={language === 'kor' ? '순서' : 'Order'}
                    className="order-input"
                  />
                </div>
              ))}
              <button
                className="photo-upload-upload-btn"
                onClick={() => handleUpload('facility', subCat)}
              >
                <FaCamera /> {language === 'kor' ? '업로드' : 'Upload'}
              </button>
            </div>
            <div className="photo-thumbnails">
              {facilityPhotos[subCat]?.map((photo, index) => (
                <div key={index} className="thumbnail">
                  <img src={photo.photoUrl} alt={`Thumbnail ${index}`} />
                  <button
                    className="photo-upload-delete-btn"
                    onClick={() =>
                      handleDelete('facility', subCat, photo.photoUrl)
                    }
                    aria-label={
                      language === 'kor' ? '사진 삭제' : 'Delete photo'
                    }
                  >
                    <FaTrash />
                  </button>
                  <span className="thumbnail-order">
                    {language === 'kor' ? '순서:' : 'Order:'} {photo.order}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

function EventSettingsSection({
  language,
  events,
  setEvents,
  roomTypes,
  onEventsChange,
}) {
  const generateUniqueId = () => uuidv4();

  const [newEvent, setNewEvent] = useState({
    uuid: generateUniqueId(),
    eventName: '',
    startDate: '',
    endDate: '',
    discountType: 'percentage',
    discountValue: '',
    applicableRoomTypes: [],
  });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // 이벤트 검증 함수
  const validateEvent = (event, existingEvents = [], editingUuid = null) => {
    console.log('[validateEvent] Validating event:', event);

    if (!event.uuid) {
      throw new Error(
        language === 'kor'
          ? '이벤트 고유 식별자가 필요합니다.'
          : 'Event UUID is required'
      );
    }

    if (!event.eventName || event.eventName.trim() === '') {
      throw new Error(
        language === 'kor'
          ? '이벤트 이름을 입력해주세요.'
          : 'Please enter an event name'
      );
    }

    if (!event.startDate || !event.endDate) {
      throw new Error(
        language === 'kor'
          ? '시작일과 종료일을 입력해주세요.'
          : 'Please enter both start and end dates'
      );
    }

    const startDateKST = toZonedTime(new Date(event.startDate), 'Asia/Seoul');
    const endDateKST = toZonedTime(new Date(event.endDate), 'Asia/Seoul');

    if (isNaN(startDateKST.getTime()) || isNaN(endDateKST.getTime())) {
      throw new Error(
        language === 'kor'
          ? '유효한 날짜를 입력해주세요.'
          : 'Please enter valid dates'
      );
    }

    // 수정: 당일 이벤트를 허용하도록 조건 변경
    if (startDateKST > endDateKST) {
      throw new Error(
        language === 'kor'
          ? '종료일은 시작일보다 이후이거나 같은 날짜여야 합니다.'
          : 'End date must be on or after start date'
      );
    }

    if (event.discountValue === undefined || isNaN(event.discountValue)) {
      throw new Error(
        language === 'kor'
          ? '유효한 할인 값을 입력해주세요.'
          : 'Please enter a valid discount value'
      );
    }

    if (event.discountType === 'percentage') {
      if (event.discountValue < 0 || event.discountValue > 100) {
        throw new Error(
          language === 'kor'
            ? '할인율은 0에서 100 사이여야 합니다.'
            : 'Discount percentage must be between 0 and 100'
        );
      }
    } else if (event.discountType === 'fixed') {
      if (event.discountValue <= 0) {
        throw new Error(
          language === 'kor'
            ? '할인 금액은 0보다 커야 합니다.'
            : 'Discount amount must be greater than 0'
        );
      }
    } else {
      throw new Error(
        language === 'kor'
          ? '유효한 할인 유형을 선택해주세요 (percentage 또는 fixed).'
          : 'Please select a valid discount type (percentage or fixed)'
      );
    }

    if (
      !Array.isArray(event.applicableRoomTypes) ||
      event.applicableRoomTypes.length === 0
    ) {
      throw new Error(
        language === 'kor'
          ? '최소 하나 이상의 객실 타입을 선택해주세요.'
          : 'Please select at least one room type'
      );
    }

    // 날짜 중복 검사 (선택적, 필요 시 주석 해제)
    const overlappingEvent = existingEvents.find((existing) => {
      if (editingUuid && existing.uuid === editingUuid) return false;
      const existingStart = toZonedTime(
        new Date(existing.startDate),
        'Asia/Seoul'
      );
      const existingEnd = toZonedTime(new Date(existing.endDate), 'Asia/Seoul');
      return (
        (startDateKST >= existingStart && startDateKST <= existingEnd) ||
        (endDateKST >= existingStart && endDateKST <= existingEnd) ||
        (startDateKST <= existingStart && endDateKST >= existingEnd)
      );
    });

    if (overlappingEvent) {
      console.warn(
        `[validateEvent] Overlap detected with ${
          overlappingEvent.eventName
        } for rooms ${event.applicableRoomTypes.join(', ')}`
      );
      // 필요 시 중복 경고 추가
      // throw new Error(
      //   language === 'kor'
      //     ? '동일한 기간에 다른 이벤트가 존재합니다.'
      //     : 'Another event exists for the same period.'
      // );
    }
  };

  // 이벤트 입력 변경 처리
  const handleEventChange = (e) => {
    const { name, value } = e.target;
    const parsedValue =
      name === 'discountValue' ? parseFloat(value) || '' : value;

    if (editingEvent) {
      setEditingEvent((prev) => ({
        ...prev,
        [name]: parsedValue,
      }));
    } else {
      setNewEvent((prev) => ({
        ...prev,
        [name]: parsedValue,
      }));
    }
  };

  // "당일 이벤트" 버튼 클릭 처리
  const handleSameDayEvent = () => {
    // 클라이언트의 로컬 시간 기준으로 현재 날짜를 계산
    const today = new Date();

    // KST 시간대로 변환 (필요 시)
    const todayKST = toZonedTime(today, 'Asia/Seoul');

    // yyyy-MM-dd 형식으로 포맷팅
    const todayStr = format(todayKST, 'yyyy-MM-dd');

    if (editingEvent) {
      setEditingEvent((prev) => ({
        ...prev,
        startDate: todayStr,
        endDate: todayStr,
      }));
    } else {
      setNewEvent((prev) => ({
        ...prev,
        startDate: todayStr,
        endDate: todayStr,
      }));
    }
  };

  // 객실 타입 선택 처리
  const handleRoomTypeSelection = (roomTypeId) => {
    const toggleRoomType = (prev) => {
      const updated = prev.applicableRoomTypes.includes(roomTypeId)
        ? prev.applicableRoomTypes.filter((id) => id !== roomTypeId)
        : [...prev.applicableRoomTypes, roomTypeId];
      return updated;
    };

    if (editingEvent) {
      setEditingEvent((prev) => ({
        ...prev,
        applicableRoomTypes: toggleRoomType(prev),
      }));
    } else {
      setNewEvent((prev) => ({
        ...prev,
        applicableRoomTypes: toggleRoomType(prev),
      }));
    }
  };

  // 이벤트 상태 토글
  const toggleEventStatus = async (eventUuid) => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      const updatedEvents = events.map((event) =>
        event.uuid === eventUuid
          ? { ...event, isActive: !event.isActive }
          : event
      );

      setEvents(updatedEvents);

      const affectedRooms = roomTypes
        .filter((rt) =>
          updatedEvents.some(
            (event) =>
              event.isActive &&
              event.applicableRoomTypes.includes(rt.roomInfo.toLowerCase())
          )
        )
        .map((rt) => {
          const discount = updatedEvents
            .filter(
              (event) =>
                event.isActive &&
                event.applicableRoomTypes.includes(rt.roomInfo.toLowerCase())
            )
            .reduce(
              (max, event) => {
                const value =
                  event.discountType === 'percentage' ||
                  event.discountType === 'fixed'
                    ? event.discountValue
                    : 0;
                return value > max.value
                  ? { value, type: event.discountType }
                  : max;
              },
              { value: 0, type: 'percentage' }
            );
          return `${rt.nameKor}: ${discount.value}${
            discount.type === 'fixed' ? '원' : '%'
          } 할인 적용`;
        });

      const feedbackMessage =
        affectedRooms.length > 0
          ? `${
              language === 'kor'
                ? '이벤트 상태가 업데이트되었습니다. 할인 적용 객실: '
                : 'Event status updated successfully. Discount applied to: '
            }${affectedRooms.join(', ')}`
          : language === 'kor'
          ? '이벤트 상태가 업데이트되었습니다.'
          : 'Event status updated successfully.';

      setMessage(feedbackMessage);
      setError('');

      if (typeof onEventsChange === 'function') {
        await onEventsChange(updatedEvents);
      } else {
        throw new Error(
          language === 'kor'
            ? '이벤트 상태 저장 실패: onEventsChange가 정의되지 않았습니다.'
            : 'Failed to save event status: onEventsChange is not defined.'
        );
      }

      setTimeout(() => setMessage(''), 5000);
    } catch (err) {
      console.error('[toggleEventStatus] Error:', err);
      setError(
        language === 'kor'
          ? `이벤트 상태 업데이트 실패: ${err.message}`
          : `Failed to update event status: ${err.message}`
      );
      setEvents([...events]); // 롤백
    } finally {
      setIsLoading(false);
    }
  };

  // 이벤트 추가
  const handleAddEvent = async () => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      const eventToValidate = {
        ...newEvent,
        uuid: newEvent.uuid || generateUniqueId(),
        discountValue: parseFloat(newEvent.discountValue) || 0,
      };

      validateEvent(eventToValidate, events);

      const startDateKST = toZonedTime(
        new Date(eventToValidate.startDate),
        'Asia/Seoul'
      );
      const endDateKST = toZonedTime(
        new Date(eventToValidate.endDate),
        'Asia/Seoul'
      );

      const newEventWithId = {
        ...eventToValidate,
        isActive: true,
        startDate: startDateKST.toISOString().split('T')[0],
        endDate: endDateKST.toISOString().split('T')[0],
      };

      console.log('[handleAddEvent] Adding event:', newEventWithId);
      const updatedEvents = [...events, newEventWithId];
      setEvents(updatedEvents);

      const affectedRooms = roomTypes
        .filter((rt) =>
          newEventWithId.applicableRoomTypes.includes(rt.roomInfo.toLowerCase())
        )
        .map(
          (rt) =>
            `${rt.nameKor}: ${newEventWithId.discountValue}${
              newEventWithId.discountType === 'fixed' ? '원' : '%'
            } 할인 적용`
        );

      const feedbackMessage =
        affectedRooms.length > 0
          ? `${
              language === 'kor'
                ? '이벤트가 추가되었습니다. 할인 적용 객실: '
                : 'Event has been added. Discount applied to: '
            }${affectedRooms.join(', ')}`
          : language === 'kor'
          ? '이벤트가 추가되었습니다.'
          : 'Event has been added.';

      setNewEvent({
        uuid: generateUniqueId(),
        eventName: '',
        startDate: '',
        endDate: '',
        discountType: 'percentage',
        discountValue: '',
        applicableRoomTypes: [],
      });
      setShowEventForm(false);
      setMessage(feedbackMessage);
      setError('');

      if (typeof onEventsChange === 'function') {
        await onEventsChange(updatedEvents);
      } else {
        throw new Error(
          language === 'kor'
            ? '이벤트 저장 실패: onEventsChange가 정의되지 않았습니다.'
            : 'Failed to save event: onEventsChange is not defined.'
        );
      }

      setTimeout(() => setMessage(''), 5000);
    } catch (err) {
      console.error('[handleAddEvent] Validation error:', err.message);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 이벤트 편집 시작
  const handleEditEvent = (event) => {
    if (!event.uuid) {
      console.error('[handleEditEvent] Event UUID is missing:', event);
      setError(
        language === 'kor'
          ? '이벤트 UUID가 누락되었습니다.'
          : 'Event UUID is missing.'
      );
      return;
    }

    setEditingEvent({
      uuid: event.uuid,
      eventName: event.eventName || '',
      startDate: event.startDate || '',
      endDate: event.endDate || '',
      discountType: event.discountType || 'percentage',
      discountValue: event.discountValue || '',
      isActive: event.isActive ?? true,
      applicableRoomTypes: event.applicableRoomTypes || [],
    });
    setShowEventForm(true);
  };

  // 이벤트 업데이트
  const handleUpdateEvent = async () => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      if (!editingEvent?.uuid) {
        throw new Error(
          language === 'kor'
            ? '수정 중인 이벤트의 UUID가 없습니다.'
            : 'Editing event is missing UUID'
        );
      }

      const eventToValidate = {
        ...editingEvent,
        discountValue: parseFloat(editingEvent.discountValue) || 0,
      };

      validateEvent(eventToValidate, events, editingEvent.uuid);

      const startDateKST = toZonedTime(
        new Date(eventToValidate.startDate),
        'Asia/Seoul'
      );
      const endDateKST = toZonedTime(
        new Date(eventToValidate.endDate),
        'Asia/Seoul'
      );

      const updatedEvent = {
        ...eventToValidate,
        startDate: startDateKST.toISOString().split('T')[0],
        endDate: endDateKST.toISOString().split('T')[0],
      };

      console.log('[handleUpdateEvent] Updating event:', updatedEvent);
      const updatedEvents = events.map((event) =>
        event.uuid === editingEvent.uuid ? updatedEvent : event
      );
      setEvents(updatedEvents);

      const affectedRooms = roomTypes
        .filter((rt) =>
          updatedEvents.some(
            (event) =>
              event.isActive &&
              event.applicableRoomTypes.includes(rt.roomInfo.toLowerCase())
          )
        )
        .map((rt) => {
          const discount = updatedEvents
            .filter(
              (event) =>
                event.isActive &&
                event.applicableRoomTypes.includes(rt.roomInfo.toLowerCase())
            )
            .reduce(
              (max, event) => {
                const value =
                  event.discountType === 'percentage' ||
                  event.discountType === 'fixed'
                    ? event.discountValue
                    : 0;
                return value > max.value
                  ? { value, type: event.discountType }
                  : max;
              },
              { value: 0, type: 'percentage' }
            );
          return `${rt.nameKor}: ${discount.value}${
            discount.type === 'fixed' ? '원' : '%'
          } 할인 적용`;
        });

      const feedbackMessage =
        affectedRooms.length > 0
          ? `${
              language === 'kor'
                ? '이벤트가 수정되었습니다. 할인 적용 객실: '
                : 'Event has been updated. Discount applied to: '
            }${affectedRooms.join(', ')}`
          : language === 'kor'
          ? '이벤트가 수정되었습니다.'
          : 'Event has been updated.';

      setEditingEvent(null);
      setShowEventForm(false);
      setMessage(feedbackMessage);
      setError('');

      if (typeof onEventsChange === 'function') {
        await onEventsChange(updatedEvents);
      } else {
        throw new Error(
          language === 'kor'
            ? '이벤트 수정 실패: onEventsChange가 정의되지 않았습니다.'
            : 'Failed to update event: onEventsChange is not defined.'
        );
      }

      setTimeout(() => setMessage(''), 5000);
    } catch (err) {
      console.error('[handleUpdateEvent] Validation error:', err.message);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 이벤트 삭제
  const handleDeleteEvent = async (eventUuid) => {
    if (isLoading) return;

    const confirmDelete = window.confirm(
      language === 'kor'
        ? '이 이벤트를 삭제하시겠습니까?'
        : 'Are you sure you want to delete this event?'
    );
    if (!confirmDelete) return;

    setIsLoading(true);
    try {
      // 백엔드로 DELETE 요청 전송
      await api.delete('/api/hotel-settings/event', {
        data: { hotelId: localStorage.getItem('hotelId'), eventUuid },
      });

      // 로컬 상태에서도 이벤트 제거
      const updatedEvents = events.filter((event) => event.uuid !== eventUuid);
      setEvents(updatedEvents);

      const affectedRooms = roomTypes
        .filter((rt) =>
          updatedEvents.some(
            (event) =>
              event.isActive &&
              event.applicableRoomTypes.includes(rt.roomInfo.toLowerCase())
          )
        )
        .map((rt) => {
          const discount = updatedEvents
            .filter(
              (event) =>
                event.isActive &&
                event.applicableRoomTypes.includes(rt.roomInfo.toLowerCase())
            )
            .reduce(
              (max, event) => {
                const value =
                  event.discountType === 'percentage' ||
                  event.discountType === 'fixed'
                    ? event.discountValue
                    : 0;
                return value > max.value
                  ? { value, type: event.discountType }
                  : max;
              },
              { value: 0, type: 'percentage' }
            );
          return `${rt.nameKor}: ${discount.value}${
            discount.type === 'fixed' ? '원' : '%'
          } 할인 적용`;
        });

      const feedbackMessage =
        affectedRooms.length > 0
          ? `${
              language === 'kor'
                ? '이벤트가 삭제되었습니다. 남은 할인 적용 객실: '
                : 'Event has been deleted. Remaining discounts applied to: '
            }${affectedRooms.join(', ')}`
          : language === 'kor'
          ? '이벤트가 삭제되었습니다.'
          : 'Event has been deleted.';

      setMessage(feedbackMessage);
      setError('');

      setTimeout(() => setMessage(''), 5000);
    } catch (err) {
      console.error('[handleDeleteEvent] Error:', err);
      setError(
        language === 'kor'
          ? `이벤트 삭제 실패: ${err.message}`
          : `Failed to delete event: ${err.message}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  // 편집 취소
  const handleCancelEdit = () => {
    setEditingEvent(null);
    setShowEventForm(false);
    setError('');
  };

  // 최대 할인 계산
  const getMaxDiscount = (roomType, date) => {
    if (!roomType || !date) return { value: 0, type: 'percentage' };

    const targetDate = toZonedTime(new Date(date), 'Asia/Seoul')
      .toISOString()
      .split('T')[0];

    return events
      .filter((event) => event.isActive)
      .filter((event) => {
        const start = toZonedTime(new Date(event.startDate), 'Asia/Seoul')
          .toISOString()
          .split('T')[0];
        const end = toZonedTime(new Date(event.endDate), 'Asia/Seoul')
          .toISOString()
          .split('T')[0];
        return (
          targetDate >= start &&
          targetDate <= end &&
          event.applicableRoomTypes.includes(roomType)
        );
      })
      .reduce(
        (max, event) => {
          const value =
            event.discountType === 'percentage' ||
            event.discountType === 'fixed'
              ? event.discountValue
              : 0;
          return value > max.value ? { value, type: event.discountType } : max;
        },
        { value: 0, type: 'percentage' }
      );
  };

  // JSX 렌더링
  return (
    <section className="hotel-settings-event-section">
      <h2>{language === 'kor' ? '◉ 이벤트 설정' : 'Event Settings'}</h2>
      {error && <p className="hotel-settings-event-error">{error}</p>}
      {message && <p className="hotel-settings-event-success">{message}</p>}
      {isLoading && <p>{language === 'kor' ? '저장 중...' : 'Saving...'}</p>}

      {showEventForm && (
        <div className="hotel-settings-event-item">
          <h4>
            {editingEvent
              ? language === 'kor'
                ? '이벤트 수정'
                : 'Edit Event'
              : language === 'kor'
              ? '이벤트 설정'
              : 'Event Configuration'}
          </h4>
          <div className="hotel-settings-event-form">
            <div className="hotel-settings-event-field-row full-width">
              <label>
                {language === 'kor' ? '이벤트 이름' : 'Event Name'}
                <input
                  type="text"
                  name="eventName"
                  placeholder={
                    language === 'kor'
                      ? '이벤트 이름을 입력하세요'
                      : 'Enter event name'
                  }
                  value={
                    editingEvent ? editingEvent.eventName : newEvent.eventName
                  }
                  onChange={handleEventChange}
                  disabled={isLoading}
                  required
                />
              </label>
            </div>
            <div className="hotel-settings-event-field-row">
              <label>
                {language === 'kor' ? '할인 유형' : 'Discount Type'}
                <select
                  name="discountType"
                  value={
                    editingEvent
                      ? editingEvent.discountType
                      : newEvent.discountType
                  }
                  onChange={handleEventChange}
                  disabled={isLoading}
                >
                  <option value="percentage">
                    {language === 'kor' ? '퍼센트 (%)' : 'Percentage (%)'}
                  </option>
                  <option value="fixed">
                    {language === 'kor' ? '고정 금액 (원)' : 'Fixed Amount (₩)'}
                  </option>
                </select>
              </label>
              <label>
                {language === 'kor' ? '할인 값' : 'Discount Value'}
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    name="discountValue"
                    placeholder={
                      language === 'kor' ? '할인 값' : 'Discount Value'
                    }
                    min="0"
                    step="0.01"
                    value={
                      editingEvent
                        ? editingEvent.discountValue
                        : newEvent.discountValue
                    }
                    onChange={handleEventChange}
                    disabled={isLoading}
                    style={{ paddingRight: '30px' }}
                    required
                  />
                  <span
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#666',
                    }}
                  >
                    {(editingEvent
                      ? editingEvent.discountType
                      : newEvent.discountType) === 'percentage'
                      ? '%'
                      : '₩'}
                  </span>
                </div>
              </label>
            </div>
            <div className="hotel-settings-event-field-row">
              <label>
                {language === 'kor' ? '시작일' : 'Start Date'}
                <input
                  type="date"
                  name="startDate"
                  value={
                    editingEvent ? editingEvent.startDate : newEvent.startDate
                  }
                  onChange={handleEventChange}
                  disabled={isLoading}
                  required
                />
              </label>
              <label>
                {language === 'kor' ? '종료일' : 'End Date'}
                <input
                  type="date"
                  name="endDate"
                  value={editingEvent ? editingEvent.endDate : newEvent.endDate}
                  onChange={handleEventChange}
                  disabled={isLoading}
                  required
                />
              </label>
              <button
                className="hotel-settings-event-sameday-btn"
                onClick={handleSameDayEvent}
                disabled={isLoading}
                style={{
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  padding: '5px 10px',
                  borderRadius: '5px',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  marginLeft: '10px',
                }}
              >
                {language === 'kor' ? '당일 이벤트' : 'Same Day Event'}
              </button>
            </div>
            <div className="hotel-settings-event-field-row full-width">
              <label>
                {language === 'kor' ? '적용된 객실' : 'Applied Room Types'}
                <div className="hotel-settings-event-room-types-checkbox">
                  {roomTypes.map((roomType) => (
                    <div
                      key={roomType.roomInfo}
                      className="hotel-settings-event-room-type-checkbox-item"
                    >
                      <input
                        type="checkbox"
                        id={`room-type-${roomType.roomInfo}`}
                        checked={
                          editingEvent
                            ? editingEvent.applicableRoomTypes.includes(
                                roomType.roomInfo
                              )
                            : newEvent.applicableRoomTypes.includes(
                                roomType.roomInfo
                              )
                        }
                        onChange={() =>
                          handleRoomTypeSelection(roomType.roomInfo)
                        }
                        disabled={isLoading}
                      />
                      <label htmlFor={`room-type-${roomType.roomInfo}`}>
                        {language === 'kor'
                          ? roomType.nameKor
                          : roomType.nameEng}
                        <span className="room-type-stock">
                          ({language === 'kor' ? '재고' : 'Stock'}{' '}
                          {roomType.stock} {language === 'kor' ? '개' : 'rooms'}
                          )
                        </span>
                      </label>
                    </div>
                  ))}
                </div>
              </label>
            </div>
            <div className="hotel-settings-event-actions">
              <button
                className="hotel-settings-event-btn save"
                onClick={editingEvent ? handleUpdateEvent : handleAddEvent}
                disabled={isLoading}
              >
                {editingEvent
                  ? language === 'kor'
                    ? '이벤트 수정'
                    : 'Update Event'
                  : language === 'kor'
                  ? '이벤트 저장'
                  : 'Save Event'}
              </button>
              <button
                type="button"
                className="hotel-settings-event-btn close"
                onClick={handleCancelEdit}
                disabled={isLoading}
              >
                {language === 'kor' ? '닫기' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="hotel-settings-event-add-btn-container">
        {!showEventForm && (
          <button
            className="hotel-settings-event-btn create"
            onClick={() => setShowEventForm(true)}
            disabled={isLoading}
          >
            {language === 'kor' ? '새 이벤트 추가' : 'Add New Event'}
          </button>
        )}
      </div>

      <div className="hotel-settings-event-list">
        <h4 className="hotel-settings-event-list-header">
          {language === 'kor' ? '진행 중인 이벤트' : 'Current Events'}
        </h4>
        {events.length === 0 && (
          <p>
            {language === 'kor'
              ? '등록된 이벤트가 없습니다.'
              : 'No events registered.'}
          </p>
        )}
        {events.map((event) => {
          const maxDiscount = getMaxDiscount(
            event.applicableRoomTypes[0],
            new Date()
          );
          return (
            <div key={event.uuid} className="hotel-settings-event-item">
              <div className="hotel-settings-event-item-header">
                <h3>{event.eventName}</h3>
                <div className="hotel-settings-event-item-actions">
                  <button
                    className="hotel-settings-event-edit-btn"
                    onClick={() => handleEditEvent(event)}
                    disabled={isLoading}
                  >
                    {language === 'kor' ? '수정' : 'Edit'}
                  </button>
                  <button
                    className={`hotel-settings-event-status-btn ${
                      event.isActive ? 'pause' : 'resume'
                    }`}
                    onClick={() => toggleEventStatus(event.uuid)}
                    disabled={isLoading}
                  >
                    {event.isActive
                      ? language === 'kor'
                        ? '일시중지'
                        : 'Pause'
                      : language === 'kor'
                      ? '재개'
                      : 'Resume'}
                  </button>
                  <button
                    className="hotel-settings-event-remove-btn"
                    onClick={() => handleDeleteEvent(event.uuid)}
                    disabled={isLoading}
                  >
                    <FaTrash />
                  </button>
                </div>
              </div>
              <div style={{ marginBottom: '15px' }}>
                <p>
                  {language === 'kor' ? '할인 유형' : 'Discount Type'}:{' '}
                  {event.discountType === 'percentage'
                    ? language === 'kor'
                      ? '퍼센트 (%)'
                      : 'Percentage (%)'
                    : language === 'kor'
                    ? '고정 금액 (원)'
                    : 'Fixed Amount (₩)'}
                </p>
                <p>
                  {language === 'kor' ? '할인 값' : 'Discount Value'}:{' '}
                  {event.discountValue}
                  {event.discountType === 'percentage' ? '%' : '원'}
                  {maxDiscount.value > event.discountValue && (
                    <span style={{ color: 'red', marginLeft: '8px' }}>
                      ({language === 'kor' ? '최대 적용' : 'Max applied'}:{' '}
                      {maxDiscount.value}
                      {maxDiscount.type === 'fixed' ? '원' : '%'})
                    </span>
                  )}
                </p>
                <p>
                  {language === 'kor' ? '기간' : 'Period'}:{' '}
                  {
                    toZonedTime(new Date(event.startDate), 'Asia/Seoul')
                      .toISOString()
                      .split('T')[0]
                  }{' '}
                  -{' '}
                  {
                    toZonedTime(new Date(event.endDate), 'Asia/Seoul')
                      .toISOString()
                      .split('T')[0]
                  }
                </p>
                <p>
                  {language === 'kor' ? '상태' : 'Status'}:{' '}
                  <span
                    className={`hotel-settings-event-status ${
                      event.isActive ? 'active' : 'inactive'
                    }`}
                  >
                    {event.isActive
                      ? language === 'kor'
                        ? '활성화'
                        : 'Active'
                      : language === 'kor'
                      ? '비활성화'
                      : 'Inactive'}
                  </span>
                </p>
              </div>
              <div style={{ marginTop: '20px', textAlign: 'left' }}>
                <h4
                  style={{
                    fontSize: '14px',
                    fontWeight: 'normal',
                    marginBottom: '10px',
                    color: '#333',
                  }}
                >
                  {language === 'kor' ? '적용된 객실' : 'Applied Room Types'}
                </h4>
                <div>
                  {event.applicableRoomTypes.map((roomTypeId) => {
                    const appliedRoomType = roomTypes.find(
                      (rt) => rt.roomInfo === roomTypeId
                    );
                    return (
                      appliedRoomType && (
                        <div
                          key={roomTypeId}
                          style={{
                            color: '#2B6CB0',
                            marginBottom: '8px',
                            fontSize: '14px',
                          }}
                        >
                          {language === 'kor'
                            ? appliedRoomType.nameKor
                            : appliedRoomType.nameEng}
                        </div>
                      )
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}


// 편의 함수 정의
const safeLower = (str) => (typeof str === 'string' ? str.toLowerCase() : '');

function CouponSettingsSection({
  language,
  coupons,
  setCoupons,
  roomTypes,
  onCouponsChange,
  hotelId,
}) {
  const generateUniqueId = () => uuidv4();
  const generateCouponCode = () => {
    return `COUPON-${Math.random().toString(36).substr(2, 8).toUpperCase()}`;
  };

  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showCouponForm, setShowCouponForm] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [applyToAll, setApplyToAll] = useState(false);
  const [selectedRoomTypes, setSelectedRoomTypes] = useState(
    roomTypes && roomTypes.length > 0
      ? roomTypes.reduce((acc, rt) => {
          if (rt && rt.roomInfo) {
            acc[rt.roomInfo] = false;
          }
          return acc;
        }, {})
      : {}
  );
  const [expandedGroups, setExpandedGroups] = useState({});
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [filterType, setFilterType] = useState('issued');
  const [monthlyStats, setMonthlyStats] = useState({});

  const [loyaltySettings, setLoyaltySettings] = useState({
    visit5: { name: '5회 방문 쿠폰', discountType: 'percentage', randomMin: 10, randomMax: 50 },
    visit10: { name: '10회 방문 쿠폰', discountType: 'percentage', randomMin: 50, randomMax: 90 },
  });

  const ADMIN_PASSWORD = '1111';

  useEffect(() => {
    const fetchLoyaltySettings = async () => {
      try {
        const { data: { loyaltyCoupons } } = await api.get(`/api/hotel-settings/${hotelId}/loyalty-coupons`);
        if (loyaltyCoupons && Array.isArray(loyaltyCoupons)) {
          const updatedSettings = {};
          loyaltyCoupons.forEach((coupon) => {
            const key = coupon.visits === 5 ? 'visit5' : coupon.visits === 10 ? 'visit10' : null;
            if (key) {
              updatedSettings[key] = {
                name: key === 'visit5' ? '5회 방문 쿠폰' : '10회 방문 쿠폰',
                discountType: coupon.discountType || 'percentage',
                randomMin: coupon.randomMin || 0,
                randomMax: coupon.randomMax || 0,
              };
            }
          });
          setLoyaltySettings((prev) => ({
            ...prev,
            ...(updatedSettings.visit5 && { visit5: updatedSettings.visit5 }),
            ...(updatedSettings.visit10 && { visit10: updatedSettings.visit10 }),
          }));
        }
      } catch (err) {
        console.error('[fetchLoyaltySettings] Error:', err);
        setError(
          language === 'kor'
            ? '로열티 설정을 불러오지 못했습니다.'
            : 'Failed to load loyalty settings.'
        );
      }
    };
    fetchLoyaltySettings();
  }, [hotelId, language]);

  // 월별 통계 데이터 계산
  useEffect(() => {
    const calculateMonthlyStats = () => {
      const stats = {};

      coupons.forEach((coupon) => {
        const issuedAt = coupon.issuedAt;
        if (!issuedAt || typeof issuedAt !== 'string') {
          return;
        }

        const issuedDate = parseDate(issuedAt);
        if (!issuedDate || isNaN(issuedDate.getTime())) {
          return;
        }

        const monthKey = format(issuedDate, 'yyyy-MM');

        if (!stats[monthKey]) {
          stats[monthKey] = { issued: 0, used: 0, deleted: 0 };
        }

        stats[monthKey].issued += 1;
        if (coupon.usedCount > 0) {
          stats[monthKey].used += 1;
        }
        if (coupon.isDeleted) {
          stats[monthKey].deleted += 1;
        }
      });

      setMonthlyStats(stats);
    };

    calculateMonthlyStats();
  }, [coupons]);

  // Chart.js를 사용하여 그래프 렌더링
  useEffect(() => {
    const ctx = document.getElementById('couponStatsChart')?.getContext('2d');
    if (!ctx) return;

    let chartInstance = null;

    const createChart = () => {
      const months = Object.keys(monthlyStats).sort();
      const issuedData = months.map((month) => monthlyStats[month].issued);
      const usedData = months.map((month) => monthlyStats[month].used);
      const deletedData = months.map((month) => monthlyStats[month].deleted);

      chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: months,
          datasets: [
            {
              label: language === 'kor' ? '발행된 쿠폰' : 'Issued Coupons',
              data: issuedData,
              backgroundColor: 'rgba(54, 162, 235, 0.6)',
              borderColor: 'rgba(54, 162, 235, 1)',
              borderWidth: 1,
            },
            {
              label: language === 'kor' ? '사용된 쿠폰' : 'Used Coupons',
              data: usedData,
              backgroundColor: 'rgba(75, 192, 192, 0.6)',
              borderColor: 'rgba(75, 192, 192, 1)',
              borderWidth: 1,
            },
            {
              label: language === 'kor' ? '삭제된 쿠폰' : 'Deleted Coupons',
              data: deletedData,
              backgroundColor: 'rgba(255, 99, 132, 0.6)',
              borderColor: 'rgba(255, 99, 132, 1)',
              borderWidth: 1,
            },
          ],
        },
        options: {
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: language === 'kor' ? '쿠폰 수' : 'Number of Coupons',
              },
            },
            x: {
              title: {
                display: true,
                text: language === 'kor' ? '월' : 'Month',
              },
            },
          },
          plugins: {
            legend: {
              position: 'top',
            },
          },
        },
      });
    };

    createChart();

    return () => {
      if (chartInstance) {
        chartInstance.destroy();
      }
    };
  }, [monthlyStats, language]);

  const initialCoupon = (roomType) => {
    const now = new Date();
    const issuedAt = format(now, "yyyy-MM-dd'T'HH:mm:ssXXX"); // 로컬 오프셋(XXX) 사용
    const startDate = format(now, "yyyy-MM-dd");
    const endDate = format(now, "yyyy-MM-dd");

    return {
      roomType: roomType && roomType.roomInfo ? roomType.roomInfo : '',
      uuid: generateUniqueId(),
      code: generateCouponCode(),
      name: '',
      startDate: startDate,
      endDate: endDate,
      discountType: 'percentage',
      discountValue: '',
      couponCount: '',
      issuedAt: issuedAt,
      autoDistribute: true,
      autoValidity: true,
      validityDays: 1,
      duration: 1,
      usedCount: 0,
      usedAt: null,
      isDeleted: false,
    };
  };

  const [newCoupons, setNewCoupons] = useState(
    roomTypes && roomTypes.length > 0
      ? roomTypes.map((roomType) => initialCoupon(roomType))
      : []
  );

  const handleApplyToAllToggle = () => {
    if (!isAdminAuthenticated) {
      setPendingAction(() => handleApplyToAllToggle);
      setShowPasswordModal(true);
      return;
    }

    setApplyToAll((prev) => {
      const newState = !prev;
      setSelectedRoomTypes(
        roomTypes && roomTypes.length > 0
          ? roomTypes.reduce((acc, rt) => {
              if (rt && rt.roomInfo) {
                acc[rt.roomInfo] = newState ? true : false; // "모든 객실" 선택 시 모든 객실 선택, 해제 시 초기화
              }
              return acc;
            }, {})
          : {}
      );
      return newState;
    });
  };

  const handleRoomTypeSelection = (roomType) => {
    if (!isAdminAuthenticated) {
      setPendingAction(() => () => handleRoomTypeSelection(roomType));
      setShowPasswordModal(true);
      return;
    }

    setSelectedRoomTypes((prev) => ({
      ...prev,
      [roomType]: !prev[roomType],
    }));
    setApplyToAll(false); // 개별 객실 선택 시 applyToAll을 false로 설정
  };

  const validateCoupon = (coupon, existingCoupons = [], editingUuid = null) => {
    if (!coupon.uuid) {
      throw new Error(
        language === 'kor'
          ? '쿠폰 고유 식별자가 필요합니다.'
          : 'Coupon UUID is required'
      );
    }

    if (!coupon.code || coupon.code.trim() === '') {
      throw new Error(
        language === 'kor'
          ? '쿠폰 코드를 입력해주세요.'
          : 'Please enter a coupon code'
      );
    }

    if (
      existingCoupons.some(
        (c) => c.code === coupon.code && c.uuid !== editingUuid
      )
    ) {
      throw new Error(
        language === 'kor'
          ? '이미 사용 중인 쿠폰 코드입니다.'
          : 'This coupon code is already in use.'
      );
    }

    if (!coupon.name || coupon.name.trim() === '') {
      throw new Error(
        language === 'kor'
          ? '쿠폰 이름을 입력해주세요.'
          : 'Please enter a coupon name'
      );
    }

    if (!coupon.startDate || !coupon.endDate) {
      throw new Error(
        language === 'kor'
          ? '유효기간을 입력해주세요.'
          : 'Please enter the validity period'
      );
    }

    const startDate = parseDate(coupon.startDate);
    const endDate = parseDate(coupon.endDate);

    if (!startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new Error(
        language === 'kor'
          ? '유효한 날짜를 입력해주세요.'
          : 'Please enter valid dates'
      );
    }

    if (startDate > endDate) {
      throw new Error(
        language === 'kor'
          ? '종료일은 시작일보다 이후이거나 같은 날짜여야 합니다.'
          : 'End date must be on or after start date'
      );
    }

    const discountValue = parseFloat(coupon.discountValue);
    if (!isNaN(discountValue) && discountValue > 0) {
      if (coupon.discountType === 'percentage') {
        if (discountValue > 100) {
          throw new Error(
            language === 'kor'
              ? `할인율은 0에서 100 사이여야 합니다.`
              : `Discount percentage must be between 0 and 100.`
          );
        }
      } else if (coupon.discountType === 'fixed') {
        if (discountValue <= 0) {
          throw new Error(
            language === 'kor'
              ? `할인 금액은 0보다 커야 합니다.`
              : `Discount amount must be greater than 0.`
          );
        }
      }
    } else {
      throw new Error(
        language === 'kor'
          ? `할인 값을 입력해주세요.`
          : `Please enter a discount value.`
      );
    }
  };

  const handleCouponChange = (roomType, e) => {
    if (!isAdminAuthenticated) {
      setPendingAction(() => () => handleCouponChange(roomType, e));
      setShowPasswordModal(true);
      return;
    }

    const { name, value } = e.target;
    const parsedValue =
      name === 'discountValue' || name === 'couponCount'
        ? parseFloat(value) || ''
        : value;

    setNewCoupons((prev) =>
      prev.map((coupon) =>
        coupon.roomType === roomType
          ? { ...coupon, [name]: parsedValue }
          : coupon
      )
    );
  };

  const handleDurationSelect = (roomType, duration) => {
    if (!isAdminAuthenticated) {
      setPendingAction(() => () => handleDurationSelect(roomType, duration));
      setShowPasswordModal(true);
      return;
    }

    const today = new Date();
    const startDate = format(today, 'yyyy-MM-dd');
    const endDate = format(addDays(today, duration - 1), 'yyyy-MM-dd');

    setNewCoupons((prev) =>
      prev.map((coupon) =>
        coupon.roomType === roomType
          ? {
              ...coupon,
              startDate: startDate,
              endDate: endDate,
              duration,
              validityDays: duration,
            }
          : coupon
      )
    );

    const durationMessage =
      duration === 1
        ? language === 'kor'
          ? '유효기간이 당일로 설정되었습니다.'
          : 'Validity period set to today.'
        : language === 'kor'
        ? `유효기간이 ${duration}일로 설정되었습니다.`
        : `Validity period set to ${duration} days.`;
    setMessage(durationMessage);
    setTimeout(() => setMessage(''), 3000);
  };

  const handleLoyaltyChange = (visitType, field, value) => {
    if (!isAdminAuthenticated) {
      setPendingAction(() => () => handleLoyaltyChange(visitType, field, value));
      setShowPasswordModal(true);
      return;
    }

    const parsedValue =
      field === 'randomMin' || field === 'randomMax'
        ? parseFloat(value) || 0
        : value;
    setLoyaltySettings((prev) => ({
      ...prev,
      [visitType]: {
        ...prev[visitType],
        [field]: parsedValue,
      },
    }));
  };

  const saveLoyaltySettings = async () => {
    if (!isAdminAuthenticated) {
      setPendingAction(() => saveLoyaltySettings);
      setShowPasswordModal(true);
      return;
    }

    setIsLoading(true);
    try {
      const { visit5, visit10 } = loyaltySettings;
      if (
        visit5.randomMin < 0 ||
        visit5.randomMin > 100 ||
        visit5.randomMax < 0 ||
        visit5.randomMax > 100 ||
        visit5.randomMin > visit5.randomMax ||
        visit10.randomMin < 0 ||
        visit10.randomMin > 100 ||
        visit10.randomMax < 0 ||
        visit10.randomMax > 100 ||
        visit10.randomMin > visit10.randomMax
      ) {
        throw new Error(
          language === 'kor'
            ? '할인율 범위가 유효하지 않습니다. (0~100% 사이, 최소값 < 최대값)'
            : 'Discount range is invalid. (0~100%, min < max)'
        );
      }

      if (!visit5.name || !visit10.name) {
        throw new Error(
          language === 'kor'
            ? '로열티 쿠폰 이름을 입력해주세요.'
            : 'Please enter names for loyalty coupons.'
        );
      }

      const loyaltyCoupons = [
        {
          visits: 5,
          discountType: visit5.discountType,
          randomMin: visit5.randomMin,
          randomMax: visit5.randomMax,
        },
        {
          visits: 10,
          discountType: visit10.discountType,
          randomMin: visit10.randomMin,
          randomMax: visit10.randomMax,
        },
      ];

      await api.put(`/api/hotel-settings/${hotelId}/loyalty-coupons`, loyaltyCoupons);

      setMessage(
        language === 'kor'
          ? '로열티 쿠폰 설정이 저장되었습니다.'
          : 'Loyalty coupon settings have been saved.'
      );
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error('[saveLoyaltySettings] Error:', err);
      setError(
        language === 'kor'
          ? `로열티 설정 저장에 실패했습니다: ${err.message}`
          : `Failed to save loyalty settings: ${err.message}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddCoupon = async () => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      const selectedTypes = Object.keys(selectedRoomTypes).filter(
        (roomType) => selectedRoomTypes[roomType]
      );

      console.log('[handleAddCoupon] applyToAll:', applyToAll);
      console.log('[handleAddCoupon] selectedRoomTypes:', selectedRoomTypes);
      console.log('[handleAddCoupon] selectedTypes:', selectedTypes);

      if (selectedTypes.length > 0 && applyToAll) {
        console.log('[handleAddCoupon] Forcing applyToAll to false as specific room types are selected');
        setApplyToAll(false);
      }

      if (!applyToAll && selectedTypes.length === 0) {
        throw new Error(
          language === 'kor'
            ? '적어도 하나의 객실을 선택해주세요.'
            : 'Please select at least one room type.'
        );
      }

      const couponsToAdd = applyToAll
        ? newCoupons
        : newCoupons.filter((coupon) => selectedTypes.includes(coupon.roomType));

      if (couponsToAdd.length === 0) {
        throw new Error(
          language === 'kor'
            ? '선택된 객실에 대한 쿠폰 정보를 입력해주세요.'
            : 'Please enter coupon information for the selected room types.'
        );
      }

      const validatedCoupons = [];
      for (const coupon of couponsToAdd) {
        const numCoupons = parseInt(coupon.couponCount, 10);
        const hasName = coupon.name.trim() !== '';
        const hasDiscountValue = coupon.discountValue !== '' && coupon.discountValue > 0;
        const hasCouponCount = numCoupons > 0;

        if (!hasName || !hasDiscountValue || !hasCouponCount) {
          throw new Error(
            language === 'kor'
              ? `쿠폰 이름, 할인 값, 쿠폰 개수를 입력해주세요 (객실: ${coupon.roomType}).`
              : `Please enter coupon name, discount value, and coupon count (Room: ${coupon.roomType}).`
          );
        }

        const now = new Date();
        const issuedAt = format(now, "yyyy-MM-dd'T'HH:mm:ssXXX"); // 로컬 오프셋(XXX) 사용
        for (let i = 0; i < numCoupons; i++) {
          const couponToValidate = {
            ...coupon,
            uuid: generateUniqueId(),
            code: generateCouponCode(),
            maxUses: 1,
            usedCount: 0,
            usedAt: null,
            issuedAt: issuedAt,
            applicableRoomType: applyToAll ? 'all' : coupon.roomType.toLowerCase(),
            roomType: coupon.roomType.toLowerCase(), // roomType 필드 추가
            autoDistribute: coupon.autoDistribute || true,
            autoValidity: coupon.autoValidity || true,
            validityDays: coupon.duration || 1,
            isDeleted: false,
          };

          validateCoupon(couponToValidate, coupons);
          validatedCoupons.push({
            ...couponToValidate,
            isActive: true,
          });
        }
      }

      console.log('[handleAddCoupon] Sending coupons to backend:', validatedCoupons);

      // 쿠폰 생성 요청
      const response = await api.post('/api/hotel-settings/coupons', {
        hotelId,
        coupons: validatedCoupons,
      });

      // 서버 응답 데이터를 로컬 상태에 바로 추가
      setCoupons((prev) => [...prev, ...response.data.coupons]);
      console.log('[handleAddCoupon] Updated coupons:', [...coupons, ...response.data.coupons]);

      const feedbackMessage =
        language === 'kor'
          ? '쿠폰이 추가되었습니다.'
          : 'Coupons have been added.';

      setNewCoupons(
        roomTypes && roomTypes.length > 0
          ? roomTypes.map((roomType) => initialCoupon(roomType))
          : []
      );
      setShowCouponForm(false);
      setApplyToAll(false);
      setSelectedRoomTypes(
        roomTypes && roomTypes.length > 0
          ? roomTypes.reduce((acc, rt) => {
              if (rt && rt.roomInfo) {
                acc[rt.roomInfo] = false;
              }
              return acc;
            }, {})
          : {}
      );
      setMessage(feedbackMessage);
      setError('');

      setTimeout(() => setMessage(''), 5000);
    } catch (err) {
      console.error('[handleAddCoupon] Validation error:', err.message);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteCoupon = async (couponUuid) => {
    if (!isAdminAuthenticated) {
      setPendingAction(() => () => handleDeleteCoupon(couponUuid));
      setShowPasswordModal(true);
      return;
    }

    if (isLoading) return;

    setIsLoading(true);
    try {
      const couponToDelete = coupons.find((coupon) => coupon.uuid === couponUuid);
      if (couponToDelete.usedCount > 0) {
        const updatedCoupons = coupons
          .filter((coupon) => coupon.uuid !== couponUuid)
          .map((coupon) => ({
            ...coupon,
            applicableRoomType:
              Array.isArray(coupon.applicableRoomTypes) &&
              coupon.applicableRoomTypes.length > 0
                ? coupon.applicableRoomTypes[0]
                : coupon.applicableRoomType || 'all',
            applicableRoomTypes: undefined,
          }));
        setCoupons(updatedCoupons);

        setMessage(
          language === 'kor'
            ? '사용된 쿠폰은 삭제할 수 없습니다. UI에서만 제거되었습니다.'
            : 'Used coupons cannot be deleted. Removed from UI only.'
        );

        if (typeof onCouponsChange === 'function') {
          await onCouponsChange(updatedCoupons);
        }
      } else {
        await api.delete('/api/hotel-settings/coupons', {
          data: { hotelId, couponUuid },
        });

        const updatedCoupons = coupons
          .map((coupon) =>
            coupon.uuid === couponUuid
              ? { ...coupon, isDeleted: true }
              : coupon
          )
          .map((coupon) => ({
            ...coupon,
            applicableRoomType:
              Array.isArray(coupon.applicableRoomTypes) &&
              coupon.applicableRoomTypes.length > 0
                ? coupon.applicableRoomTypes[0]
                : coupon.applicableRoomType || 'all',
            applicableRoomTypes: undefined,
          }));
        setCoupons(updatedCoupons);

        setMessage(
          language === 'kor'
            ? '쿠폰이 삭제되었습니다.'
            : 'Coupon has been deleted.'
        );

        if (typeof onCouponsChange === 'function') {
          await onCouponsChange(updatedCoupons);
        }
      }

      setTimeout(() => setMessage(''), 5000);
    } catch (err) {
      console.error('[handleDeleteCoupon] Error:', err);
      setError(
        language === 'kor'
          ? `쿠폰 삭제 실패: ${err.message}`
          : `Failed to delete coupon: ${err.message}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteGroup = async (groupCoupons) => {
    if (!isAdminAuthenticated) {
      setPendingAction(() => () => handleDeleteGroup(groupCoupons));
      setShowPasswordModal(true);
      return;
    }

    if (isLoading) return;

    setIsLoading(true);
    try {
      // 모든 쿠폰에 대해 삭제 호출 (usedCount 조건 제거)
      for (const coupon of groupCoupons) {
        await api.delete('/api/hotel-settings/coupons', {
          data: { hotelId, couponUuid: coupon.uuid },
        });
      }

      // UI에서 모든 쿠폰 제거
      const updatedCoupons = coupons
        .filter((coupon) => !groupCoupons.some((gc) => gc.uuid === coupon.uuid))
        .map((coupon) => ({
          ...coupon,
          applicableRoomType:
            Array.isArray(coupon.applicableRoomTypes) &&
            coupon.applicableRoomTypes.length > 0
              ? coupon.applicableRoomTypes[0]
              : coupon.applicableRoomType || 'all',
          applicableRoomTypes: undefined,
        }));
      setCoupons(updatedCoupons);

      const feedbackMessage =
        language === 'kor'
          ? '그룹 내 모든 쿠폰이 삭제되었습니다.'
          : 'All coupons in the group have been deleted.';

      setMessage(feedbackMessage);
      setError('');

      if (typeof onCouponsChange === 'function') {
        await onCouponsChange(updatedCoupons);
      }

      setTimeout(() => setMessage(''), 5000);
    } catch (err) {
      console.error('[handleDeleteGroup] Error:', err);
      setError(
        language === 'kor'
          ? `그룹 삭제 실패: ${err.message}`
          : `Failed to delete group: ${err.message}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminAuth = () => {
    if (adminPasswordInput === ADMIN_PASSWORD) {
      setIsAdminAuthenticated(true);
      setShowPasswordModal(false);
      setAdminPasswordInput('');
      if (pendingAction) {
        pendingAction();
        setPendingAction(null);
      }
    } else {
      setError(
        language === 'kor'
          ? '관리자 번호가 올바르지 않습니다.'
          : 'Invalid admin password.'
      );
      setAdminPasswordInput('');
    }
  };

  const handleLockClick = () => {
    if (isAdminAuthenticated) {
      setIsAdminAuthenticated(false);
    } else {
      setShowPasswordModal(true);
    }
  };

  const handleCancelEdit = () => {
    setEditingCoupon(null);
    setNewCoupons(
      roomTypes && roomTypes.length > 0
        ? roomTypes.map((roomType) => initialCoupon(roomType))
        : []
    );
    setShowCouponForm(false);
    setApplyToAll(false);
    setSelectedRoomTypes(
      roomTypes && roomTypes.length > 0
        ? roomTypes.reduce((acc, rt) => {
            if (rt && rt.roomInfo) {
              acc[rt.roomInfo] = false;
            }
            return acc;
          }, {})
        : {}
    );
    setError('');
  };

  const groupCoupons = () => {
    let filteredCoupons = coupons;
    if (filterType === 'used') {
      filteredCoupons = coupons.filter((coupon) => coupon.usedCount > 0);
    } else if (filterType === 'deleted') {
      filteredCoupons = coupons.filter((coupon) => coupon.isDeleted);
    } else {
      filteredCoupons = coupons.filter((coupon) => !coupon.isDeleted);
    }

    const grouped = filteredCoupons.reduce((acc, coupon) => {
      const key = `${coupon.name}-${coupon.applicableRoomType || 'unknown'}`;
      if (!acc[key]) {
        acc[key] = {
          name: coupon.name || 'Unnamed Coupon',
          roomType: coupon.applicableRoomType || 'all',
          coupons: [],
        };
      }
      acc[key].coupons.push(coupon);
      return acc;
    }, {});
    return Object.values(grouped);
  };

  const toggleGroup = (key) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const toggleDropdown = () => {
    setShowDropdown((prev) => !prev);
  };

  const handleFilterChange = (type) => {
    setFilterType(type);
    setShowDropdown(false);
  };

  const groupedCoupons = groupCoupons();

  return (
    <section className="hotel-settings-coupon-section">
      <div className="section-header">
        <h2>
          {language === 'kor' ? '◉ 쿠폰 발행' : 'Coupon Issuance'}
          <span
            className={`lock-icon ${isAdminAuthenticated ? 'unlocked' : 'locked'}`}
            onClick={handleLockClick}
            title={
              language === 'kor'
                ? '쿠폰을 발행/삭제하려면 관리자 비밀번호를 입력해야 합니다.'
                : 'Enter admin password to issue/delete coupons.'
            }
          >
            {isAdminAuthenticated ? '🔓' : '🔒'}
          </span>
        </h2>
        {!isAdminAuthenticated && (
          <p className="lock-message">
            {language === 'kor' ? '잠금을 풀어 수정하세요' : 'Unlock to edit'}
          </p>
        )}
      </div>
      {error && <p className="hotel-settings-coupon-error">{error}</p>}
      {message && <p className="hotel-settings-coupon-success">{message}</p>}
      {isLoading && <p>{language === 'kor' ? '저장 중...' : 'Saving...'}</p>}

      {/* 관리자 인증 모달 */}
      {showPasswordModal && (
        <div className="admin-auth-modal">
          <div className="modal-content">
            <h3>{language === 'kor' ? '관리자 인증' : 'Admin Authentication'}</h3>
            <p>{language === 'kor' ? '관리자 번호를 입력해주세요:' : 'Please enter the admin password:'}</p>
            <input
              type="password"
              value={adminPasswordInput}
              onChange={(e) => setAdminPasswordInput(e.target.value)}
              placeholder={language === 'kor' ? '관리자 번호' : 'Admin Password'}
            />
            <div className="modal-actions">
              <button onClick={handleAdminAuth}>
                {language === 'kor' ? '확인' : 'Confirm'}
              </button>
              <button onClick={() => setShowPasswordModal(false)}>
                {language === 'kor' ? '취소' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 로열티 쿠폰 설정 섹션 */}
      <div className="loyalty-coupon-settings coupon-section-block">
        <h4>{language === 'kor' ? '로열티 쿠폰 설정' : 'Loyalty Coupon Settings'}</h4>
        <div className="loyalty-form">
          <div className="loyalty-form-row">
            <div className="loyalty-form-cell">
              <label>{language === 'kor' ? '5회 방문 쿠폰 이름' : '5 Visits Coupon Name'}</label>
              <input
                type="text"
                value={loyaltySettings.visit5?.name || '5회 방문 쿠폰'}
                onChange={(e) => handleLoyaltyChange('visit5', 'name', e.target.value)}
                disabled={isLoading || !isAdminAuthenticated}
              />
            </div>
            <div className="loyalty-form-cell">
              <label>{language === 'kor' ? '5회 방문 할인율 범위 (%)' : '5 Visits Discount Range (%)'}</label>
              <div className="discount-range-input">
                <input
                  type="number"
                  value={loyaltySettings.visit5?.randomMin || 0}
                  onChange={(e) => handleLoyaltyChange('visit5', 'randomMin', e.target.value)}
                  min="0"
                  max="100"
                  disabled={isLoading || !isAdminAuthenticated}
                />
                <span> ~ </span>
                <input
                  type="number"
                  value={loyaltySettings.visit5?.randomMax || 0}
                  onChange={(e) => handleLoyaltyChange('visit5', 'randomMax', e.target.value)}
                  min="0"
                  max="100"
                  disabled={isLoading || !isAdminAuthenticated}
                />
              </div>
            </div>
            <div className="loyalty-form-cell">
              <label>{language === 'kor' ? '10회 방문 쿠폰 이름' : '10 Visits Coupon Name'}</label>
              <input
                type="text"
                value={loyaltySettings.visit10?.name || '10회 방문 쿠폰'}
                onChange={(e) => handleLoyaltyChange('visit10', 'name', e.target.value)}
                disabled={isLoading || !isAdminAuthenticated}
              />
            </div>
            <div className="loyalty-form-cell">
              <label>{language === 'kor' ? '10회 방문 할인율 범위 (%)' : '10 Visits Discount Range (%)'}</label>
              <div className="discount-range-input">
                <input
                  type="number"
                  value={loyaltySettings.visit10?.randomMin || 0}
                  onChange={(e) => handleLoyaltyChange('visit10', 'randomMin', e.target.value)}
                  min="0"
                  max="100"
                  disabled={isLoading || !isAdminAuthenticated}
                />
                <span> ~ </span>
                <input
                  type="number"
                  value={loyaltySettings.visit10?.randomMax || 0}
                  onChange={(e) => handleLoyaltyChange('visit10', 'randomMax', e.target.value)}
                  min="0"
                  max="100"
                  disabled={isLoading || !isAdminAuthenticated}
                />
              </div>
            </div>
            <div className="loyalty-form-cell">
              <button
                className="hotel-settings-coupon-btn save"
                onClick={saveLoyaltySettings}
                disabled={isLoading || !isAdminAuthenticated}
              >
                {language === 'kor' ? '저장' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showCouponForm && (
        <div className="coupon-form-container coupon-section-block">
          <h4>
            {editingCoupon
              ? language === 'kor'
                ? '쿠폰 수정'
                : 'Edit Coupon'
              : language === 'kor'
              ? '쿠폰 발행'
              : 'Issue Coupon'}
          </h4>
          <div className="apply-to-all-section">
            <label>
              <input
                type="checkbox"
                checked={applyToAll}
                onChange={handleApplyToAllToggle}
                disabled={isLoading}
              />
              {language === 'kor' ? '모든 객실에 적용' : 'Apply to All Rooms'}
            </label>
          </div>
          <div className="coupon-form-table">
            <div className="coupon-form-row coupon-form-header">
              <div className="coupon-form-cell">
                <label>{language === 'kor' ? '선택' : 'Select'}</label>
              </div>
              <div className="coupon-form-cell">
                <label>{language === 'kor' ? '적용 객실' : 'Applicable Room'}</label>
              </div>
              <div className="coupon-form-cell">
                <label>{language === 'kor' ? '고유 쿠폰 코드' : 'Coupon Code'}</label>
              </div>
              <div className="coupon-form-cell">
                <label>{language === 'kor' ? '쿠폰 이름' : 'Coupon Name'}</label>
              </div>
              <div className="coupon-form-cell">
                <label>{language === 'kor' ? '쿠폰 개수' : 'Coupon Count'}</label>
              </div>
              <div className="coupon-form-cell">
                <label>{language === 'kor' ? '발행형태' : 'Discount Type'}</label>
              </div>
              <div className="coupon-form-cell">
                <label>{language === 'kor' ? '유효기간 시작일' : 'Start Date'}</label>
              </div>
              <div className="coupon-form-cell">
                <label>{language === 'kor' ? '유효기간 종료일' : 'End Date'}</label>
              </div>
              <div className="coupon-form-cell">
                <label>{language === 'kor' ? '발행일시' : 'Issued At'}</label>
              </div>
              <div className="coupon-form-cell">
                <label>{language === 'kor' ? '할인 값' : 'Discount Value'}</label>
              </div>
              <div className="coupon-form-cell">
                <label>{language === 'kor' ? '기간 설정' : 'Duration'}</label>
              </div>
            </div>

            {newCoupons.length === 0 ? (
              <div className="coupon-form-row">
                <div className="coupon-form-cell" style={{ textAlign: 'center', width: '100%' }}>
                  <p>
                    {language === 'kor'
                      ? '객실 정보를 불러올 수 없습니다. 관리자에게 문의하세요.'
                      : 'Unable to load room information. Please contact the administrator.'}
                  </p>
                </div>
              </div>
            ) : (
              newCoupons.map((coupon) => (
                <div
                  className={`coupon-form-row ${applyToAll || selectedRoomTypes[coupon.roomType] ? 'selected-row' : ''}`}
                  key={coupon.roomType || coupon.uuid}
                >
                  <div className="coupon-form-cell">
                    <input
                      type="checkbox"
                      checked={applyToAll || selectedRoomTypes[coupon.roomType]}
                      onChange={() => handleRoomTypeSelection(coupon.roomType)}
                      disabled={isLoading || applyToAll}
                    />
                  </div>
                  <div className="coupon-form-cell">
                    <input
                      type="text"
                      value={
                        applyToAll
                          ? language === 'kor' ? '모든 객실' : 'All Rooms'
                          : !roomTypes || !coupon.roomType
                          ? language === 'kor' ? '알 수 없음' : 'Unknown'
                          : coupon.roomType === 'all'
                          ? language === 'kor' ? '모든 객실' : 'All Rooms'
                          : roomTypes && roomTypes.length > 0
                          ? language === 'kor'
                            ? roomTypes.find((rt) => rt && rt.roomInfo && rt.roomInfo === coupon.roomType)?.nameKor || '알 수 없음'
                            : roomTypes.find((rt) => rt && rt.roomInfo && rt.roomInfo === coupon.roomType)?.nameEng || 'Unknown'
                          : language === 'kor' ? '알 수 없음' : 'Unknown'
                      }
                      readOnly
                      disabled
                    />
                  </div>
                  <div className="coupon-form-cell">
                    <input
                      type="text"
                      name="code"
                      value={coupon.code}
                      readOnly
                      disabled={isLoading}
                      className="coupon-code-input"
                    />
                  </div>
                  <div className="coupon-form-cell">
                    <input
                      type="text"
                      name="name"
                      value={coupon.name}
                      onChange={(e) => handleCouponChange(coupon.roomType, e)}
                      disabled={isLoading || !isAdminAuthenticated}
                      required
                    />
                  </div>
                  <div className="coupon-form-cell">
                    <input
                      type="number"
                      name="couponCount"
                      value={coupon.couponCount}
                      onChange={(e) => handleCouponChange(coupon.roomType, e)}
                      disabled={isLoading || !isAdminAuthenticated}
                      min="1"
                    />
                  </div>
                  <div className="coupon-form-cell">
                    <select
                      name="discountType"
                      value={coupon.discountType}
                      onChange={(e) => handleCouponChange(coupon.roomType, e)}
                      disabled={isLoading || !isAdminAuthenticated}
                    >
                      <option value="percentage">
                        {language === 'kor' ? '정률 (%)' : 'Percentage (%)'}
                      </option>
                      <option value="fixed">
                        {language === 'kor' ? '정액 (원)' : 'Fixed Amount (₩)'}
                      </option>
                    </select>
                  </div>
                  <div className="coupon-form-cell">
                    <input
                      type="date"
                      name="startDate"
                      value={coupon.startDate}
                      onChange={(e) => handleCouponChange(coupon.roomType, e)}
                      disabled={isLoading || !isAdminAuthenticated}
                    />
                  </div>
                  <div className="coupon-form-cell">
                    <input
                      type="date"
                      name="endDate"
                      value={coupon.endDate}
                      onChange={(e) => handleCouponChange(coupon.roomType, e)}
                      disabled={isLoading || !isAdminAuthenticated}
                    />
                  </div>
                  <div className="coupon-form-cell">
                    <input
                      type="text"
                      name="issuedAt"
                      value={formatDate(parseDate(coupon.issuedAt), "yyyy-MM-dd HH:mm:ss")}
                      readOnly
                      disabled
                    />
                  </div>
                  <div className="coupon-form-cell">
                    <div className={`discount-value-input ${coupon.discountType}`}>
                      <input
                        type="number"
                        name="discountValue"
                        value={coupon.discountValue}
                        onChange={(e) => handleCouponChange(coupon.roomType, e)}
                        disabled={isLoading || !isAdminAuthenticated}
                        min="0"
                      />
                      <span>{coupon.discountType === 'percentage' ? '%' : '₩'}</span>
                    </div>
                  </div>
                  <div className="coupon-form-cell duration-buttons">
                    {[1, 7, 30].map((d) => (
                      <button
                        key={d}
                        className={`duration-btn ${coupon.duration === d ? 'active' : ''}`}
                        onClick={() => handleDurationSelect(coupon.roomType, d)}
                        disabled={isLoading || !isAdminAuthenticated}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="coupon-form-actions">
            <button
              className="hotel-settings-coupon-btn save"
              onClick={handleAddCoupon}
              disabled={isLoading}
            >
              {language === 'kor' ? '발행' : 'Issue'}
            </button>
            <button
              className="hotel-settings-coupon-btn close"
              onClick={handleCancelEdit}
              disabled={isLoading}
            >
              {language === 'kor' ? '취소' : 'Cancel'}
            </button>
          </div>
        </div>
      )}

      <div className="hotel-settings-coupon-list coupon-section-block">
        <div className="header-with-button">
          <h4 className="hotel-settings-coupon-list-header">
            {language === 'kor' ? '발행된 쿠폰 목록' : 'Issued Coupons'}
          </h4>
          {!showCouponForm && (
            <div className="header-button-container">
              <button
                className="hotel-settings-coupon-btn create"
                onClick={() => setShowCouponForm(true)}
                disabled={isLoading}
              >
                {language === 'kor' ? '새 쿠폰 발행' : 'Issue New Coupon'}
              </button>
            </div>
          )}
        </div>
        {groupedCoupons.length === 0 ? (
          <p>
            {language === 'kor'
              ? '해당 조건에 맞는 쿠폰이 없습니다.'
              : 'No coupons match the selected criteria.'}
          </p>
        ) : (
          groupedCoupons.map((group, index) => {
            const key = `${group.name}-${group.roomType}-${index}`;
            const isExpanded = expandedGroups[key];
            const roomName =
              group.roomType === 'all'
                ? language === 'kor'
                  ? '모든 객실'
                  : 'All Rooms'
                : roomTypes && roomTypes.length > 0 && group.roomType
                ? language === 'kor'
                  ? roomTypes.find(
                      (rt) =>
                        rt &&
                        rt.roomInfo &&
                        safeLower(rt.roomInfo) === safeLower(group.roomType)
                    )?.nameKor || (group.roomType || '알 수 없음')
                  : roomTypes.find(
                      (rt) =>
                        rt &&
                        rt.roomInfo &&
                        safeLower(rt.roomInfo) === safeLower(group.roomType)
                    )?.nameEng || (group.roomType || 'Unknown')
                : group.roomType || (language === 'kor' ? '알 수 없음' : 'Unknown');

            return (
              <div key={key} className="coupon-group">
                <div className="coupon-group-header">
                  <h3 onClick={() => toggleGroup(key)}>
                    {group.name} ({roomName}) - {group.coupons.length}{' '}
                    {language === 'kor' ? '개' : 'coupons'}
                    <span className={`toggle-icon ${isExpanded ? 'expanded' : ''}`}>
                      {isExpanded ? '▲' : '▼'}
                    </span>
                  </h3>
                  <button
                    className="group-delete"
                    onClick={() => handleDeleteGroup(group.coupons)}
                    disabled={isLoading}
                  >
                    {language === 'kor' ? '전체 삭제' : 'Delete All'}
                  </button>
                </div>
                {isExpanded && (
                  <div className="coupon-group-details">
                    <div className="coupon-card-container">
                      {group.coupons.map((coupon) => {
                        const currentDate = format(new Date(), 'yyyy-MM-dd');
                        const startDate = coupon.startDate;
                        const endDate = coupon.endDate;
                        const isExpired = startDate > currentDate || endDate < currentDate;
                        const isUsed = coupon.usedCount > 0;
                        const statusReason =
                          !coupon.isActive && isExpired
                            ? language === 'kor'
                              ? '만료됨 - 유효기간이 지났습니다'
                              : 'Expired - Validity period has passed'
                            : !coupon.isActive
                            ? language === 'kor'
                              ? '비활성화'
                              : 'Inactive'
                            : isUsed
                            ? language === 'kor'
                              ? '사용완료'
                              : 'Used'
                            : language === 'kor'
                            ? '사용전'
                            : 'Not Used';

                        return (
                          <div key={coupon.uuid} className="coupon-card">
                            <div className="coupon-card-content">
                              <p>
                                <strong>
                                  {language === 'kor' ? '쿠폰 이름' : 'Coupon Name'}:
                                </strong>{' '}
                                {coupon.name}
                              </p>
                              <p>
                                <strong>
                                  {language === 'kor' ? '쿠폰 코드' : 'Coupon Code'}:
                                </strong>{' '}
                                {coupon.code}
                              </p>
                              <p>
                                <strong>
                                  {language === 'kor'
                                    ? '적용 객실'
                                    : 'Applicable Room'}
                                  :
                                </strong>{' '}
                                {coupon.applicableRoomType === 'all'
                                  ? language === 'kor' ? '모든 객실' : 'All Rooms'
                                  : roomTypes && roomTypes.length > 0
                                  ? language === 'kor'
                                    ? roomTypes.find(
                                        (rt) =>
                                          rt &&
                                          rt.roomInfo &&
                                          safeLower(rt.roomInfo) ===
                                            safeLower(coupon.applicableRoomType)
                                      )?.nameKor || coupon.applicableRoomType
                                    : roomTypes.find(
                                        (rt) =>
                                          rt &&
                                          rt.roomInfo &&
                                          safeLower(rt.roomInfo) ===
                                            safeLower(coupon.applicableRoomType)
                                      )?.nameEng || coupon.applicableRoomType
                                  : coupon.applicableRoomType}
                              </p>
                              <p>
                                <strong>
                                  {language === 'kor' ? '할인 유형' : 'Discount Type'}:
                                </strong>{' '}
                                {coupon.discountType === 'percentage'
                                  ? '정률 (%)'
                                  : '정액 (₩)'}
                              </p>
                              <p>
                                <strong>
                                  {language === 'kor' ? '할인 값' : 'Discount Value'}:
                                </strong>{' '}
                                {coupon.discountValue}
                                {coupon.discountType === 'percentage' ? '%' : '원'}
                              </p>
                              <p>
                                <strong>
                                  {language === 'kor' ? '유효기간' : 'Validity'}:
                                </strong>{' '}
                                {startDate} ~ {endDate}
                              </p>
                              <p>
                                <strong>
                                  {language === 'kor' ? '생성 일시' : 'Created At'}:
                                </strong>{' '}
                                {formatDate(parseDate(coupon.issuedAt), "yyyy-MM-dd HH:mm:ss")}
                              </p>
                              <p>
                                <strong>
                                  {language === 'kor' ? '상태' : 'Status'}:
                                </strong>{' '}
                                {statusReason}
                              </p>
                              {isUsed && coupon.usedAt && (
                                <p>
                                  <strong>
                                    {language === 'kor' ? '사용 일시' : 'Used At'}:
                                  </strong>{' '}
                                  {formatDate(parseDate(coupon.usedAt), "yyyy-MM-dd HH:mm:ss")}
                                </p>
                              )}
                            </div>
                            <div className="coupon-card-actions">
                              <button
                                className="delete-btn"
                                onClick={() => handleDeleteCoupon(coupon.uuid)}
                                disabled={isLoading}
                              >
                                <FaTrash />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 통계 섹션 */}
      <div className="coupon-stats-section">
        {/* 월별 통계 테이블 */}
        <div className="monthly-stats coupon-section-block">
          <div className="header-with-button">
            <h5>{language === 'kor' ? '월별 쿠폰 통계' : 'Monthly Coupon Stats'}</h5>
            <div className="header-button-container">
              <button className="dropdown-toggle" onClick={toggleDropdown}>
                {language === 'kor' ? '쿠폰 통계 보기' : 'View Coupon Stats'}
                <span className={`dropdown-icon ${showDropdown ? 'expanded' : ''}`}>
                  ▼
                </span>
              </button>
              {showDropdown && (
                <div className="dropdown-menu">
                  <button onClick={() => handleFilterChange('issued')}>
                    {language === 'kor' ? '발행된 쿠폰' : 'Issued Coupons'}
                  </button>
                  <button onClick={() => handleFilterChange('used')}>
                    {language === 'kor' ? '사용된 쿠폰' : 'Used Coupons'}
                  </button>
                  <button onClick={() => handleFilterChange('deleted')}>
                    {language === 'kor' ? '삭제된 쿠폰' : 'Deleted Coupons'}
                  </button>
                </div>
              )}
            </div>
          </div>
          <table className="stats-table">
            <thead>
              <tr>
                <th>{language === 'kor' ? '월' : 'Month'}</th>
                <th>{language === 'kor' ? '발행된 쿠폰' : 'Issued'}</th>
                <th>{language === 'kor' ? '사용된 쿠폰' : 'Used'}</th>
                <th>{language === 'kor' ? '삭제된 쿠폰' : 'Deleted'}</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(monthlyStats).sort().map((month) => (
                <tr key={month}>
                  <td>{month}</td>
                  <td>{monthlyStats[month].issued}</td>
                  <td>{monthlyStats[month].used}</td>
                  <td>{monthlyStats[month].deleted}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 월별 통계 그래프 */}
        <div className="stats-chart coupon-section-block">
          <h5>{language === 'kor' ? '월별 쿠폰 통계 그래프' : 'Monthly Coupon Stats Chart'}</h5>
          <div className="chart-container">
            {Object.keys(monthlyStats).length > 0 ? (
              <canvas id="couponStatsChart" />
            ) : (
              <p>{language === 'kor' ? '데이터가 없습니다.' : 'No data available.'}</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function HotelSettingsPage() {
  const navigate = useNavigate();
  const originalDataRef = useRef(null);
  const [activeTab, setActiveTab] = useState('info');
  const [language, setLanguage] = useState('kor');
  const [hotelId, setHotelId] = useState(localStorage.getItem('hotelId') || '');
  const [isExisting, setIsExisting] = useState(false);
  const [error, setError] = useState('');
  const [totalRooms, setTotalRooms] = useState(0);
  const [roomTypes, setRoomTypes] = useState([]);
  const [floors, setFloors] = useState([]);
  const [amenities, setAmenities] = useState([...DEFAULT_AMENITIES]);
  const [hotelAddress, setHotelAddress] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [hotelName, setHotelName] = useState('');
  const [checkInTime, setCheckInTime] = useState('16:00');
  const [checkOutTime, setCheckOutTime] = useState('11:00');
  const [hotelInfo, setHotelInfo] = useState(null);
  const [coordinates, setCoordinates] = useState(null);
  const [events, setEvents] = useState([]);
  const [coupons, setCoupons] = useState([]); // 추가: coupons 상태
  const [message, setMessage] = useState('');

  const handleCoordinatesUpdate = (coords) => {
    setCoordinates(coords);
  };

  const toggleLanguage = () => {
    setLanguage((prev) => (prev === 'kor' ? 'eng' : 'kor'));
  };

  useEffect(() => {
    async function loadData() {
      if (!hotelId) {
        setError(
          language === 'kor'
            ? '호텔 ID가 없습니다. 다시 로그인해주세요.'
            : 'Hotel ID not found. Please log in again.'
        );
        navigate('/login');
        return;
      }
  
      try {
        const [hotelData, userData] = await Promise.all([
          fetchHotelSettings(hotelId).catch((err) => {
            console.error('[fetchHotelSettings] Error:', err);
            return null;
          }),
          fetchUserInfo(hotelId).catch((err) => {
            console.error('[fetchUserInfo] Error:', err);
            return null;
          }),
        ]);
  
        if (userData) {
          setHotelName(userData.hotelName || '');
          setHotelAddress(userData.address || '');
          setEmail(userData.email || '');
          setPhoneNumber(userData.phoneNumber || '');
          setHotelInfo({
            hotelId,
            hotelName: userData.hotelName || '',
            address: userData.address || '',
            email: userData.email || '',
            phoneNumber: userData.phoneNumber || '',
            adminName: userData.adminName || '정보 없음',
          });
        } else {
          setError(
            language === 'kor'
              ? '사용자 정보를 불러오지 못했습니다. 기본값으로 설정합니다.'
              : 'Failed to load user information. Setting defaults.'
          );
          setHotelName('');
          setHotelAddress('');
          setEmail('');
          setPhoneNumber('');
          setHotelInfo({
            hotelId,
            hotelName: '',
            address: '',
            email: '',
            phoneNumber: '',
            adminName: '정보 없음',
          });
        }
  
        if (hotelData && hotelData._id) {
          setIsExisting(true);
          const containers =
            hotelData.gridSettings?.floors?.flatMap(
              (floor) => floor.containers || []
            ) || [];
  
          const activeTypes = new Set(
            containers
              .filter((c) => c.roomInfo && c.isActive)
              .map((c) => c.roomInfo.toLowerCase())
          );
  
          let updatedRoomTypes = hotelData.roomTypes
            .filter((rt) => activeTypes.has(rt.roomInfo.toLowerCase()))
            .map((rt) => ({
              ...rt,
              isBaseRoom: rt.isBaseRoom || false,
              roomAmenities:
                rt.roomAmenities ||
                DEFAULT_AMENITIES.filter((a) => a.type === 'in-room').map(
                  (a) => ({
                    nameKor: a.nameKor,
                    nameEng: a.nameEng,
                    icon: a.icon,
                    type: a.type,
                    isActive: false,
                  })
                ),
              photos: rt.photos || [],
            }));
  
          activeTypes.forEach((typeKey) => {
            if (
              !updatedRoomTypes.some(
                (rt) => rt.roomInfo.toLowerCase() === typeKey
              )
            ) {
              updatedRoomTypes.push({
                roomInfo: typeKey,
                nameKor: typeKey.charAt(0).toUpperCase() + typeKey.slice(1),
                nameEng: typeKey.charAt(0).toUpperCase() + typeKey.slice(1),
                price: 0,
                aliases: [],
                stock: 0,
                roomNumbers: [],
                isBaseRoom: false,
                roomAmenities: DEFAULT_AMENITIES.filter(
                  (a) => a.type === 'in-room'
                ).map((a) => ({
                  nameKor: a.nameKor,
                  nameEng: a.nameEng,
                  icon: a.icon,
                  type: a.type,
                  isActive: false,
                })),
                photos: [],
              });
            }
          });
  
          updatedRoomTypes = buildRoomTypesWithNumbers(
            updatedRoomTypes,
            containers
          );
          setRoomTypes(updatedRoomTypes);
          setTotalRooms(
            containers.filter((c) => c.roomInfo && c.roomNumber && c.isActive)
              .length
          );
          setFloors(hotelData.gridSettings?.floors || []);
          setAmenities(hotelData.amenities || DEFAULT_AMENITIES);
          setEvents(
            (hotelData.eventSettings || []).map((event) => ({
              uuid: event.uuid || uuidv4(),
              eventName: event.eventName || '특가 이벤트',
              startDate: new Date(event.startDate).toISOString().split('T')[0],
              endDate: new Date(event.endDate).toISOString().split('T')[0],
              discountType: event.discountType || 'percentage',
              discountValue: event.discountValue || 0,
              isActive: event.isActive ?? true,
              applicableRoomTypes: event.applicableRoomTypes || [],
            }))
          );
          console.log('[loadData] hotelData.coupons:', hotelData.coupons); // 디버깅 로그 추가
          setCoupons(
            (hotelData.coupons || []).map((coupon) => ({
              uuid: coupon.uuid || uuidv4(),
              code: coupon.code || '',
              name: coupon.name || '할인 쿠폰',
              startDate: new Date(coupon.startDate).toISOString().split('T')[0],
              endDate: new Date(coupon.endDate).toISOString().split('T')[0],
              autoValidity: coupon.autoValidity ?? true,
              validityDays: coupon.validityDays || 30,
              discountType: coupon.discountType || 'percentage',
              discountValue: coupon.discountValue || 0,
              isActive: coupon.isActive ?? true,
              applicableRoomType: coupon.applicableRoomType,
              maxUses: coupon.maxUses || null,
              stackWithEvents: coupon.stackWithEvents ?? false,
              usedCount: coupon.usedCount || 0,
              condition: coupon.condition || {
                type: 'none',
                value: null,
                minPrice: null,
                maxPrice: null,
              },
              isRandom: coupon.isRandom || false,
              randomMin: coupon.randomMin || '',
              randomMax: coupon.randomMax || '',
              autoDistribute: coupon.autoDistribute || false,
              issuedAt: coupon.issuedAt || format(toZonedTime(new Date(), 'Asia/Seoul'), 'yyyy-MM-dd HH:mm:ss'),
              usedAt: coupon.usedAt || null,
              isDeleted: coupon.isDeleted || false,
            }))
          );
          setCheckInTime(hotelData.checkInTime || '16:00');
          setCheckOutTime(hotelData.checkOutTime || '11:00');
          if (hotelData.latitude && hotelData.longitude) {
            setCoordinates({
              latitude: hotelData.latitude,
              longitude: hotelData.longitude,
            });
          }
        } else {
          setIsExisting(false);
          setRoomTypes([]);
          setFloors([]);
          setTotalRooms(0);
          setEvents([]);
          setCoupons([]);
          setAmenities(DEFAULT_AMENITIES);
          setCheckInTime('16:00');
          setCheckOutTime('11:00');
          setError(
            language === 'kor'
              ? '호텔 설정이 없습니다. 레이아웃 탭에서 층과 객실을 추가해 주세요.'
              : 'No hotel settings found. Please add floors and rooms in the Layout tab.'
          );
        }
      } catch (err) {
        console.error('[loadData] Error:', err);
        setError(
          language === 'kor'
            ? `데이터 로딩 실패: ${err.message}. 기본값으로 설정합니다.`
            : `Failed to load data: ${err.message}. Setting defaults.`
        );
        setIsExisting(false);
        setRoomTypes([]);
        setFloors([]);
        setTotalRooms(0);
        setEvents([]);
        setCoupons([]);
        setHotelName('');
        setHotelAddress('');
        setEmail('');
        setPhoneNumber('');
        setHotelInfo({
          hotelId,
          hotelName: '',
          address: '',
          email: '',
          phoneNumber: '',
          adminName: '정보 없음',
        });
      }
    }
  
    loadData();
  }, [hotelId, language, navigate]);

  const handleLoadDefault = () => {
    const defaultRoomTypesCopy = defaultRoomTypes.map((rt) => ({
      ...rt,
      isBaseRoom: false,
      aliases: [],
      roomNumbers: [],
      roomAmenities: DEFAULT_AMENITIES.map((a) => ({ ...a, isActive: false })),
      photos: [],
    }));
    const newFloors = DEFAULT_FLOORS.map((floorNum) => {
      const containers = [];
      const roomType = defaultRoomTypesCopy.find(
        (rt) => rt.floorSettings[floorNum] > 0
      );
      if (roomType) {
        const stock = roomType.floorSettings[floorNum] || 0;
        const startNum = parseInt(
          roomType.startRoomNumbers[floorNum] || `${floorNum}01`,
          10
        );
        for (let i = 0; i < stock; i++) {
          const roomNum = `${startNum + i}`;
          containers.push({
            containerId: `${floorNum}-${
              roomType.roomInfo
            }-${roomNum}-${Date.now()}`,
            roomInfo: roomType.roomInfo,
            roomNumber: roomNum,
            price: roomType.price,
            isActive: true,
          });
          roomType.roomNumbers.push(roomNum);
        }
      }
      containers.sort(
        (a, b) => parseInt(a.roomNumber, 10) - parseInt(b.roomNumber, 10)
      );
      return { floorNum, containers };
    });
    defaultRoomTypesCopy.forEach((rt) => {
      rt.roomNumbers = [...new Set(rt.roomNumbers)];
      rt.roomNumbers.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
      rt.stock = rt.roomNumbers.length;
    });
    setRoomTypes(defaultRoomTypesCopy);
    setFloors(newFloors);
    setTotalRooms(defaultRoomTypesCopy.reduce((sum, rt) => sum + rt.stock, 0));
    setCoupons([]);
    setError('');
    alert('디폴트 설정이 불러와졌습니다.');
  };

  const updatedRoomTypes = useMemo(() => {
    const newRoomTypes = [...roomTypes];
    let hasChanges = false;

    const roomCounts = {};
    floors.forEach((floor) => {
      if (floor.containers && Array.isArray(floor.containers)) {
        floor.containers.forEach((cont) => {
          if (cont.isActive && cont.roomInfo && cont.roomNumber) {
            const typeKey = cont.roomInfo.toLowerCase();
            roomCounts[typeKey] = (roomCounts[typeKey] || 0) + 1;
          }
        });
      }
    });

    newRoomTypes.forEach((rt) => {
      const typeKey = rt.roomInfo.toLowerCase();
      const currentRoomNumbers = floors
        .flatMap((floor) =>
          floor.containers
            .filter(
              (cont) =>
                cont.roomInfo.toLowerCase() === typeKey &&
                cont.roomNumber &&
                cont.isActive
            )
            .map((cont) => cont.roomNumber)
        )
        .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

      const currentRoomNumbersStr = (rt.roomNumbers || []).sort().join(',');
      const newRoomNumbersStr = currentRoomNumbers.join(',');
      if (currentRoomNumbersStr !== newRoomNumbersStr) {
        rt.roomNumbers = currentRoomNumbers;
        hasChanges = true;
      }

      const newStock = roomCounts[typeKey] || 0;
      if (rt.stock !== newStock) {
        rt.stock = newStock;
        hasChanges = true;
      }
    });

    return { roomTypes: newRoomTypes, hasChanges };
  }, [floors, roomTypes]);

  useEffect(() => {
    const newTotal = floors.reduce(
      (sum, f) =>
        sum +
        (f.containers || []).filter((c) => c.roomInfo && c.roomNumber).length,
      0
    );
    setTotalRooms(newTotal);
    if (updatedRoomTypes.hasChanges) {
      setRoomTypes(updatedRoomTypes.roomTypes);
    }
    originalDataRef.current = {
      hotelId,
      isExisting,
      totalRooms: newTotal,
      roomTypes: updatedRoomTypes.roomTypes,
      floors,
      amenities,
      hotelAddress,
      email,
      phoneNumber,
      hotelName,
      coupons,
    };
  }, [
    floors,
    hotelId,
    isExisting,
    hotelAddress,
    email,
    phoneNumber,
    hotelName,
    updatedRoomTypes.hasChanges,
    updatedRoomTypes.roomTypes,
    amenities,
    coupons,
  ]);

  const handleSaveHotelInfo = async () => {
    if (!hotelId) {
      alert('호텔 ID는 필수입니다.');
      return;
    }

    if (!coordinates) {
      alert('좌표를 먼저 추출해주세요.');
      return;
    }

    const userPayload = {
      hotelName,
      email,
      phoneNumber,
      address: hotelAddress,
    };

    const settingsPayload = {
      hotelId,
      hotelName,
      address: hotelAddress,
      email,
      phoneNumber,
      checkInTime,
      checkOutTime,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
    };

    try {
      if (isExisting) {
        await Promise.all([
          updateUser(hotelId, userPayload),
          updateHotelSettings(hotelId, settingsPayload),
        ]);
        alert('호텔 기본 정보가 저장되었습니다.');
      } else {
        await registerHotel(settingsPayload);
        alert('호텔 기본 정보가 등록되었습니다.');
        setIsExisting(true);
      }
    } catch (err) {
      alert('저장 실패: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleSaveRoomTypes = async () => {
    if (!hotelId) {
      alert('호텔 ID는 필수입니다.');
      return;
    }

    const activeTypes = new Set();
    const roomCounts = {};
    floors.forEach((floor) => {
      if (floor.containers && Array.isArray(floor.containers)) {
        floor.containers.forEach((cont) => {
          if (cont.isActive && cont.roomInfo) {
            const typeKey = cont.roomInfo.toLowerCase();
            activeTypes.add(typeKey);
            roomCounts[typeKey] = (roomCounts[typeKey] || 0) + 1;
          }
        });
      }
    });

    const updatedRoomTypes = roomTypes
      .filter((rt) => activeTypes.has(rt.roomInfo.toLowerCase()))
      .map((rt) => {
        const typeKey = rt.roomInfo.toLowerCase();
        return {
          ...rt,
          isBaseRoom: rt.isBaseRoom,
          stock: roomCounts[typeKey] || 0,
          aliases: (rt.aliases || []).filter(Boolean),
          roomNumbers: floors
            .flatMap((floor) =>
              floor.containers
                .filter(
                  (cont) =>
                    cont.roomInfo.toLowerCase() === typeKey &&
                    cont.roomNumber &&
                    cont.isActive
                )
                .map((cont) => cont.roomNumber)
            )
            .sort((a, b) => parseInt(a, 10) - parseInt(b, 10)),
          roomAmenities: rt.roomAmenities.map((amenity) => ({
            nameKor: amenity.nameKor,
            nameEng: amenity.nameEng,
            icon: amenity.icon,
            type: amenity.type,
            isActive: amenity.isActive,
          })),
        };
      });

    const payload = {
      hotelId,
      amenities,
      roomTypes: updatedRoomTypes,
      totalRooms: Object.values(roomCounts).reduce(
        (sum, count) => sum + count,
        0
      ),
    };

    try {
      await updateHotelSettings(hotelId, payload);
      alert('객실 타입 및 공통 시설 정보가 저장되었습니다.');
      setRoomTypes(updatedRoomTypes);
      setTotalRooms(payload.totalRooms);
    } catch (err) {
      alert('저장 실패: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleSaveLayout = async () => {
    if (!hotelId) {
      alert('호텔 ID는 필수입니다.');
      return;
    }

    const activeTypes = new Set();
    const roomCounts = {};
    floors.forEach((floor) => {
      if (floor.containers && Array.isArray(floor.containers)) {
        floor.containers.forEach((cont) => {
          if (cont.isActive && cont.roomInfo) {
            const typeKey = cont.roomInfo.toLowerCase();
            activeTypes.add(typeKey);
            roomCounts[typeKey] = (roomCounts[typeKey] || 0) + 1;
          }
        });
      }
    });

    const updatedRoomTypes = roomTypes
      .filter((rt) => activeTypes.has(rt.roomInfo.toLowerCase()))
      .map((rt) => {
        const typeKey = rt.roomInfo.toLowerCase();
        return {
          ...rt,
          stock: roomCounts[typeKey] || 0,
          roomNumbers: floors
            .flatMap((floor) =>
              floor.containers
                .filter(
                  (cont) =>
                    cont.roomInfo.toLowerCase() === typeKey &&
                    cont.roomNumber &&
                    cont.isActive
                )
                .map((cont) => cont.roomNumber)
            )
            .sort((a, b) => parseInt(a, 10) - parseInt(b, 10)),
        };
      });

    const payload = {
      hotelId,
      gridSettings: { floors },
      roomTypes: updatedRoomTypes,
      totalRooms: Object.values(roomCounts).reduce(
        (sum, count) => sum + count,
        0
      ),
    };

    try {
      await updateHotelSettings(hotelId, payload);
      alert('레이아웃 정보가 저장되었습니다.');
      setRoomTypes(updatedRoomTypes);
      setTotalRooms(payload.totalRooms);
    } catch (err) {
      alert('저장 실패: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleSaveAmenities = async () => {
    if (!hotelId) {
      alert('호텔 ID는 필수입니다.');
      return;
    }
    const payload = {
      hotelId,
      amenities,
      roomTypes: roomTypes.map((rt) => ({
        ...rt,
        isBaseRoom: rt.isBaseRoom,
        roomAmenities: rt.roomAmenities.map((amenity) => ({
          nameKor: amenity.nameKor,
          nameEng: amenity.nameEng,
          icon: amenity.icon,
          type: amenity.type,
          isActive: amenity.isActive,
        })),
      })),
    };
    console.log('[handleSaveAmenities] Payload:', payload);
    try {
      await updateHotelSettings(hotelId, payload);
      alert('시설 정보가 저장되었습니다.');
    } catch (err) {
      alert('저장 실패: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleSaveEvents = async (updatedEvents) => {
    try {
      if (!hotelId) {
        throw new Error(
          language === 'kor' ? '호텔 ID가 필요합니다.' : 'Hotel ID is required'
        );
      }

      if (!updatedEvents || updatedEvents.length === 0) {
        setMessage(
          language === 'kor' ? '저장할 이벤트가 없습니다.' : 'No events to save'
        );
        setTimeout(() => setMessage(''), 3000);
        return;
      }

      const formattedEvents = updatedEvents.map((event) => {
        if (!event.uuid) {
          throw new Error(
            language === 'kor'
              ? '이벤트 UUID가 누락되었습니다.'
              : 'Event UUID is missing.'
          );
        }

        const startDateStr = event.startDate;
        const endDateStr = event.endDate;

        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(startDateStr) ||
          !/^\d{4}-\d{2}-\d{2}$/.test(endDateStr)
        ) {
          throw new Error(
            language === 'kor'
              ? `유효하지 않은 날짜 형식입니다 (이벤트: ${event.eventName}).`
              : `Invalid date format (Event: ${event.eventName}).`
          );
        }

        const startDate = new Date(startDateStr);
        const endDate = new Date(endDateStr);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          throw new Error(
            language === 'kor'
              ? `유효하지 않은 날짜입니다 (이벤트: ${event.eventName}).`
              : `Invalid date format (Event: ${event.eventName}).`
          );
        }

        if (startDate > endDate) {
          throw new Error(
            language === 'kor'
              ? `종료일은 시작일보다 이후이거나 같은 날짜여야 합니다 (이벤트: ${event.eventName}).`
              : `End date must be on or after start date (Event: ${event.eventName}).`
          );
        }

        const discountValue = Number(event.discountValue) || 0;
        if (
          event.discountType === 'percentage' &&
          (discountValue < 0 || discountValue > 100)
        ) {
          throw new Error(
            language === 'kor'
              ? `할인율은 0~100% 사이여야 합니다 (이벤트: ${event.eventName}).`
              : `Discount percentage must be between 0 and 100 (Event: ${event.eventName}).`
          );
        }
        if (event.discountType === 'fixed' && discountValue <= 0) {
          throw new Error(
            language === 'kor'
              ? `할인 금액은 0보다 커야 합니다 (이벤트: ${event.eventName}).`
              : `Discount amount must be greater than 0 (Event: ${event.eventName}).`
          );
        }

        return {
          uuid: event.uuid,
          eventName: event.eventName || '특가 이벤트',
          startDate: startDateStr,
          endDate: endDateStr,
          discountType: event.discountType || 'percentage',
          discountValue,
          isActive: event.isActive ?? true,
          applicableRoomTypes: Array.isArray(event.applicableRoomTypes)
            ? event.applicableRoomTypes.filter(
                (roomType) => roomType && roomType.trim()
              )
            : [],
        };
      });

      const uuids = formattedEvents.map((event) => event.uuid);
      if (new Set(uuids).size !== uuids.length) {
        throw new Error(
          language === 'kor'
            ? '중복된 이벤트 UUID가 있습니다.'
            : 'Duplicate event UUIDs detected.'
        );
      }

      const payload = {
        eventSettings: formattedEvents,
        roomTypes,
      };

      console.log('[handleSaveEvents] Sending payload:', {
        eventSettings: formattedEvents,
        roomTypes: roomTypes.map((rt) => ({
          roomInfo: rt.roomInfo,
          discount: rt.discount,
          fixedDiscount: rt.fixedDiscount,
        })),
      });

      const updatedSettings = await updateHotelSettings(hotelId, payload);
      console.log('[handleSaveEvents] Updated Settings:', updatedSettings);

      if (!updatedSettings || !updatedSettings.roomTypes) {
        throw new Error(
          language === 'kor'
            ? '서버 응답에서 호텔 설정 데이터를 찾을 수 없습니다.'
            : 'Hotel settings data not found in server response.'
        );
      }

      setRoomTypes(updatedSettings.roomTypes);
      console.log(
        '[handleSaveEvents] Updated roomTypes with discount:',
        updatedSettings.roomTypes
      );

      const updatedRoomTypes = updatedSettings.roomTypes;
      const affectedRooms = updatedRoomTypes
        .filter((rt) => rt.discount > 0 || rt.fixedDiscount > 0)
        .map(
          (rt) =>
            `${rt.nameKor}: ${
              rt.fixedDiscount > 0 ? `${rt.fixedDiscount}원` : `${rt.discount}%`
            } 할인 적용`
        );

      const feedbackMessage =
        affectedRooms.length > 0
          ? `${
              language === 'kor'
                ? '이벤트가 저장되었습니다. 할인 적용 객실: '
                : 'Events saved successfully. Discount applied to: '
            }${affectedRooms.join(', ')}`
          : language === 'kor'
          ? '이벤트가 저장되었습니다.'
          : 'Events saved successfully';

      setMessage(feedbackMessage);
      setError('');
      setTimeout(() => setMessage(''), 5000);
    } catch (err) {
      console.error('[handleSaveEvents] Error:', {
        message: err.message,
        response: err.response,
        request: err.request,
      });
      setError(
        language === 'kor'
          ? `이벤트 저장 실패: ${err.message}${
              err.response ? ` (상태 코드: ${err.response.status})` : ''
            }`
          : `Failed to save events: ${err.message}${
              err.response ? ` (Status code: ${err.response.status})` : ''
            }`
      );
      setMessage('');
    }
  };

  const handleSaveCoupons = async (updatedCoupons) => {
    try {
      if (!hotelId) {
        throw new Error(
          language === 'kor' ? '호텔 ID가 필요합니다.' : 'Hotel ID is required'
        );
      }
  
      if (!updatedCoupons || updatedCoupons.length === 0) {
        setMessage(
          language === 'kor' ? '저장할 쿠폰이 없습니다.' : 'No coupons to save'
        );
        setTimeout(() => setMessage(''), 3000);
        return;
      }
  
      const formattedCoupons = updatedCoupons.map((coupon) => {
        if (!coupon.uuid) {
          throw new Error(
            language === 'kor'
              ? '쿠폰 UUID가 누락되었습니다.'
              : 'Coupon UUID is missing.'
          );
        }
  
        const startDateStr = coupon.startDate;
        const endDateStr = coupon.endDate;
  
        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(startDateStr) ||
          !/^\d{4}-\d{2}-\d{2}$/.test(endDateStr)
        ) {
          throw new Error(
            language === 'kor'
              ? `유효하지 않은 날짜 형식입니다 (쿠폰: ${coupon.name}).`
              : `Invalid date format (Coupon: ${coupon.name}).`
          );
        }
  
        const startDate = new Date(startDateStr);
        const endDate = new Date(endDateStr);
  
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          throw new Error(
            language === 'kor'
              ? `유효하지 않은 날짜입니다 (쿠폰: ${coupon.name}).`
              : `Invalid date format (Coupon: ${coupon.name}).`
          );
        }
  
        if (startDate > endDate) {
          throw new Error(
            language === 'kor'
              ? `종료일은 시작일보다 이후이거나 같은 날짜여야 합니다 (쿠폰: ${coupon.name}).`
              : `End date must be on or after start date (Coupon: ${coupon.name}).`
          );
        }
  
        const discountValue = Number(coupon.discountValue) || 0;
        if (
          coupon.discountType === 'percentage' &&
          (discountValue < 0 || discountValue > 100)
        ) {
          throw new Error(
            language === 'kor'
              ? `할인율은 0~100% 사이여야 합니다 (쿠폰: ${coupon.name}).`
              : `Discount percentage must be between 0 and 100 (Coupon: ${coupon.name}).`
          );
        }
        if (coupon.discountType === 'fixed' && discountValue <= 0) {
          throw new Error(
            language === 'kor'
              ? `할인 금액은 0보다 커야 합니다 (쿠폰: ${coupon.name}).`
              : `Discount amount must be greater than 0 (Coupon: ${coupon.name}).`
          );
        }
  
        if (coupon.isRandom) {
          const randomMin = Number(coupon.randomMin) || 0;
          const randomMax = Number(coupon.randomMax) || 0;
          if (randomMin >= randomMax) {
            throw new Error(
              language === 'kor'
                ? `최소 할인 값은 최대 할인 값보다 작아야 합니다 (쿠폰: ${coupon.name}).`
                : `Minimum discount value must be less than maximum discount value (Coupon: ${coupon.name}).`
            );
          }
          if (coupon.discountType === 'percentage') {
            if (randomMin < 0 || randomMax > 100) {
              throw new Error(
                language === 'kor'
                  ? `랜덤 할인율은 0~100% 사이여야 합니다 (쿠폰: ${coupon.name}).`
                  : `Random discount percentage must be between 0 and 100 (Coupon: ${coupon.name}).`
              );
            }
          } else if (coupon.discountType === 'fixed') {
            if (randomMin <= 0 || randomMax <= 0) {
              throw new Error(
                language === 'kor'
                  ? `랜덤 할인 금액은 0보다 커야 합니다 (쿠폰: ${coupon.name}).`
                  : `Random discount amount must be greater than 0 (Coupon: ${coupon.name}).`
              );
            }
          }
        }
  
        if (coupon.condition && coupon.condition.type !== 'none') {
          if (coupon.condition.type === 'visitCount') {
            const visitCount = parseInt(coupon.condition.value, 10);
            if (isNaN(visitCount) || visitCount <= 0) {
              throw new Error(
                language === 'kor'
                  ? `방문 횟수는 1 이상의 숫자여야 합니다 (쿠폰: ${coupon.name}).`
                  : `Visit count must be a number greater than 0 (Coupon: ${coupon.name}).`
              );
            }
          } else if (coupon.condition.type === 'topN') {
            const topN = parseInt(coupon.condition.value, 10);
            if (isNaN(topN) || topN <= 0) {
              throw new Error(
                language === 'kor'
                  ? `상위 N명은 1 이상의 숫자여야 합니다 (쿠폰: ${coupon.name}).`
                  : `Top N must be a number greater than 0 (Coupon: ${coupon.name}).`
              );
            }
          } else if (coupon.condition.type === 'priceRange') {
            const minPrice = parseFloat(coupon.condition.minPrice);
            const maxPrice = parseFloat(coupon.condition.maxPrice);
            if (
              (minPrice !== null && (isNaN(minPrice) || minPrice < 0)) ||
              (maxPrice !== null && (isNaN(maxPrice) || maxPrice <= 0))
            ) {
              throw new Error(
                language === 'kor'
                  ? `가격 범위는 유효한 숫자여야 하며, 0 이상이어야 합니다 (쿠폰: ${coupon.name}).`
                  : `Price range must be a valid number and greater than 0 (Coupon: ${coupon.name}).`
              );
            }
            if (
              minPrice !== null &&
              maxPrice !== null &&
              minPrice >= maxPrice
            ) {
              throw new Error(
                language === 'kor'
                  ? `최소 가격은 최대 가격보다 작아야 합니다 (쿠폰: ${coupon.name}).`
                  : `Minimum price must be less than maximum price (Coupon: ${coupon.name}).`
              );
            }
          }
        }
  
        return {
          uuid: coupon.uuid,
          code: coupon.code,
          name: coupon.name || '할인 쿠폰',
          startDate: startDateStr,
          endDate: endDateStr,
          discountType: coupon.discountType || 'percentage',
          discountValue,
          isActive: coupon.isActive ?? true,
          applicableRoomType: coupon.applicableRoomType, // 단일 필드 추가
          applicableRoomTypes: Array.isArray(coupon.applicableRoomTypes)
            ? coupon.applicableRoomTypes.filter(
                (roomType) => roomType && roomType.trim()
              )
            : [],
          maxUses: coupon.maxUses ? parseInt(coupon.maxUses, 10) : null,
          stackWithEvents: coupon.stackWithEvents ?? false,
          usedCount: coupon.usedCount || 0,
          condition: coupon.condition || {
            type: 'none',
            value: null,
            minPrice: null,
            maxPrice: null,
          },
          isRandom: coupon.isRandom || false,
          randomMin: coupon.isRandom ? parseFloat(coupon.randomMin) : null,
          randomMax: coupon.isRandom ? parseFloat(coupon.randomMax) : null,
          autoValidity: coupon.autoValidity ?? true,
          validityDays: coupon.autoValidity
            ? parseInt(coupon.validityDays, 10)
            : null,
          autoDistribute: coupon.autoDistribute || false,
        };
      });
  
      const uuids = formattedCoupons.map((coupon) => coupon.uuid);
      if (new Set(uuids).size !== uuids.length) {
        throw new Error(
          language === 'kor'
            ? '중복된 쿠폰 UUID가 있습니다.'
            : 'Duplicate coupon UUIDs detected.'
        );
      }
  
      const codes = formattedCoupons.map((coupon) => coupon.code);
      if (new Set(codes).size !== codes.length) {
        throw new Error(
          language === 'kor'
            ? '중복된 쿠폰 코드가 있습니다.'
            : 'Duplicate coupon codes detected.'
        );
      }
  
      const payload = {
        coupons: formattedCoupons,
      };
  
      console.log('[handleSaveCoupons] Sending payload:', payload);
  
      const updatedSettings = await updateHotelSettings(hotelId, payload);
      console.log('[handleSaveCoupons] Updated Settings:', updatedSettings);
  
      setMessage(
        language === 'kor'
          ? '쿠폰이 저장되었습니다.'
          : 'Coupons saved successfully'
      );
      setError('');
      setTimeout(() => setMessage(''), 5000);
    } catch (err) {
      console.error('[handleSaveCoupons] Error:', {
        message: err.message,
        response: err.response,
        request: err.request,
      });
      setError(
        language === 'kor'
          ? `쿠폰 저장 실패: ${err.message}${
              err.response ? ` (상태 코드: ${err.response.status})` : ''
            }`
          : `Failed to save coupons: ${err.message}${
              err.response ? ` (Status code: ${err.response.status})` : ''
            }`
      );
      setMessage('');
    }
  };

  const handleCancel = () => {
    if (!originalDataRef.current) return;
    const orig = originalDataRef.current;
    setHotelId(orig.hotelId);
    setIsExisting(orig.isExisting);
    setTotalRooms(orig.totalRooms);
    setRoomTypes(orig.roomTypes);
    setFloors(orig.floors);
    setAmenities(orig.amenities);
    setHotelAddress(orig.hotelAddress);
    setEmail(orig.email);
    setPhoneNumber(orig.phoneNumber);
    setHotelName(orig.hotelName);
    setCoordinates(orig.coordinates);
    setCoupons(orig.coupons);
    alert('변경 사항이 취소되었습니다.');
  };

  return (
    <div className="hotel-settings-page" aria-label="호텔 설정 페이지">
      <h1>HOTEL BASIC SETTINGS</h1>
      <div className="hotel-settings-button-group">
        <button
          className="hotel-settings-btn"
          onClick={() => navigate('/')}
          aria-label="메인 페이지로 이동"
        >
          메인으로
        </button>
        {!isExisting && (
          <button
            className="hotel-settings-btn default-load-btn"
            onClick={handleLoadDefault}
            aria-label="디폴트 설정 불러오기"
            style={{
              backgroundColor: '#4CAF50',
              color: 'white',
              fontWeight: 'bold',
            }}
          >
            {language === 'kor'
              ? '디폴트 설정 불러오기'
              : 'Load Default Settings'}
          </button>
        )}
        <button
          className="hotel-settings-btn"
          onClick={handleCancel}
          aria-label="변경 사항 취소"
        >
          취소
        </button>
        <button
          className="hotel-settings-btn"
          onClick={toggleLanguage}
          aria-label="언어 전환"
        >
          {language === 'kor' ? 'English' : '한국어'}
        </button>
        <button
          className="hotel-settings-btn-chrome"
          onClick={() =>
            window.open(
              'https://chromewebstore.google.com/detail/ota-scraper-extension/cnoicicjafgmfcnjclhlehfpojfaelag?authuser=0&hl=ko',
              '_blank'
            )
          }
          aria-label="크롬 확장 프로그램 설치"
        >
          크롬확장설치
        </button>
      </div>
      {error && (
        <p
          className={
            error.includes('초기 설정이 필요합니다') ||
            error.includes('Initial setup is required') ||
            error.includes('레이아웃 탭에서')
              ? 'info-message'
              : 'error-message'
          }
          role="alert"
          style={{
            color:
              error.includes('초기 설정이 필요합니다') ||
              error.includes('Initial setup is required') ||
              error.includes('레이아웃 탭에서')
                ? '#4CAF50'
                : 'red',
            fontWeight: 'bold',
            textAlign: 'center',
            margin: '20px 0',
          }}
        >
          {error}
          {(error.includes('초기 설정이 필요합니다') ||
            error.includes('Initial setup is required') ||
            error.includes('레이아웃 탭에서')) && (
            <span>
              {' '}
              {language === 'kor'
                ? '위의 "디폴트 설정 불러오기" 버튼을 눌러 시작하거나, 레이아웃 탭에서 직접 설정을 추가하세요.'
                : 'Click the "Load Default Settings" button above to get started, or add settings directly in the Layout tab.'}
            </span>
          )}
        </p>
      )}
      <nav className="tabs">
        <button
          className={activeTab === 'info' ? 'active' : ''}
          onClick={() => setActiveTab('info')}
        >
          호텔 정보
        </button>
        <button
          className={activeTab === 'roomTypes' ? 'active' : ''}
          onClick={() => setActiveTab('roomTypes')}
        >
          객실 타입
        </button>
        <button
          className={activeTab === 'layout' ? 'active' : ''}
          onClick={() => setActiveTab('layout')}
        >
          레이아웃
        </button>
        <button
          className={activeTab === 'amenities' ? 'active' : ''}
          onClick={() => setActiveTab('amenities')}
        >
          시설
        </button>
        <button
          className={activeTab === 'photos' ? 'active' : ''}
          onClick={() => setActiveTab('photos')}
        >
          사진 업로드
        </button>
        <button
          className={activeTab === 'events' ? 'active' : ''}
          onClick={() => setActiveTab('events')}
        >
          이벤트 설정
        </button>
        <button
          className={activeTab === 'coupons' ? 'active' : ''}
          onClick={() => setActiveTab('coupons')}
        >
          {language === 'kor' ? '쿠폰 발행' : 'Coupon Issuance'}
        </button>
      </nav>
      <div className="tab-content">
        {activeTab === 'info' && (
          <HotelInfoSection
            hotelId={hotelId}
            setHotelId={setHotelId}
            isExisting={isExisting}
            hotelName={hotelName}
            setHotelName={setHotelName}
            totalRooms={totalRooms}
            hotelAddress={hotelAddress}
            setHotelAddress={setHotelAddress}
            email={email}
            setEmail={setEmail}
            phoneNumber={phoneNumber}
            setPhoneNumber={setPhoneNumber}
            checkInTime={checkInTime}
            setCheckInTime={setCheckInTime}
            checkOutTime={checkOutTime}
            setCheckOutTime={setCheckOutTime}
            onSave={handleSaveHotelInfo}
            onCancel={handleCancel}
            onCoordinatesUpdate={handleCoordinatesUpdate}
            initialCoordinates={coordinates}
          />
        )}
        {activeTab === 'roomTypes' && (
          <RoomTypeEditor
            roomTypes={roomTypes}
            setRoomTypes={setRoomTypes}
            amenities={amenities}
            onSave={handleSaveRoomTypes}
          />
        )}
        {activeTab === 'layout' && (
          <DndProvider backend={HTML5Backend}>
            <LayoutEditor
              roomTypes={roomTypes}
              setRoomTypes={setRoomTypes}
              floors={floors}
              setFloors={setFloors}
              onSave={handleSaveLayout}
            />
          </DndProvider>
        )}
        {activeTab === 'amenities' && (
          <AmenitiesSection
            amenities={amenities}
            setAmenities={setAmenities}
            roomTypes={roomTypes}
            setRoomTypes={setRoomTypes}
            onSave={handleSaveAmenities}
            language={language}
          />
        )}
        {activeTab === 'photos' && (
          <PhotoUploadSection
            hotelId={hotelId}
            roomTypes={roomTypes}
            hotelInfo={hotelInfo}
            language={language}
          />
        )}
        {activeTab === 'events' && (
          <EventSettingsSection
            language={language}
            events={events}
            setEvents={setEvents}
            roomTypes={roomTypes}
            onEventsChange={handleSaveEvents}
          />
        )}
        {activeTab === 'coupons' && (
          <CouponSettingsSection
            language={language}
            coupons={coupons}
            setCoupons={setCoupons}
            roomTypes={roomTypes}
            onCouponsChange={handleSaveCoupons}
            hotelId={hotelId}
          />
        )}
      </div>
      <div className="save-section">
        {activeTab === 'info' && (
          <button
            className="hotel-settings-btn save-btn"
            onClick={handleSaveHotelInfo}
          >
            호텔 정보 저장
          </button>
        )}
        {activeTab === 'roomTypes' && (
          <button
            className="hotel-settings-btn save-btn"
            onClick={handleSaveRoomTypes}
          >
            객실 타입 저장
          </button>
        )}
        {activeTab === 'layout' && (
          <button
            className="hotel-settings-btn save-btn"
            onClick={handleSaveLayout}
          >
            레이아웃 저장
          </button>
        )}
        {activeTab === 'amenities' && (
          <button
            className="hotel-settings-btn save-btn"
            onClick={handleSaveAmenities}
          >
            시설 저장
          </button>
        )}
        {/* 이벤트 및 쿠폰 탭에서는 저장 버튼 제거 */}
      </div>
      {message && <p className="success-message">{message}</p>}
      {error && <p className="error-message">{error}</p>}
    </div>
  );
}

export { HotelSettingsPage };
