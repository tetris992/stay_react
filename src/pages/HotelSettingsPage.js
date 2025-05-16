// frontend/src/pages/HotelSettingsPage.js

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Chart } from 'chart.js/auto';
import { normalizeRoomType } from '../utils/couponUtils';
import api, {
  fetchHotelSettings,
  updateHotelSettings,
  registerHotel,
  fetchUserInfo,
  updateUser,
  searchCustomers,
  fetchUsedCoupons,
  issueTargetedCoupon,
  deleteExpiredCoupons,
  fetchLoyaltyCoupons,
  saveLoyaltyCoupons,
  uploadHotelPhotos,
} from '../api/api';
import DEFAULT_AMENITIES from '../config/defaultAmenities';
import iconMap from '../config/iconMap';
import { getColorForRoomType } from '../utils/getColorForRoomType';
import extractCoordinates from './extractCoordinates';
import { format, addDays, subMonths } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { parseDate, formatDate } from '../utils/dateParser';
import {
  FaBed,
  FaMinus,
  FaPlus,
  FaTrash,
  FaCamera,
  FaMapMarkerAlt,
  FaPlusSquare,
  FaUndo,
} from 'react-icons/fa';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { v4 as uuidv4 } from 'uuid';
import './HotelSettingsPage.css';
import { buildRoomTypesWithNumbers } from '../utils/roomUtils'; // 기존 함수 사용

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
const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB
const MAX_RESOLUTION = { width: 2048, height: 2048 }; // 1440x1440

