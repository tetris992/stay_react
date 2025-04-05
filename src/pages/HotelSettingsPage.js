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

import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { v4 as uuidv4 } from 'uuid';
import { toZonedTime } from 'date-fns-tz';
import api from '../api/api';

// 기본 층 설정
const DEFAULT_FLOORS = [2, 3, 4, 5, 6, 7, 8];

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
];

// 사진 업로드 관련 상수
const DEFAULT_PASSWORD = '##11';
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_FORMATS = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_RESOLUTION = { width: 1920, height: 1080 };

// 초기 객실 타입 설정 – DEFAULT_AMENITIES에서 in‑room만 필터링
const initializedDefaultRoomTypes = defaultRoomTypes.map((rt) => ({
  ...rt,
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
  }));

  containers.forEach((cont) => {
    const tKey = (cont.roomInfo || '').toLowerCase();
    const found = cloned.find(
      (rt) => (rt.roomInfo || '').toLowerCase() === tKey
    );
    if (found && cont.roomNumber) {
      found.roomNumbers.push(cont.roomNumber);
    }
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

  // 수정된 부분: 필터링된 배열의 인덱스가 아닌, 고유 식별자인 nameKor를 기준으로 변경
  const handleRoomAmenityChange = (roomIndex, amenityNameKor) => {
    setRoomTypes((prev) => {
      const updated = [...prev];
      updated[roomIndex] = {
        ...updated[roomIndex],
        roomAmenities: updated[roomIndex].roomAmenities.map((amenity) =>
          amenity.nameKor === amenityNameKor
            ? { ...amenity, isActive: !amenity.isActive }
            : amenity
        ),
      };
      return updated;
    });
  };

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
          <h4>
            {language === 'kor' ? rt.nameKor : rt.nameEng} ({rt.nameEng})
          </h4>
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
}) {
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
function PhotoUploadSection({ hotelId, roomTypes, hotelInfo }) {
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
        setPasswordError('비밀번호가 올바르지 않습니다.');
      }
    } catch (err) {
      if (password === DEFAULT_PASSWORD) {
        setIsAuthenticated(true);
      } else {
        setPasswordError(
          '비밀번호 인증 실패: ' + (err.response?.data?.message || err.message)
        );
      }
    }
  };

  useEffect(() => {
    if (!hotelId || !roomTypes) {
      setError('호텔 ID 또는 객실 타입 정보가 없습니다.');
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
        const photos = response.data.photos || [];
        const newRoomPhotos = { ...initialRoomPhotos };
        photos
          .filter((photo) => photo.category === 'room')
          .forEach((photo) => {
            if (newRoomPhotos[photo.subCategory]) {
              newRoomPhotos[photo.subCategory].push({
                photoUrl: photo.photoUrl,
                order: photo.order,
              });
            }
          });
        setRoomPhotos(newRoomPhotos);
        const newExteriorPhotos = photos
          .filter((photo) => photo.category === 'exterior')
          .map((photo) => ({ photoUrl: photo.photoUrl, order: photo.order }));
        setExteriorPhotos(newExteriorPhotos);
        const newFacilityPhotos = { ...initialFacilityPhotos };
        photos
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
          '사진 로드 실패: ' + (err.response?.data?.message || err.message)
        );
      }
    };
    fetchPhotos();
  }, [hotelId, roomTypes]);

  const validateFile = (file) => {
    if (!ALLOWED_FORMATS.includes(file.type)) {
      return `허용된 파일 형식은 ${ALLOWED_FORMATS.join(', ')}입니다.`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return '파일 크기는 5MB를 초과할 수 없습니다.';
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
            `해상도는 ${MAX_RESOLUTION.width}x${MAX_RESOLUTION.height}을 초과할 수 없습니다.`
          );
        } else {
          resolve();
        }
        URL.revokeObjectURL(img.src);
      };
      img.onerror = () => reject('이미지 로드 실패');
    });
  };

  const handleFileChange = (category, subCategory, e) => {
    const files = Array.from(e.target.files);
    const filePromises = files.map((file) => validateFile(file));
    Promise.all(filePromises)
      .then(() => {
        if (category === 'room') {
          setRoomFiles((prev) => ({
            ...prev,
            [subCategory]: files.map((file) => ({ file, order: 1 })),
          }));
        } else if (category === 'exterior') {
          setExteriorFiles(files.map((file) => ({ file, order: 1 })));
        } else if (category === 'facility') {
          setFacilityFiles((prev) => ({
            ...prev,
            [subCategory]: files.map((file) => ({ file, order: 1 })),
          }));
        }
      })
      .catch((err) => setError(err));
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
      setError('파일을 선택하세요.');
      return;
    }
    try {
      const uploadPromises = files.map(async (fileObj) => {
        const formData = new FormData();
        formData.append('photo', fileObj.file);
        formData.append('hotelId', hotelId);
        formData.append('category', category);
        formData.append('subCategory', subCategory);
        formData.append('order', fileObj.order);
        const response = await api.post('/api/hotel-settings/photos', formData);
        return { photoUrl: response.data.photo.photoUrl, order: fileObj.order };
      });
      const newPhotos = await Promise.all(uploadPromises);
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
      setMessage('사진이 성공적으로 업로드되었습니다.');
      setError('');
    } catch (err) {
      const errorMsg = err.response?.data?.message || '알 수 없는 오류';
      setError(`업로드 실패: ${errorMsg}`);
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
      setMessage('사진이 삭제되었습니다.');
      setError('');
    } catch (err) {
      const errorMsg = err.response?.data?.message || '알 수 없는 오류';
      setError(`삭제 실패: ${errorMsg}`);
      setMessage('');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="photo-upload-container">
        <div className="password-card">
          <h1>호텔 사진 관리</h1>
          <div className="password-prompt">
            <label htmlFor="password">관리자 비밀번호 입력</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호를 입력하세요"
            />
            <button
              className="photo-upload-submit-password-btn"
              onClick={handlePasswordSubmit}
            >
              확인
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
          <h2>호텔 정보</h2>
          {hotelInfo ? (
            <div className="hotel-details">
              <p>
                <strong>호텔 ID:</strong> {hotelInfo.hotelId}
              </p>
              <p>
                <strong>호텔 이름:</strong> {hotelInfo.hotelName}
              </p>
              <p>
                <strong>주소:</strong> {hotelInfo.address}
              </p>
              <p>
                <strong>관리자 이름:</strong> {hotelInfo.adminName}
              </p>
              <p>
                <strong>이메일:</strong> {hotelInfo.email}
              </p>
              <p>
                <strong>전화번호:</strong> {hotelInfo.phoneNumber}
              </p>
            </div>
          ) : (
            <p>호텔 정보를 로드할 수 없습니다.</p>
          )}
        </div>
      </div>
      {error && <p className="error-message center-text">{error}</p>}
      {message && <p className="success-message center-text">{message}</p>}
      <section className="photo-upload-section">
        <h2 className="section-title">객실 사진</h2>
        {roomTypes &&
          roomTypes.map((rt) => (
            <div key={rt.roomInfo} className="photo-upload-card">
              <div className="photo-upload-header">
                <h3>
                  {rt.nameKor} ({rt.nameEng})
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
                      placeholder="순서"
                      className="order-input"
                    />
                  </div>
                ))}
                <button
                  className="photo-upload-upload-btn"
                  onClick={() => handleUpload('room', rt.roomInfo)}
                >
                  <FaCamera /> 업로드
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
                      aria-label="사진 삭제"
                    >
                      <FaTrash />
                    </button>
                    <span className="thumbnail-order">순서: {photo.order}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
      </section>
      <section className="photo-upload-section">
        <h2 className="section-title">호텔 전경 사진</h2>
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
                  placeholder="순서"
                  className="order-input"
                />
              </div>
            ))}
            <button
              className="photo-upload-upload-btn"
              onClick={() => handleUpload('exterior', 'default')}
            >
              <FaCamera /> 업로드
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
                  aria-label="사진 삭제"
                >
                  <FaTrash />
                </button>
                <span className="thumbnail-order">순서: {photo.order}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="photo-upload-section">
        <h2 className="section-title">기타 시설 사진</h2>
        {Object.keys(facilityPhotos).map((subCat) => (
          <div key={subCat} className="photo-upload-card">
            <div className="photo-upload-header">
              <h3>{subCat.charAt(0).toUpperCase() + subCat.slice(1)}</h3>
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
                    placeholder="순서"
                    className="order-input"
                  />
                </div>
              ))}
              <button
                className="photo-upload-upload-btn"
                onClick={() => handleUpload('facility', subCat)}
              >
                <FaCamera /> 업로드
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
                    aria-label="사진 삭제"
                  >
                    <FaTrash />
                  </button>
                  <span className="thumbnail-order">순서: {photo.order}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

