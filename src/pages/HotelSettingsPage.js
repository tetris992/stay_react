import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchHotelSettings,
  updateHotelSettings,
  registerHotel,
  fetchUserInfo,
} from '../api/api';
import { defaultRoomTypes } from '../config/defaultRoomTypes';
import { getColorForRoomType } from '../utils/getColorForRoomType';
import './HotelSettingsPage.css';
import { FaBed, FaMinus, FaPlus, FaTrash, FaUndo } from 'react-icons/fa';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

const DEFAULT_FLOORS = [2, 3, 4, 5, 6, 7, 8];

const initializedDefaultRoomTypes = defaultRoomTypes.map((rt) => ({
  ...rt,
  aliases: [], // 빈 배열로 초기화
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
}));

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

function RoomTypeEditor({ roomTypes, setRoomTypes }) {
  const addRoomType = () => {
    setRoomTypes((prev) => [
      ...prev,
      {
        roomInfo: '',
        nameKor: '',
        nameEng: '',
        price: 0,
        stock: 0,
        aliases: [], // 빈 배열로 초기화
        roomNumbers: [],
        floorSettings: {},
        startRoomNumbers: {},
      },
    ]);
  };

  const updateRoomType = (index, field, value, aliasIndex = null) => {
    setRoomTypes((prev) => {
      const updated = [...prev];
      if (field === 'price') {
        updated[index][field] = Number(value);
      } else if (field === 'nameKor' || field === 'nameEng') {
        updated[index][field] = value;
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

  const removeRoomType = (index) => {
    setRoomTypes((prev) => prev.filter((_, i) => i !== index));
  };

  const generateAllRoomNumbers = () => {
    setRoomTypes((prev) =>
      prev.map((rt, idx) => {
        const floorNum = DEFAULT_FLOORS[idx % DEFAULT_FLOORS.length];
        const startNum = parseInt(`${floorNum}01`, 10);
        const roomCount = rt.stock || 7;
        const newRoomNumbers = Array.from(
          { length: roomCount },
          (_, i) => `${startNum + i}`
        );
        return {
          ...rt,
          roomNumbers: newRoomNumbers,
          stock: newRoomNumbers.length,
          floorSettings: { [floorNum]: newRoomNumbers.length },
          startRoomNumbers: { [floorNum]: `${startNum}` },
        };
      })
    );
  };

  return (
    <section className="room-types-section">
      <h2>객실 타입 설정</h2>
      <div className="room-types-container">
        {roomTypes.map((rt, idx) => (
          <div key={idx} className="room-type-item">
            <div className="room-type-header">
              <FaBed /> 객실 타입 {idx + 1}
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
                />
                <input
                  className="name-eng"
                  type="text"
                  placeholder="영어 이름"
                  value={rt.nameEng || ''}
                  onChange={(e) =>
                    updateRoomType(idx, 'nameEng', e.target.value)
                  }
                />
              </div>
              <div className="field-row">
                <input
                  className="price"
                  type="number"
                  placeholder="가격"
                  value={rt.price || 0}
                  onChange={(e) => updateRoomType(idx, 'price', e.target.value)}
                />
                <input
                  className="stock"
                  type="number"
                  placeholder="객실 수"
                  value={rt.stock || 0}
                  readOnly
                />
              </div>
              <button
                className="remove-btn"
                onClick={() => removeRoomType(idx)}
              >
                <FaTrash />
              </button>
            </div>
            <div className="room-type-aliases">
              <div className="field-row">
                <input
                  type="text"
                  placeholder="별칭 1"
                  value={rt.aliases[0] || ''} // 빈 값 유지, 플레이스홀더로만 표시
                  onChange={(e) =>
                    updateRoomType(idx, 'aliases', e.target.value, 0)
                  }
                />
                <input
                  type="text"
                  placeholder="별칭 2"
                  value={rt.aliases[1] || ''}
                  onChange={(e) =>
                    updateRoomType(idx, 'aliases', e.target.value, 1)
                  }
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
                />
                <input
                  type="text"
                  placeholder="별칭 4"
                  value={rt.aliases[3] || ''}
                  onChange={(e) =>
                    updateRoomType(idx, 'aliases', e.target.value, 3)
                  }
                />
              </div>
            </div>
            <div className="room-numbers">
              <h4>객실 번호 배열</h4>
              <div>
                {rt.roomNumbers?.length > 0
                  ? rt.roomNumbers.join(', ')
                  : '아직 생성되지 않음'}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="room-type-actions">
        <button className="action-btn add-btn" onClick={addRoomType}>
          + 타입 추가
        </button>
        <button
          className="action-btn generate-btn"
          onClick={generateAllRoomNumbers}
        >
          객실 번호 생성
        </button>
      </div>
    </section>
  );
}

function LayoutEditor({ roomTypes, setRoomTypes, floors, setFloors }) {
  const maxRoomsPerFloor = Math.max(...roomTypes.map((rt) => rt.stock || 7), 7);
  const previousFloorsRef = useRef([]);

  const updateContainer = (floorNum, containerId, field, value) => {
    setFloors((prev) => {
      const updated = [...prev];
      const floorIdx = updated.findIndex((f) => f.floorNum === floorNum);
      if (floorIdx === -1) return prev;
      const containerIdx = updated[floorIdx].containers.findIndex(
        (c) => c.containerId === containerId
      );
      if (containerIdx === -1) return prev;
      const oldRoomInfo = updated[floorIdx].containers[containerIdx].roomInfo;
      updated[floorIdx].containers[containerIdx][field] =
        field === 'price' ? Number(value) : value;

      if (field === 'roomInfo') {
        const newRoomInfo = value;
        let roomNum = updated[floorIdx].containers[containerIdx].roomNumber;
        console.log(
          `Updating roomInfo from ${oldRoomInfo} to ${newRoomInfo}, roomNumber: ${roomNum}`
        );

        if (newRoomInfo === 'none') {
          // "객실없음"으로 변경 시 번호 제거, 물리적 위치 유지
          updated[floorIdx].containers[containerIdx].roomNumber = '';
          updated[floorIdx].containers[containerIdx].price = 0;
        } else if (!roomNum) {
          // "객실없음"에서 다른 타입으로 변경 시 새로운 번호 부여
          const activeContainers = updated[floorIdx].containers.filter(
            (c) => c.roomInfo !== 'none' && c.roomNumber
          );
          const lastNum = activeContainers.length
            ? Math.max(...activeContainers.map((c) => parseInt(c.roomNumber, 10)))
            : parseInt(`${floorNum}00`, 10);
          roomNum = `${floorNum}${(lastNum + 1 - parseInt(floorNum + '00')).toString().padStart(2, '0')}`;
          updated[floorIdx].containers[containerIdx].roomNumber = roomNum;
          updated[floorIdx].containers[containerIdx].price =
            roomTypes.find((rt) => rt.roomInfo === newRoomInfo)?.price || 0;
        }

        setRoomTypes((prevTypes) => {
          const updatedTypes = [...prevTypes];
          if (oldRoomInfo !== 'none' && roomNum) {
            const oldIdx = updatedTypes.findIndex(
              (rt) => rt.roomInfo === oldRoomInfo
            );
            if (oldIdx !== -1) {
              updatedTypes[oldIdx].roomNumbers = updatedTypes[
                oldIdx
              ].roomNumbers.filter((num) => num !== roomNum);
              updatedTypes[oldIdx].stock = updatedTypes[oldIdx].roomNumbers.length;
            }
          }
          if (newRoomInfo !== 'none' && roomNum) {
            const newIdx = updatedTypes.findIndex(
              (rt) => rt.roomInfo === newRoomInfo
            );
            if (newIdx !== -1) {
              updatedTypes[newIdx].roomNumbers.push(roomNum);
              updatedTypes[newIdx].roomNumbers.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
              updatedTypes[newIdx].stock = updatedTypes[newIdx].roomNumbers.length;
            }
          }
          return updatedTypes;
        });
      }
      return updated;
    });
  };

  const removeFloor = (floorNum) => {
    setFloors((prev) => {
      if (!prev || !Array.isArray(prev)) return prev;
      previousFloorsRef.current = [...prev];
      const updated = prev.filter((f) => f.floorNum !== floorNum);
      setRoomTypes((prevTypes) => {
        const updatedTypes = [...prevTypes];
        updatedTypes.forEach((rt) => {
          rt.roomNumbers = (rt.roomNumbers || []).filter(
            (num) => !num.startsWith(String(floorNum))
          );
          rt.stock = rt.roomNumbers.length;
        });
        return updatedTypes;
      });
      return updated;
    });
  };

  const undoRemoveFloor = () => {
    if (previousFloorsRef.current.length > 0) {
      setFloors([...previousFloorsRef.current]);
      setRoomTypes((prevTypes) => {
        const updatedTypes = [...prevTypes];
        updatedTypes.forEach((rt) => {
          rt.roomNumbers = (rt.roomNumbers || []).map((num) => num);
          rt.stock = rt.roomNumbers.length;
        });
        return updatedTypes;
      });
      previousFloorsRef.current = [];
    } else {
      alert('되돌릴 삭제가 없습니다.');
    }
  };

  const addRoomToFloor = (floorNum) => {
    const defaultRoomType = initializedDefaultRoomTypes[0];
    setFloors((prev) => {
      const updated = [...prev];
      const floorIdx = updated.findIndex((f) => f.floorNum === floorNum);
      if (floorIdx === -1) return prev;

      const activeContainers = updated[floorIdx].containers.filter(
        (c) => c.roomInfo !== 'none' && c.roomNumber
      );
      const lastNum = activeContainers.length
        ? Math.max(...activeContainers.map((c) => parseInt(c.roomNumber, 10)))
        : parseInt(`${floorNum}00`, 10);
      const newRoomNum = `${floorNum}${(lastNum + 1 - parseInt(floorNum + '00')).toString().padStart(2, '0')}`;

      const newContainer = {
        containerId: `${floorNum}-${defaultRoomType.roomInfo}-${newRoomNum}-${Date.now()}`,
        roomInfo: defaultRoomType.roomInfo,
        roomNumber: newRoomNum,
        price: defaultRoomType.price,
        isActive: true,
      };
      updated[floorIdx].containers.push(newContainer);
      return updated;
    });

    setRoomTypes((prevTypes) => {
      const updatedTypes = [...prevTypes];
      const typeIdx = updatedTypes.findIndex(
        (rt) => rt.roomInfo === defaultRoomType.roomInfo
      );
      if (typeIdx !== -1) {
        const lastNum = updatedTypes[typeIdx].roomNumbers.length
          ? Math.max(...updatedTypes[typeIdx].roomNumbers.map((n) => parseInt(n, 10)))
          : parseInt(`${floorNum}00`, 10);
        const newRoomNum = `${floorNum}${(lastNum + 1 - parseInt(floorNum + '00')).toString().padStart(2, '0')}`;
        updatedTypes[typeIdx].roomNumbers.push(newRoomNum);
        updatedTypes[typeIdx].roomNumbers.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
        updatedTypes[typeIdx].stock = updatedTypes[typeIdx].roomNumbers.length;
      }
      return updatedTypes;
    });
  };

  const removeContainer = (floorNum, containerId) => {
    setFloors((prev) => {
      const updated = [...prev];
      const floorIdx = updated.findIndex((f) => f.floorNum === floorNum);
      if (floorIdx === -1) return prev;
      const containerIdx = updated[floorIdx].containers.findIndex(
        (c) => c.containerId === containerId
      );
      if (containerIdx === -1) return prev;

      const removedRoomInfo = updated[floorIdx].containers[containerIdx].roomInfo;
      const removedRoomNum = updated[floorIdx].containers[containerIdx].roomNumber;
      updated[floorIdx].containers.splice(containerIdx, 1); // 물리적 위치 제거

      if (removedRoomInfo !== 'none') {
        setRoomTypes((prevTypes) => {
          const updatedTypes = [...prevTypes];
          const typeIdx = updatedTypes.findIndex(
            (rt) => rt.roomInfo === removedRoomInfo
          );
          if (typeIdx !== -1) {
            updatedTypes[typeIdx].roomNumbers = updatedTypes[typeIdx].roomNumbers.filter(
              (num) => num !== removedRoomNum
            );
            updatedTypes[typeIdx].stock = updatedTypes[typeIdx].roomNumbers.length;
          }
          return updatedTypes;
        });
      }
      return updated;
    });
  };

  const generateInitialLayout = () => {
    const newFloors = DEFAULT_FLOORS.map((floorNum) => {
      const containers = [];
      for (let i = 0; i < maxRoomsPerFloor; i++) {
        const roomNum = `${floorNum}${(i + 1).toString().padStart(2, '0')}`;
        const rt = roomTypes[i % roomTypes.length];
        containers.push({
          containerId: `${floorNum}-${rt.roomInfo}-${roomNum}-${Date.now()}`,
          roomInfo: rt.roomInfo,
          roomNumber: roomNum,
          price: rt.price,
          isActive: true,
        });
      }
      return { floorNum, containers };
    });

    setFloors(newFloors);
    setRoomTypes((prevTypes) => {
      const updatedTypes = [...prevTypes];
      newFloors.forEach((floor) => {
        floor.containers.forEach((cont) => {
          if (cont.roomInfo !== 'none' && cont.roomNumber) {
            const typeIdx = updatedTypes.findIndex(
              (rt) => rt.roomInfo === cont.roomInfo
            );
            if (typeIdx !== -1 && !updatedTypes[typeIdx].roomNumbers.includes(cont.roomNumber)) {
              updatedTypes[typeIdx].roomNumbers.push(cont.roomNumber);
              updatedTypes[typeIdx].stock = updatedTypes[typeIdx].roomNumbers.length;
            }
          }
        });
      });
      return updatedTypes;
    });
  };

  return (
    <section className="layout-editor-section">
      <div className="layout-header">
        <h2>객실 레이아웃 편집</h2>
        <button
          className="action-btn generate-btn"
          onClick={generateInitialLayout}
          title="레이아웃 생성"
        >
          레이아웃 생성
        </button>
        <button
          className="action-btn undo-btn"
          onClick={undoRemoveFloor}
          title="되돌리기"
        >
          <FaUndo />
        </button>
      </div>
      <div className="floor-grid">
        {floors
          .slice()
          .reverse()
          .map((floor) => (
            <div key={floor.floorNum} className="floor-row">
              <div className="floor-header">
                <h3>
                  {floor.floorNum}층
                  <FaMinus
                    onClick={() => removeFloor(floor.floorNum)}
                    className="remove-icon"
                    title="객실 층 삭제"
                  />
                </h3>
              </div>
              <div className="containers">
                {floor.containers.map((cont, index) => (
                  <React.Fragment key={cont.containerId}>
                    <div
                      className={`container-box ${
                        cont.roomInfo === 'none' ? 'empty' : ''
                      }`}
                      style={{
                        backgroundColor:
                          cont.roomInfo !== 'none'
                            ? getColorForRoomType(cont.roomInfo)
                            : undefined,
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
                      >
                        <option value="none">객실없음</option>
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
                        disabled={cont.roomInfo === 'none'}
                      />
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
                        disabled={cont.roomInfo === 'none'}
                      />
                      <button
                        className="delete-btn"
                        onClick={() =>
                          removeContainer(floor.floorNum, cont.containerId)
                        }
                      >
                        <FaTrash />
                      </button>
                    </div>
                    {index === floor.containers.length - 1 && (
                      <button
                        className="action-btn add-room-btn"
                        onClick={() => addRoomToFloor(floor.floorNum)}
                        title="객실 추가"
                      >
                        <FaPlus />
                      </button>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          ))}
      </div>
    </section>
  );
}

export default function HotelSettingsPage() {
  const navigate = useNavigate();
  const originalDataRef = useRef(null);

  const [hotelId, setHotelId] = useState(localStorage.getItem('hotelId') || '');
  const [isExisting, setIsExisting] = useState(false);
  const [error, setError] = useState('');
  const [totalRooms, setTotalRooms] = useState(
    initializedDefaultRoomTypes.reduce((sum, rt) => sum + rt.stock, 0)
  );
  const [roomTypes, setRoomTypes] = useState([...initializedDefaultRoomTypes]);
  const [floors, setFloors] = useState([]);
  const [hotelAddress, setHotelAddress] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [hotelName, setHotelName] = useState('');
  const [adminName, setAdminName] = useState('');

  useEffect(() => {
    async function loadData() {
      if (!hotelId) {
        setFloors(
          DEFAULT_FLOORS.map((floorNum) => ({ floorNum, containers: [] }))
        );
        setTotalRooms(
          initializedDefaultRoomTypes.reduce((sum, rt) => sum + rt.stock, 0)
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
          setTotalRooms(
            hotelData.totalRooms ||
              initializedDefaultRoomTypes.reduce((sum, rt) => sum + rt.stock, 0)
          );
          const containers =
            hotelData.gridSettings?.floors?.flatMap(
              (floor) => floor.containers
            ) || [];
          const updatedRoomTypes = buildRoomTypesWithNumbers(
            hotelData.roomTypes.map((rt) => ({
              ...rt,
              aliases: [],
            })) || initializedDefaultRoomTypes,
            containers
          );
          setRoomTypes(updatedRoomTypes);
          setFloors(
            hotelData.gridSettings?.floors ||
              DEFAULT_FLOORS.map((floorNum) => ({ floorNum, containers: [] }))
          );
          setHotelAddress(hotelData.address || '');
          setEmail(hotelData.email || '');
          setPhoneNumber(hotelData.phoneNumber || '');
          setHotelName(hotelData.hotelName || '');
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
          setHotelName(userData.hotelName || hotelName);
          setAdminName(userData.adminName || '');
          setHotelAddress(userData.address || hotelAddress);
          setEmail(userData.email || email);
          setPhoneNumber(userData.phoneNumber || phoneNumber);
        }
      } catch (err) {
        console.error(err);
        setError('호텔 설정 또는 사용자 정보 로딩 실패: ' + err.message);
      }
    }
    loadData();
  }, [hotelId, email, phoneNumber, hotelAddress, hotelName]);

  useEffect(() => {
    const newTotal = floors.reduce(
      (sum, f) =>
        sum + (f.containers || []).filter((c) => c.roomInfo !== 'none').length,
      0
    );
    setTotalRooms(newTotal);
    originalDataRef.current = {
      hotelId,
      isExisting,
      totalRooms: newTotal,
      roomTypes,
      floors,
      hotelAddress,
      email,
      phoneNumber,
      hotelName,
    };
  }, [
    hotelId,
    isExisting,
    roomTypes,
    floors,
    hotelAddress,
    email,
    phoneNumber,
    hotelName,
  ]);

  const handleLoadDefault = () => {
    // 디폴트 roomTypes 초기화 (stock 및 roomNumbers 초기화)
    const defaultRoomTypes = initializedDefaultRoomTypes.map((rt) => ({
      ...rt,
      stock: rt.stock, // 각 타입의 기본 stock 유지 (예: 스탠다드 7, 프리미엄 6 등)
      roomNumbers: [], // roomNumbers 초기화
      aliases: [], // 빈 배열로 초기화
    }));

    // 기본 floors 설정 (각 층에 "객실없음"과 실제 객실 번호 순차적으로 배치)
    const newFloors = DEFAULT_FLOORS.map((floorNum, floorIdx) => {
      const containers = [];
      // "객실없음"을 맨 앞에 빈 공간으로 추가 (번호 없이)
      containers.push({
        containerId: `${floorNum}-none-${Date.now()}`,
        roomInfo: 'none',
        roomNumber: '',
        price: 0,
        isActive: false,
      });

      // 해당 층에 맞는 객실 타입 선택 (floorIdx로 순환)
      const roomType = defaultRoomTypes[floorIdx % defaultRoomTypes.length];
      const roomCount = roomType.stock || 7; // 각 타입의 stock 사용

      // 층별 순차 번호 부여 (예: 2층 201~207, 3층 301~306 등)
      for (let i = 0; i < roomCount; i++) {
        const roomNum = `${floorNum}${(i + 1).toString().padStart(2, '0')}`; // 2자리 숫자로 패딩 (예: 201, 202, ...)
        containers.push({
          containerId: `${floorNum}-${
            roomType.roomInfo
          }-${roomNum}-${Date.now()}`,
          roomInfo: roomType.roomInfo,
          roomNumber: roomNum,
          price: roomType.price,
          isActive: true,
        });
        // roomTypes에 roomNumbers와 stock 업데이트
        roomType.roomNumbers.push(roomNum);
      }

      return { floorNum, containers };
    });

    setRoomTypes(defaultRoomTypes); // roomTypes 업데이트
    setFloors(newFloors); // floors 업데이트
    setTotalRooms(
      defaultRoomTypes.reduce((sum, rt) => sum + rt.stock, 0) // 총 객실 수 계산
    );
    alert('디폴트 설정이 불러와졌습니다.');
  };

  const handleSaveAll = async () => {
    if (!hotelId) {
      alert('호텔 ID는 필수입니다.');
      return;
    }
    const allHaveRoomNumbers = roomTypes.every(
      (rt) => rt.roomNumbers && rt.roomNumbers.length > 0
    );
    if (!allHaveRoomNumbers) {
      alert('모든 객실 타입에 대해 객실 번호를 생성해야 저장할 수 있습니다.');
      return;
    }
    const payload = {
      hotelId,
      totalRooms,
      roomTypes: roomTypes.map((rt) => ({
        ...rt,
        aliases: rt.aliases.filter(Boolean), // 빈 문자열 제거
        stock: rt.roomNumbers.length,
        floorSettings: DEFAULT_FLOORS.reduce((acc, floorNum) => {
          const count = (rt.roomNumbers || []).filter((num) =>
            num.startsWith(String(floorNum))
          ).length;
          if (count > 0) acc[floorNum] = count;
          return acc;
        }, {}),
        startRoomNumbers: DEFAULT_FLOORS.reduce((acc, floorNum) => {
          const nums = (rt.roomNumbers || []).filter((num) =>
            num.startsWith(String(floorNum))
          );
          if (nums.length > 0) acc[floorNum] = nums[0];
          return acc;
        }, {}),
      })),
      gridSettings: { floors },
      address: hotelAddress,
      email,
      phoneNumber,
      hotelName,
    };
    try {
      if (isExisting) {
        console.log('Updating hotel settings with payload:', payload);
        await updateHotelSettings(hotelId, payload);
        alert('업데이트 완료');
      } else {
        console.log('Registering new hotel with payload:', payload);
        await registerHotel(payload);
        alert('등록 완료');
        setIsExisting(true);
      }
      // 저장 후 App.js에서 새 설정을 로드하도록 페이지 새로고침
      console.log('Navigating to main page and reloading...');
      navigate('/');
      window.location.reload(); // 새 설정을 즉시 반영하기 위해 페이지 새로고침
    } catch (err) {
      console.error('저장 실패:', err);
      alert('저장 실패: ' + err.message);
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
    setHotelAddress(orig.hotelAddress);
    setEmail(orig.email);
    setPhoneNumber(orig.phoneNumber);
    setHotelName(orig.hotelName);
    alert('변경 사항이 취소되었습니다.');
  };

  return (
    <div className="hotel-settings-page">
      <h1>호텔 설정</h1>
      <div className="button-group">
        <button className="action-btn" onClick={() => navigate('/')}>
          메인으로
        </button>
        <button className="action-btn" onClick={handleLoadDefault}>
          디폴트 불러오기
        </button>
        <button className="action-btn" onClick={handleCancel}>
          취소
        </button>
      </div>
      {error && <p className="error-message">{error}</p>}
      <section className="hotel-info-section">
        <div className="info-columns">
          <div className="basic-info">
            <h2>호텔 기본 정보</h2>
            <label>
              호텔 ID:
              <input
                value={hotelId}
                onChange={(e) => setHotelId(e.target.value)}
                disabled={isExisting}
              />
            </label>
            <label>
              총 객실 수:
              <input value={totalRooms} readOnly />
            </label>
            <label>
              호텔 주소:
              <input
                value={hotelAddress}
                onChange={(e) => setHotelAddress(e.target.value)}
                placeholder="호텔 주소를 입력하세요"
              />
            </label>
            <label>
              이메일:
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="이메일을 입력하세요"
              />
            </label>
            <label>
              전화번호:
              <input
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="전화번호를 입력하세요"
              />
            </label>
          </div>
          <div className="account-info">
            <h2>회원가입 정보</h2>
            <label>
              호텔 이름:
              <input
                value={hotelName}
                onChange={(e) => setHotelName(e.target.value)}
                placeholder="호텔 이름을 입력하세요"
              />
            </label>
            <label>
              관리자 이름:
              <input
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                placeholder="관리자 이름을 입력하세요"
              />
            </label>
            <label>
              비밀번호:
              <input
                type="password"
                value="********"
                readOnly
                placeholder="비밀번호 변경은 별도 처리"
              />
              <button className="action-btn change-pw-btn" disabled>
                비밀번호 변경 (미구현)
              </button>
            </label>
          </div>
        </div>
      </section>
      <RoomTypeEditor roomTypes={roomTypes} setRoomTypes={setRoomTypes} />
      <DndProvider backend={HTML5Backend}>
        <LayoutEditor
          roomTypes={roomTypes}
          setRoomTypes={setRoomTypes}
          floors={floors}
          setFloors={setFloors}
        />
      </DndProvider>
      <div className="save-section">
        <button className="action-btn save-btn" onClick={handleSaveAll}>
          전체 저장
        </button>
      </div>
    </div>
  );
}