function AmenitiesSection({
  amenities,
  setAmenities,
  roomTypes,
  setRoomTypes,
  language, // onSave prop 제거
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
            type: 'in-room', // 강제로 in-room 설정
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
      updated[roomIndex] = {
        ...updated[roomIndex],
        roomAmenities: updated[roomIndex].roomAmenities.map((amenity) =>
          amenity.nameKor === amenityNameKor
            ? { ...amenity, type: 'in-room', isActive: !amenity.isActive }
            : { ...amenity, type: 'in-room' }
        ),
      };

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
      {/* 저장 버튼 제거: HotelSettingsPage의 save-section에서 관리 */}
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

function RoomTypeEditor({
  hotelId,
  roomTypes,
  setRoomTypes,
  floors,
  amenities,
  onSave,
  language = 'kor',
}) {
  // 수정: floors 변경 시 roomNumbers 동기화
  useEffect(() => {
    const containers = floors.flatMap((floor) => floor.containers || []);
    setRoomTypes((prev) => {
      const updated = buildRoomTypesWithNumbers(prev, containers);
      console.log('[RoomTypeEditor] Synced roomNumbers:', updated);
      return updated;
    });
  }, [floors, setRoomTypes]);

  // 삭제: roomNumbersBackup 초기화 및 복구 관련 useEffect 제거
  // 삭제: restoreRoomNumbers 함수 제거

  const addRoomType = () => {
    // 기존 객실에서 roomAmenities 설정 복사
    const baseRoomType = roomTypes.find((rt) => rt.isBaseRoom) || roomTypes[0]; // 기본 객실 또는 첫 번째 객실 참조
    const copiedRoomAmenities = baseRoomType
      ? baseRoomType.roomAmenities.map((amenity) => ({
          nameKor: amenity.nameKor,
          nameEng: amenity.nameEng,
          icon: amenity.icon,
          type: 'in-room',
          isActive: amenity.isActive, // 기존 설정 유지
        }))
      : amenities
          .filter((a) => a.type === 'in-room')
          .map((a) => ({
            nameKor: a.nameKor,
            nameEng: a.nameEng,
            icon: a.icon,
            type: 'in-room',
            isActive: false, // 기본값으로 초기화
          }));

    setRoomTypes((prev) => [
      ...prev,
      {
        id: uuidv4(),
        roomInfo: `room-${Date.now()}`,
        nameKor: '',
        nameEng: '',
        price: 0,
        stock: 0,
        aliases: ['', '', '', ''],
        roomNumbers: [],
        floorSettings: floors.reduce((acc, floor) => {
          acc[floor.floorNum] = 0;
          return acc;
        }, {}),
        startRoomNumbers: floors.reduce((acc, floor) => {
          acc[floor.floorNum] = '';
          return acc;
        }, {}),
        roomAmenities: copiedRoomAmenities, // 복사된 설정 적용
        photos: [],
        discount: 0,
        fixedDiscount: 0,
      },
    ]);

    // 공통 시설은 초기화하지 않음 (기존 상태 유지)
    // 사용자 알림 제거
  };

  const updateRoomType = (index, field, value, aliasIndex = null) => {
    setRoomTypes((prev) => {
      const updated = [...prev];
      const room = updated[index];
      if (field === 'price') {
        const numValue = Number(value);
        if (isNaN(numValue) && value !== '') {
          alert(
            language === 'kor'
              ? '유효한 가격을 입력해주세요.'
              : 'Please enter a valid price.'
          );
          return prev;
        }
        room.price = numValue || 0;
      } else if (field === 'nameKor' || field === 'nameEng') {
        room[field] = value;
        room.roomInfo = (
          field === 'nameEng' && value
            ? value
            : field === 'nameKor' && value && !room.nameEng
            ? value
            : room.nameEng || room.nameKor || room.roomInfo
        ).toLowerCase();
      } else if (field === 'aliases' && aliasIndex !== null) {
        room.aliases[aliasIndex] = value;
      }
      return updated;
    });
  };

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

  const removeRoomType = (index) => {
    setRoomTypes((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <section
      className="room-types-section"
      aria-label={
        language === 'kor'
          ? '객실 타입 설정 섹션'
          : 'Room Types Settings Section'
      }
    >
      <h2>{language === 'kor' ? '◉ 공통 시설' : '◉ Common Facilities'}</h2>
      <div className="common-amenities-section">
        <div className="common-amenities-container">
          {amenities
            .filter((amenity) => amenity.type === 'on-site' && amenity.isActive)
            .map((amenity, idx) => (
              <span
                key={`common-amenity-${idx}`}
                className="common-amenity-item"
              >
                {iconMap[amenity.icon] || <span>❓</span>}
                <span title={amenity.nameEng}>
                  {language === 'kor' ? amenity.nameKor : amenity.nameEng}
                </span>
              </span>
            ))}
        </div>
      </div>

      <h2>{language === 'kor' ? '◉ 객실 타입' : '◉ Room Types'}</h2>
      <div className="room-types-container">
        {roomTypes.map((rt, idx) => (
          <div key={rt.id || idx} className="room-type-item">
            <div className="room-type-header">
              <FaBed />{' '}
              {language === 'kor'
                ? `객실 타입 ${idx + 1}`
                : `Room Type ${idx + 1}`}
              <button
                className="remove-btn"
                onClick={() => removeRoomType(idx)}
                aria-label={
                  language === 'kor'
                    ? `객실 타입 ${idx + 1} 삭제`
                    : `Delete Room Type ${idx + 1}`
                }
              >
                <FaTrash />
              </button>
            </div>
            <div className="room-type-fields">
              <div className="field-row">
                <input
                  className="name-kor"
                  type="text"
                  placeholder={language === 'kor' ? '한글 이름' : 'Korean Name'}
                  value={rt.nameKor || ''}
                  onChange={(e) =>
                    updateRoomType(idx, 'nameKor', e.target.value)
                  }
                  aria-label={
                    language === 'kor' ? '한글 이름 입력' : 'Korean Name Input'
                  }
                />
                <input
                  className="name-eng"
                  type="text"
                  placeholder={
                    language === 'kor' ? '영어 이름' : 'English Name'
                  }
                  value={rt.nameEng || ''}
                  onChange={(e) =>
                    updateRoomType(idx, 'nameEng', e.target.value)
                  }
                  aria-label={
                    language === 'kor' ? '영어 이름 입력' : 'English Name Input'
                  }
                />
              </div>
              <div className="field-row price-row">
                <div className="price-input-container">
                  <input
                    className="price"
                    type="number"
                    placeholder={language === 'kor' ? '가격' : 'Price'}
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
                    aria-label={
                      language === 'kor' ? '가격 입력' : 'Price Input'
                    }
                  />
                  <div className="price-buttons">
                    <button
                      className="price-btn increment"
                      onClick={() => incrementPrice(idx)}
                      aria-label={
                        language === 'kor' ? '가격 증가' : 'Increase Price'
                      }
                    >
                      <FaPlus />
                    </button>
                    <button
                      className="price-btn decrement"
                      onClick={() => decrementPrice(idx)}
                      aria-label={
                        language === 'kor' ? '가격 감소' : 'Decrease Price'
                      }
                    >
                      <FaMinus />
                    </button>
                  </div>
                </div>
                <input
                  className="stock"
                  type="number"
                  placeholder={language === 'kor' ? '객실 수' : 'Room Count'}
                  value={rt.stock || 0}
                  readOnly
                  style={{ marginLeft: '10px' }}
                  aria-label={language === 'kor' ? '객실 수' : 'Room Count'}
                />
              </div>
            </div>
            <div
              className="room-type-aliases"
              aria-label={
                language === 'kor' ? '별칭 입력 섹션' : 'Alias Input Section'
              }
            >
              <div className="field-row">
                <input
                  type="text"
                  placeholder={language === 'kor' ? '별칭 1' : 'Alias 1'}
                  value={rt.aliases[0] || ''}
                  onChange={(e) =>
                    updateRoomType(idx, 'aliases', e.target.value, 0)
                  }
                  aria-label={
                    language === 'kor' ? '별칭 1 입력' : 'Alias 1 Input'
                  }
                />
                <input
                  type="text"
                  placeholder={language === 'kor' ? '별칭 2' : 'Alias 2'}
                  value={rt.aliases[1] || ''}
                  onChange={(e) =>
                    updateRoomType(idx, 'aliases', e.target.value, 1)
                  }
                  aria-label={
                    language === 'kor' ? '별칭 2 입력' : 'Alias 2 Input'
                  }
                />
              </div>
              <div className="field-row">
                <input
                  type="text"
                  placeholder={language === 'kor' ? '별칭 3' : 'Alias 3'}
                  value={rt.aliases[2] || ''}
                  onChange={(e) =>
                    updateRoomType(idx, 'aliases', e.target.value, 2)
                  }
                  aria-label={
                    language === 'kor' ? '별칭 3 입력' : 'Alias 3 Input'
                  }
                />
                <input
                  type="text"
                  placeholder={language === 'kor' ? '별칭 4' : 'Alias 4'}
                  value={rt.aliases[3] || ''}
                  onChange={(e) =>
                    updateRoomType(idx, 'aliases', e.target.value, 3)
                  }
                  aria-label={
                    language === 'kor' ? '별칭 4 입력' : 'Alias 4 Input'
                  }
                />
              </div>
            </div>
            <div
              className="room-numbers"
              aria-label={
                language === 'kor' ? '객실 번호 목록' : 'Room Numbers List'
              }
            >
              <h4>
                {language === 'kor' ? '객실 번호 배열' : 'Room Numbers Array'}
              </h4>
              <div>
                {rt.roomNumbers?.length > 0
                  ? rt.roomNumbers.join(', ')
                  : language === 'kor'
                  ? '아직 생성되지 않음'
                  : 'Not yet generated'}
              </div>
            </div>
            <div
              className="room-amenities-display"
              aria-label={
                language === 'kor'
                  ? '활성화된 객실 시설'
                  : 'Activated Room Amenities'
              }
            >
              <h4>
                {language === 'kor'
                  ? '활성화된 객실 시설'
                  : 'Activated Room Amenities'}
              </h4>
              <div className="amenities-list">
                {rt.roomAmenities
                  .filter((amenity) => amenity.isActive)
                  .map((amenity, aIdx) => (
                    <span key={aIdx} className="amenity-item">
                      {iconMap[amenity.icon] || <span>❓</span>}
                      <span title={amenity.nameEng}>
                        {language === 'kor' ? amenity.nameKor : amenity.nameEng}
                      </span>
                    </span>
                  ))}
                {rt.roomAmenities.every((amenity) => !amenity.isActive) && (
                  <span>
                    {language === 'kor'
                      ? '활성화된 시설이 없습니다.'
                      : 'No amenities activated.'}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div
        className="room-type-actions"
        style={{ textAlign: 'right', marginTop: '1rem' }}
      >
        <button
          className="hotel-settings-room-add-btn"
          onClick={addRoomType}
          aria-label={language === 'kor' ? '객실 타입 추가' : 'Add Room Type'}
        >
          {language === 'kor' ? '+ 타입 추가' : '+ Add Type'}
        </button>
        <button
          className="hotel-settings-btn save-btn"
          onClick={onSave}
          style={{ marginLeft: 16 }}
          aria-label={language === 'kor' ? '객실 타입 저장' : 'Save Room Types'}
        >
          <FaPlusSquare /> {language === 'kor' ? '저장' : 'Save'}
        </button>
        {/* 삭제: 복구 버튼 제거 */}
      </div>
    </section>
  );
}

function LayoutEditor({
  hotelId,
  roomTypes,
  setRoomTypes,
  floors,
  setFloors,
  onSave,
  language = 'kor',
}) {
  const previousFloorsRef = useRef([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const addFloor = () => {
    if (isAdding) return;
    setIsAdding(true);
    try {
      const maxFloorNum =
        floors.length > 0 ? Math.max(...floors.map((f) => f.floorNum)) : 0;
      const newFloorNum = maxFloorNum + 1;
      if (newFloorNum < 1) {
        alert(
          language === 'kor'
            ? '층 번호는 1 이상이어야 합니다.'
            : 'Floor number must be 1 or greater.'
        );
        return;
      }
      setFloors((prev) => {
        const updated = [...prev, { floorNum: newFloorNum, containers: [] }];
        console.log('[LayoutEditor] Added floor:', updated);
        return updated;
      });
    } catch (error) {
      console.error('[LayoutEditor] Error adding floor:', error);
      alert(
        language === 'kor'
          ? '층 추가 중 오류가 발생했습니다.'
          : 'Error adding floor.'
      );
    } finally {
      setIsAdding(false);
    }
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
          roomNumbersBackup: rt.roomNumbers.filter(
            (num) => !num.startsWith(String(floorNum))
          ),
        }))
      );
      console.log('[LayoutEditor] Removed floor:', updated);
      return updated;
    });
  };

  const undoRemoveFloor = () => {
    if (previousFloorsRef.current.length > 0) {
      setFloors([...previousFloorsRef.current]);
      previousFloorsRef.current = [];
      alert(
        language === 'kor'
          ? '층 삭제가 취소되었습니다.'
          : 'Floor deletion undone.'
      );
    } else {
      alert(
        language === 'kor' ? '되돌릴 삭제가 없습니다.' : 'No deletion to undo.'
      );
    }
  };

  const addContainer = (floorNum) => {
    if (isAdding || roomTypes.length === 0) {
      alert(
        language === 'kor'
          ? '먼저 객실 타입을 추가해주세요.'
          : 'Please add a room type first.'
      );
      return;
    }
    setIsAdding(true);
    try {
      const defaultRoomType = roomTypes[0];
      let newRoomNumber;
      setFloors((prev) => {
        const updated = [...prev];
        const floorIdx = updated.findIndex((f) => f.floorNum === floorNum);
        if (floorIdx === -1) return prev;
        const activeRooms = updated[floorIdx].containers.filter(
          (c) => c.roomInfo && c.roomNumber && c.isActive
        );
        const allRooms = updated.flatMap((f) =>
          f.containers.filter((c) => c.roomInfo && c.roomNumber && c.isActive)
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
          price: defaultRoomType.price || 0,
          isActive: true,
        };
        if (!existingNumbers.has(newRoomNumber)) {
          updated[floorIdx].containers.push(newContainer);
          updated[floorIdx].containers.sort(
            (a, b) => parseInt(a.roomNumber, 10) - parseInt(b.roomNumber, 10)
          );
        }
        console.log('[LayoutEditor] Added container:', updated);
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
          updatedTypes[typeIdx].roomNumbersBackup = [
            ...updatedTypes[typeIdx].roomNumbers,
          ];
        }
        return updatedTypes;
      });
    } catch (error) {
      console.error('[LayoutEditor] Error adding room:', error);
      alert(
        language === 'kor'
          ? '객실 추가 중 오류가 발생했습니다.'
          : 'Error adding room.'
      );
    } finally {
      setIsAdding(false);
    }
  };

  const updateContainer = (floorNum, containerId, field, value) => {
    setFloors((prev) => {
      const updated = [...prev];
      const floorIdx = updated.findIndex((f) => f.floorNum === floorNum);
      if (floorIdx === -1) {
        console.log(`[updateContainer] Floor ${floorNum} not found`);
        return prev;
      }
      const containerIdx = updated[floorIdx].containers.findIndex(
        (c) => c.containerId === containerId
      );
      if (containerIdx === -1) {
        console.log(`[updateContainer] Container ${containerId} not found`);
        return prev;
      }
      const container = updated[floorIdx].containers[containerIdx];
      const oldRoomInfo = container.roomInfo;
      const oldRoomNumber = container.roomNumber;
      if (field === 'price') {
        const numValue = Number(value);
        if (isNaN(numValue) && value !== '') {
          alert(
            language === 'kor'
              ? '유효한 가격을 입력해주세요.'
              : 'Please enter a valid price.'
          );
          return prev;
        }
        container[field] = numValue || 0;
      } else if (field === 'roomInfo') {
        if (!value) {
          alert(
            language === 'kor'
              ? '객실 타입을 선택해주세요.'
              : 'Please select a room type.'
          );
          return prev;
        }
        container[field] = value;
        const matchingType = roomTypes.find((rt) => rt.roomInfo === value);
        container.price = matchingType ? matchingType.price : 0;
        setRoomTypes((prevTypes) => {
          const updatedTypes = [...prevTypes];
          if (oldRoomInfo && oldRoomNumber) {
            const oldIdx = updatedTypes.findIndex(
              (rt) => rt.roomInfo === oldRoomInfo
            );
            if (oldIdx !== -1) {
              updatedTypes[oldIdx].roomNumbers = updatedTypes[
                oldIdx
              ].roomNumbers.filter((num) => num !== oldRoomNumber);
              updatedTypes[oldIdx].stock =
                updatedTypes[oldIdx].roomNumbers.length;
              updatedTypes[oldIdx].roomNumbersBackup = [
                ...updatedTypes[oldIdx].roomNumbers,
              ];
            }
          }
          if (oldRoomNumber) {
            const newIdx = updatedTypes.findIndex(
              (rt) => rt.roomInfo === value
            );
            if (
              newIdx !== -1 &&
              !updatedTypes[newIdx].roomNumbers.includes(oldRoomNumber)
            ) {
              updatedTypes[newIdx].roomNumbers.push(oldRoomNumber);
              updatedTypes[newIdx].roomNumbers.sort(
                (a, b) => parseInt(a, 10) - parseInt(b, 10)
              );
              updatedTypes[newIdx].stock =
                updatedTypes[newIdx].roomNumbers.length;
              updatedTypes[newIdx].roomNumbersBackup = [
                ...updatedTypes[newIdx].roomNumbers,
              ];
            }
          }
          return updatedTypes;
        });
      } else if (field === 'roomNumber') {
        if (!value || value.trim() === '') {
          alert(
            language === 'kor'
              ? '객실 번호를 입력해주세요.'
              : 'Please enter a room number.'
          );
          return prev;
        }
        if (!/^\d+$/.test(value)) {
          alert(
            language === 'kor'
              ? '객실 번호는 숫자만 입력해주세요.'
              : 'Room number must be numeric.'
          );
          return prev;
        }
        if (value.length < 3) {
          alert(
            language === 'kor'
              ? '객실 번호는 최소 3자리여야 합니다.'
              : 'Room number must be at least 3 digits.'
          );
          return prev;
        }
        const floorPrefix = String(floorNum);
        if (!value.startsWith(floorPrefix)) {
          alert(
            language === 'kor'
              ? `객실 번호는 층 번호(${floorNum})로 시작해야 합니다.`
              : `Room number must start with floor number (${floorNum}).`
          );
          return prev;
        }
        const existingNumbers = updated[floorIdx].containers
          .filter((c, idx) => idx !== containerIdx)
          .map((c) => c.roomNumber);
        if (existingNumbers.includes(value)) {
          alert(
            language === 'kor'
              ? '객실 번호가 중복되었습니다.'
              : 'Room number is duplicated.'
          );
          return prev;
        }
        container[field] = value;
        setRoomTypes((prevTypes) => {
          const updatedTypes = [...prevTypes];
          const typeIdx = updatedTypes.findIndex(
            (rt) => rt.roomInfo === container.roomInfo
          );
          if (typeIdx !== -1) {
            updatedTypes[typeIdx].roomNumbers = updatedTypes[
              typeIdx
            ].roomNumbers.map((num) => (num === oldRoomNumber ? value : num));
            updatedTypes[typeIdx].stock =
              updatedTypes[typeIdx].roomNumbers.length;
            updatedTypes[typeIdx].roomNumbersBackup = [
              ...updatedTypes[typeIdx].roomNumbers,
            ];
          }
          return updatedTypes;
        });
      } else if (field === 'isActive') {
        container[field] = value;
        setRoomTypes((prevTypes) => {
          const updatedTypes = [...prevTypes];
          const typeIdx = updatedTypes.findIndex(
            (rt) => rt.roomInfo === container.roomInfo
          );
          if (typeIdx !== -1 && oldRoomNumber) {
            if (!value) {
              updatedTypes[typeIdx].roomNumbers = updatedTypes[
                typeIdx
              ].roomNumbers.filter((num) => num !== oldRoomNumber);
            } else if (
              !updatedTypes[typeIdx].roomNumbers.includes(oldRoomNumber)
            ) {
              updatedTypes[typeIdx].roomNumbers.push(oldRoomNumber);
              updatedTypes[typeIdx].roomNumbers.sort(
                (a, b) => parseInt(a, 10) - parseInt(b, 10)
              );
            }
            updatedTypes[typeIdx].stock =
              updatedTypes[typeIdx].roomNumbers.length;
            updatedTypes[typeIdx].roomNumbersBackup = [
              ...updatedTypes[typeIdx].roomNumbers,
            ];
          }
          return updatedTypes;
        });
      }
      updated[floorIdx].containers.sort(
        (a, b) => parseInt(a.roomNumber, 10) - parseInt(b.roomNumber, 10)
      );
      console.log('[LayoutEditor] Updated container:', updated);
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
      console.log('[LayoutEditor] Incremented price:', updated);
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
      console.log('[LayoutEditor] Decremented price:', updated);
      return updated;
    });
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
            updatedTypes[typeIdx].roomNumbersBackup = [
              ...updatedTypes[typeIdx].roomNumbers,
            ];
          }
          return updatedTypes;
        });
      }
      console.log('[LayoutEditor] Removed container:', updated);
      return updated;
    });
  };

  const generateLayout = () => {
    if (isGenerating || roomTypes.length === 0) {
      alert(
        language === 'kor'
          ? '먼저 객실 타입을 추가해주세요.'
          : 'Please add a room type first.'
      );
      return;
    }
    // 중첩 제거: 기존 floors 완전 초기화
    setFloors([]);
    setIsGenerating(true);
    try {
      const defaultRoomType = roomTypes[0];
      const newFloors = Array.from({ length: 15 }, (_, i) => {
        const floorNum = i + 1; // 초기 1~15층
        const containers = Array.from({ length: 6 }, (_, j) => {
          const roomNumber = `${floorNum}${String(j + 1).padStart(2, '0')}`;
          const kstNow = toZonedTime(new Date(), 'Asia/Seoul');
          return {
            containerId: `${floorNum}-${
              defaultRoomType.roomInfo
            }-${roomNumber}-${kstNow.getTime()}-${uuidv4()}`,
            roomInfo: defaultRoomType.roomInfo,
            roomNumber,
            price: defaultRoomType.price || 0,
            isActive: true,
          };
        });
        return { floorNum, containers };
      });

      setFloors(newFloors);
      setRoomTypes((prevTypes) => {
        const updatedTypes = [...prevTypes];
        const typeIdx = updatedTypes.findIndex(
          (rt) => rt.roomInfo === defaultRoomType.roomInfo
        );
        if (typeIdx !== -1) {
          const allRoomNumbers = newFloors
            .flatMap((floor) => floor.containers.map((c) => c.roomNumber))
            .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
          updatedTypes[typeIdx].roomNumbers = allRoomNumbers;
          updatedTypes[typeIdx].roomNumbersBackup = allRoomNumbers;
          updatedTypes[typeIdx].stock = allRoomNumbers.length;
        }
        return updatedTypes;
      });
      console.log('[LayoutEditor] Generated layout:', newFloors);
      alert(
        language === 'kor'
          ? '초기 레이아웃이 생성되었습니다: 1층부터 15층까지, 각 층에 6개의 객실.'
          : 'Initial layout generated: Floors 1 to 15, each with 6 rooms.'
      );
    } catch (error) {
      console.error('[LayoutEditor] Error generating layout:', error);
      alert(
        language === 'kor'
          ? '레이아웃 생성 중 오류가 발생했습니다.'
          : 'Error generating layout.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <section
      className="layout-editor-section"
      aria-label={
        language === 'kor'
          ? '객실 레이아웃 편집 섹션'
          : 'Room Layout Editor Section'
      }
    >
      <div className="layout-header">
        <h2>
          {language === 'kor' ? '◉ 객실 레이아웃 편집' : '◉ Room Layout Editor'}
        </h2>
        <button
          className="hotel-settings-btn generate-btn"
          onClick={generateLayout}
          disabled={isGenerating}
          title={
            language === 'kor'
              ? '초기 레이아웃 생성'
              : 'Generate Initial Layout'
          }
          aria-label={
            language === 'kor'
              ? '초기 레이아웃 생성'
              : 'Generate Initial Layout'
          }
        >
          {language === 'kor'
            ? '초기 레이아웃 생성'
            : 'Generate Initial Layout'}
        </button>
        <button
          className="hotel-settings-btn undo-btn"
          onClick={undoRemoveFloor}
          title={language === 'kor' ? '되돌리기' : 'Undo'}
          aria-label={language === 'kor' ? '삭제 되돌리기' : 'Undo Deletion'}
        >
          <FaUndo />
        </button>
        <button
          className="hotel-settings-btn add-floor-btn"
          onClick={addFloor}
          disabled={isAdding}
          title={language === 'kor' ? '층 추가' : 'Add Floor'}
          aria-label={language === 'kor' ? '층 추가' : 'Add Floor'}
        >
          <FaPlus /> {language === 'kor' ? '층 추가' : 'Add Floor'}
        </button>
      </div>
      <div className="floor-grid">
        {floors
        // .filter((floor) => floor.containers && floor.containers.length > 0)
          .slice()
          .sort((a, b) => b.floorNum - a.floorNum)
          .map((floor) => (
            <div key={floor.floorNum} className="floor-row">
              <div className="floor-header">
                <h3 style={{ marginLeft: '10px', color: 'lightslategray' }}>
                  {floor.floorNum}F
                  <FaMinus
                    onClick={() => removeFloor(floor.floorNum)}
                    className="remove-icon"
                    title={language === 'kor' ? '객실 층 삭제' : 'Delete Floor'}
                    aria-label={
                      language === 'kor'
                        ? `층 ${floor.floorNum} 삭제`
                        : `Delete Floor ${floor.floorNum}`
                    }
                  />
                </h3>
              </div>
              <div className="containers">
                {floor.containers.map((cont, index) => (
                  <div
                    key={cont.containerId}
                    className="container-box"
                    style={{
                      backgroundColor: getColorForRoomType(cont.roomInfo),
                    }}
                  >
                    <select
                      value={cont.roomInfo || ''}
                      onChange={(e) =>
                        updateContainer(
                          floor.floorNum,
                          cont.containerId,
                          'roomInfo',
                          e.target.value
                        )
                      }
                      aria-label={
                        language === 'kor'
                          ? `객실 유형 선택 ${index + 1}`
                          : `Room Type Selection ${index + 1}`
                      }
                    >
                      <option value="" disabled>
                        {language === 'kor' ? '유형 선택' : 'Select Type'}
                      </option>
                      {roomTypes.map((rt) => (
                        <option key={rt.id || rt.roomInfo} value={rt.roomInfo}>
                          {language === 'kor'
                            ? rt.nameKor || rt.roomInfo
                            : rt.nameEng || rt.roomInfo}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={cont.roomNumber || ''}
                      onChange={(e) =>
                        updateContainer(
                          floor.floorNum,
                          cont.containerId,
                          'roomNumber',
                          e.target.value
                        )
                      }
                      placeholder={
                        language === 'kor' ? '객실 번호' : 'Room Number'
                      }
                      aria-label={
                        language === 'kor'
                          ? '객실 번호 입력'
                          : 'Room Number Input'
                      }
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
                          placeholder={language === 'kor' ? '가격' : 'Price'}
                          style={{
                            width: '100px',
                            paddingRight: '0',
                            border: 'none',
                            borderRadius: '0',
                          }}
                          aria-label={
                            language === 'kor' ? '가격 입력' : 'Price Input'
                          }
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
                            aria-label={
                              language === 'kor'
                                ? '가격 증가'
                                : 'Increase Price'
                            }
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
                            aria-label={
                              language === 'kor'
                                ? '가격 감소'
                                : 'Decrease Price'
                            }
                          >
                            <FaMinus />
                          </button>
                        </div>
                      </div>
                    </div>
                    <label>
                      <input
                        type="checkbox"
                        checked={cont.isActive}
                        onChange={(e) =>
                          updateContainer(
                            floor.floorNum,
                            cont.containerId,
                            'isActive',
                            e.target.checked
                          )
                        }
                      />
                      {language === 'kor' ? '활성화' : 'Active'}
                    </label>
                    <button
                      className="hotel-settings-layout-btn delete-btn"
                      onClick={() =>
                        removeContainer(floor.floorNum, cont.containerId)
                      }
                      aria-label={
                        language === 'kor'
                          ? `객실 ${cont.roomNumber} 삭제`
                          : `Delete Room ${cont.roomNumber}`
                      }
                    >
                      <FaTrash />
                    </button>
                  </div>
                ))}
                <button
                  className="hotel-settings-btn add-container-btn"
                  onClick={() => addContainer(floor.floorNum)}
                  disabled={isAdding || roomTypes.length === 0}
                  aria-label={
                    language === 'kor'
                      ? `층 ${floor.floorNum}에 객실 추가`
                      : `Add Room to Floor ${floor.floorNum}`
                  }
                >
                  <FaPlus /> {language === 'kor' ? '객실 추가' : 'Add Room'}
                </button>
              </div>
            </div>
          ))}
      </div>
      <div className="tab-actions">
        <button
          className="hotel-settings-btn save-btn"
          onClick={onSave}
          aria-label={language === 'kor' ? '레이아웃 저장' : 'Save Layout'}
        >
          {language === 'kor' ? '저장' : 'Save'}
        </button>
      </div>
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

  // --- PhotoUploadSection 내부에 넣으시면 됩니다 ---
  const handleUpload = async (category, subCategory) => {
    setError('');
    setMessage('');

    // 1) 해당 카테고리의 file 객체 리스트 가져오기
    let fileObjs;
    if (category === 'room') {
      fileObjs = roomFiles[subCategory];
    } else if (category === 'exterior') {
      fileObjs = exteriorFiles;
    } else if (category === 'facility') {
      fileObjs = facilityFiles[subCategory];
    }

    if (!fileObjs || fileObjs.length === 0) {
      setError(
        language === 'kor' ? '파일을 선택하세요.' : 'Please select a file.'
      );
      return;
    }

    // 2) FormData 구성 (Multer가 'photo' 필드로 받도록)
    const formData = new FormData();
    fileObjs.forEach(({ file, order }, idx) => {
      formData.append('photo', file);
      formData.append('order', order);
    });
    formData.append('hotelId', hotelId);
    formData.append('category', category);
    formData.append('subCategory', subCategory);

    try {
      // 3) uploadHotelPhotos 헬퍼 호출
      const response = await uploadHotelPhotos(formData);
      // axios 헬퍼가 response.data를 반환했다면 아래처럼 꺼내고,
      // 아니라면 response 자체를 newPhotos로 사용합니다.
      const payload = response.data != null ? response.data : response;
      const newPhotos = payload.photos || payload;

      // 4) 상태 업데이트
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
    } catch (err) {
      // 에러 메시지 뿌리기
      const msg = err.response?.data?.message || err.message;
      setError(
        language === 'kor' ? `업로드 실패: ${msg}` : `Upload failed: ${msg}`
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

  const getEventMaxDiscount = (applicableRoomTypes) => {
    return applicableRoomTypes.reduce(
      (acc, roomTypeId) => {
        const m = getMaxDiscount(roomTypeId, new Date());
        return m.value > acc.value ? m : acc;
      },
      { value: 0, type: 'percentage' }
    );
  };

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
          const maxDiscount = getEventMaxDiscount(event.applicableRoomTypes);
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
                      (최대 적용: {maxDiscount.value}
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
  const generateCouponCode = () =>
    `COUPON-${uuidv4().replace(/-/g, '').slice(0, 8).toUpperCase()}`;

  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showCouponForm, setShowCouponForm] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [applyToAll, setApplyToAll] = useState(false);
  const [appliedCoupons, setAppliedCoupons] = useState([]);
  const [selectedRoomTypes, setSelectedRoomTypes] = useState(
    roomTypes.reduce((acc, rt) => {
      if (rt?.roomInfo) acc[rt.roomInfo] = false;
      return acc;
    }, {})
  );
  const [expandedGroups, setExpandedGroups] = useState({});
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [filterType, setFilterType] = useState('issued');
  const [monthlyStats, setMonthlyStats] = useState({});
  // 변경
  const [loyaltySettings, setLoyaltySettings] = useState({
    customCoupons: [],
  });

  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedCustomers, setSelectedCustomers] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  // const [pushCouponUuid, setPushCouponUuid] = useState(null);
  const [visitCountFilter, setVisitCountFilter] = useState({
    min: '',
    max: '',
  });

  const [showTargetForm, setShowTargetForm] = useState(false);
  const [targetCoupon, setTargetCoupon] = useState({
    name: '',
    discountType: 'percentage',
    discountValue: 10,
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
  });

  // 사용된 쿠폰 상태
  const [usedCoupons, setUsedCoupons] = useState([]);
  const [isUsedCouponsLoading, setIsUsedCouponsLoading] = useState(false);
  const [usedCouponsError, setUsedCouponsError] = useState(null);

  const [lastVisitDate, setLastVisitDate] = useState('');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 10;

  const ADMIN_PASSWORD = '1111';

  // 메시지 표시 및 지우기 함수 정의
  const showMessage = (msg, duration = 3000) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), duration);
  };

  useEffect(() => {
    const fetchUsedCouponsData = async () => {
      setIsUsedCouponsLoading(true);
      try {
        const usedCouponsData = await fetchUsedCoupons(hotelId);
        setUsedCoupons(usedCouponsData);
        setUsedCouponsError(null);
      } catch (err) {
        console.error('[fetchUsedCouponsData] Error:', err.message);
        setUsedCouponsError(
          language === 'kor'
            ? '사용된 쿠폰 목록 로드 실패.'
            : 'Failed to load used coupons.'
        );
      } finally {
        setIsUsedCouponsLoading(false);
      }
    };
  
    fetchUsedCouponsData();
  }, [hotelId, language]);

  useEffect(() => {
    const calculateMonthlyStats = () => {
      const stats = {};
      const today = new Date();

      coupons.forEach((coupon) => {
        const issuedAt = parseDate(coupon.issuedAt);
        if (!issuedAt || isNaN(issuedAt.getTime())) return;
        const monthKey = format(issuedAt, 'yyyy-MM');
        if (!stats[monthKey]) {
          stats[monthKey] = { issued: 0, used: 0, deleted: 0 };
        }
        stats[monthKey].issued += 1;
      });

      usedCoupons.forEach((coupon) => {
        const usedAt = parseDate(coupon.usedAt);
        if (!usedAt || isNaN(usedAt.getTime())) return;
        const monthKey = format(usedAt, 'yyyy-MM');
        if (!stats[monthKey]) {
          stats[monthKey] = { issued: 0, used: 0, deleted: 0 };
        }
        stats[monthKey].used += 1;

        const oneMonthAgo = subMonths(today, 1);
        if (usedAt < oneMonthAgo) {
          stats[monthKey].deleted += 1;
        }
      });

      setMonthlyStats(stats);
    };
    calculateMonthlyStats();
  }, [coupons, usedCoupons]);

  // Chart.js를 사용하여 그래프 렌더링
  useEffect(() => {
    const ctx = document.getElementById('coupon-stats-chart')?.getContext('2d');
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
            legend: { position: 'top' },
          },
        },
      });
    };
    createChart();
    return () => {
      if (chartInstance) chartInstance.destroy();
    };
  }, [monthlyStats, language]);

  // 실시간 업데이트를 위한 폴링 (10초마다)
  useEffect(() => {
    const intervalId = setInterval(async () => {
      try {
        const response = await api.get(
          `/api/hotel-settings/${hotelId}/coupons`
        );
        const latestCoupons = response.data.coupons
          .filter((coupon) => !coupon.isDeleted)
          .map((coupon) => ({
            ...coupon,
            startDate: coupon.startDate
              ? format(new Date(coupon.startDate), 'yyyy-MM-dd')
              : coupon.startDate,
            endDate: coupon.endDate
              ? format(new Date(coupon.endDate), 'yyyy-MM-dd')
              : coupon.endDate,
            issuedAt: coupon.issuedAt
              ? format(new Date(coupon.issuedAt), "yyyy-MM-dd'T'HH:mm:ssXXX")
              : coupon.issuedAt,
            usedAt: coupon.usedAt
              ? format(new Date(coupon.usedAt), "yyyy-MM-dd'T'HH:mm:ssXXX")
              : coupon.usedAt,
          }));
        if (JSON.stringify(latestCoupons) !== JSON.stringify(coupons)) {
          setCoupons(latestCoupons);
          if (typeof onCouponsChange === 'function') {
            await onCouponsChange(latestCoupons);
          }
        }
  
        const usedCouponsData = await fetchUsedCoupons(hotelId);
        if (JSON.stringify(usedCouponsData) !== JSON.stringify(usedCoupons)) {
          setUsedCoupons(usedCouponsData);
        }
  
        await deleteExpiredCoupons(hotelId);
      } catch (err) {
        console.error('[pollCoupons] Error:', err);
        setError(
          language === 'kor'
            ? `쿠폰 동기화 중 오류가 발생했습니다: ${err.message}`
            : `Error during coupon sync: ${err.message}`
        );
      }
    }, 10_000);
  
    return () => clearInterval(intervalId);
  }, [hotelId, onCouponsChange, coupons, usedCoupons, language, setCoupons]);

  const initialCoupon = (roomType) => {
    const now = new Date();
    const issuedAt = format(now, "yyyy-MM-dd'T'HH:mm:ssXXX");
    const startDate = format(now, 'yyyy-MM-dd');
    const endDate = format(now, 'yyyy-MM-dd');
    return {
      roomType: roomType && roomType.roomInfo ? roomType.roomInfo : '',
      uuid: generateUniqueId(),
      code: generateCouponCode(),
      name: '',
      startDate,
      endDate,
      discountType: 'percentage',
      discountValue: '',
      couponCount: '',
      issuedAt,
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
              if (rt && rt.roomInfo) acc[rt.roomInfo] = newState ? true : false;
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
    setApplyToAll(false);
  };

  const handleTargetCouponChange = (e) => {
    const { name, value } = e.target;
    if (name === 'discountValue') {
      const parsedValue = parseFloat(value);
      if (isNaN(parsedValue) || parsedValue < 0) {
        setError(
          language === 'kor'
            ? '할인 값은 0 이상이어야 합니다.'
            : 'Discount value must be 0 or greater.'
        );
        return;
      }
      if (targetCoupon.discountType === 'percentage' && parsedValue > 100) {
        setError(
          language === 'kor'
            ? '할인율은 0에서 100 사이여야 합니다.'
            : 'Discount percentage must be between 0 and 100.'
        );
        return;
      }
      setError('');
    }
    setTargetCoupon((prev) => ({
      ...prev,
      [name]: name === 'discountValue' ? parseFloat(value) || 0 : value,
    }));
  };

  const validateCoupon = (coupon, existingCoupons = [], editingUuid = null) => {
    const errors = {
      COUPON_UUID_REQUIRED:
        language === 'kor'
          ? '쿠폰 고유 식별자가 필요합니다.'
          : 'Coupon UUID is required',
      COUPON_CODE_REQUIRED:
        language === 'kor'
          ? '쿠폰 코드를 입력해주세요.'
          : 'Please enter a coupon code',
      COUPON_CODE_DUPLICATED:
        language === 'kor'
          ? '이미 사용 중인 쿠폰 코드입니다.'
          : 'This coupon code is already in use.',
      COUPON_NAME_REQUIRED:
        language === 'kor'
          ? '쿠폰 이름을 입력해주세요.'
          : 'Please enter a coupon name',
      INVALID_DATES:
        language === 'kor'
          ? '유효한 날짜를 입력해주세요.'
          : 'Please enter valid dates',
      END_DATE_INVALID:
        language === 'kor'
          ? '종료일은 시작일보다 이후이거나 같은 날짜여야 합니다.'
          : 'End date must be on or after start date',
      INVALID_DISCOUNT_PERCENTAGE:
        language === 'kor'
          ? '할인율은 0에서 100 사이여야 합니다.'
          : 'Discount percentage must be between 0 and 100.',
      INVALID_DISCOUNT_AMOUNT:
        language === 'kor'
          ? '할인 금액은 0보다 커야 합니다.'
          : 'Discount amount must be greater than 0.',
      DISCOUNT_VALUE_REQUIRED:
        language === 'kor'
          ? '할인 값을 입력해주세요.'
          : 'Please enter a discount value.',
    };

    if (!coupon.uuid) throw new Error(errors.COUPON_UUID_REQUIRED);
    if (!coupon.code?.trim()) throw new Error(errors.COUPON_CODE_REQUIRED);
    if (
      existingCoupons.some(
        (c) => c.code === coupon.code && c.uuid !== editingUuid
      )
    ) {
      throw new Error(errors.COUPON_CODE_DUPLICATED);
    }
    if (!coupon.name?.trim()) throw new Error(errors.COUPON_NAME_REQUIRED);
    if (!coupon.startDate || !coupon.endDate)
      throw new Error(errors.INVALID_DATES);
    const startDate = parseDate(coupon.startDate);
    const endDate = parseDate(coupon.endDate);
    if (
      !startDate ||
      !endDate ||
      isNaN(startDate.getTime()) ||
      isNaN(endDate.getTime())
    ) {
      throw new Error(errors.INVALID_DATES);
    }
    if (startDate > endDate) throw new Error(errors.END_DATE_INVALID);
    const discountValue = parseFloat(coupon.discountValue);
    if (isNaN(discountValue) || discountValue <= 0)
      throw new Error(errors.DISCOUNT_VALUE_REQUIRED);
    if (coupon.discountType === 'percentage' && discountValue > 100) {
      throw new Error(errors.INVALID_DISCOUNT_PERCENTAGE);
    }
    if (coupon.discountType === 'fixed' && discountValue <= 0) {
      throw new Error(errors.INVALID_DISCOUNT_AMOUNT);
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
          ? { ...coupon, startDate, endDate, duration, validityDays: duration }
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

  const addCustomCoupon = () => {
    if (!isAdminAuthenticated) {
      setPendingAction(() => addCustomCoupon);
      setShowPasswordModal(true);
      return;
    }
    setLoyaltySettings((prev) => ({
      customCoupons: [
        ...prev.customCoupons,
        {
          visits: 10,
          discountType: 'percentage',
          discountValue: 10,
          validityDays: 30,
          isActive: true,
        },
      ],
    }));
  };

  const deleteCustomCoupon = (index) => {
    if (!isAdminAuthenticated) {
      setPendingAction(() => () => deleteCustomCoupon(index));
      setShowPasswordModal(true);
      return;
    }
    setLoyaltySettings((prev) => ({
      customCoupons: prev.customCoupons.filter((_, i) => i !== index),
    }));
  };

  const saveLoyaltySettings = async () => {
    if (!isAdminAuthenticated) {
      setPendingAction(() => saveLoyaltySettings);
      setShowPasswordModal(true);
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const newCoupons = Array.isArray(loyaltySettings.customCoupons)
        ? loyaltySettings.customCoupons
        : [];
      const allCoupons = [...appliedCoupons, ...newCoupons];

      allCoupons.forEach(
        ({ visits, discountType, discountValue, validityDays }) => {
          if (
            visits < 1 ||
            validityDays < 1 ||
            discountValue < 0 ||
            (discountType === 'percentage' && discountValue > 100)
          ) {
            throw new Error(
              language === 'kor'
                ? '유효하지 않은 쿠폰 데이터가 있습니다.'
                : 'There is invalid coupon data.'
            );
          }
        }
      );

      const visitsList = allCoupons.map((c) => c.visits);
      if (new Set(visitsList).size !== visitsList.length) {
        throw new Error(
          language === 'kor'
            ? '중복된 방문 횟수가 포함되어 있습니다. 방문 횟수는 고유해야 합니다.'
            : 'Duplicate visit counts detected. Visit counts must be unique.'
        );
      }

      const payload = allCoupons.map((coupon) => ({
        visits: coupon.visits,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        validityDays: coupon.validityDays,
        isActive: coupon.isActive ?? true,
      }));

      const updatedCoupons = await saveLoyaltyCoupons(hotelId, payload);

      setAppliedCoupons(updatedCoupons);
      setLoyaltySettings((prev) => ({ ...prev, customCoupons: [] }));
      setMessage(
        language === 'kor'
          ? '로열티 쿠폰 설정이 저장되었습니다.'
          : 'Loyalty coupon settings saved successfully.'
      );
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error('[saveLoyaltySettings] Error:', err);
      setError(
        language === 'kor'
          ? `저장에 실패했습니다: ${err.message}`
          : `Failed to save: ${err.message}`
      );
    } finally {
      setIsLoading(false);
    }
  };


  const handleCustomerSearch = async () => {
    if (
      !customerSearchQuery.trim() &&
      !visitCountFilter.min &&
      !visitCountFilter.max &&
      !lastVisitDate
    ) {
      setSearchResults([]);
      setTotalCount(0);
      return;
    }

    if (lastVisitDate && !/^\d{4}-\d{2}-\d{2}$/.test(lastVisitDate)) {
      setError(
        language === 'kor'
          ? '마지막 방문일은 YYYY-MM-DD 형식이어야 합니다.'
          : 'Last visit date must be in YYYY-MM-DD format.'
      );
      return;
    }

    setIsSearching(true);
    try {
      const { customers, totalCount } = await searchCustomers(hotelId, {
        query: customerSearchQuery.trim() || undefined,
        minVisits: visitCountFilter.min ? +visitCountFilter.min : undefined,
        maxVisits: visitCountFilter.max ? +visitCountFilter.max : undefined,
        lastVisitDate: lastVisitDate || undefined,
        limit,
        skip: page * limit,
      });

      setSearchResults(customers || []);
      setTotalCount(totalCount || 0);
    } catch (err) {
      const errorCode = err.response?.data?.errorCode || 'UNKNOWN';
      const errorMessage =
        language === 'kor'
          ? `고객 검색 실패: ${err.message} (코드: ${errorCode})`
          : `Failed to search customers: ${err.message} (Code: ${errorCode})`;
      console.error('[handleCustomerSearch] Error:', err);
      setError(errorMessage);
      setSearchResults([]);
      setTotalCount(0);
    } finally {
      setIsSearching(false);
    }
  };

  const toggleCustomerSelection = (customer) => {
    setSelectedCustomers((prev) =>
      prev.some((c) => c._id === customer._id)
        ? prev.filter((c) => c._id !== customer._id)
        : [...prev, customer]
    );
  };

  const handleCreateAndPush = async () => {
    if (selectedCustomers.length === 0) {
      setError('고객을 선택해주세요.');
      return;
    }
    setIsLoading(true);
    try {
      // (1) 쿠폰 생성
      const payload = {
        uuid: generateUniqueId(),
        code: generateCouponCode(),
        name: targetCoupon.name,
        discountType: targetCoupon.discountType,
        discountValue: targetCoupon.discountValue,
        startDate: targetCoupon.startDate,
        endDate: targetCoupon.endDate,
        couponCount: 1,
        hotelId, // hotelId 추가
        applicableRoomType: 'all', // 기본적으로 모든 객실에 적용
        isActive: true,
        autoDistribute: false,
        maxUses: 1,
        usedCount: 0,
      };
      const {
        data: {
          coupons: [created],
        },
      } = await api.post(`/api/hotel-settings/${hotelId}/coupons`, {
        hotelId,
        coupons: [payload],
      });
      const newUuid = created.uuid;

      // (2) 선택 고객에게 푸시
      await Promise.all(
        selectedCustomers.map((c) =>
          issueTargetedCoupon(hotelId, c._id, { couponUuid: newUuid })
        )
      );

      setMessage(
        `${selectedCustomers.length}명에게 신규 쿠폰이 발행되었습니다.`
      );
      // 초기화
      setShowTargetForm(false);
      setSelectedCustomers([]);
      setTargetCoupon({
        name: '',
        discountType: 'percentage',
        discountValue: 10,
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
      });
    } catch (err) {
      setError(`발행 실패: ${err.message}`);
    } finally {
      setIsLoading(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleAddCoupon = async () => {
    if (isLoading) {
      console.warn('[handleAddCoupon] Request already in progress, ignoring.');
      return;
    }
    setIsLoading(true);
    try {
      const selectedTypes = Object.keys(selectedRoomTypes).filter(
        (roomType) => selectedRoomTypes[roomType]
      );
      if (selectedTypes.length > 0 && applyToAll) {
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
        : newCoupons.filter((coupon) =>
            selectedTypes.includes(coupon.roomType)
          );
      if (couponsToAdd.length === 0) {
        throw new Error(
          language === 'kor'
            ? '선택된 객실에 대한 쿠폰 정보를 입력해주세요.'
            : 'Please enter coupon information for the selected room types.'
        );
      }

      const validatedCoupons = [];
      const codeSet = new Set(); // 요청 내 고유성 보장을 위한 Set
      for (const coupon of couponsToAdd) {
        const numCoupons = parseInt(coupon.couponCount, 10);
        const hasName = coupon.name.trim() !== '';
        const hasDiscountValue =
          coupon.discountValue !== '' && coupon.discountValue > 0;
        const hasCouponCount = numCoupons > 0;
        if (!hasName || !hasDiscountValue || !hasCouponCount) {
          throw new Error(
            language === 'kor'
              ? `쿠폰 이름, 할인 값, 쿠폰 개수를 입력해주세요 (객실: ${coupon.roomType}).`
              : `Please enter coupon name, discount value, and coupon count (Room: ${coupon.roomType}).`
          );
        }
        const now = new Date();
        const issuedAt = format(now, "yyyy-MM-dd'T'HH:mm:ss+09:00");
        const startDate = parseDate(coupon.startDate);
        const endDate = parseDate(coupon.endDate);
        if (!startDate || !endDate) {
          throw new Error(
            language === 'kor'
              ? '유효하지 않은 날짜 형식입니다. (yyyy-MM-dd 형식이어야 합니다)'
              : 'Invalid date format. (Must be in yyyy-MM-dd format)'
          );
        }
        for (let i = 0; i < numCoupons; i++) {
          const couponToValidate = {
            ...coupon,
            uuid: generateUniqueId(),
            code: generateCouponCode(codeSet), // 고유성 보장
            maxUses: 1,
            usedCount: 0,
            usedAt: null,
            issuedAt,
            startDate: format(startDate, "yyyy-MM-dd'T'HH:mm:ss+09:00"),
            endDate: format(endDate, "yyyy-MM-dd'T'HH:mm:ss+09:00"),
            applicableRoomType: applyToAll
              ? 'all'
              : coupon.roomType.toLowerCase(),
            roomType: coupon.roomType.toLowerCase(),
            autoDistribute: coupon.autoDistribute || true,
            autoValidity: coupon.autoValidity || true,
            validityDays: coupon.duration || 1,
            isDeleted: false,
            hotelId,
          };
          validateCoupon(couponToValidate, validatedCoupons);
          validatedCoupons.push({ ...couponToValidate, isActive: true });
        }
      }

      const response = await api.post(
        `/api/hotel-settings/${hotelId}/coupons`,
        {
          hotelId,
          coupons: validatedCoupons,
        }
      );

      setCoupons(response.data.coupons);

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
              if (rt && rt.roomInfo) acc[rt.roomInfo] = false;
              return acc;
            }, {})
          : {}
      );
      setMessage(feedbackMessage);
      setError('');
      setTimeout(() => setMessage(''), 5000);
    } catch (err) {
      console.error('[handleAddCoupon] Validation error:', err.message);
      setError(
        language === 'kor'
          ? `쿠폰 생성에 실패했습니다: ${err.message}`
          : `Failed to create coupons: ${err.message}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const deleteAppliedCoupon = async (index) => {
    setIsLoading(true);
    try {
      const updatedCoupons = appliedCoupons.filter((_, i) => i !== index);
      await api.put(`/api/hotel-settings/${hotelId}/loyalty-coupons`, {
        loyaltyCoupons: updatedCoupons.length > 0 ? updatedCoupons : [],
        hotelId,
      });
      setAppliedCoupons(updatedCoupons);
      const loyaltyCoupons = await fetchLoyaltyCoupons(hotelId);
      setAppliedCoupons(loyaltyCoupons || []);
      showMessage(
        language === 'kor'
          ? '로열티 쿠폰이 삭제되었습니다.'
          : 'Loyalty coupon has been deleted.'
      );
    } catch (err) {
      console.error('[deleteAppliedCoupon] Error:', err);
      setError(
        language === 'kor'
          ? `로열티 쿠폰 삭제 실패: ${err.message}`
          : `Failed to delete loyalty coupon: ${err.message}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const toggleAppliedCoupon = async (index) => {
    setIsLoading(true);
    try {
      const updatedCoupons = appliedCoupons.map((coupon, i) =>
        i === index ? { ...coupon, isActive: !coupon.isActive } : coupon
      );
      await api.put(`/api/hotel-settings/${hotelId}/loyalty-coupons`, {
        loyaltyCoupons: updatedCoupons,
        hotelId,
      });
      setAppliedCoupons(updatedCoupons);
      setMessage(
        language === 'kor'
          ? '로열티 쿠폰 상태가 업데이트되었습니다.'
          : 'Loyalty coupon status has been updated.'
      );
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error('[toggleAppliedCoupon] Error:', err);
      setError(
        language === 'kor'
          ? `로열티 쿠폰 상태 업데이트 실패: ${err.message}`
          : `Failed to update loyalty coupon status: ${err.message}`
      );
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
      await api.delete(`/api/hotel-settings/${hotelId}/coupons/${couponUuid}`, {
        data: { hotelId, couponUuid },
      });

      const updatedCoupons = coupons
        .filter((c) => c.uuid !== couponUuid)
        .map(normalizeRoomType);
      setCoupons(updatedCoupons);
      onCouponsChange?.(updatedCoupons);

      const updatedUsedCoupons = usedCoupons.filter(
        (c) => c.couponUuid !== couponUuid
      );
      setUsedCoupons(updatedUsedCoupons);

      setMessage(
        language === 'kor' ? '쿠폰이 삭제되었습니다.' : 'Coupon deleted.'
      );
    } catch (err) {
      console.error('[handleDeleteCoupon] Error:', err);
      setError(
        language === 'kor'
          ? `쿠폰 삭제 실패: ${err.message}`
          : `Failed to delete coupon: ${err.message}`
      );
    } finally {
      setTimeout(() => setMessage(''), 5000);
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

    const MAX_RETRIES = 3;
    const BASE_DELAY_MS = 500;

    const deleteWithRetry = async (coupon) => {
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          await api.delete(
            `/api/hotel-settings/${hotelId}/coupons/${coupon.uuid}`,
            {
              data: { hotelId, couponUuid: coupon.uuid },
            }
          );
          return;
        } catch (err) {
          const labels = err.response?.data?.errorLabels || [];
          if (
            labels.includes('TransientTransactionError') &&
            attempt < MAX_RETRIES
          ) {
            await new Promise((res) =>
              setTimeout(res, BASE_DELAY_MS * attempt)
            );
          } else {
            throw err;
          }
        }
      }
    };

    try {
      await Promise.all(groupCoupons.map((coupon) => deleteWithRetry(coupon)));

      const updatedCoupons = coupons
        .filter((c) => !groupCoupons.some((g) => g.uuid === c.uuid))
        .map(normalizeRoomType);
      setCoupons(updatedCoupons);
      onCouponsChange?.(updatedCoupons);

      const updatedUsedCoupons = usedCoupons.filter(
        (c) => !groupCoupons.some((g) => g.couponUuid === c.couponUuid)
      );
      setUsedCoupons(updatedUsedCoupons);

      setMessage(
        language === 'kor'
          ? '그룹 내 모든 쿠폰이 삭제되었습니다.'
          : 'All coupons in the group have been deleted.'
      );
      setError('');
    } catch (err) {
      console.error('[handleDeleteGroup] Error:', err);
      setError(
        language === 'kor'
          ? `그룹 삭제 실패: ${err.message}`
          : `Failed to delete group: ${err.message}`
      );
    } finally {
      setTimeout(() => setMessage(''), 5000);
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
            if (rt && rt.roomInfo) acc[rt.roomInfo] = false;
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
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
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
    <section className="coupon-section">
      <div className="coupon-section-header">
        <h2>
          {language === 'kor' ? '◉ 쿠폰 발행' : 'Coupon Issuance'}
          <span
            className={`coupon-lock-icon ${
              isAdminAuthenticated ? 'coupon-unlocked' : 'coupon-locked'
            }`}
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
          <p className="coupon-lock-message">
            {language === 'kor' ? '잠금을 풀어 수정하세요' : 'Unlock to edit'}
          </p>
        )}
      </div>
      {error && <p className="coupon-error">{error}</p>}
      {message && <p className="coupon-success">{message}</p>}
      {isLoading && <p>{language === 'kor' ? '저장 중...' : 'Saving...'}</p>}

      {showPasswordModal && (
        <div className="coupon-admin-auth-modal">
          <div className="coupon-modal-content">
            <h3>
              {language === 'kor' ? '관리자 인증' : 'Admin Authentication'}
            </h3>
            <p>
              {language === 'kor'
                ? '관리자 번호를 입력해주세요:'
                : 'Please enter the admin password:'}
            </p>
            <input
              type="password"
              value={adminPasswordInput}
              onChange={(e) => setAdminPasswordInput(e.target.value)}
              placeholder={
                language === 'kor' ? '관리자 번호' : 'Admin Password'
              }
            />
            <div className="coupon-modal-actions">
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

      <div className="coupon-loyalty-settings coupon-section-block">
        <h4>
          {language === 'kor' ? '로열티 쿠폰 설정' : 'Loyalty Coupon Settings'}
        </h4>
        <div className="coupon-loyalty-form">
          {isLoading && <span className="coupon-loading">Loading...</span>}
          {error && <p className="coupon-error">{error}</p>}
          {message && <p className="coupon-success">{message}</p>}

          {/* 조건 입력 섹션 */}
          {isAdminAuthenticated && (
            <>
              {loyaltySettings.customCoupons.map((coupon, index) => (
                <div className="coupon-loyalty-form-row" key={index}>
                  {/* 방문 횟수 */}
                  <div className="coupon-loyalty-form-cell">
                    <label>
                      {language === 'kor' ? '방문 횟수' : 'Visit Count'}
                    </label>
                    <input
                      type="number"
                      value={coupon.visits}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        if (value < 1) {
                          setError('방문 횟수는 1 이상이어야 합니다.');
                          return;
                        }
                        setError('');
                        setLoyaltySettings({
                          customCoupons: loyaltySettings.customCoupons.map(
                            (c, i) =>
                              i === index ? { ...c, visits: value } : c
                          ),
                        });
                      }}
                      disabled={isLoading}
                      min="1"
                    />
                  </div>

                  {/* 할인 유형 */}
                  <div className="coupon-loyalty-form-cell">
                    <label>
                      {language === 'kor' ? '할인 유형' : 'Discount Type'}
                    </label>
                    <select
                      value={coupon.discountType}
                      onChange={(e) =>
                        setLoyaltySettings({
                          customCoupons: loyaltySettings.customCoupons.map(
                            (c, i) =>
                              i === index
                                ? { ...c, discountType: e.target.value }
                                : c
                          ),
                        })
                      }
                      disabled={isLoading}
                    >
                      <option value="percentage">
                        {language === 'kor' ? '정률 (%)' : 'Percentage (%)'}
                      </option>
                      <option value="fixed">
                        {language === 'kor' ? '정액 (원)' : 'Fixed (₩)'}
                      </option>
                    </select>
                  </div>

                  {/* 할인 값 */}
                  <div className="coupon-loyalty-form-cell">
                    <label>
                      {language === 'kor' ? '할인 값' : 'Discount Value'}
                    </label>
                    <div
                      className={`coupon-loyalty-discount-value-input ${coupon.discountType}`}
                    >
                      <input
                        type="number"
                        value={coupon.discountValue}
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          if (value < 0) {
                            setError('할인 값은 0 이상이어야 합니다.');
                            return;
                          }
                          if (
                            coupon.discountType === 'percentage' &&
                            value > 100
                          ) {
                            setError('할인율은 100 이하이어야 합니다.');
                            return;
                          }
                          setError('');
                          setLoyaltySettings({
                            customCoupons: loyaltySettings.customCoupons.map(
                              (c, i) =>
                                i === index ? { ...c, discountValue: value } : c
                            ),
                          });
                        }}
                        min="0"
                        max={
                          coupon.discountType === 'percentage' ? 100 : undefined
                        }
                        disabled={isLoading}
                      />
                      <span className="discount-unit">
                        {coupon.discountType === 'percentage' ? '%' : '원'}
                      </span>
                    </div>
                  </div>

                  {/* 유효기간 (일) */}
                  <div className="coupon-loyalty-form-cell">
                    <label>
                      {language === 'kor' ? '유효기간 (일)' : 'Validity Days'}
                    </label>
                    <input
                      type="number"
                      value={coupon.validityDays}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        if (value < 1) {
                          setError('유효기간은 1일 이상이어야 합니다.');
                          return;
                        }
                        setError('');
                        setLoyaltySettings({
                          customCoupons: loyaltySettings.customCoupons.map(
                            (c, i) =>
                              i === index ? { ...c, validityDays: value } : c
                          ),
                        });
                      }}
                      min="1"
                      disabled={isLoading}
                    />
                  </div>

                  {/* 입력 행 삭제 버튼 */}
                  <button
                    className="coupon-btn coupon-delete"
                    onClick={() => deleteCustomCoupon(index)}
                    disabled={isLoading}
                  >
                    <FaTrash />
                  </button>
                </div>
              ))}
              <div className="coupon-loyalty-form-actions">
                <button
                  className="coupon-btn coupon-create"
                  onClick={addCustomCoupon}
                  disabled={isLoading}
                >
                  {language === 'kor' ? '조건 추가' : 'Add Condition'}
                </button>
                {loyaltySettings.customCoupons.length > 0 && (
                  <button
                    className="coupon-btn coupon-save"
                    onClick={saveLoyaltySettings}
                    disabled={isLoading}
                  >
                    {language === 'kor' ? '저장' : 'Save'}
                  </button>
                )}
              </div>
            </>
          )}

          {/* 잠금 상태 메시지 */}
          {!isAdminAuthenticated && (
            <p className="coupon-lock-message">
              {language === 'kor' ? '잠금을 풀어 수정하세요' : 'Unlock to edit'}
            </p>
          )}

          {/* 현재 적용중인 로열티 쿠폰 섹션 */}
          {appliedCoupons.length > 0 && (
            <div className="coupon-loyalty-applied">
              <h4>
                {language === 'kor'
                  ? '현재 적용중인 로열티 쿠폰'
                  : 'Currently Applied Loyalty Coupons'}
              </h4>
              {appliedCoupons.map((coupon, index) => (
                <div className="coupon-loyalty-applied-row" key={index}>
                  <span className="coupon-loyalty-applied-field">
                    {language === 'kor' ? '방문 횟수' : 'Visit Count'}:{' '}
                    {coupon.visits}
                  </span>
                  <span className="coupon-loyalty-applied-field">
                    {language === 'kor' ? '할인 유형' : 'Discount Type'}:{' '}
                    {coupon.discountType === 'percentage'
                      ? '정률 (%)'
                      : '정액 (₩)'}
                  </span>
                  <span className="coupon-loyalty-applied-field">
                    {language === 'kor' ? '할인 값' : 'Discount Value'}:{' '}
                    {coupon.discountValue}
                    {coupon.discountType === 'percentage' ? '%' : '원'}
                  </span>
                  <span className="coupon-loyalty-applied-field">
                    {language === 'kor' ? '유효기간 (일)' : 'Validity Days'}:{' '}
                    {coupon.validityDays}
                  </span>
                  <div className="coupon-loyalty-applied-actions">
                    {isAdminAuthenticated && (
                      <>
                        <button
                          className={`coupon-btn coupon-toggle ${
                            coupon.isActive
                              ? 'coupon-active'
                              : 'coupon-inactive'
                          }`}
                          onClick={() => toggleAppliedCoupon(index)}
                          disabled={isLoading}
                        >
                          {coupon.isActive
                            ? language === 'kor'
                              ? '비활성화'
                              : 'Deactivate'
                            : language === 'kor'
                            ? '활성화'
                            : 'Activate'}
                        </button>
                        <button
                          className="coupon-btn coupon-delete"
                          onClick={() => deleteAppliedCoupon(index)}
                          disabled={isLoading}
                        >
                          <FaTrash />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="coupon-customer-push coupon-section-block">
        <h4>
          {language === 'kor'
            ? '고객별 쿠폰 발행'
            : 'Push Coupons to Customers'}
        </h4>
        <div className="coupon-customer-search-form">
          <div className="coupon-customer-search-form-row">
            <div className="coupon-customer-search-form-cell">
              <label>
                {language === 'kor'
                  ? '고객 검색 (이름/전화번호)'
                  : 'Search Customer (Name/Phone)'}
              </label>
              <input
                type="text"
                value={customerSearchQuery}
                onChange={(e) => setCustomerSearchQuery(e.target.value)}
                placeholder={
                  language === 'kor'
                    ? '고객 이름 또는 전화번호 입력'
                    : 'Enter customer name or phone'
                }
                disabled={isLoading || !isAdminAuthenticated}
              />
            </div>
            <div className="coupon-customer-search-form-cell">
              <label>
                {language === 'kor' ? '최소 방문 횟수' : 'Min Visits'}
              </label>
              <input
                type="number"
                value={visitCountFilter.min}
                onChange={(e) =>
                  setVisitCountFilter({
                    ...visitCountFilter,
                    min: e.target.value,
                  })
                }
                disabled={isLoading || !isAdminAuthenticated}
                min="0"
              />
            </div>
            <div className="coupon-customer-search-form-cell">
              <label>
                {language === 'kor' ? '최대 방문 횟수' : 'Max Visits'}
              </label>
              <input
                type="number"
                value={visitCountFilter.max}
                onChange={(e) =>
                  setVisitCountFilter({
                    ...visitCountFilter,
                    max: e.target.value,
                  })
                }
                disabled={isLoading || !isAdminAuthenticated}
                min="0"
              />
            </div>
            <div className="coupon-customer-search-form-cell">
              <label>
                {language === 'kor'
                  ? '마지막 방문일 (YYYY-MM-DD)'
                  : 'Last Visit Date'}
              </label>
              <input
                type="date"
                value={lastVisitDate}
                onChange={(e) => setLastVisitDate(e.target.value)}
                disabled={isLoading || !isAdminAuthenticated}
              />
            </div>
            <div className="coupon-customer-search-form-cell">
              <button
                className="coupon-btn coupon-search"
                onClick={handleCustomerSearch}
              >
                {language === 'kor' ? '검색' : 'Search'}
              </button>
            </div>
          </div>
        </div>
        {/* 공용(전체) 쿠폰 발행 섹션 제거 */}
        {isSearching ? (
          <p>{language === 'kor' ? '검색 중...' : 'Searching...'}</p>
        ) : searchResults.length > 0 ? (
          <div className="coupon-customer-search-results">
            <table className="coupon-customer-table">
              <thead>
                <tr>
                  <th>{/* 선택 */}</th>
                  <th>{language === 'kor' ? '이름' : 'Name'}</th>
                  <th>{language === 'kor' ? '전화번호' : 'Phone'}</th>
                  <th>{language === 'kor' ? '방문 횟수' : 'Visits'}</th>
                  <th>{language === 'kor' ? '최근 방문' : 'Last Visit'}</th>
                </tr>
              </thead>
              <tbody>
                {searchResults.map((customer) => (
                  <tr key={customer._id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedCustomers.some(
                          (c) => c._id === customer._id
                        )}
                        onChange={() => toggleCustomerSelection(customer)}
                        disabled={isLoading || !isAdminAuthenticated}
                      />
                    </td>
                    <td>{customer.name}</td>
                    <td>{customer.phoneNumber}</td>
                    <td>{customer.totalVisits || 0}</td>
                    <td>
                      {customer.reservations?.length > 0
                        ? format(
                            new Date(
                              customer.reservations.sort(
                                (a, b) =>
                                  new Date(b.createdAt) - new Date(a.createdAt)
                              )[0].createdAt
                            ),
                            'yyyy-MM-dd'
                          )
                        : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="coupon-pagination">
              <button
                onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
                disabled={page === 0}
              >
                {language === 'kor' ? '이전' : 'Previous'}
              </button>
              <span>{`${page + 1} / ${Math.ceil(totalCount / limit)}`}</span>
              <button
                onClick={() => setPage((prev) => prev + 1)}
                disabled={(page + 1) * limit >= totalCount}
              >
                {language === 'kor' ? '다음' : 'Next'}
              </button>
            </div>
          </div>
        ) : (
          (customerSearchQuery.trim() ||
            visitCountFilter.min ||
            visitCountFilter.max ||
            lastVisitDate) && (
            <p>
              {language === 'kor'
                ? '검색 결과가 없습니다.'
                : 'No results found.'}
            </p>
          )
        )}

        {/* 고객별 쿠폰 발행 (다중 선택) - 유지 */}
        {selectedCustomers.length > 0 && (
          <div className="coupon-push-form">
            <h5>
              {language === 'kor'
                ? `선택된 고객 (${selectedCustomers.length}명)`
                : `Selected Customers (${selectedCustomers.length})`}
            </h5>

            {!showTargetForm ? (
              // 신규 쿠폰 생성 & 발행 버튼
              <button
                className="coupon-btn coupon-push"
                onClick={() => setShowTargetForm(true)}
                disabled={isLoading || !isAdminAuthenticated}
              >
                {language === 'kor'
                  ? '신규 쿠폰 생성 & 발행'
                  : 'Create & Issue New Coupon'}
              </button>
            ) : (
              // 신규 쿠폰 입력 폼
              <div className="target-coupon-form">
                <div className="coupon-form-cell">
                  <label>
                    {language === 'kor' ? '쿠폰 이름' : 'Coupon Name'}
                  </label>
                  <input
                    name="name"
                    value={targetCoupon.name}
                    onChange={handleTargetCouponChange}
                    disabled={isLoading || !isAdminAuthenticated}
                    placeholder={
                      language === 'kor'
                        ? '쿠폰 이름을 입력하세요'
                        : 'Enter coupon name'
                    }
                  />
                </div>
                <div className="coupon-form-cell">
                  <label>
                    {language === 'kor' ? '할인 유형' : 'Discount Type'}
                  </label>
                  <select
                    name="discountType"
                    value={targetCoupon.discountType}
                    onChange={handleTargetCouponChange}
                    disabled={isLoading || !isAdminAuthenticated}
                  >
                    <option value="percentage">
                      {language === 'kor' ? '정률 (%)' : 'Percentage (%)'}
                    </option>
                    <option value="fixed">
                      {language === 'kor' ? '정액 (원)' : 'Fixed (₩)'}
                    </option>
                  </select>
                </div>
                <div className="coupon-form-cell">
                  <label>
                    {language === 'kor' ? '할인 값' : 'Discount Value'}
                  </label>
                  <div
                    className={`coupon-discount-value-input ${targetCoupon.discountType}`}
                  >
                    <input
                      name="discountValue"
                      type="number"
                      value={targetCoupon.discountValue}
                      onChange={handleTargetCouponChange}
                      disabled={isLoading || !isAdminAuthenticated}
                      min="0"
                      max={
                        targetCoupon.discountType === 'percentage'
                          ? '100'
                          : undefined
                      }
                    />
                    <span>
                      {targetCoupon.discountType === 'percentage' ? '%' : '₩'}
                    </span>
                  </div>
                </div>
                <div className="coupon-form-cell">
                  <label>{language === 'kor' ? '시작일' : 'Start Date'}</label>
                  <input
                    name="startDate"
                    type="date"
                    value={targetCoupon.startDate}
                    onChange={handleTargetCouponChange}
                    disabled={isLoading || !isAdminAuthenticated}
                  />
                </div>
                <div className="coupon-form-cell">
                  <label>{language === 'kor' ? '종료일' : 'End Date'}</label>
                  <input
                    name="endDate"
                    type="date"
                    value={targetCoupon.endDate}
                    onChange={handleTargetCouponChange}
                    disabled={isLoading || !isAdminAuthenticated}
                  />
                </div>
                <div className="target-form-actions">
                  <button
                    className="coupon-btn coupon-push"
                    onClick={handleCreateAndPush}
                    disabled={isLoading || !isAdminAuthenticated}
                  >
                    {language === 'kor' ? '생성 후 발행' : 'Create & Issue'}
                  </button>
                  <button
                    className="coupon-btn coupon-close"
                    onClick={() => setShowTargetForm(false)}
                    disabled={isLoading}
                  >
                    {language === 'kor' ? '취소' : 'Cancel'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
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
          <div className="coupon-apply-to-all-section">
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
                <label>
                  {language === 'kor' ? '적용 객실' : 'Applicable Room'}
                </label>
              </div>
              <div className="coupon-form-cell">
                <label>
                  {language === 'kor' ? '고유 쿠폰 코드' : 'Coupon Code'}
                </label>
              </div>
              <div className="coupon-form-cell">
                <label>
                  {language === 'kor' ? '쿠폰 이름' : 'Coupon Name'}
                </label>
              </div>
              <div className="coupon-form-cell">
                <label>
                  {language === 'kor' ? '쿠폰 개수' : 'Coupon Count'}
                </label>
              </div>
              <div className="coupon-form-cell">
                <label>
                  {language === 'kor' ? '발행형태' : 'Discount Type'}
                </label>
              </div>
              <div className="coupon-form-cell">
                <label>
                  {language === 'kor' ? '유효기간 시작일' : 'Start Date'}
                </label>
              </div>
              <div className="coupon-form-cell">
                <label>
                  {language === 'kor' ? '유효기간 종료일' : 'End Date'}
                </label>
              </div>
              <div className="coupon-form-cell">
                <label>{language === 'kor' ? '발행일시' : 'Issued At'}</label>
              </div>
              <div className="coupon-form-cell">
                <label>
                  {language === 'kor' ? '할인 값' : 'Discount Value'}
                </label>
              </div>
              <div className="coupon-form-cell">
                <label>{language === 'kor' ? '기간 설정' : 'Duration'}</label>
              </div>
            </div>
            {newCoupons.length === 0 ? (
              <div className="coupon-form-row">
                <div
                  className="coupon-form-cell"
                  style={{ textAlign: 'center', width: '100%' }}
                >
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
                  className={`coupon-form-row ${
                    applyToAll || selectedRoomTypes[coupon.roomType]
                      ? 'coupon-selected-row'
                      : ''
                  }`}
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
                          ? language === 'kor'
                            ? '모든 객실'
                            : 'All Rooms'
                          : !roomTypes || !coupon.roomType
                          ? language === 'kor'
                            ? '알 수 없음'
                            : 'Unknown'
                          : coupon.roomType === 'all'
                          ? language === 'kor'
                            ? '모든 객실'
                            : 'All Rooms'
                          : roomTypes && roomTypes.length > 0
                          ? language === 'kor'
                            ? roomTypes.find(
                                (rt) =>
                                  rt &&
                                  rt.roomInfo &&
                                  rt.roomInfo === coupon.roomType
                              )?.nameKor || '알 수 없음'
                            : roomTypes.find(
                                (rt) =>
                                  rt &&
                                  rt.roomInfo &&
                                  rt.roomInfo === coupon.roomType
                              )?.nameEng || 'Unknown'
                          : language === 'kor'
                          ? '알 수 없음'
                          : 'Unknown'
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
                      value={formatDate(
                        parseDate(coupon.issuedAt),
                        'yyyy-MM-dd HH:mm:ss'
                      )}
                      readOnly
                      disabled
                    />
                  </div>
                  <div className="coupon-form-cell">
                    <div
                      className={`coupon-discount-value-input ${coupon.discountType}`}
                    >
                      <input
                        type="number"
                        name="discountValue"
                        value={coupon.discountValue}
                        onChange={(e) => handleCouponChange(coupon.roomType, e)}
                        disabled={isLoading || !isAdminAuthenticated}
                        min="0"
                      />
                      <span>
                        {coupon.discountType === 'percentage' ? '%' : '₩'}
                      </span>
                    </div>
                  </div>
                  <div className="coupon-form-cell coupon-duration-buttons">
                    {[1, 7, 30].map((d) => (
                      <button
                        key={d}
                        className={`coupon-duration-btn ${
                          coupon.duration === d ? 'coupon-active' : ''
                        }`}
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
              className="coupon-btn coupon-save"
              onClick={handleAddCoupon}
              disabled={isLoading}
            >
              {language === 'kor' ? '발행' : 'Issue'}
            </button>
            <button
              className="coupon-btn coupon-close"
              onClick={handleCancelEdit}
              disabled={isLoading}
            >
              {language === 'kor' ? '취소' : 'Cancel'}
            </button>
          </div>
        </div>
      )}

      <div className="coupon-list coupon-section-block">
        <div className="coupon-header-with-button">
          <h4 className="coupon-list-header">
            {language === 'kor' ? '발행된 쿠폰 목록' : 'Issued Coupons'}
          </h4>
          {!showCouponForm && (
            <div className="coupon-header-button-container">
              <button
                className="coupon-btn coupon-create"
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
                    )?.nameKor ||
                    group.roomType ||
                    '알 수 없음'
                  : roomTypes.find(
                      (rt) =>
                        rt &&
                        rt.roomInfo &&
                        safeLower(rt.roomInfo) === safeLower(group.roomType)
                    )?.nameEng ||
                    group.roomType ||
                    'Unknown'
                : group.roomType ||
                  (language === 'kor' ? '알 수 없음' : 'Unknown');
            return (
              <div key={key} className="coupon-group">
                <div className="coupon-group-header">
                  <h3 onClick={() => toggleGroup(key)}>
                    {group.name} ({roomName}) - {group.coupons.length}{' '}
                    {language === 'kor' ? '개' : 'coupons'}
                    <span
                      className={`coupon-toggle-icon ${
                        isExpanded ? 'coupon-expanded' : ''
                      }`}
                    >
                      {isExpanded ? '▲' : '▼'}
                    </span>
                  </h3>
                  <button
                    className="coupon-group-delete"
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
                        const isExpired =
                          startDate > currentDate || endDate < currentDate;
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
                                  {language === 'kor'
                                    ? '쿠폰 이름'
                                    : 'Coupon Name'}
                                  :
                                </strong>{' '}
                                {coupon.name}
                              </p>
                              <p>
                                <strong>
                                  {language === 'kor'
                                    ? '쿠폰 코드'
                                    : 'Coupon Code'}
                                  :
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
                                  ? language === 'kor'
                                    ? '모든 객실'
                                    : 'All Rooms'
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
                                  {language === 'kor'
                                    ? '할인 유형'
                                    : 'Discount Type'}
                                  :
                                </strong>{' '}
                                {coupon.discountType === 'percentage'
                                  ? '정률 (%)'
                                  : '정액 (₩)'}
                              </p>
                              <p>
                                <strong>
                                  {language === 'kor'
                                    ? '할인 값'
                                    : 'Discount Value'}
                                  :
                                </strong>{' '}
                                {coupon.discountValue}
                                {coupon.discountType === 'percentage'
                                  ? '%'
                                  : '원'}
                              </p>
                              <p>
                                <strong>
                                  {language === 'kor' ? '유효기간' : 'Validity'}
                                  :
                                </strong>{' '}
                                {startDate} ~ {endDate}
                              </p>
                              <p>
                                <strong>
                                  {language === 'kor'
                                    ? '생성 일시'
                                    : 'Created At'}
                                  :
                                </strong>{' '}
                                {formatDate(
                                  parseDate(coupon.issuedAt),
                                  'yyyy-MM-dd HH:mm:ss'
                                )}
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
                                    {language === 'kor'
                                      ? '사용 일시'
                                      : 'Used At'}
                                    :
                                  </strong>{' '}
                                  {formatDate(
                                    parseDate(coupon.usedAt),
                                    'yyyy-MM-dd HH:mm:ss'
                                  )}
                                </p>
                              )}
                            </div>
                            <div className="coupon-card-actions">
                              <button
                                className="coupon-delete-btn"
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
      <div className="coupon-used-list coupon-section-block">
        <h4 className="coupon-list-header">
          {language === 'kor' ? '사용된 쿠폰 목록' : 'Used Coupons List'}
        </h4>
        {isUsedCouponsLoading ? (
          <p>{language === 'kor' ? '로딩 중...' : 'Loading...'}</p>
        ) : usedCouponsError ? (
          <p className="coupon-error">{usedCouponsError}</p>
        ) : usedCoupons.length === 0 ? (
          <p>
            {language === 'kor'
              ? '사용된 쿠폰이 없습니다.'
              : 'No coupons have been used.'}
          </p>
        ) : (
          <table className="coupon-used-table">
            <thead>
              <tr>
                <th>{language === 'kor' ? '쿠폰 코드' : 'Coupon Code'}</th>
                <th>{language === 'kor' ? '쿠폰 이름' : 'Coupon Name'}</th>
                <th>{language === 'kor' ? '적용 객실' : 'Applicable Room'}</th>
                <th>{language === 'kor' ? '할인 유형' : 'Discount Type'}</th>
                <th>{language === 'kor' ? '할인 값' : 'Discount Value'}</th>
                <th>{language === 'kor' ? '예약 ID' : 'Reservation ID'}</th>
                <th>
                  {language === 'kor' ? '체크인 상태' : 'Check-In Status'}
                </th>
                <th>{language === 'kor' ? '체크아웃' : 'Check-Out'}</th>
                <th>{language === 'kor' ? '사용 일시' : 'Used At'}</th>
              </tr>
            </thead>
            <tbody>
              {usedCoupons.map((coupon, index) => {
                const statusClass =
                  coupon.checkInStatus === 'checked-in'
                    ? 'coupon-checked-in'
                    : 'coupon-reserved';
                return (
                  <tr key={coupon.couponUuid || index}>
                    <td>{coupon.code}</td>
                    <td>{coupon.name}</td>
                    <td>
                      {coupon.applicableRoomType === 'all'
                        ? language === 'kor'
                          ? '모든 객실'
                          : 'All Rooms'
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
                    </td>
                    <td>
                      {coupon.discountType === 'percentage'
                        ? language === 'kor'
                          ? '정률 (%)'
                          : 'Percentage (%)'
                        : language === 'kor'
                        ? '정액 (₩)'
                        : 'Fixed Amount (₩)'}
                    </td>
                    <td>
                      {coupon.discountValue}
                      {coupon.discountType === 'percentage' ? '%' : '원'}
                    </td>
                    <td>{coupon.reservationId || 'N/A'}</td>
                    <td className={statusClass}>
                      {coupon.checkInStatus === 'checked-in'
                        ? language === 'kor'
                          ? '체크인 완료'
                          : 'Checked In'
                        : language === 'kor'
                        ? '예약만 됨'
                        : 'Reserved'}
                    </td>
                    <td>
                      {coupon.checkOutStatus
                        ? language === 'kor'
                          ? '완료'
                          : 'Completed'
                        : language === 'kor'
                        ? '미완료'
                        : 'Not Completed'}
                    </td>
                    <td>
                      {coupon.usedAt
                        ? formatDate(
                            parseDate(coupon.usedAt),
                            'yyyy-MM-dd HH:mm:ss'
                          )
                        : 'N/A'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="coupon-stats-section">
        <div className="coupon-monthly-stats coupon-section-block">
          <div className="coupon-header-with-button">
            <h5>
              {language === 'kor' ? '월별 쿠폰 통계' : 'Monthly Coupon Stats'}
            </h5>
            <div className="coupon-header-button-container">
              <button
                className="coupon-dropdown-toggle"
                onClick={toggleDropdown}
              >
                {language === 'kor' ? '쿠폰 통계 보기' : 'View Coupon Stats'}
                <span
                  className={`coupon-dropdown-icon ${
                    showDropdown ? 'coupon-expanded' : ''
                  }`}
                >
                  ▼
                </span>
              </button>
              {showDropdown && (
                <div className="coupon-dropdown-menu">
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
          <table className="coupon-stats-table">
            <thead>
              <tr>
                <th>{language === 'kor' ? '월' : 'Month'}</th>
                <th>{language === 'kor' ? '발행된 쿠폰' : 'Issued'}</th>
                <th>{language === 'kor' ? '사용된 쿠폰' : 'Used'}</th>
                <th>{language === 'kor' ? '삭제된 쿠폰' : 'Deleted'}</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(monthlyStats)
                .sort()
                .map((month) => (
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
        <div className="coupon-stats-chart coupon-section-block">
          <h5>
            {language === 'kor'
              ? '월별 쿠폰 통계 그래프'
              : 'Monthly Coupon Stats Chart'}
          </h5>
          <div className="coupon-chart-container">
            {Object.keys(monthlyStats).length > 0 ? (
              <canvas id="coupon-stats-chart" />
            ) : (
              <p>
                {language === 'kor'
                  ? '데이터가 없습니다.'
                  : 'No data available.'}
              </p>
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
  const [coupons, setCoupons] = useState([]);
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
            adminName:
              userData.adminName ||
              (language === 'kor' ? '정보 없음' : 'No info'),
          });
        } else {
          setError(
            language === 'kor'
              ? '사용자 정보를 불러오지 못했습니다. 기본값으로 설정합니다.'
              : 'Failed to load user information. Setting defaults.'
          );
        }

        if (hotelData && hotelData._id) {
          setIsExisting(true);
          const dbFloors = hotelData.gridSettings?.floors || [];
          const containers = dbFloors.flatMap(
            (floor) => floor.containers || []
          );

          let dbRoomTypes = hotelData.roomTypes.map((rt) => {
            let roomAmenities;
            if (
              !rt.roomAmenities ||
              !Array.isArray(rt.roomAmenities) ||
              rt.roomAmenities.length === 0
            ) {
              console.warn(
                `[loadData] roomAmenities for room type ${rt.roomInfo} is invalid or empty, initializing with default values`
              );
              roomAmenities = DEFAULT_AMENITIES.filter(
                (a) => a.type === 'in-room'
              ).map((a) => ({
                nameKor: a.nameKor,
                nameEng: a.nameEng,
                icon: a.icon,
                type: 'in-room',
                isActive: false,
              }));
            } else {
              roomAmenities = DEFAULT_AMENITIES.filter(
                (a) => a.type === 'in-room'
              ).map((defaultAmenity) => {
                const existingAmenity = rt.roomAmenities.find(
                  (amenity) => amenity.nameKor === defaultAmenity.nameKor
                );
                return {
                  nameKor: defaultAmenity.nameKor,
                  nameEng: defaultAmenity.nameEng,
                  icon: defaultAmenity.icon,
                  type: 'in-room',
                  isActive: existingAmenity?.isActive ?? false,
                };
              });
            }

            return {
              ...rt,
              id: rt.id || uuidv4(),
              isBaseRoom: rt.isBaseRoom || false,
              roomAmenities,
              photos: rt.photos || [],
              roomNumbers: rt.roomNumbers || [],
              stock: rt.roomNumbers?.length || 0,
              aliases: rt.aliases || ['', '', '', ''],
              discount: rt.discount || 0,
              fixedDiscount: rt.fixedDiscount || 0,
            };
          });

          setFloors(dbFloors);
          setRoomTypes(dbRoomTypes);

          setTotalRooms(
            containers.filter((c) => c.roomInfo && c.roomNumber && c.isActive)
              .length
          );
          setAmenities(hotelData.amenities || DEFAULT_AMENITIES);
          setEvents(
            (hotelData.eventSettings || []).map((event) => ({
              uuid: event.uuid || uuidv4(),
              eventName:
                event.eventName ||
                (language === 'kor' ? '특가 이벤트' : 'Special Event'),
              startDate: new Date(event.startDate).toISOString().split('T')[0],
              endDate: new Date(event.endDate).toISOString().split('T')[0],
              discountType: event.discountType || 'percentage',
              discountValue: event.discountValue || 0,
              isActive: event.isActive ?? true,
              applicableRoomTypes: event.applicableRoomTypes || [],
            }))
          );
          setCoupons(
            (hotelData.coupons || []).map((coupon) => ({
              uuid: coupon.uuid || uuidv4(),
              code: coupon.code || '',
              name:
                coupon.name ||
                (language === 'kor' ? '할인 쿠폰' : 'Discount Coupon'),
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
              issuedAt:
                coupon.issuedAt ||
                format(
                  toZonedTime(new Date(), 'Asia/Seoul'),
                  'yyyy-MM-dd HH:mm:ss'
                ),
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
          setAmenities([...DEFAULT_AMENITIES]);
          setEvents([]);
          setCoupons([]);
          setCheckInTime('16:00');
          setCheckOutTime('11:00');
          setCoordinates(null);
          setError(
            language === 'kor'
              ? '호텔 설정이 없습니다. 객실 타입 탭에서 타입을 추가하고 레이아웃 탭에서 객실을 설정해주세요.'
              : 'No hotel settings found. Please add room types in the Room Types tab and set up rooms in the Layout tab.'
          );
        }
      } catch (err) {
        console.error('[loadData] Error:', err);
        setError(
          language === 'kor'
            ? `데이터 로딩 실패: ${err.message}.`
            : `Failed to load data: ${err.message}.`
        );
      }
    }

    loadData();
  }, [hotelId, language, navigate]);

  const syncedRoomTypes = useMemo(() => {
    const containers = floors.flatMap((floor) => floor.containers || []);
    return buildRoomTypesWithNumbers(roomTypes, containers);
  }, [roomTypes, floors]);

  useEffect(() => {
    const newTotal = floors.reduce(
      (sum, f) =>
        sum +
        (f.containers || []).filter((c) => c.roomInfo && c.roomNumber).length,
      0
    );
    setTotalRooms(newTotal);

    originalDataRef.current = {
      hotelId,
      isExisting,
      totalRooms: newTotal,
      roomTypes: syncedRoomTypes, // `updatedRoomTypes.roomTypes` -> `syncedRoomTypes`
      floors,
      amenities,
      hotelAddress,
      email,
      phoneNumber,
      hotelName,
      coupons,
      coordinates,
      events,
    };
  }, [
    floors, // 의존성 최소화
    hotelId,
    isExisting,
    hotelAddress,
    email,
    phoneNumber,
    hotelName,
    syncedRoomTypes, // `updatedRoomTypes` 관련 의존성 제거
    amenities,
    coupons,
    coordinates,
    events,
  ]);

  const handleSaveHotelInfo = async () => {
    if (!hotelId) {
      alert(
        language === 'kor' ? '호텔 ID는 필수입니다.' : 'Hotel ID is required.'
      );
      return;
    }

    if (!coordinates) {
      alert(
        language === 'kor'
          ? '좌표를 먼저 추출해주세요.'
          : 'Please extract coordinates first.'
      );
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
        alert(
          language === 'kor'
            ? '호텔 기본 정보가 저장되었습니다.'
            : 'Hotel basic information saved.'
        );
      } else {
        await registerHotel(settingsPayload);
        alert(
          language === 'kor'
            ? '호텔 기본 정보가 등록되었습니다.'
            : 'Hotel basic information registered.'
        );
        setIsExisting(true);
      }
    } catch (err) {
      alert(
        language === 'kor'
          ? `저장 실패: ${err.response?.data?.message || err.message}`
          : `Save failed: ${err.response?.data?.message || err.message}`
      );
    }
  };

  const handleSaveRoomTypes = async () => {
    if (!hotelId) {
      alert(
        language === 'kor' ? '호텔 ID는 필수입니다.' : 'Hotel ID is required.'
      );
      return;
    }

    // 실제 저장할 총 객실 수를, syncedRoomTypes의 stock 합으로 계산
    const calculatedTotalRooms = syncedRoomTypes.reduce(
      (acc, rt) => acc + (rt.stock || 0),
      0
    );

    // payload 생성
    const payload = {
      hotelId,
      roomTypes: syncedRoomTypes.map((rt) => ({
        ...rt,
        isBaseRoom: rt.isBaseRoom || false,
        stock: rt.roomNumbers?.length || 0,
        aliases: (rt.aliases || []).filter(Boolean),
        roomAmenities: rt.roomAmenities.map((amenity) => ({
          nameKor: amenity.nameKor,
          nameEng: amenity.nameEng,
          icon: amenity.icon,
          type: 'in-room',
          isActive: amenity.isActive,
        })),
      })),
      totalRooms: calculatedTotalRooms,
    };

    try {
      await updateHotelSettings(hotelId, payload);
      alert(
        language === 'kor'
          ? '객실 타입 정보가 저장되었습니다.'
          : 'Room types information saved.'
      );
      // 상단 상태에도 반영
      setTotalRooms(calculatedTotalRooms);
    } catch (err) {
      alert(
        language === 'kor'
          ? `저장 실패: ${err.response?.data?.message || err.message}`
          : `Save failed: ${err.response?.data?.message || err.message}`
      );
    }
  };

  const handleSaveLayout = async () => {
    if (!hotelId) {
      alert(
        language === 'kor' ? '호텔 ID는 필수입니다.' : 'Hotel ID is required.'
      );
      return;
    }

    if (!isExisting && roomTypes.length === 0) {
      alert(
        language === 'kor'
          ? '초기 레이아웃을 저장하려면 먼저 객실 타입 탭에서 타입을 추가해주세요.'
          : 'Please add room types in the Room Types tab before saving layout.'
      );
      return;
    }

    // 검증 수행 (LayoutEditor의 validateFloors와 동일한 로직)
    const errors = [];
    floors.forEach((floor) => {
      const floorNum = floor.floorNum;
      const floorPrefix = String(floorNum);
      const roomNumbersInFloor = new Set();

      floor.containers.forEach((cont) => {
        const roomNumber = cont.roomNumber;

        if (!roomNumber || roomNumber.trim() === '') {
          errors.push(
            language === 'kor'
              ? `${floorNum}층: 객실 번호가 비어 있습니다.`
              : `Floor ${floorNum}F: Room number is empty.`
          );
          return;
        }

        if (!/^\d+$/.test(roomNumber)) {
          errors.push(
            language === 'kor'
              ? `${floorNum}층, 객실 번호 ${roomNumber}: 숫자만 입력해주세요.`
              : `Floor ${floorNum}F, Room ${roomNumber}: Please enter numbers only.`
          );
          return;
        }

        if (roomNumber.length < 3) {
          errors.push(
            language === 'kor'
              ? `${floorNum}층, 객실 번호 ${roomNumber}: 객실 번호는 최소 3자리 이상이어야 합니다.`
              : `Floor ${floorNum}F, Room ${roomNumber}: Room number must be at least 3 digits long.`
          );
          return;
        }

        const roomPrefix = roomNumber.slice(0, floorPrefix.length);
        if (roomPrefix !== floorPrefix) {
          errors.push(
            language === 'kor'
              ? `${floorNum}층, 객실 번호 ${roomNumber}: 객실 번호의 첫 부분은 층 번호(${floorNum})와 일치해야 합니다.`
              : `Floor ${floorNum}F, Room ${roomNumber}: The first part of the room number must match the floor number (${floorNum}).`
          );
          return;
        }

        const extractedFloorNum = parseInt(roomPrefix);
        if (
          isNaN(extractedFloorNum) ||
          extractedFloorNum < 1 || // 1층부터 허용
          extractedFloorNum > 15
        ) {
          errors.push(
            language === 'kor'
              ? `${floorNum}층, 객실 번호 ${roomNumber}: 층 번호는 1에서 15 사이여야 합니다.`
              : `Floor ${floorNum}F, Room ${roomNumber}: Floor number must be between 1 and 15.`
          );
          return;
        }

        if (roomNumbersInFloor.has(roomNumber)) {
          errors.push(
            language === 'kor'
              ? `${floorNum}층: 객실 번호 ${roomNumber}가 중복되었습니다.`
              : `Floor ${floorNum}F: Room number ${roomNumber} is duplicated.`
          );
        } else {
          roomNumbersInFloor.add(roomNumber);
        }
      });
    });

    if (errors.length > 0) {
      alert(
        language === 'kor'
          ? `저장할 수 없습니다. 다음 오류를 수정해주세요:\n${errors.join(
              '\n'
            )}`
          : `Cannot save. Please fix the following errors:\n${errors.join(
              '\n'
            )}`
      );
      return;
    }

    // 저장 직전 1~15층 모두 포함 보장
    const allFloors = Array.from({ length: 15 }, (_, i) => i + 1).map(
      (floorNum) =>
        floors.find((f) => f.floorNum === floorNum) || {
          floorNum,
          containers: [],
        }
    );

    const payload = {
      hotelId,
      gridSettings: { floors: allFloors },
      roomTypes: roomTypes.map((rt) => ({
        ...rt,
        stock: rt.roomNumbers?.length || 0,
      })),
      totalRooms: roomTypes.reduce(
        (sum, rt) => sum + (rt.roomNumbers?.length || 0),
        0
      ),
    };

    try {
      await updateHotelSettings(hotelId, payload);
      alert(
        language === 'kor'
          ? '레이아웃 정보가 저장되었습니다.'
          : 'Layout information saved.'
      );
      setTotalRooms(payload.totalRooms);
    } catch (err) {
      alert(
        language === 'kor'
          ? `저장 실패: ${err.response?.data?.message || err.message}`
          : `Save failed: ${err.response?.data?.message || err.message}`
      );
    }
  };

  const handleSaveAmenities = async () => {
    if (!hotelId) {
      alert(
        language === 'kor' ? '호텔 ID는 필수입니다.' : 'Hotel ID is required.'
      );
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
          type: 'in-room',
          isActive: amenity.isActive,
        })),
      })),
    };
    console.log('[handleSaveAmenities] Payload:', payload);
    try {
      await updateHotelSettings(hotelId, payload);
      alert(
        language === 'kor'
          ? '시설 정보가 저장되었습니다.'
          : 'Amenities information saved.'
      );
    } catch (err) {
      alert(
        language === 'kor'
          ? `저장 실패: ${err.response?.data?.message || err.message}`
          : `Save failed: ${err.response?.data?.message || err.message}`
      );
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

      // 1) axios 를 쓰고 있다면 .data.data 안에 실제 payload 가 들어옵니다.
      const response = await updateHotelSettings(hotelId, payload);
      // wrapper 에 따라 response.data.data 혹은 response.data 혹은 response
      const updatedSettings =
        // axios 형태
        response.data?.data ||
        // fetch 형태
        response.data ||
        // 혹시 미리 래핑해놨다면
        response;
      console.log('[handleSaveEvents] Updated Settings:', updatedSettings);

      // 이제 방어 코드도 수정: roomTypes 없으면 그냥 리턴
      if (!updatedSettings?.roomTypes) {
        console.warn(
          '[handleSaveEvents] roomTypes가 응답에 없습니다.',
          updatedSettings
        );
        return;
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
    setEvents(orig.events);
    alert(
      language === 'kor' ? '변경 사항이 취소되었습니다.' : 'Changes canceled.'
    );
  };

  return (
    <div
      className="hotel-settings-page"
      aria-label={
        language === 'kor' ? '호텔 설정 페이지' : 'Hotel Settings Page'
      }
    >
      <h1>HOTEL BASIC SETTINGS</h1>
      <div className="hotel-settings-button-group">
        <button
          className="hotel-settings-btn"
          onClick={() => navigate('/')}
          aria-label={
            language === 'kor' ? '메인 페이지로 이동' : 'Go to main page'
          }
        >
          {language === 'kor' ? '메인으로' : 'Back to Main'}
        </button>
        <button
          className="hotel-settings-btn"
          onClick={handleCancel}
          aria-label={language === 'kor' ? '변경 사항 취소' : 'Cancel changes'}
        >
          {language === 'kor' ? '취소' : 'Cancel'}
        </button>
        <button
          className="hotel-settings-btn"
          onClick={toggleLanguage}
          aria-label={language === 'kor' ? '언어 전환' : 'Toggle language'}
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
          aria-label={
            language === 'kor'
              ? '크롬 확장 프로그램 설치'
              : 'Install Chrome extension'
          }
        >
          {language === 'kor' ? '크롬확장설치' : 'Install Chrome Extension'}
        </button>
      </div>
      {error && (
        <p
          className="error-message"
          role="alert"
          style={{
            color: 'red',
            fontWeight: 'bold',
            textAlign: 'center',
            margin: '20px 0',
          }}
        >
          {error}
        </p>
      )}
      <nav className="tabs">
        <button
          className={activeTab === 'info' ? 'active' : ''}
          onClick={() => setActiveTab('info')}
        >
          {language === 'kor' ? '호텔 정보' : 'Hotel Info'}
        </button>
        <button
          className={activeTab === 'roomTypes' ? 'active' : ''}
          onClick={() => setActiveTab('roomTypes')}
        >
          {language === 'kor' ? '객실 타입' : 'Room Types'}
        </button>
        <button
          className={activeTab === 'layout' ? 'active' : ''}
          onClick={() => setActiveTab('layout')}
        >
          {language === 'kor' ? '레이아웃' : 'Layout'}
        </button>
        <button
          className={activeTab === 'amenities' ? 'active' : ''}
          onClick={() => setActiveTab('amenities')}
        >
          {language === 'kor' ? '시설' : 'Amenities'}
        </button>
        <button
          className={activeTab === 'photos' ? 'active' : ''}
          onClick={() => setActiveTab('photos')}
        >
          {language === 'kor' ? '사진 업로드' : 'Photo Upload'}
        </button>
        <button
          className={activeTab === 'events' ? 'active' : ''}
          onClick={() => setActiveTab('events')}
        >
          {language === 'kor' ? '이벤트 설정' : 'Event Settings'}
        </button>
        <button
          className={activeTab === 'coupons' ? 'active' : ''}
          onClick={() => setActiveTab('coupons')}
        >
          {language === 'kor' ? '쿠폰 발행' : 'Coupon Issuance'}
        </button>
      </nav>
      <DndProvider backend={HTML5Backend}>
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
              onCoordinatesUpdate={handleCoordinatesUpdate}
              initialCoordinates={coordinates}
              language={language}
            />
          )}
          {activeTab === 'roomTypes' && (
            <RoomTypeEditor
              hotelId={hotelId}
              roomTypes={syncedRoomTypes}
              setRoomTypes={setRoomTypes}
              floors={floors}
              setFloors={setFloors}
              amenities={amenities}
              language={language}
            />
          )}
          {activeTab === 'layout' && (
            <LayoutEditor
              hotelId={hotelId}
              roomTypes={syncedRoomTypes}
              setRoomTypes={setRoomTypes}
              floors={floors}
              setFloors={setFloors}
              language={language}
            />
          )}
          {activeTab === 'amenities' && (
            <AmenitiesSection
              amenities={amenities}
              setAmenities={setAmenities}
              roomTypes={syncedRoomTypes}
              setRoomTypes={setRoomTypes}
              language={language}
            />
          )}
          {activeTab === 'photos' && (
            <PhotoUploadSection
              hotelId={hotelId}
              roomTypes={syncedRoomTypes}
              hotelInfo={hotelInfo}
              language={language}
            />
          )}
          {activeTab === 'events' && (
            <EventSettingsSection
              language={language}
              events={events}
              setEvents={setEvents}
              roomTypes={syncedRoomTypes}
              onEventsChange={handleSaveEvents}
            />
          )}
          {activeTab === 'coupons' && (
            <CouponSettingsSection
              language={language}
              coupons={coupons}
              setCoupons={setCoupons}
              roomTypes={syncedRoomTypes}
              onCouponsChange={handleSaveCoupons}
              hotelId={hotelId}
            />
          )}
        </div>
      </DndProvider>

      <div className="save-section">
        {activeTab === 'info' && (
          <button
            className="hotel-settings-btn save-btn"
            onClick={handleSaveHotelInfo}
          >
            {language === 'kor' ? '호텔 정보 저장' : 'Save Hotel Info'}
          </button>
        )}
        {activeTab === 'roomTypes' && (
          <button
            className="hotel-settings-btn save-btn"
            onClick={handleSaveRoomTypes}
          >
            {language === 'kor' ? '객실 타입 저장' : 'Save Room Types'}
          </button>
        )}
        {activeTab === 'layout' && (
          <button
            className="hotel-settings-btn save-btn"
            onClick={handleSaveLayout}
          >
            {language === 'kor' ? '레이아웃 저장' : 'Save Layout'}
          </button>
        )}
        {activeTab === 'amenities' && (
          <button
            className="hotel-settings-btn save-btn"
            onClick={handleSaveAmenities}
          >
            {language === 'kor' ? '시설 저장' : 'Save Amenities'}
          </button>
        )}
      </div>

      {message && <p className="success-message">{message}</p>}
    </div>
  );
}

export { HotelSettingsPage };