// 메인 컴포넌트
export default function HotelSettingsPage() {
  const navigate = useNavigate();
  const originalDataRef = useRef(null);
  const [activeTab, setActiveTab] = useState('info');
  const [language, setLanguage] = useState('kor'); // 언어 상태 ('kor' 또는 'eng')
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

  // 언어 전환 함수
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
        setIsExisting(false);
        return;
      }

      try {
        const [hotelData, userData] = await Promise.all([
          fetchHotelSettings(hotelId),
          fetchUserInfo(hotelId),
        ]);

        if (hotelData && hotelData._id) {
          setIsExisting(true);

          // containers 배열을 추출 (객실 번호를 위해)
          const containers =
            hotelData.gridSettings?.floors?.flatMap(
              (floor) => floor.containers
            ) || [];

          // buildRoomTypesWithNumbers 함수를 사용하여 roomTypes를 업데이트
          const updatedRoomTypes = buildRoomTypesWithNumbers(
            hotelData.roomTypes,
            containers
          );
          setRoomTypes(updatedRoomTypes);

          // 나머지 호텔 설정 필드 업데이트
          setTotalRooms(hotelData.totalRooms || 0);
          setFloors(hotelData.gridSettings?.floors || []);
          setAmenities(hotelData.amenities || DEFAULT_AMENITIES);
          setCheckInTime(hotelData.checkInTime || '16:00');
          setCheckOutTime(hotelData.checkOutTime || '11:00');
          setHotelName(hotelData.hotelName || '');
          setHotelAddress(hotelData.address || '');
          setEmail(hotelData.email || '');
          setPhoneNumber(hotelData.phoneNumber || '');
        } else {
          setIsExisting(false);
          setRoomTypes([...initializedDefaultRoomTypes]);
          setFloors(
            DEFAULT_FLOORS.map((floorNum) => ({ floorNum, containers: [] }))
          );
          setTotalRooms(
            initializedDefaultRoomTypes.reduce((sum, rt) => sum + rt.stock, 0)
          );
        }

        if (userData) {
          // User 문서의 필드 업데이트 (User 정보가 우선순위인 경우)
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
          setError('사용자 정보를 불러오지 못했습니다.');
        }
      } catch (err) {
        setError(
          '호텔 설정 또는 사용자 정보 로딩 실패: ' +
            (err.response?.data?.message || err.message)
        );
        setIsExisting(false);
      }
    }

    loadData();
  }, [hotelId, language]);

  const handleLoadDefault = () => {
    const defaultRoomTypesCopy = defaultRoomTypes.map((rt) => ({
      ...rt,
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
    floors.forEach((floor) => {
      floor.containers.forEach((cont) => {
        if (cont.roomInfo && cont.roomNumber) {
          const typeIdx = newRoomTypes.findIndex(
            (rt) => rt.roomInfo === cont.roomInfo
          );
          if (typeIdx !== -1) {
            const currentRoomNumbers = newRoomTypes[typeIdx].roomNumbers || [];
            if (!currentRoomNumbers.includes(cont.roomNumber)) {
              newRoomTypes[typeIdx].roomNumbers = (
                currentRoomNumbers || []
              ).concat([cont.roomNumber]);
              newRoomTypes[typeIdx].roomNumbers.sort(
                (a, b) => parseInt(a, 10) - parseInt(b, 10)
              );
              newRoomTypes[typeIdx].stock =
                newRoomTypes[typeIdx].roomNumbers.length;
              hasChanges = true;
            }
          }
        }
      });
    });
    return { roomTypes: hasChanges ? newRoomTypes : roomTypes, hasChanges };
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
      roomTypes: updatedRoomTypes.hasChanges
        ? updatedRoomTypes.roomTypes
        : roomTypes,
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
    roomTypes,
    amenities,
    updatedRoomTypes.roomTypes,
  ]);

  // 탭별 부분 저장 함수들
  const handleSaveHotelInfo = async () => {
    if (!hotelId) {
      alert('호텔 ID는 필수입니다.');
      return;
    }

    // User 업데이트용 payload (hotelId 제외)
    const userPayload = {
      hotelName,
      email,
      phoneNumber,
      address: hotelAddress,
    };

    // HotelSettings 업데이트용 payload
    const settingsPayload = {
      hotelId,
      hotelName,
      hotelAddress,
      email,
      phoneNumber,
      checkInTime,
      checkOutTime,
    };

    try {
      if (isExisting) {
        await Promise.all([
          updateUser(hotelId, userPayload), // PATCH /api/auth/users/:hotelId
          updateHotelSettings(hotelId, settingsPayload), // PATCH /api/hotel-settings/:hotelId
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
    // 공통 시설 + 객실 타입 시설 모두 담아서 전송
    const payload = {
      hotelId,
      amenities, // 공통 시설
      roomTypes: roomTypes.map((rt) => ({
        ...rt,
        aliases: (rt.aliases || []).filter(Boolean),
        stock: (rt.roomNumbers || []).length,
        roomAmenities: rt.roomAmenities.map((amenity) => ({
          nameKor: amenity.nameKor,
          nameEng: amenity.nameEng,
          icon: amenity.icon,
          type: amenity.type,
          isActive: amenity.isActive,
        })),
      })),
    };

    try {
      await updateHotelSettings(hotelId, payload);
      alert('객실 타입 및 공통 시설 정보가 저장되었습니다.');
    } catch (err) {
      alert('저장 실패: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleSaveLayout = async () => {
    if (!hotelId) {
      alert('호텔 ID는 필수입니다.');
      return;
    }
    const payload = {
      hotelId,
      gridSettings: { floors },
    };
    try {
      await updateHotelSettings(hotelId, payload);
      alert('레이아웃 정보가 저장되었습니다.');
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
        {/* isExisting이 false일 때만 "디폴트 불러오기" 버튼 표시 */}
        {!isExisting && (
          <button
            className="hotel-settings-btn"
            onClick={handleLoadDefault}
            aria-label="디폴트 설정 불러오기"
          >
            디폴트 불러오기
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
        <p className="error-message" role="alert">
          {error}
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
          />
        )}
      </div>
      {/* 탭 콘텐츠 아래, 중앙에 활성 탭별로 저장 버튼을 렌더링 */}
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
      </div>
    </div>
  );
}
export { HotelSettingsPage };
