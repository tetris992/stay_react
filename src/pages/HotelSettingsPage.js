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
import { toZonedTime } from 'date-fns-tz'; // KST 변환용

const DEFAULT_FLOORS = [2, 3, 4, 5, 6, 7, 8]; // 기본 층 설정

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
        aliases: [],
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
        const numValue = Number(value);
        if (isNaN(numValue) && value !== '') {
          alert('유효한 가격을 입력해주세요.');
          return prev;
        }
        updated[index][field] = numValue || 0;
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
      console.log(
        `[RoomTypeEditor] Updated ${field} at index ${index}:`,
        value
      ); // 디버깅 로그
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
    <section className="room-types-section" aria-label="객실 타입 설정 섹션">
      <h2>객실 타입 설정</h2>
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
          </div>
        ))}
      </div>
      <div className="room-type-actions">
        <button
          className="hotel-settings-action-btn add-btn"
          onClick={addRoomType}
          aria-label="객실 타입 추가"
        >
          + 타입 추가
        </button>
      </div>
    </section>
  );
}

function LayoutEditor({ roomTypes, setRoomTypes, floors, setFloors }) {
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
      console.log(`[LayoutEditor] Added floor: ${newFloorNum}`); // 디버깅 로그
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
        }-${Date.now()}-${uniqueId}`; // KST 변환 제거

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
          console.log('[LayoutEditor] Updated roomTypes:', updatedTypes);
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
      console.log(`[LayoutEditor] Removed floor: ${floorNum}`); // 디버깅 로그
      return updated;
    });
  };

  const undoRemoveFloor = () => {
    if (previousFloorsRef.current.length > 0) {
      setFloors([...previousFloorsRef.current]);
      previousFloorsRef.current = [];
      console.log('[LayoutEditor] Undo floor removal'); // 디버깅 로그
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

        const kstNow = toZonedTime(new Date(), 'Asia/Seoul'); // KST로 변환
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
      console.log(
        `[LayoutEditor] Added room ${newRoomNumber} to floor ${floorNum}`
      ); // 디버깅 로그
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
        const kstNow = toZonedTime(new Date(), 'Asia/Seoul'); // KST로 변환
        container.containerId = `${floorNum}-${
          container.roomInfo
        }-${newRoomNumber}-${kstNow.getTime()}-${Math.random()
          .toString(36)
          .substr(2, 9)}`;
      });

      updated[floorIdx].containers = uniqueContainers;
      console.log(`[LayoutEditor] Removed container ${containerId}`); // 디버깅 로그
      return updated;
    });
  };

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
    console.log('[LayoutEditor] Generated initial layout'); // 디버깅 로그
  };

  return (
    <section
      className="layout-editor-section"
      aria-label="객실 레이아웃 편집 섹션"
    >
      <div className="layout-header">
        <h2>객실 레이아웃 편집</h2>
        <button
          className="hotel-settings-btn generate-btn"
          onClick={generateInitialLayout}
          title="레이아웃 생성"
          aria-label="레이아웃 생성"
        >
          레이아웃 생성
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
                        className="hotel-settings-btn delete-btn"
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
                  className="hotel-settings-btn add-room-btn"
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

  // 체크인/체크아웃 시간 상태 추가
  const [checkInTime, setCheckInTime] = useState('16:00'); // 디폴트 16:00
  const [checkOutTime, setCheckOutTime] = useState('11:00'); // 디폴트 11:00

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
        console.log('[HotelSettingsPage] Fetched hotel data:', hotelData);

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
          // 체크인/체크아웃 시간 로드
          setCheckInTime(hotelData.checkInTime || '16:00');
          setCheckOutTime(hotelData.checkOutTime || '11:00');
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
        console.error('[HotelSettingsPage] Error loading data:', err);
        setError('호텔 설정 또는 사용자 정보 로딩 실패: ' + err.message);
      }
    }
    loadData();
  }, [hotelId, email, phoneNumber, hotelAddress, hotelName]);

  const handleLoadDefault = () => {
    const defaultRoomTypesCopy = defaultRoomTypes.map((rt) => ({
      ...rt,
      aliases: [],
      roomNumbers: [],
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
    console.log('[HotelSettingsPage] Loaded default settings'); // 디버깅 로그
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
    console.log('[HotelSettingsPage] Updated roomTypes:', newRoomTypes); // 디버깅 로그
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
      hotelAddress,
      email,
      phoneNumber,
      hotelName,
    };
    console.log('[HotelSettingsPage] Updated totalRooms:', newTotal); // 디버깅 로그
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
      checkInTime, // 추가
      checkOutTime, // 추가
    };
    try {
      if (isExisting) {
        console.log('[HotelSettingsPage] Updating hotel settings:', payload);
        await updateHotelSettings(hotelId, payload);
        alert('업데이트 완료');
      } else {
        console.log('[HotelSettingsPage] Registering new hotel:', payload);
        await registerHotel(payload);
        alert('등록 완료');
        setIsExisting(true);
      }
      navigate('/');
      window.location.reload();
    } catch (err) {
      console.error('[HotelSettingsPage] Save failed:', err);
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
    setHotelAddress(orig.hotelAddress);
    setEmail(orig.email);
    setPhoneNumber(orig.phoneNumber);
    setHotelName(orig.hotelName);
    console.log('[HotelSettingsPage] Cancelled changes'); // 디버깅 로그
    alert('변경 사항이 취소되었습니다.');
  };

  return (
    <div className="hotel-settings-page" aria-label="호텔 설정 페이지">
      <h1>호텔 설정</h1>
      <div className="hotel-settings-button-group">
        <button
          className="hotel-settings-btn"
          onClick={() => navigate('/')}
          aria-label="메인 페이지로 이동"
        >
          메인으로
        </button>
        <button
          className="hotel-settings-btn"
          onClick={handleLoadDefault}
          aria-label="디폴트 설정 불러오기"
        >
          디폴트 불러오기
        </button>
        <button
          className="hotel-settings-btn"
          onClick={handleCancel}
          aria-label="변경 사항 취소"
        >
          취소
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
      <section className="hotel-info-section" aria-label="호텔 기본 정보 섹션">
        <div className="info-columns">
          <div className="basic-info">
            <h2>호텔 기본 정보</h2>
            <label>
              호텔 ID:
              <input
                value={hotelId}
                onChange={(e) => setHotelId(e.target.value)}
                disabled={isExisting}
                aria-label="호텔 ID 입력"
              />
            </label>
            <label>
              총 객실 수:
              <input value={totalRooms} readOnly aria-label="총 객실 수" />
            </label>
            <label>
              호텔 주소:
              <input
                value={hotelAddress}
                onChange={(e) => setHotelAddress(e.target.value)}
                placeholder="호텔 주소를 입력하세요"
                aria-label="호텔 주소 입력"
              />
            </label>
            <label>
              이메일:
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="이메일을 입력하세요"
                aria-label="이메일 입력"
              />
            </label>
            <label>
              전화번호:
              <input
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="전화번호를 입력하세요"
                aria-label="전화번호 입력"
              />
            </label>
            {/* 체크인/체크아웃 시간 입력 필드 추가 */}
            <label>
              체크인 시간:
              <input
                type="time"
                value={checkInTime}
                onChange={(e) => setCheckInTime(e.target.value)}
                aria-label="체크인 시간 입력"
              />
            </label>
            <label>
              체크아웃 시간:
              <input
                type="time"
                value={checkOutTime}
                onChange={(e) => setCheckOutTime(e.target.value)}
                aria-label="체크아웃 시간 입력"
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
                aria-label="호텔 이름 입력"
              />
            </label>
            <label>
              관리자 이름:
              <input
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                placeholder="관리자 이름을 입력하세요"
                aria-label="관리자 이름 입력"
              />
            </label>
            <label>
              비밀번호:
              <input
                type="password"
                value="********"
                readOnly
                placeholder="비밀번호 변경은 별도 처리"
                aria-label="비밀번호 (읽기 전용)"
              />
              <button
                className="hotel-settings-action-btn change-pw-btn"
                disabled
                aria-label="비밀번호 변경 (미구현)"
              >
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
        <button
          className="hotelsetting-all-save"
          onClick={handleSaveAll}
          aria-label="모든 설정 저장"
        >
          전체 저장
        </button>
      </div>
    </div>
  );
}
