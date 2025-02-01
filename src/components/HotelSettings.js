// src/components/HotelSettings.js

import React, { useState, useEffect } from 'react';
import './HotelSettings.css';
import {
  fetchHotelSettings,
  fetchUserInfo,
  updateHotelSettings,
  registerHotel,
} from '../api/api';
import { defaultRoomTypes } from '../config/defaultRoomTypes';
import PropTypes from 'prop-types';
import PrivacyConsentModal from './PrivacyConsentModal';

function HotelSettings({
  onClose,
  onSave,
  existingSettings = {
    hotelId: '',
    totalRooms: 0,
    roomTypes: defaultRoomTypes,
    email: '',
    address: '',
    phoneNumber: '',
  },
}) {
  // 기본 정보 상태
  const [hotelId, setHotelId] = useState(
    existingSettings?.hotelId || localStorage.getItem('hotelId') || ''
  );
  // totalRooms는 이제 개별 재고 합계로 자동 계산되므로 초기값은 기존 설정을 그대로 사용(나중에 useEffect에서 업데이트)
  const [totalRooms, setTotalRooms] = useState(existingSettings?.totalRooms || 0);
  const [address, setAddress] = useState(existingSettings?.address || '');
  const [phoneNumber, setPhoneNumber] = useState(existingSettings?.phoneNumber || '');
  const [email, setEmail] = useState(existingSettings?.email || '');
  const [roomTypes, setRoomTypes] = useState(existingSettings?.roomTypes || defaultRoomTypes);
  const [error, setError] = useState('');
  const [isExisting, setIsExisting] = useState(false);

  // OTA 로그인 정보 상태
  const [yanoljaId, setYanoljaId] = useState('');
  const [yanoljaPw, setYanoljaPw] = useState('');

  // 개인정보 동의 상태 및 모달
  const [consentChecked, setConsentChecked] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  useEffect(() => {
    console.log('Existing Settings:', existingSettings);
  }, [existingSettings]);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        let localUserInfo = null;
        const storedUserInfo = localStorage.getItem('userInfo');
        if (storedUserInfo) {
          try {
            localUserInfo = JSON.parse(storedUserInfo);
          } catch (e) {
            console.error('Failed to parse userInfo from localStorage:', e);
          }
        }

        let currentUserData = localUserInfo;

        if (existingSettings && existingSettings.hotelId) {
          // 기존 호텔 설정
          setRoomTypes(existingSettings.roomTypes);
          setTotalRooms(existingSettings.totalRooms);
          setIsExisting(true);

          if (!currentUserData) {
            currentUserData = await fetchUserInfo(existingSettings.hotelId);
          }
          setAddress(currentUserData?.address || '');
          setPhoneNumber(currentUserData?.phoneNumber || '');
          setEmail(currentUserData?.email || '');
          setConsentChecked(!!currentUserData?.consentChecked);

          if (existingSettings.otaCredentials?.yanolja) {
            setYanoljaId(existingSettings.otaCredentials.yanolja.loginId || '');
            setYanoljaPw(existingSettings.otaCredentials.yanolja.loginPw || '');
          }
        } else {
          // 새 호텔 설정
          const hotelIdToUse = localStorage.getItem('hotelId') || hotelId;
          if (!hotelIdToUse) return;
          const hotelData = await fetchHotelSettings(hotelIdToUse);
          if (hotelData && hotelData.roomTypes) {
            setRoomTypes(hotelData.roomTypes);
            setTotalRooms(hotelData.totalRooms);
            setIsExisting(true);
          } else {
            setIsExisting(false);
          }
          if (!currentUserData) {
            currentUserData = await fetchUserInfo(hotelIdToUse);
          }
          setAddress(currentUserData?.address || '');
          setPhoneNumber(currentUserData?.phoneNumber || '');
          setEmail(currentUserData?.email || '');
          setConsentChecked(!!currentUserData?.consentChecked);
          setYanoljaId('');
          setYanoljaPw('');
        }
      } catch (error) {
        console.error('호텔 설정 불러오기 실패:', error);
        setError('호텔 설정을 불러오는 중 오류가 발생했습니다.');
      }
    };

    loadSettings();
  }, [hotelId, existingSettings]);

  // ⭐️ 개별 객실 타입의 재고(stock) 값이 변경될 때마다 총 객실 수를 자동 계산
  useEffect(() => {
    const computedTotal = roomTypes.reduce(
      (acc, rt) => acc + (Number(rt.stock) || 0),
      0
    );
    setTotalRooms(computedTotal);
  }, [roomTypes]);

  // 객실 타입 변경 (별칭은 별도의 5개 입력란으로 처리)
  const handleRoomTypeChange = (index, field, value) => {
    const newRoomTypes = [...roomTypes];
    if (field === 'price' || field === 'stock') {
      newRoomTypes[index][field] = value === '' ? '' : Number(value);
    } else if (field === 'aliases') {
      newRoomTypes[index][field] = value;
    } else {
      newRoomTypes[index][field] = value;
    }
    setRoomTypes(newRoomTypes);
  };

  // 객실 타입 추가/삭제
  const addRoomType = () => {
    setRoomTypes([
      ...roomTypes,
      {
        type: 'custom-type-' + (roomTypes.length + 1),
        nameKor: '',
        nameEng: '',
        price: '',
        stock: '',
        aliases: [],
      },
    ]);
  };

  const removeRoomType = (index) => {
    setRoomTypes(roomTypes.filter((_, i) => i !== index));
  };

  // 저장 처리
  const handleSave = async () => {
    if (
      !hotelId.trim() ||
      !address.trim() ||
      !phoneNumber.trim() ||
      !email.trim()
    ) {
      alert('호텔 ID, 주소, 전화번호, 이메일은 필수 입력 항목입니다.');
      return;
    }

    // 객실 타입 검사 (별칭은 배열 형태)
    if (
      roomTypes.length === 0 ||
      roomTypes.some(
        (rt) =>
          !rt.nameKor ||
          !rt.nameEng ||
          rt.price === '' ||
          rt.stock === '' ||
          isNaN(rt.price) ||
          isNaN(rt.stock)
      )
    ) {
      alert('유효한 객실 타입, 가격, 재고를 입력하세요.');
      return;
    }

    const normalizedHotelId = hotelId.trim().toLowerCase();

    const otaCredentials = {
      yanolja: {
        loginId: yanoljaId.trim(),
        loginPw: yanoljaPw.trim(),
        cookies: [],
      },
    };

    // ⭐️ 개별 객실 재고(stock)의 합계를 총 객실 수로 사용
    const computedTotalRooms = roomTypes.reduce(
      (sum, rt) => sum + (Number(rt.stock) || 0),
      0
    );

    const newSettings = {
      hotelId: normalizedHotelId,
      totalRooms: computedTotalRooms,
      roomTypes: roomTypes.map((rt) => ({
        ...rt,
        price: Number(rt.price),
        stock: Number(rt.stock),
        nameEng: rt.nameEng ? rt.nameEng.trim() : '',
        nameKor: rt.nameKor ? rt.nameKor.trim() : '',
        aliases: Array.isArray(rt.aliases)
          ? rt.aliases.map((alias) => alias.trim().toLowerCase())
          : [],
      })),
      email: email.trim(),
      address: address.trim(),
      phoneNumber: phoneNumber.trim(),
      otaCredentials,
    };

    console.log('Saving settings from HotelSettings:', newSettings);

    try {
      if (isExisting) {
        await updateHotelSettings(normalizedHotelId, newSettings);
        alert('호텔 설정이 성공적으로 업데이트되었습니다.');
      } else {
        await registerHotel(newSettings);
        alert('호텔 설정이 성공적으로 등록되었습니다.');
      }

      if (onSave) {
        onSave(newSettings);
      }
      onClose();
    } catch (error) {
      console.error('호텔 설정 저장 오류:', error);
      alert(`호텔 설정 저장에 실패했습니다: ${error.message}`);
    }
  };

  // 개인정보 동의 모달 핸들러
  const openPrivacyModal = () => {
    setShowPrivacyModal(true);
  };
  const closePrivacyModal = () => {
    setShowPrivacyModal(false);
  };
  const handleConsentComplete = () => {
    setConsentChecked(true);
    closePrivacyModal();
  };

  return (
    <div className="hotel-settings-modal">
      <form className="hotel-settings-content" autoComplete="off">
        <button className="close-button" onClick={onClose} aria-label="닫기">
          &times;
        </button>

        <div className="settings-header">
          <h2 className="settings-title">
            {isExisting ? '호텔 설정 수정' : '호텔 초기 설정'}
          </h2>
          {/* 개인정보 동의 배너 */}
          <div className="consent-banner">
            {consentChecked ? (
              <span className="consent-checked-label">
                <i className="fa fa-check-circle"></i> 개인정보 동의 완료
              </span>
            ) : (
              <button
                type="button"
                className="consent-button"
                onClick={openPrivacyModal}
              >
                개인정보처리방침 확인 및 동의
              </button>
            )}
          </div>
        </div>

        {error && <p className="error">{error}</p>}
        {!isExisting && !error && <p className="info">호텔 설정을 입력해주세요.</p>}

        {/* 섹션 1: 호텔 기본정보 */}
        <div className="section">
          <h3>호텔 기본정보</h3>
          <input
            type="text"
            placeholder="호텔 ID"
            value={hotelId}
            onChange={(e) => setHotelId(e.target.value)}
            required
            disabled={isExisting}
            autoComplete="off"
          />
          {/* 총 객실 수는 개별 재고 합계로 자동 계산되므로 읽기 전용 */}
          <input
            type="number"
            placeholder="총 객실 수"
            value={totalRooms}
            readOnly
            required
            min="0"
            autoComplete="off"
          />
          <input
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="off"
          />
          <input
            type="text"
            placeholder="호텔 주소"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
            autoComplete="off"
          />
          <input
            type="text"
            placeholder="전화번호 (예: 0507-1388-6901)"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            required
            autoComplete="off"
          />
        </div>

        {/* 섹션 2: 객실 타입 및 가격/재고 */}
        <div className="section">
          <h3>객실 타입 및 가격/재고</h3>
          {roomTypes.map((room, index) => (
            <div key={index} className="room-type">
              <input
                type="text"
                placeholder="한글 이름 (예: 스탠다드)"
                value={room.nameKor || ''}
                onChange={(e) =>
                  handleRoomTypeChange(index, 'nameKor', e.target.value)
                }
                required
                autoComplete="off"
              />
              <input
                type="text"
                placeholder="영어 이름 (예: Standard)"
                value={room.nameEng || ''}
                onChange={(e) =>
                  handleRoomTypeChange(index, 'nameEng', e.target.value)
                }
                required
                autoComplete="off"
              />
              <input
                type="number"
                placeholder="가격 (예: 100000)"
                value={room.price === '' ? '' : room.price}
                onChange={(e) =>
                  handleRoomTypeChange(index, 'price', e.target.value)
                }
                required
                autoComplete="off"
              />
              <input
                type="number"
                placeholder="재고 수량"
                value={room.stock === '' ? '' : room.stock}
                onChange={(e) =>
                  handleRoomTypeChange(index, 'stock', e.target.value)
                }
                required
                autoComplete="off"
              />
              {/* 별칭 입력란: 5개의 입력필드를 한 행에 배치 */}
              <div className="alias-inputs">
                {Array.from({ length: 5 }).map((_, i) => (
                  <input
                    key={i}
                    type="text"
                    placeholder={`별칭 ${i + 1}`}
                    value={room.aliases && room.aliases[i] ? room.aliases[i] : ''}
                    onChange={(e) => {
                      const newAliases = room.aliases ? [...room.aliases] : [];
                      newAliases[i] = e.target.value;
                      handleRoomTypeChange(index, 'aliases', newAliases);
                    }}
                    autoComplete="off"
                  />
                ))}
              </div>
              <button
                className="delete-roomType"
                onClick={() => removeRoomType(index)}
                aria-label="객실 타입 삭제"
                type="button"
              >
                &times;
              </button>
            </div>
          ))}
          <button
            className="add_button"
            onClick={addRoomType}
            type="button"
            style={{ marginBottom: '1rem' }}
          >
            객실 타입 추가
          </button>
        </div>

        {/* 섹션 3: OTA 로그인 정보 */}
        <div className="section">
          <h3>야놀자 로그인 정보</h3>
          <input
            type="text"
            placeholder="야놀자 아이디"
            value={yanoljaId}
            onChange={(e) => setYanoljaId(e.target.value)}
            autoComplete="new-username"
          />
          <input
            type="password"
            placeholder="야놀자 비밀번호"
            value={yanoljaPw}
            onChange={(e) => setYanoljaPw(e.target.value)}
            autoComplete="new-password"
          />
        </div>

        <div className="buttons_container">
          <div className="buttons">
            <button className="save-button" onClick={handleSave} type="button">
              저장
            </button>
            <button className="cancel-button" onClick={onClose} type="button">
              취소
            </button>
          </div>
        </div>
      </form>

      {showPrivacyModal && (
        <PrivacyConsentModal
          hotelId={hotelId}
          onClose={closePrivacyModal}
          onConsentComplete={handleConsentComplete}
        />
      )}
    </div>
  );
}

HotelSettings.propTypes = {
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func,
  existingSettings: PropTypes.shape({
    hotelId: PropTypes.string,
    totalRooms: PropTypes.number,
    roomTypes: PropTypes.arrayOf(
      PropTypes.shape({
        type: PropTypes.string,
        nameKor: PropTypes.string,
        nameEng: PropTypes.string,
        price: PropTypes.number,
        stock: PropTypes.number,
        aliases: PropTypes.arrayOf(PropTypes.string),
      })
    ),
    email: PropTypes.string,
    address: PropTypes.string,
    phoneNumber: PropTypes.string,
    otaCredentials: PropTypes.object,
  }),
};

export default HotelSettings;
