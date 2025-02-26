import React, { useEffect, useState, useRef, useMemo } from 'react';
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
import { v4 as uuidv4 } from 'uuid';

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
              <button
                className="remove-btn"
                onClick={() => removeRoomType(idx)}
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
            </div>
            <div className="room-type-aliases">
              <div className="field-row">
                <input
                  type="text"
                  placeholder="별칭 1"
                  value={rt.aliases[0] || ''}
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

// LayoutEditor: 객실 레이아웃 편집 컴포넌트
function LayoutEditor({ roomTypes, setRoomTypes, floors, setFloors }) {
  const previousFloorsRef = useRef([]);
  const [isAdding, setIsAdding] = useState(false); // 로딩 상태 추가

  /* --------------------------------------------------------------------------
     updateContainer:
     - 특정 층의 컨테이너 필드 업데이트
     - 고유 `containerId` 생성 및 중복 방지
  -------------------------------------------------------------------------- */
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
      container[field] = field === 'price' ? Number(value) : value;

      if (field === 'roomInfo') {
        if (!value || value === '') {
          return prev;
        }
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

        // 고유한 containerId 생성 (UUID 사용)
        const uniqueId = uuidv4();
        container.containerId = `${floorNum}-${value}-${container.roomNumber}-${uniqueId}`;

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

        // 층 내 컨테이너 정렬
        updated[floorIdx].containers.sort(
          (a, b) => parseInt(a.roomNumber, 10) - parseInt(b.roomNumber, 10)
        );
      }
      return updated;
    });
  };

  /* --------------------------------------------------------------------------
     removeFloor:
     - 특정 층 삭제 전 상태 저장 (undo 용)
     - 해당 층에 해당하는 roomNumbers는 roomTypes에서 제거
  -------------------------------------------------------------------------- */
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

  /* --------------------------------------------------------------------------
     undoRemoveFloor:
     - 삭제한 층 되돌리기
  -------------------------------------------------------------------------- */
  const undoRemoveFloor = () => {
    if (previousFloorsRef.current.length > 0) {
      setFloors([...previousFloorsRef.current]);
      previousFloorsRef.current = [];
    } else {
      alert('되돌릴 삭제가 없습니다.');
    }
  };

  /* --------------------------------------------------------------------------
   addRoomToFloor:
   - 실시간 상태 업데이트 보장 및 중복 방지 강화
--------------------------------------------------------------------------- */
  const addRoomToFloor = async (floorNum) => {
    if (isAdding) return;
    setIsAdding(true);
    try {
      const defaultRoomType = initializedDefaultRoomTypes[0]; // "none" 제거 후 첫 번째 타입

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

        const uniqueId = uuidv4();
        const newContainer = {
          containerId: `${floorNum}-${defaultRoomType.roomInfo}-${newRoomNumber}-${uniqueId}`,
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

      // 실시간 상태 업데이트 보장
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
    } finally {
      setIsAdding(false);
    }
  };

  /* --------------------------------------------------------------------------
   removeContainer:
   - 특정 컨테이너 삭제 후, roomTypes 업데이트 및 중복 제거
--------------------------------------------------------------------------- */
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
            ]; // 중복 제거
            updatedTypes[typeIdx].roomNumbers.sort(
              (a, b) => parseInt(a, 10) - parseInt(b, 10)
            );
            updatedTypes[typeIdx].stock =
              updatedTypes[typeIdx].roomNumbers.length;
          }
          return updatedTypes;
        });
      }

      // 중복 번호 제거 후 재정렬
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
        container.containerId = `${floorNum}-${
          container.roomInfo
        }-${newRoomNumber}-${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 9)}`;
      });

      updated[floorIdx].containers = uniqueContainers;
      return updated;
    });
  };

  /* --------------------------------------------------------------------------
   generateInitialLayout:
   - "none" 옵션 제거, 유효한 객실 타입만 컨테이너 생성
--------------------------------------------------------------------------- */
  const generateInitialLayout = () => {
    const newFloors = DEFAULT_FLOORS.map((floorNum) => {
      const containers = [];
      roomTypes.forEach((rt) => {
        const matchingNumbers = rt.roomNumbers.filter((num) =>
          num.startsWith(String(floorNum))
        );
        matchingNumbers.forEach((num) => {
          containers.push({
            containerId: `${floorNum}-${rt.roomInfo}-${num}-${Date.now()}`,
            roomInfo: rt.roomInfo,
            roomNumber: num,
            price: rt.price,
            isActive: true,
          });
        });
      });
      containers.sort(
        (a, b) => parseInt(a.roomNumber, 10) - parseInt(b.roomNumber, 10)
      );
      return { floorNum, containers };
    });
    setFloors(newFloors);
    setRoomTypes((prevTypes) => {
      const updatedTypes = [...prevTypes];
      newFloors.forEach((floor) => {
        floor.containers.forEach((cont) => {
          if (cont.roomInfo && cont.roomNumber) {
            const typeIdx = updatedTypes.findIndex(
              (rt) => rt.roomInfo === cont.roomInfo
            );
            if (
              typeIdx !== -1 &&
              !updatedTypes[typeIdx].roomNumbers.includes(cont.roomNumber)
            ) {
              updatedTypes[typeIdx].roomNumbers.push(cont.roomNumber);
              updatedTypes[typeIdx].stock =
                updatedTypes[typeIdx].roomNumbers.length;
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
                <h3 style={{ marginLeft: '10px', color: 'lightslategray' }}>
                  {floor.floorNum}_Floor
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
                      className={`container-box`}
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
                  </React.Fragment>
                ))}
                <button
                  className="action-btn add-room-btn"
                  onClick={() => addRoomToFloor(floor.floorNum)}
                  disabled={isAdding}
                  title="객실 추가"
                >
                  <FaPlus />
                </button>
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
        setRoomTypes([...initializedDefaultRoomTypes]);
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
          // 실시간 상태 동기화
          updatedRoomTypes.forEach((rt) => {
            rt.roomNumbers = (rt.roomNumbers || []).sort(
              (a, b) => parseInt(a, 10) - parseInt(b, 10)
            );
            rt.stock = rt.roomNumbers.length;
          });
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

  // roomTypes 업데이트를 최적화: floors 변경 시만 실행, roomTypes가 실제로 변경되었는지 확인
  // useMemo로 updatedRoomTypes 정의 (HotelSettingsPage 상단에 추가)
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

  // useEffect 수정 (HotelSettingsPage 내에서)
  useEffect(() => {
    const newTotal = floors.reduce(
      (sum, f) =>
        sum +
        (f.containers || []).filter((c) => c.roomInfo && c.roomNumber).length,
      0
    );
    setTotalRooms(newTotal);

    // updatedRoomTypes가 실제로 변경되었을 때만 업데이트
    if (updatedRoomTypes.hasChanges) {
      setRoomTypes(updatedRoomTypes.roomTypes);
    }

    // originalDataRef 업데이트
    originalDataRef.current = {
      hotelId,
      isExisting,
      totalRooms: newTotal,
      roomTypes: updatedRoomTypes.hasChanges
        ? updatedRoomTypes.roomTypes
        : roomTypes,
      floors,
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
    updatedRoomTypes.roomTypes,
  ]);

  const handleLoadDefault = () => {
    // 디폴트 roomTypes 초기화 (stock 및 roomNumbers 유지, 중복 제거)
    const defaultRoomTypes = initializedDefaultRoomTypes.map((rt) => ({
      ...rt,
      aliases: [],
      roomNumbers: [], // 초기화
    }));

    // 기본 floors 설정 (각 층에 해당 타입의 객실만 순차적으로 배치)
    const newFloors = DEFAULT_FLOORS.map((floorNum) => {
      const containers = [];
      const roomType = defaultRoomTypes.find(
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

    // roomNumbers 정렬 및 stock 업데이트
    defaultRoomTypes.forEach((rt) => {
      rt.roomNumbers = [...new Set(rt.roomNumbers)]; // 중복 제거
      rt.roomNumbers.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
      rt.stock = rt.roomNumbers.length;
    });

    setRoomTypes(defaultRoomTypes); // roomTypes 업데이트
    setFloors(newFloors); // floors 업데이트
    setTotalRooms(defaultRoomTypes.reduce((sum, rt) => sum + rt.stock, 0)); // 총 객실 수 계산
    alert('디폴트 설정이 불러와졌습니다.');
  };

  const handleSaveAll = async () => {
    if (!hotelId) {
      alert('호텔 ID는 필수입니다.');
      return;
    }
    const allHaveRoomNumbers = roomTypes.every(
      (rt) => (rt.roomNumbers || []).length > 0
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
        aliases: (rt.aliases || []).filter(Boolean),
        stock: (rt.roomNumbers || []).length,
        floorSettings: DEFAULT_FLOORS.reduce((acc, floorNum) => {
          const count = (rt.roomNumbers || []).filter((num) =>
            num?.startsWith?.(String(floorNum))
          ).length;
          if (count > 0) acc[floorNum] = count;
          return acc;
        }, {}),
        startRoomNumbers: DEFAULT_FLOORS.reduce((acc, floorNum) => {
          const nums = (rt.roomNumbers || []).filter((num) =>
            num?.startsWith?.(String(floorNum))
          );
          if (nums.length > 0) acc[floorNum] = nums[0];
          return acc;
        }, {}),
      })),
      gridSettings: {
        floors: floors.map((floor) => ({
          floorNum: floor.floorNum,
          containers: floor.containers.map((cont) => ({
            containerId: cont.containerId,
            roomInfo: cont.roomInfo,
            roomNumber: cont.roomNumber,
            price: cont.price,
            isActive: cont.isActive,
          })),
        })),
      },
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
      console.log(
        '[HotelSettingsPage] Saved gridSettings.floors:',
        payload.gridSettings.floors
      );
      payload.gridSettings.floors.forEach((floor) => {
        console.log(
          `[HotelSettingsPage] Floor ${floor.floorNum} containers:`,
          floor.containers
        );
      });
      console.log(
        '[HotelSettingsPage] Total containers saved:',
        payload.gridSettings.floors.flatMap((f) => f.containers).length
      );
      navigate('/');
      window.location.reload();
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
      <div className="hotel-settings-button-group">
        <button className="hotel-settings-btn" onClick={() => navigate('/')}>
          메인으로
        </button>
        <button className="hotel-settings-btn" onClick={handleLoadDefault}>
          디폴트 불러오기
        </button>
        <button className="hotel-settings-btn" onClick={handleCancel}>
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
        <button className="hotelsetting-all-save" onClick={handleSaveAll}>
          전체 저장
        </button>
      </div>
    </div>
  );
}
