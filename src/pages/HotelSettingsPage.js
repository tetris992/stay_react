/* src/pages/HotelSettingsPage.js */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchHotelSettings,
  updateHotelSettings,
  registerHotel,
} from '../api/api';
import { defaultRoomTypes } from '../config/defaultRoomTypes';
import { getColorForRoomType } from '../utils/getColorForRoomType'; // 색상 함수 (roomInfo 값에 따라 색상 결정)
import './HotelSettingsPage.css'; // 통합 스타일 (Layout+DailyBoard+RoomTypes)

/* === DnD 관련 === */
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

/** **************************************
 * (A) DailyBoard (예약 배정)
 ***************************************/
function ReservationCard({ reservation }) {
  const [{ isDragging }, dragRef] = useDrag({
    type: 'RESERVATION',
    item: { reservation },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });
  return (
    <div
      ref={dragRef}
      className="reservation-card"
      style={{ opacity: isDragging ? 0.5 : 1 }}
    >
      <div>{reservation.customerName}</div>
      <div>
        {reservation.roomInfo} / {reservation.roomNumber}
      </div>
    </div>
  );
}

function ContainerBox({ container, reservations, onUpdateReservation }) {
  const [{ isOver }, dropRef] = useDrop({
    accept: 'RESERVATION',
    drop: (item) => {
      const { reservation } = item;
      onUpdateReservation(reservation._id, {
        roomInfo: container.roomInfo,
        roomNumber: container.roomNumber,
      });
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  const headerText = `${container.roomInfo || '미설정'} / ${
    container.roomNumber || '미설정'
  }`;

  return (
    <div
      className={`container-box ${isOver ? 'hovered' : ''}`}
      ref={dropRef}
      style={{
        backgroundColor: getColorForRoomType(container.roomInfo),
      }}
    >
      <div className="container-label">{headerText}</div>
      <div className="reservation-list">
        {reservations.map((res) => (
          <ReservationCard key={res._id} reservation={res} />
        ))}
      </div>
    </div>
  );
}

function DailyBoard({ gridSettings, reservations, onUpdateReservation }) {
  // eslint-disable-next-line no-unused-vars
  const { rows, cols, containers } = gridSettings || {
    rows: 0,
    cols: 0,
    containers: [],
  };

  // 매칭 함수: 예약의 roomInfo와 컨테이너의 roomInfo가 같고, roomNumber가 같은지 비교
  const isMatching = useCallback((res, cont) => {
    const rInfo = (res.roomInfo || '').toLowerCase();
    const cInfo = (cont.roomInfo || '').toLowerCase();
    return rInfo === cInfo && res.roomNumber === cont.roomNumber;
  }, []);

  // 컨테이너별 예약 매핑
  const containerMap = {};
  containers.forEach((c) => {
    containerMap[c.containerId] = [];
  });
  reservations.forEach((res) => {
    const matched = containers.find((cont) => isMatching(res, cont));
    if (matched) {
      containerMap[matched.containerId].push(res);
    }
  });

  // 미배정 예약: 어떤 컨테이너와도 매칭되지 않은 예약
  const unassigned = reservations.filter(
    (res) => !containers.some((c) => isMatching(res, c))
  );

  return (
    <div className="daily-board-container">
      <div className="unassigned-area">
        <h3>미배정 예약</h3>
        {unassigned.map((res) => (
          <ReservationCard key={res._id} reservation={res} />
        ))}
      </div>
      <div
        className="grid-area"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      >
        {containers.map((cont) => (
          <ContainerBox
            key={cont.containerId}
            container={cont}
            reservations={containerMap[cont.containerId] || []}
            onUpdateReservation={onUpdateReservation}
          />
        ))}
      </div>
    </div>
  );
}

/** **************************************
 * (B) LayoutEditor
 ***************************************/
function LayoutEditor({
  hotelRoomTypes,
  initialGridSettings,
  onChangeGridSettings,
}) {
  // 기본 그리드 사이즈: 최대 10 x 10 (초기값)
  const defaultRows =
    initialGridSettings?.rows && initialGridSettings.rows > 0
      ? initialGridSettings.rows
      : 10;
  const defaultCols =
    initialGridSettings?.cols && initialGridSettings.cols > 0
      ? initialGridSettings.cols
      : 10;

  const [rows, setRows] = useState(defaultRows);
  const [cols, setCols] = useState(defaultCols);
  const [containers, setContainers] = useState(
    initialGridSettings?.containers || []
  );

  // 빈 그리드 생성 (roomType -> roomInfo 변경)
  const generateContainers = useCallback(() => {
    const fresh = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        fresh.push({
          containerId: `${r}-${c}-${Date.now()}`,
          row: r,
          col: c,
          roomInfo: '',
          roomNumber: '',
          price: 0,
        });
      }
    }
    setContainers(fresh);
  }, [rows, cols]);

  // rows/cols 변경 시 빈 그리드 생성
  useEffect(() => {
    if (!containers || containers.length === 0) {
      generateContainers();
    }
  }, [rows, cols, containers, generateContainers]);

  // “자동 배치”: 각 행은 hotelRoomTypes 배열의 해당 타입으로 채움
  const autoLayout = useCallback(() => {
    const newContainers = [];
    // 새로운 행의 수: hotelRoomTypes.length (없으면 10)
    const newRows = hotelRoomTypes.length < 1 ? 10 : hotelRoomTypes.length;
    const newCols = cols < 1 ? 10 : cols; // 현재 cols 사용

    hotelRoomTypes.forEach((rt, rowIndex) => {
      for (let c = 0; c < newCols; c++) {
        // 예시: 방번호는 (층 * 100 + col+1)
        const roomNo = ((2 + rowIndex) * 100 + (c + 1)).toString();
        newContainers.push({
          containerId: `${rowIndex}-${c}-${Date.now()}`,
          row: rowIndex,
          col: c,
          roomInfo: rt.roomInfo || 'standard', // 변경: roomType -> roomInfo
          roomNumber: roomNo,
          price: rt.price ?? 0,
        });
      }
    });

    // 나머지 행은 빈 컨테이너로 처리
    for (let r = hotelRoomTypes.length; r < newRows; r++) {
      for (let c = 0; c < newCols; c++) {
        newContainers.push({
          containerId: `${r}-${c}-${Date.now()}`,
          row: r,
          col: c,
          roomInfo: '', // 변경
          roomNumber: '',
          price: 0,
        });
      }
    }

    setRows(newRows);
    setCols(newCols);
    setContainers(newContainers);
  }, [cols, hotelRoomTypes]);

  const handleChangeCell = (id, field, val) => {
    setContainers((prev) =>
      prev.map((c) => (c.containerId === id ? { ...c, [field]: val } : c))
    );
  };

  const handlePriceChange = (id, val) => {
    let parsed = parseInt(val, 10);
    if (Number.isNaN(parsed) || parsed < 1) parsed = 1;
    setContainers((prev) =>
      prev.map((c) =>
        c.containerId === id ? { ...c, price: parsed * 1000 } : c
      )
    );
  };

  const prevGridSettingsRef = useRef(initialGridSettings);
  useEffect(() => {
    const newGridSettings = { rows, cols, containers };
    if (
      JSON.stringify(newGridSettings) !==
      JSON.stringify(prevGridSettingsRef.current)
    ) {
      onChangeGridSettings(newGridSettings);
      prevGridSettingsRef.current = newGridSettings;
    }
  }, [rows, cols, containers, onChangeGridSettings]);

  return (
    <div className="layout-editor-section">
      <h3>객실 레이아웃 편집</h3>
      <div className="layout-inputs">
        <label style={{ fontSize: '18px' }}>
          Rows:
          <input
            type="number"
            value={rows}
            onChange={(e) => setRows(Number(e.target.value))}
            style={{ marginLeft: '6px', fontSize: '18px', width: '80px' }}
          />
        </label>
        <label style={{ fontSize: '18px', marginLeft: '20px' }}>
          Cols:
          <input
            type="number"
            value={cols}
            onChange={(e) => setCols(Number(e.target.value))}
            style={{ marginLeft: '6px', fontSize: '18px', width: '80px' }}
          />
        </label>
        <button onClick={generateContainers} style={{ fontSize: '18px' }}>
          빈 그리드
        </button>
        <button onClick={autoLayout} style={{ fontSize: '18px' }}>
          자동 배치
        </button>
      </div>

      <div
        className="grid-preview"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      >
        {containers.map((cont) => (
          <div
            key={cont.containerId}
            className="grid-cell"
            style={{
              backgroundColor: getColorForRoomType(cont.roomInfo),
              minHeight: '120px',
            }}
          >
            <div className="cell-label" style={{ fontSize: '18px' }}>
              [{cont.row}, {cont.col}]
            </div>
            <div className="cell-inputs">
              <select
                value={cont.roomInfo}
                onChange={(e) =>
                  handleChangeCell(cont.containerId, 'roomInfo', e.target.value)
                }
                style={{ fontSize: '18px' }}
              >
                <option value="">--타입--</option>
                {hotelRoomTypes.map((rt, index) => (
                  <option key={`${rt.roomInfo}-${index}`} value={rt.roomInfo}>
                    {rt.roomInfo}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="객실번호"
                value={cont.roomNumber}
                onChange={(e) =>
                  handleChangeCell(
                    cont.containerId,
                    'roomNumber',
                    e.target.value
                  )
                }
                style={{ fontSize: '18px' }}
              />
              <input
                type="number"
                placeholder="가격(천원)"
                value={cont.price > 0 ? cont.price / 1000 : ''}
                onChange={(e) =>
                  handlePriceChange(cont.containerId, e.target.value)
                }
                style={{ fontSize: '18px' }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** **************************************
 * (C) HotelSettingsPage (최종)
 ***************************************/
export default function HotelSettingsPage() {
  const navigate = useNavigate();

  // 원복(취소) 시 사용하기 위한 originalData 저장
  const originalDataRef = useRef(null);

  // 호텔 기본정보
  const [hotelId, setHotelId] = useState(localStorage.getItem('hotelId') || '');
  const [isExisting, setIsExisting] = useState(false);
  const [error, setError] = useState('');
  const [totalRooms, setTotalRooms] = useState(0);

  // 객실 타입 설정 (여기서는 그대로 roomTypes 배열의 구조는 변경하지 않음)
  const [roomTypes, setRoomTypes] = useState(defaultRoomTypes);

  // 레이아웃 (gridSettings: { rows, cols, containers })
  const [gridSettings, setGridSettings] = useState({
    rows: 7,
    cols: 7,
    containers: [],
  });

  // 예시 예약 – roomType 속성을 roomInfo로 변경
  const [reservations, setReservations] = useState([
    {
      _id: 'r1',
      customerName: '홍길동',
      roomInfo: 'standard',
      roomNumber: '201',
    },
    {
      _id: 'r2',
      customerName: '김영희',
      roomInfo: 'premium',
      roomNumber: '301',
    },
    { _id: 'r3', customerName: '미배정-장보고', roomInfo: '', roomNumber: '' },
  ]);

  // 1) 로딩 시 서버에서 hotelSettings 불러오기
  useEffect(() => {
    async function loadData() {
      if (!hotelId) {
        return;
      }
      try {
        const data = await fetchHotelSettings(hotelId);

        if (data?.gridSettings?.containers) {
          // DB에서 roomType가 넘어올 수 있으므로, roomInfo로 변환
          const convertedContainers = data.gridSettings.containers.map((c) => {
            return {
              ...c,
              // roomInfo가 이미 있으면 그대로 두고, 없으면 roomType 복사
              roomInfo: c.roomInfo ?? c.roomType ?? '',
            };
          });
          setGridSettings({
            ...data.gridSettings,
            containers: convertedContainers,
          });
        } else {
          setGridSettings({ rows: 10, cols: 10, containers: [] });
        }

        // 나머지 hotel info나 roomTypes도 설정
        if (data && data._id) {
          setIsExisting(true);
          setTotalRooms(data.totalRooms || 0);
          // roomTypes 객체에서 roomInfo가 없으면 type을 사용하도록 변환
          setRoomTypes(
            (data.roomTypes || defaultRoomTypes).map((rt) => ({
              ...rt,
              roomInfo: rt.roomInfo || rt.type || '',
            }))
          );
        } else {
          setIsExisting(false);
          setRoomTypes(defaultRoomTypes);
        }
      } catch (err) {
        console.error(err);
        setError('호텔 설정 로딩 실패: ' + err.message);
      }
    }
    loadData();
  }, [hotelId]);

  // 2) gridSettings 기반으로 총 객실 수 재계산 및 roomTypes의 stock 업데이트
  useEffect(() => {
    const computedTotalRooms = gridSettings.containers.length;
    setTotalRooms(computedTotalRooms);
  }, [gridSettings]);

  // 3) 객실 타입 변경 (roomTypes 변경)
  const handleRoomTypeChange = (idx, field, val) => {
    setRoomTypes((prev) => {
      const arr = [...prev];
      if (field === 'price') {
        arr[idx].price = Number(val);
      } else if (field === 'nameKor' || field === 'nameEng') {
        arr[idx][field] = val;
        const eng = field === 'nameEng' ? val.trim() : arr[idx].nameEng?.trim();
        const kor = field === 'nameKor' ? val.trim() : arr[idx].nameKor?.trim();
        arr[idx].roomInfo = eng ? eng.toLowerCase() : kor;
      } else if (field === 'aliases') {
        arr[idx].aliases = val;
      }
      return arr;
    });
  };
  const addRoomType = () => {
    setRoomTypes((prev) => [
      ...prev,
      {
        roomInfo: `custom-type-${prev.length + 1}`,
        nameKor: '',
        nameEng: '',
        price: 0,
        stock: 0,
        aliases: [],
      },
    ]);
  };
  const removeRoomType = (index) => {
    setRoomTypes((prev) => prev.filter((_, i) => i !== index));
  };

  // 4) LayoutEditor -> gridSettings 변경 시
  const handleChangeGridSettings = (gs) => {
    setGridSettings(gs);
  };

  // 5) DailyBoard - 예약 드롭 업데이트 (roomType -> roomInfo)
  const handleReservationUpdate = (resId, updateData) => {
    setReservations((prev) =>
      prev.map((r) =>
        r._id === resId
          ? {
              ...r,
              roomInfo: updateData.roomInfo,
              roomNumber: updateData.roomNumber,
            }
          : r
      )
    );
  };

  // 6) 전체 저장: gridSettings 기반으로 총 객실 수와 각 roomTypes의 stock 재계산 후 백엔드 전송
  const handleSaveAll = async () => {
    if (!hotelId) {
      alert('호텔 ID는 필수입니다.');
      return;
    }

    const computedTotalRooms = gridSettings.containers.length;

    const updatedRoomTypes = roomTypes.map((rt) => {
      const count = gridSettings.containers.filter(
        (cell) => cell.roomInfo === rt.roomInfo
      ).length;
      return { ...rt, stock: count };
    });

    const payload = {
      hotelId,
      totalRooms: computedTotalRooms,
      roomTypes: updatedRoomTypes,
      gridSettings: {
        ...gridSettings,
        containers: gridSettings.containers.map((c) => ({
          ...c,
          // 만약 이미 roomType 필드가 있다면 그대로 두고, 없으면 roomInfo 값을 복사
          roomInfo: c.roomInfo?.trim() || 'standard',
        })),
      },
    };

    try {
      if (isExisting) {
        await updateHotelSettings(hotelId, payload);
        alert('전체 업데이트 완료');
      } else {
        await registerHotel(payload);
        alert('호텔 등록 완료');
        setIsExisting(true);
      }
    } catch (err) {
      console.error('전체 저장 실패:', err);
      alert('전체 저장 실패: ' + err.message);
    }
  };

  // 7) 취소 (원복)
  const handleCancel = () => {
    if (!originalDataRef.current) return;
    const orig = originalDataRef.current;

    setHotelId(orig.hotelId);
    setIsExisting(orig.isExisting);
    setTotalRooms(orig.totalRooms);
    setRoomTypes(JSON.parse(JSON.stringify(orig.roomTypes)));
    setGridSettings(JSON.parse(JSON.stringify(orig.gridSettings)));

    alert('변경 사항이 취소되었습니다. (원복됨)');
  };

  // 로딩된 데이터를 원복용으로 저장
  useEffect(() => {
    originalDataRef.current = {
      hotelId,
      isExisting,
      totalRooms,
      roomTypes: JSON.parse(JSON.stringify(roomTypes)),
      gridSettings: JSON.parse(JSON.stringify(gridSettings)),
    };
  }, [hotelId, isExisting, totalRooms, roomTypes, gridSettings]);

  return (
    <div className="hotel-settings-page" style={{ fontSize: '18px' }}>
      <h1 style={{ fontSize: '32px', marginBottom: '10px' }}>
        호텔 설정 통합 페이지 (단일 최종 저장)
      </h1>

      <div style={{ marginBottom: '1rem' }}>
        <button
          style={{ fontSize: '18px', marginRight: '10px' }}
          onClick={() => navigate('/')}
        >
          메인화면으로 돌아가기
        </button>
        <button style={{ fontSize: '18px' }} onClick={handleCancel}>
          취소 (원복)
        </button>
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {/* (1) 기본정보 */}
      <section className="hotel-info-section">
        <h2 style={{ fontSize: '24px' }}>1. 호텔 기본정보</h2>
        <div>
          <label>호텔 ID</label>
          <input
            type="text"
            value={hotelId}
            onChange={(e) => setHotelId(e.target.value)}
            disabled={isExisting}
            style={{ fontSize: '18px', width: '240px' }}
          />
        </div>
        <div>
          <label>총 객실 수</label>
          <input
            type="number"
            value={totalRooms}
            readOnly
            style={{
              fontSize: '18px',
              width: '120px',
              backgroundColor: '#eee',
            }}
          />
        </div>
      </section>

      {/* (2) 객실 타입 설정을 그냥 객실설정으로 바꾸고 필드값이 룸인포가 되어야함. */}
      <section className="room-types-section">
        <h2 style={{ fontSize: '24px' }}>2. 객실 설정</h2>
        {roomTypes.map((rt, idx) => (
          <div key={idx} className="room-type_setting">
            {/* 첫 줄 */}
            <div className="horizontal-fields">
              <input
                type="text"
                placeholder="한글 이름"
                value={rt.nameKor}
                onChange={(e) =>
                  handleRoomTypeChange(idx, 'nameKor', e.target.value)
                }
                style={{ fontSize: '18px' }}
              />
              <input
                type="text"
                placeholder="영어 이름"
                value={rt.nameEng}
                onChange={(e) =>
                  handleRoomTypeChange(idx, 'nameEng', e.target.value)
                }
                style={{ fontSize: '18px' }}
              />
              <input
                type="number"
                placeholder="가격"
                value={rt.price}
                onChange={(e) =>
                  handleRoomTypeChange(idx, 'price', e.target.value)
                }
                style={{ fontSize: '18px' }}
              />
              {/* stock은 layout에서 자동 업데이트됨 → readOnly */}
              <input
                type="number"
                placeholder="재고"
                value={rt.stock}
                readOnly
                style={{
                  fontSize: '18px',
                  backgroundColor: '#eaeaea',
                  width: '100px',
                }}
              />
            </div>
            {/* 둘째 줄: 별칭 4칸 */}
            <div className="horizontal-fields">
              {Array.from({ length: 4 }).map((_, aliasIndex) => {
                const aliasVal =
                  rt.aliases && rt.aliases[aliasIndex]
                    ? rt.aliases[aliasIndex]
                    : '';
                return (
                  <input
                    key={aliasIndex}
                    type="text"
                    placeholder={`별칭 ${aliasIndex + 1}`}
                    value={aliasVal}
                    onChange={(e) => {
                      const newAliases = rt.aliases ? [...rt.aliases] : [];
                      newAliases[aliasIndex] = e.target.value;
                      handleRoomTypeChange(idx, 'aliases', newAliases);
                    }}
                    style={{ fontSize: '18px' }}
                  />
                );
              })}
            </div>
            <button
              onClick={() => removeRoomType(idx)}
              style={{ fontSize: '18px', marginTop: '4px' }}
            >
              삭제
            </button>
          </div>
        ))}
        <button
          onClick={addRoomType}
          style={{ fontSize: '18px', marginTop: '8px' }}
        >
          객실 타입 추가
        </button>
      </section>

      {/* (3) 레이아웃 편집 */}
      <section className="layout-section">
        <h2 style={{ fontSize: '24px' }}>3. 객실 레이아웃 편집</h2>
        <LayoutEditor
          hotelRoomTypes={roomTypes}
          initialGridSettings={gridSettings}
          onChangeGridSettings={handleChangeGridSettings}
        />
      </section>

      {/* (4) DailyBoard 미리보기 */}
      <section className="preview-section">
        <h2 style={{ fontSize: '24px' }}>4. 예약 배정 미리보기</h2>
        <DndProvider backend={HTML5Backend}>
          <DailyBoard
            gridSettings={gridSettings}
            reservations={reservations}
            onUpdateReservation={handleReservationUpdate}
          />
        </DndProvider>
      </section>

      {/* (5) 전체 저장 & 취소 */}
      <div style={{ marginTop: '2rem' }}>
        <button
          onClick={handleSaveAll}
          style={{ fontSize: '20px', marginRight: '10px' }}
        >
          전체 저장
        </button>
        <button
          onClick={handleCancel}
          style={{ fontSize: '20px', backgroundColor: '#999', color: '#fff' }}
        >
          취소 (원복)
        </button>
      </div>
    </div>
  );
}
