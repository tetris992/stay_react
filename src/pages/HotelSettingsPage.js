import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchHotelSettings, updateHotelSettings, registerHotel, fetchUserInfo } from '../api/api';
import { defaultRoomTypes } from '../config/defaultRoomTypes';
import { getColorForRoomType } from '../utils/getColorForRoomType';
import './HotelSettingsPage.css';
import { FaBed, FaMinus, FaPlus, FaTrash, FaUndo } from 'react-icons/fa';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

const DEFAULT_FLOORS = [2, 3, 4, 5, 6, 7, 8];

const initializedDefaultRoomTypes = defaultRoomTypes.map(rt => ({
  ...rt,
  aliases: [], // 빈 배열로 초기화
  roomNumbers:
    rt.startRoomNumbers && Object.keys(rt.floorSettings).length > 0
      ? Array.from(
          { length: rt.stock },
          (_, i) => `${parseInt(rt.startRoomNumbers[Object.keys(rt.floorSettings)[0]]) + i}`
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
    const found = cloned.find((rt) => (rt.roomInfo || '').toLowerCase() === tKey);
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
          field === 'nameEng' ? value : updated[index].nameEng || updated[index].nameKor
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
                  onChange={(e) => updateRoomType(idx, 'nameKor', e.target.value)}
                />
                <input
                  className="name-eng"
                  type="text"
                  placeholder="영어 이름"
                  value={rt.nameEng || ''}
                  onChange={(e) => updateRoomType(idx, 'nameEng', e.target.value)}
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
              <button className="remove-btn" onClick={() => removeRoomType(idx)}>
                <FaTrash />
              </button>
            </div>
            <div className="room-type-aliases">
              <div className="field-row">
                <input
                  type="text"
                  placeholder="별칭 1"
                  value={rt.aliases[0] || ''} // 빈 값 유지, 플레이스홀더로만 표시
                  onChange={(e) => updateRoomType(idx, 'aliases', e.target.value, 0)}
                />
                <input
                  type="text"
                  placeholder="별칭 2"
                  value={rt.aliases[1] || ''}
                  onChange={(e) => updateRoomType(idx, 'aliases', e.target.value, 1)}
                />
              </div>
              <div className="field-row">
                <input
                  type="text"
                  placeholder="별칭 3"
                  value={rt.aliases[2] || ''}
                  onChange={(e) => updateRoomType(idx, 'aliases', e.target.value, 2)}
                />
                <input
                  type="text"
                  placeholder="별칭 4"
                  value={rt.aliases[3] || ''}
                  onChange={(e) => updateRoomType(idx, 'aliases', e.target.value, 3)}
                />
              </div>
            </div>
            <div className="room-numbers">
              <h4>객실 번호 배열</h4>
              <div>{rt.roomNumbers?.length > 0 ? rt.roomNumbers.join(', ') : '아직 생성되지 않음'}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="room-type-actions">
        <button className="action-btn add-btn" onClick={addRoomType}>
          + 타입 추가
        </button>
        <button className="action-btn generate-btn" onClick={generateAllRoomNumbers}>
          객실 번호 생성
        </button>
      </div>
    </section>
  );
}

function LayoutEditor({ roomTypes, setRoomTypes, floors, setFloors }) {
  const maxRoomsPerFloor = Math.max(...roomTypes.map((rt) => rt.stock || 7), 7);
  const previousFloorsRef = useRef([]); // 이전 floors 상태 저장

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
        const roomNum = updated[floorIdx].containers[containerIdx].roomNumber;
        setRoomTypes((prevTypes) => {
          const updatedTypes = [...prevTypes];
          if (oldRoomInfo !== 'none') {
            const oldIdx = updatedTypes.findIndex(
              (rt) => rt.roomInfo === oldRoomInfo
            );
            if (oldIdx !== -1) {
              updatedTypes[oldIdx].roomNumbers = updatedTypes[oldIdx].roomNumbers.filter(
                (num) => num !== roomNum
              );
              updatedTypes[oldIdx].stock = updatedTypes[oldIdx].roomNumbers.length;
            }
          }
          if (newRoomInfo !== 'none') {
            const newIdx = updatedTypes.findIndex(
              (rt) => rt.roomInfo === newRoomInfo
            );
            if (newIdx !== -1) {
              updatedTypes[newIdx].roomNumbers.push(roomNum);
              updatedTypes[newIdx].stock = updatedTypes[newIdx].roomNumbers.length;
              // 객실 타입 변경 시 가격 동기화 (사용자 입력값 우선)
              const roomType = updatedTypes[newIdx];
              updated[floorIdx].containers[containerIdx].price = Number(roomType.price) || 0;
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
      previousFloorsRef.current = [...prev]; // 삭제 전 상태 저장
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
          rt.roomNumbers = (rt.roomNumbers || []).map(num => num); // 원래 상태 복원
          rt.stock = rt.roomNumbers.length;
        });
        return updatedTypes;
      });
      previousFloorsRef.current = []; // 되돌리기 후 상태 초기화
    } else {
      alert('되돌릴 삭제가 없습니다.');
    }
  };

  const addRoomToFloor = (floorNum) => {
    setFloors((prev) => {
      const updated = [...prev];
      const floorIdx = updated.findIndex((f) => f.floorNum === floorNum);
      if (floorIdx === -1) return prev;
      const floor = updated[floorIdx];
      const lastRoomNum = floor.containers.length > 0
        ? parseInt(floor.containers[floor.containers.length - 1].roomNumber, 10)
        : parseInt(`${floorNum}01`, 10) - 1;
      const newRoomNum = `${lastRoomNum + 1}`;
      const newContainer = {
        containerId: `${floorNum}-none-${newRoomNum}-${Date.now()}`,
        roomInfo: 'none',
        roomNumber: newRoomNum,
        price: 0,
        isActive: false,
      };
      updated[floorIdx].containers.push(newContainer);
      return updated;
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
      updated[floorIdx].containers.splice(containerIdx, 1);

      if (removedRoomInfo !== 'none') {
        setRoomTypes((prevTypes) => {
          const updatedTypes = [...prevTypes];
          const typeIdx = updatedTypes.findIndex((rt) => rt.roomInfo === removedRoomInfo);
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
      const startNum = parseInt(`${floorNum}01`, 10);
      const endNum = startNum + maxRoomsPerFloor - 1;

      for (let roomNum = startNum; roomNum <= endNum; roomNum++) {
        let found = false;
        const roomNumberStr = roomNum.toString();
        roomTypes.forEach((rt) => {
          const roomNumbers = rt.roomNumbers || [];
          if (roomNumbers.includes(roomNumberStr)) {
            containers.push({
              containerId: `${floorNum}-${rt.roomInfo}-${roomNumberStr}-${Date.now()}`,
              roomInfo: rt.roomInfo,
              roomNumber: roomNumberStr,
              price: rt.price,
              isActive: true,
            });
            found = true;
          }
        });
        if (!found) {
          containers.push({
            containerId: `${floorNum}-none-${roomNum}-${Date.now()}`,
            roomInfo: 'none',
            roomNumber: roomNumberStr,
            price: 0,
            isActive: false,
          });
        }
      }
      return { floorNum, containers };
    });
    setFloors(newFloors);
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
                      className={`container-box ${cont.roomInfo === 'none' ? 'empty' : ''}`}
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
                          updateContainer(floor.floorNum, cont.containerId, 'roomInfo', e.target.value)
                        }
                      >
                        <option value="none">객실없음/사용불가</option>
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
                          updateContainer(floor.floorNum, cont.containerId, 'roomNumber', e.target.value)
                        }
                        placeholder="객실 번호"
                      />
                      <input
                        type="number"
                        value={cont.price || 0}
                        onChange={(e) =>
                          updateContainer(floor.floorNum, cont.containerId, 'price', e.target.value)
                        }
                        placeholder="가격"
                      />
                      <button
                        className="delete-btn"
                        onClick={() => removeContainer(floor.floorNum, cont.containerId)}
                      >
                        <FaTrash />
                      </button>
                    </div>
                    {index === floor.containers.length - 1 && ( // 마지막 객실 컨테이너 옆에 버튼 배치
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
        setFloors(DEFAULT_FLOORS.map((floorNum) => ({ floorNum, containers: [] })));
        setTotalRooms(initializedDefaultRoomTypes.reduce((sum, rt) => sum + rt.stock, 0));
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
            hotelData.totalRooms || initializedDefaultRoomTypes.reduce((sum, rt) => sum + rt.stock, 0)
          );
          const containers = hotelData.gridSettings?.floors?.flatMap(floor => floor.containers) || [];
          const updatedRoomTypes = buildRoomTypesWithNumbers(
            hotelData.roomTypes.map(rt => ({
              ...rt,
              aliases: [],
            })) || initializedDefaultRoomTypes,
            containers
          );
          setRoomTypes(updatedRoomTypes);
          setFloors(hotelData.gridSettings?.floors || DEFAULT_FLOORS.map((floorNum) => ({ floorNum, containers: [] })));
          setHotelAddress(hotelData.address || '');
          setEmail(hotelData.email || '');
          setPhoneNumber(hotelData.phoneNumber || '');
          setHotelName(hotelData.hotelName || '');
        } else {
          setIsExisting(false);
          setRoomTypes([...initializedDefaultRoomTypes]);
          setFloors(DEFAULT_FLOORS.map((floorNum) => ({ floorNum, containers: [] })));
          setTotalRooms(initializedDefaultRoomTypes.reduce((sum, rt) => sum + rt.stock, 0));
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
      (sum, f) => sum + (f.containers || []).filter((c) => c.roomInfo !== 'none').length,
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
  }, [hotelId, isExisting, roomTypes, floors, hotelAddress, email, phoneNumber, hotelName]);

  const handleLoadDefault = () => {
    setRoomTypes([...initializedDefaultRoomTypes]);
    setFloors(DEFAULT_FLOORS.map((floorNum) => ({ floorNum, containers: [] })));
    setTotalRooms(initializedDefaultRoomTypes.reduce((sum, rt) => sum + rt.stock, 0));
    alert('디폴트 설정이 불러와졌습니다.');
  };

  const handleSaveAll = async () => {
    if (!hotelId) {
      alert('호텔 ID는 필수입니다.');
      return;
    }
    const allHaveRoomNumbers = roomTypes.every((rt) => rt.roomNumbers && rt.roomNumbers.length > 0);
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
        await updateHotelSettings(hotelId, payload);
        alert('업데이트 완료');
      } else {
        await registerHotel(payload);
        alert('등록 완료');
        setIsExisting(true);
      }
      navigate('/');
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