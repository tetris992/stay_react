// frontend/src/pages/HotelSettingsPage.js

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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

import extractCoordinates from './extractCoordinates';
import { FaMapMarkerAlt } from 'react-icons/fa';

import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { v4 as uuidv4 } from 'uuid';
import { toZonedTime } from 'date-fns-tz';
import api from '../api/api';

const generateUniqueId = () => {
  return uuidv4();
};

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
}) {
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState('');
  const [coordinates, setCoordinates] = useState(initialCoordinates); // 좌표 상태 추가

  // 좌표 추출 핸들러
  const handleExtractCoordinates = async () => {
    if (!hotelAddress) {
      setError('주소를 먼저 입력해주세요.');
      return;
    }

    setIsFetching(true);
    setError('');
    try {
      console.log('Calling extractCoordinates with address:', hotelAddress);
      const { latitude, longitude } = await extractCoordinates(hotelAddress);
      console.log('Extracted Coordinates:', { latitude, longitude });
      setCoordinates({ latitude, longitude }); // 좌표 상태 업데이트
      if (onCoordinatesUpdate) {
        onCoordinatesUpdate({ latitude, longitude }); // 상위 컴포넌트로 좌표 전달
      }
    } catch (err) {
      console.error('Extract Coordinates Error:', err.message);
      setError(err.message);
    } finally {
      setIsFetching(false);
    }
  };

  return (
    <section className="hotel-info-section" aria-label="호텔 기본 정보 섹션">
      <div className="info-columns">
        <div className="basic-info">
          <h2>호텔 기본 정보</h2>
          <div className="info-columns-split">
            <div className="info-column">
              <label>
                호텔 ID:
                <input
                  value={hotelId || ''}
                  onChange={(e) => setHotelId(e.target.value)}
                  disabled={isExisting}
                  aria-label="호텔 ID 입력"
                />
              </label>
              <label>
                호텔 이름:
                <input
                  value={hotelName || ''}
                  onChange={(e) => setHotelName(e.target.value)}
                  placeholder="호텔 이름을 입력하세요"
                  aria-label="호텔 이름 입력"
                />
              </label>
              <label>
                총 객실 수:
                <input
                  value={totalRooms || 0}
                  readOnly
                  aria-label="총 객실 수"
                />
              </label>
              <label>
                호텔 주소:
                <input
                  value={hotelAddress || ''}
                  onChange={(e) => setHotelAddress(e.target.value)}
                  placeholder="호텔 주소를 입력하세요"
                  aria-label="호텔 주소 입력"
                />
              </label>
              <button
                onClick={handleExtractCoordinates}
                disabled={isFetching}
                style={{
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  padding: '5px 10px',
                  borderRadius: '5px',
                  cursor: isFetching ? 'not-allowed' : 'pointer',
                  marginTop: '10px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <FaMapMarkerAlt style={{ marginRight: '5px' }} />
                {isFetching ? '좌표 추출 중...' : '좌표 추출'}
              </button>
              {error && (
                <p style={{ color: 'red', marginTop: '5px' }}>{error}</p>
              )}
              {coordinates && (
                <div style={{ marginTop: '10px' }}>
                  <p>
                    위도: {coordinates.latitude}, 경도: {coordinates.longitude}
                  </p>
                </div>
              )}
            </div>
            <div className="info-column">
              <label>
                이메일:
                <input
                  value={email || ''}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="이메일을 입력하세요"
                  aria-label="이메일 입력"
                />
              </label>
              <label>
                전화번호:
                <input
                  value={phoneNumber || ''}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="전화번호를 입력하세요"
                  aria-label="전화번호 입력"
                />
              </label>
              <label>
                체크IN 시간:
                <input
                  type="time"
                  value={checkInTime || '16:00'}
                  onChange={(e) => setCheckInTime(e.target.value)}
                  aria-label="체크인 시간 입력"
                />
              </label>
              <label>
                체크OUT 시간:
                <input
                  type="time"
                  value={checkOutTime || '11:00'}
                  onChange={(e) => setCheckOutTime(e.target.value)}
                  aria-label="체크아웃 시간 입력"
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
  const generateUniqueId = () => {
    return uuidv4();
  };

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

  const validateEvent = (event, existingEvents = [], editingUuid = null) => {
    console.log('[validateEvent] Validating event:', JSON.stringify(event));

    if (!event.eventName || event.eventName.trim() === '') {
      throw new Error(
        language === 'kor'
          ? '이벤트 이름을 입력해주세요.'
          : 'Please enter an event name'
      );
    }

    if (!event.uuid) {
      throw new Error(
        language === 'kor'
          ? '이벤트 고유 식별자가 필요합니다.'
          : 'Event UUID is required'
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

    if (startDateKST >= endDateKST) {
      throw new Error(
        language === 'kor'
          ? '종료일은 시작일보다 이후여야 합니다.'
          : 'End date must be after start date'
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

    const overlappingEvent = existingEvents.find((existingEvent) => {
      if (editingUuid && existingEvent.uuid === editingUuid) return false;
      const existingStart = toZonedTime(
        new Date(existingEvent.startDate),
        'Asia/Seoul'
      );
      const existingEnd = toZonedTime(
        new Date(existingEvent.endDate),
        'Asia/Seoul'
      );
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
    }
  };

  const handleEventChange = (e) => {
    const { name, value } = e.target;
    if (editingEvent) {
      setEditingEvent((prev) => ({
        ...prev,
        [name]: value,
      }));
    } else {
      setNewEvent((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleRoomTypeSelection = (roomTypeId) => {
    if (editingEvent) {
      setEditingEvent((prev) => ({
        ...prev,
        applicableRoomTypes: prev.applicableRoomTypes.includes(roomTypeId)
          ? prev.applicableRoomTypes.filter((id) => id !== roomTypeId)
          : [...prev.applicableRoomTypes, roomTypeId],
      }));
    } else {
      setNewEvent((prev) => ({
        ...prev,
        applicableRoomTypes: prev.applicableRoomTypes.includes(roomTypeId)
          ? prev.applicableRoomTypes.filter((id) => id !== roomTypeId)
          : [...prev.applicableRoomTypes, roomTypeId],
      }));
    }
  };

  const toggleEventStatus = async (eventUuid) => {
    if (isLoading) return;

    try {
      setIsLoading(true);
      const updatedEvents = events.map((event) =>
        event.uuid === eventUuid
          ? { ...event, isActive: !event.isActive }
          : event
      );
      setEvents(updatedEvents);
      console.log('[toggleEventStatus] Updated events:', updatedEvents);

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
            .reduce((max, event) => {
              if (event.discountType === 'percentage') {
                return Math.max(max, event.discountValue);
              } else if (event.discountType === 'fixed') {
                const roomPrice = rt.price || 1;
                const percentage = (event.discountValue / roomPrice) * 100;
                return Math.max(max, percentage);
              }
              return max;
            }, 0);
          return `${rt.nameKor}: ${discount}% 할인 적용`;
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
        console.error('[toggleEventStatus] onEventsChange is not a function');
        setError(
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
      setEvents([...events]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddEvent = async () => {
    if (isLoading) return;

    try {
      setIsLoading(true);
      const eventToValidate = {
        ...newEvent,
        uuid: newEvent.uuid || generateUniqueId(),
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
        .map((rt) => `${rt.nameKor}: ${newEventWithId.discountValue}% 할인 적용`);
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
        console.error('[handleAddEvent] onEventsChange is not a function');
        setError(
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
      eventName: event.eventName,
      startDate: event.startDate,
      endDate: event.endDate,
      discountType: event.discountType,
      discountValue: event.discountValue,
      isActive: event.isActive,
      applicableRoomTypes: event.applicableRoomTypes,
    });
    setShowEventForm(true);
  };

  const handleUpdateEvent = async () => {
    if (isLoading) return;

    try {
      setIsLoading(true);
      if (!editingEvent.uuid) {
        throw new Error(
          language === 'kor'
            ? '수정 중인 이벤트의 UUID가 없습니다.'
            : 'Editing event is missing UUID'
        );
      }
      validateEvent(editingEvent, events, editingEvent.uuid);
      const startDateKST = toZonedTime(
        new Date(editingEvent.startDate),
        'Asia/Seoul'
      );
      const endDateKST = toZonedTime(
        new Date(editingEvent.endDate),
        'Asia/Seoul'
      );
      const updatedEvent = {
        ...editingEvent,
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
            .reduce((max, event) => {
              if (event.discountType === 'percentage') {
                return Math.max(max, event.discountValue);
              } else if (event.discountType === 'fixed') {
                const roomPrice = rt.price || 1;
                const percentage = (event.discountValue / roomPrice) * 100;
                return Math.max(max, percentage);
              }
              return max;
            }, 0);
          return `${rt.nameKor}: ${discount}% 할인 적용`;
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
        console.error('[handleUpdateEvent] onEventsChange is not a function');
        setError(
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

  const handleDeleteEvent = async (eventUuid) => {
    if (isLoading) return;

    const confirmDelete = window.confirm(
      language === 'kor'
        ? '이 이벤트를 삭제하시겠습니까?'
        : 'Are you sure you want to delete this event?'
    );
    if (!confirmDelete) return;

    try {
      setIsLoading(true);
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
            .reduce((max, event) => {
              if (event.discountType === 'percentage') {
                return Math.max(max, event.discountValue);
              } else if (event.discountType === 'fixed') {
                const roomPrice = rt.price || 1;
                const percentage = (event.discountValue / roomPrice) * 100;
                return Math.max(max, percentage);
              }
              return max;
            }, 0);
          return `${rt.nameKor}: ${discount}% 할인 적용`;
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

      if (typeof onEventsChange === 'function') {
        await onEventsChange(updatedEvents);
      } else {
        console.error('[handleDeleteEvent] onEventsChange is not a function');
        setError(
          language === 'kor'
            ? '이벤트 삭제 실패: onEventsChange가 정의되지 않았습니다.'
            : 'Failed to delete event: onEventsChange is not defined.'
        );
      }

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

  const handleCancelEdit = () => {
    setEditingEvent(null);
    setShowEventForm(false);
  };

  const getMaxDiscount = (roomType, date) => {
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
      .reduce((max, event) => {
        if (event.discountType === 'percentage') {
          return Math.max(max, event.discountValue);
        } else if (event.discountType === 'fixed') {
          return Math.max(max, event.discountValue);
        }
        return max;
      }, 0);
  };

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
                    {language === 'kor' ? '고정 금액' : 'Fixed Amount'}
                  </option>
                </select>
              </label>
              <label>
                {language === 'kor' ? '할인 값' : 'Discount Value'}
                <input
                  type="number"
                  name="discountValue"
                  placeholder={
                    language === 'kor' ? '할인 값' : 'Discount Value'
                  }
                  min="0"
                  value={
                    editingEvent
                      ? editingEvent.discountValue
                      : newEvent.discountValue
                  }
                  onChange={handleEventChange}
                  disabled={isLoading}
                />
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
                />
              </label>
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
                          (재고 {roomType.stock}{' '}
                          {language === 'kor' ? '개' : 'rooms'})
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
                onClick={
                  editingEvent
                    ? handleCancelEdit
                    : () => setShowEventForm(false)
                }
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
                    ? '고정 금액'
                    : 'Fixed Amount'}
                </p>
                <p>
                  {language === 'kor' ? '할인 값' : 'Discount Value'}:{' '}
                  {event.discountType === 'percentage'
                    ? `${event.discountValue}%`
                    : `${event.discountValue}원`}
                  {maxDiscount > event.discountValue && (
                    <span style={{ color: 'red' }}>
                      {' '}
                      (최대 적용: {maxDiscount}%
                      {event.discountType === 'fixed' ? '원' : ''})
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

export default function HotelSettingsPage() {
  const navigate = useNavigate();
  const originalDataRef = useRef(null);
  const [activeTab, setActiveTab] = useState('info');
  const [language, setLanguage] = useState('kor');
  const [hotelId, setHotelId] = useState(localStorage.getItem('hotelId') || '');
  const [isExisting, setIsExisting] = useState(false);
  const [error, setError] = useState('');
  const [totalRooms, setTotalRooms] = useState(
    initializedDefaultRoomTypes.reduce((sum, rt) => sum + rt.stock, 0)
  );
  const [roomTypes, setRoomTypes] = useState([...initializedDefaultRoomTypes]);
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
        setFloors(
          DEFAULT_FLOORS.map((floorNum) => ({ floorNum, containers: [] }))
        );
        setTotalRooms(
          initializedDefaultRoomTypes.reduce((sum, rt) => sum + rt.stock, 0)
        );
        setRoomTypes([...initializedDefaultRoomTypes]);
        setEvents([]);
        setIsExisting(false);
        setError(
          language === 'kor'
            ? '호텔 ID가 없습니다. 초기 설정이 필요합니다.'
            : 'Hotel ID not found. Initial setup is required.'
        );
        return;
      }

      try {
        const [hotelData, userData] = await Promise.all([
          fetchHotelSettings(hotelId),
          fetchUserInfo(hotelId),
        ]);

        if (hotelData && hotelData._id) {
          setIsExisting(true);
          const containers =
            hotelData.gridSettings?.floors?.flatMap(
              (floor) => floor.containers
            ) || [];
          const updatedRoomTypes = buildRoomTypesWithNumbers(
            hotelData.roomTypes,
            containers
          ).map((rt) => ({
            ...rt,
            isBaseRoom: rt.isBaseRoom || false,
          }));
          setRoomTypes(updatedRoomTypes);
          setTotalRooms(hotelData.totalRooms || 0);
          setFloors(hotelData.gridSettings?.floors || []);
          setAmenities(hotelData.amenities || DEFAULT_AMENITIES);
          setEvents(
            hotelData.eventSettings.map((event) => ({
              uuid: event.uuid || Date.now().toString(),
              eventName: event.eventName,
              startDate: new Date(event.startDate).toISOString().split('T')[0],
              endDate: new Date(event.endDate).toISOString().split('T')[0],
              discountType: event.discountType,
              discountValue: event.discountValue,
              isActive: event.isActive,
              applicableRoomTypes: event.applicableRoomTypes || [],
            })) || []
          );
          setCheckInTime(hotelData.checkInTime || '16:00');
          setCheckOutTime(hotelData.checkOutTime || '11:00');
          setHotelName(hotelData.hotelName || '');
          setHotelAddress(hotelData.address || '');
          setEmail(hotelData.email || '');
          setPhoneNumber(hotelData.phoneNumber || '');
          if (hotelData.latitude && hotelData.longitude) {
            setCoordinates({
              latitude: hotelData.latitude,
              longitude: hotelData.longitude,
            });
          }
        } else {
          setIsExisting(false);
          setRoomTypes([...initializedDefaultRoomTypes]);
          setFloors(
            DEFAULT_FLOORS.map((floorNum) => ({ floorNum, containers: [] }))
          );
          setTotalRooms(
            initializedDefaultRoomTypes.reduce((sum, rt) => sum + rt.stock, 0)
          );
          setEvents([]);
          setError(
            language === 'kor'
              ? '호텔 설정이 없습니다. 초기 설정이 필요합니다.'
              : 'Hotel settings not found. Initial setup is required.'
          );
        }

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
              ? '사용자 정보를 불러오지 못했습니다.'
              : 'Failed to load user information.'
          );
        }
      } catch (err) {
        if (err.response?.status === 404) {
          setIsExisting(false);
          setRoomTypes([...initializedDefaultRoomTypes]);
          setFloors(
            DEFAULT_FLOORS.map((floorNum) => ({ floorNum, containers: [] }))
          );
          setTotalRooms(
            initializedDefaultRoomTypes.reduce((sum, rt) => sum + rt.stock, 0)
          );
          setEvents([]);
          setError(
            language === 'kor'
              ? '호텔 설정이 없습니다. 초기 설정이 필요합니다.'
              : 'Hotel settings not found. Initial setup is required.'
          );
        } else {
          setError(
            language === 'kor'
              ? '호텔 설정 또는 사용자 정보 로딩 실패: ' +
                  (err.response?.data?.message || err.message)
              : 'Failed to load hotel settings or user info: ' +
                  (err.response?.data?.message || err.message)
          );
          setIsExisting(false);
        }
      }
    }

    loadData();
  }, [hotelId, language]);

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

    const roomCounts = {};
    floors.forEach((floor) => {
      if (floor.containers && Array.isArray(floor.containers)) {
        floor.containers.forEach((cont) => {
          if (cont.isActive && cont.roomInfo) {
            const typeKey = cont.roomInfo.toLowerCase();
            roomCounts[typeKey] = (roomCounts[typeKey] || 0) + 1;
          }
        });
      }
    });

    const updatedRoomTypes = roomTypes.map((rt) => {
      const typeKey = rt.roomInfo.toLowerCase();
      const stock = roomCounts[typeKey] || 0;
      return {
        ...rt,
        isBaseRoom: rt.isBaseRoom,
        stock,
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
    };

    try {
      await updateHotelSettings(hotelId, payload);
      alert('객실 타입 및 공통 시설 정보가 저장되었습니다.');
      setRoomTypes(updatedRoomTypes);
    } catch (err) {
      alert('저장 실패: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleSaveLayout = async () => {
    if (!hotelId) {
      alert('호텔 ID는 필수입니다.');
      return;
    }

    const roomCounts = {};
    floors.forEach((floor) => {
      if (floor.containers && Array.isArray(floor.containers)) {
        floor.containers.forEach((cont) => {
          if (cont.isActive && cont.roomInfo) {
            const typeKey = cont.roomInfo.toLowerCase();
            roomCounts[typeKey] = (roomCounts[typeKey] || 0) + 1;
          }
        });
      }
    });

    const updatedRoomTypes = roomTypes.map((rt) => {
      const typeKey = rt.roomInfo.toLowerCase();
      const stock = roomCounts[typeKey] || 0;
      return {
        ...rt,
        stock,
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
    };

    try {
      await updateHotelSettings(hotelId, payload);
      alert('레이아웃 정보가 저장되었습니다.');
      setRoomTypes(updatedRoomTypes);
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
        setError(
          language === 'kor' ? '호텔 ID가 필요합니다.' : 'Hotel ID is required'
        );
        return;
      }
  
      if (!updatedEvents || updatedEvents.length === 0) {
        setMessage(
          language === 'kor' ? '저장할 이벤트가 없습니다.' : 'No events to save'
        );
        setTimeout(() => setMessage(''), 3000);
        return;
      }
  
      const formattedEvents = updatedEvents.map((event) => {
        const startDateKST = toZonedTime(new Date(event.startDate), 'Asia/Seoul');
        const endDateKST = toZonedTime(new Date(event.endDate), 'Asia/Seoul');
        return {
          uuid: event.uuid || generateUniqueId(),
          eventName: event.eventName || '특가 이벤트',
          startDate: startDateKST.toISOString(),
          endDate: endDateKST.toISOString(),
          discountType: event.discountType || 'percentage',
          discountValue: Number(event.discountValue) || 0,
          isActive: event.isActive ?? true,
          applicableRoomTypes: Array.isArray(event.applicableRoomTypes)
            ? event.applicableRoomTypes.filter(
                (roomType) => roomType && roomType.trim()
              )
            : [],
        };
      });
  
      const payload = {
        eventSettings: formattedEvents,
        roomTypes,
      };
  
      console.log('[handleSaveEvents] Sending payload:', {
        eventSettings: formattedEvents,
        roomTypes: roomTypes.map((rt) => ({
          roomInfo: rt.roomInfo,
          discount: rt.discount,
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
        .filter((rt) => rt.discount > 0)
        .map((rt) => `${rt.nameKor}: ${rt.discount}% 할인 적용`);
      const feedbackMessage = affectedRooms.length > 0
        ? `${language === 'kor' ? '이벤트가 저장되었습니다. 할인 적용 객실: ' : 'Events saved successfully. Discount applied to: '}${affectedRooms.join(', ')}`
        : language === 'kor'
        ? '이벤트가 저장되었습니다.'
        : 'Events saved successfully';
  
      setMessage(feedbackMessage);
      setError('');
      setTimeout(() => setMessage(''), 5000);
    } catch (err) {
      console.error(
        '[handleSaveEvents] 상세 오류:',
        err,
        err.response,
        err.request
      );
      setError(
        language === 'kor'
          ? `이벤트 저장 실패: ${err.message}${err.response ? ` (상태 코드: ${err.response.status})` : ''}`
          : `Failed to save events: ${err.message}${err.response ? ` (Status code: ${err.response.status})` : ''}`
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
            error.includes('Initial setup is required')
              ? 'info-message'
              : 'error-message'
          }
          role="alert"
          style={{
            color:
              error.includes('초기 설정이 필요합니다') ||
              error.includes('Initial setup is required')
                ? '#4CAF50'
                : 'red',
            fontWeight: 'bold',
            textAlign: 'center',
            margin: '20px 0',
          }}
        >
          {error}
          {(error.includes('초기 설정이 필요합니다') ||
            error.includes('Initial setup is required')) && (
            <span>
              {' '}
              {language === 'kor'
                ? '위의 "디폴트 설정 불러오기" 버튼을 눌러 시작하세요.'
                : 'Click the "Load Default Settings" button above to get started.'}
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
        {/* 이벤트 탭에서는 저장 버튼 제거 */}
      </div>
      {message && <p className="success-message">{message}</p>}
      {error && <p className="error-message">{error}</p>}
    </div>
  );
}

export { HotelSettingsPage };
