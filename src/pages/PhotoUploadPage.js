// frontend/src/pages/PhotoUploadPage.js
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaTrash, FaCamera } from 'react-icons/fa';
import { fetchHotelSettings, fetchUserInfo } from '../api/api';
import api from '../api/api';
import './PhotoUploadPage.css';

const DEFAULT_PASSWORD = '##11'; // 개발사가 지정한 디폴트 비밀번호
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB 제한
const ALLOWED_FORMATS = ['image/jpeg', 'image/png', 'image/webp']; // 허용된 포맷
const MAX_RESOLUTION = { width: 1920, height: 1080 }; // 최대 해상도 1920x1080

const PhotoUploadPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { hotelId, roomTypes } = location.state || {};

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const [hotelInfo, setHotelInfo] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // 각 카테고리별 업로드된 사진 상태
  const [roomPhotos, setRoomPhotos] = useState({}); // { roomType: [{ photoUrl, order }, ...] }
  const [exteriorPhotos, setExteriorPhotos] = useState([]); // [{ photoUrl, order }, ...]
  const [facilityPhotos, setFacilityPhotos] = useState({}); // { subCategory: [{ photoUrl, order }, ...] }

  // 업로드 중인 파일과 순서 상태
  const [roomFiles, setRoomFiles] = useState({}); // { roomType: [{ file, order }, ...] }
  const [exteriorFiles, setExteriorFiles] = useState([]); // [{ file, order }, ...]
  const [facilityFiles, setFacilityFiles] = useState({}); // { subCategory: [{ file, order }, ...] }

  // 기타 시설 서브 카테고리 목록을 useMemo로 메모이제이션
  const facilitySubCategories = useMemo(() => [
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
  ], []);

  // 비밀번호 인증 처리
  const handlePasswordSubmit = async () => {
    try {
      const response = await api.post('/auth/validate-upload-password', {
        hotelId,
        password,
      });

      if (response.data.valid || password === DEFAULT_PASSWORD) {
        setIsAuthenticated(true);
      } else {
        setPasswordError('비밀번호가 올바르지 않습니다.');
      }
    } catch (err) {
      // 백엔드에서 validate-upload-password 엔드포인트가 없으므로, 임시로 디폴트 비밀번호만으로 인증
      if (password === DEFAULT_PASSWORD) {
        setIsAuthenticated(true);
      } else {
        setPasswordError(
          '비밀번호 인증 실패: ' + (err.response?.data?.message || err.message)
        );
      }
    }
  };

  // 호텔 및 기존 사진 로드
  useEffect(() => {
    if (!hotelId || !roomTypes) {
      setError('호텔 ID 또는 객실 타입 정보가 없습니다. 호텔 설정 페이지에서 접근해주세요.');
      setTimeout(() => navigate('/hotel-settings'), 3000);
      return;
    }

    // 호텔 정보와 회원 정보를 병렬로 로드하고, 한 번만 상태 업데이트 (HotelSettingsPage.js 참고)
    const loadHotelData = async () => {
      try {
        const [hotelData, userData] = await Promise.all([
          fetchHotelSettings(hotelId).catch((err) => {
            if (err.response?.status === 404) {
              throw new Error('호텔 정보를 찾을 수 없습니다. 호텔 설정을 먼저 저장해주세요.');
            }
            throw err;
          }),
          fetchUserInfo(hotelId).catch((err) => {
            console.warn('호텔 회원 정보 로드 실패:', err);
            return null; // 회원 정보 로드 실패 시 null 반환
          }),
        ]);

        if (hotelData && hotelData._id) {
          setHotelInfo({
            hotelId: hotelData.hotelId,
            hotelName: hotelData.hotelName,
            address: hotelData.address || '',
            email: hotelData.email || '',
            phoneNumber: hotelData.phoneNumber || '',
            adminName: userData?.adminName || '정보 없음',
          });
        } else {
          throw new Error('호텔 정보를 찾을 수 없습니다. 호텔 설정을 먼저 저장해주세요.');
        }
      } catch (err) {
        setError('호텔 정보 로드 실패: ' + (err.message || err));
      }
    };

    // 객실 타입별 상태 초기화
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

    // 기타 시설 서브 카테고리별 상태 초기화
    const initialFacilityPhotos = {};
    facilitySubCategories.forEach((subCat) => {
      initialFacilityPhotos[subCat] = [];
    });
    setFacilityPhotos(initialFacilityPhotos);
    setFacilityFiles(
      facilitySubCategories.reduce((acc, subCat) => {
        acc[subCat] = [];
        return acc;
      }, {})
    );

    // 서버에 저장된 기존 사진 불러오기 (S3 가정)
    const fetchPhotos = async () => {
      try {
        const response = await api.get('/hotel-photos', {
          params: { hotelId },
        });
        const photos = response.data.photos || [];

        // 객실 사진 분류
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

        // 호텔 전경 사진 분류
        const newExteriorPhotos = photos
          .filter((photo) => photo.category === 'exterior')
          .map((photo) => ({
            photoUrl: photo.photoUrl,
            order: photo.order,
          }));
        setExteriorPhotos(newExteriorPhotos);

        // 기타 시설 사진 분류
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
        setError('사진 로드 실패: ' + (err.response?.data?.message || err.message));
      }
    };

    loadHotelData();
    fetchPhotos();
  }, [hotelId, roomTypes, navigate, facilitySubCategories]);

  // 파일 유효성 검사
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
        if (img.width > MAX_RESOLUTION.width || img.height > MAX_RESOLUTION.height) {
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

  // 파일 선택 핸들러 (다중 파일)
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

  // 순서 변경
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

  // 사진 업로드 (S3 가정)
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

        const response = await api.post('/hotel-photos/upload', formData);

        return { photoUrl: response.data.photo.photoUrl, order: fileObj.order };
      });

      const newPhotos = await Promise.all(uploadPromises);

      if (category === 'room') {
        setRoomPhotos((prev) => ({
          ...prev,
          [subCategory]: [...prev[subCategory], ...newPhotos],
        }));
        setRoomFiles((prev) => ({
          ...prev,
          [subCategory]: [],
        }));
      } else if (category === 'exterior') {
        setExteriorPhotos((prev) => [...prev, ...newPhotos]);
        setExteriorFiles([]);
      } else if (category === 'facility') {
        setFacilityPhotos((prev) => ({
          ...prev,
          [subCategory]: [...prev[subCategory], ...newPhotos],
        }));
        setFacilityFiles((prev) => ({
          ...prev,
          [subCategory]: [],
        }));
      }

      setMessage('사진이 성공적으로 업로드되었습니다.');
      setError('');
    } catch (err) {
      const errorMsg = err.response?.data?.message || '알 수 없는 오류';
      setError(`업로드 실패: ${errorMsg}`);
      setMessage('');
    }
  };

  // 사진 삭제 (S3 가정)
  const handleDelete = async (category, subCategory, photoUrl) => {
    try {
      await api.delete('/hotel-photos', {
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
        setExteriorPhotos((prev) => prev.filter((photo) => photo.photoUrl !== photoUrl));
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

  // 인증되지 않은 경우, 비밀번호 입력 폼 노출
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
            <button className="photo-upload-submit-password-btn" onClick={handlePasswordSubmit}>
              확인
            </button>
            {passwordError && <p className="error-message">{passwordError}</p>}
          </div>
        </div>
      </div>
    );
  }

  // 인증 후, 실제 사진 업로드/관리 UI 노출
  return (
    <div className="photo-upload-container">
      {/* 상단 호텔 정보 섹션 */}
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
        <div className="photo-upload-button-group">
          <button
            className="photo-upload-back-btn"
            onClick={() => navigate('/hotel-settings')}
            aria-label="호텔 설정 페이지로 이동"
          >
            뒤로가기
          </button>
        </div>
      </div>

      {error && <p className="error-message center-text">{error}</p>}
      {message && <p className="success-message center-text">{message}</p>}

      {/* 객실 사진 업로드 섹션 */}
      <section className="photo-upload-section">
        <h2 className="section-title">객실 사진</h2>
        {roomTypes && roomTypes.map((rt) => (
          <div key={rt.roomInfo} className="photo-upload-card">
            <div className="photo-upload-header">
              <h3>{rt.nameKor} ({rt.nameEng})</h3>
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
                      handleOrderChange('room', rt.roomInfo, index, e.target.value)
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
                    onClick={() => handleDelete('room', rt.roomInfo, photo.photoUrl)}
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

      {/* 호텔 전경 사진 업로드 섹션 */}
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
                    handleOrderChange('exterior', 'default', index, e.target.value)
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
                  onClick={() => handleDelete('exterior', 'default', photo.photoUrl)}
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

      {/* 기타 시설 사진 업로드 섹션 */}
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
                      handleOrderChange('facility', subCat, index, e.target.value)
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
                    onClick={() => handleDelete('facility', subCat, photo.photoUrl)}
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
};

export default PhotoUploadPage;