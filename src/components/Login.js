import React, { useState, useEffect } from 'react';
import { loginUser, fetchHotelSettings /*, logoutUser */ } from '../api/api';
import ForgotPassword from './ForgotPassword';
import HotelSettings from './HotelSettings';
import { Link } from 'react-router-dom';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import Modal from 'react-modal';
import './Login.css';

// Eslint 경고 무시: logoutUser는 부모 컴포넌트에서 사용될 수 있음
// eslint-disable-next-line no-unused-vars
Modal.setAppElement('#root');

const Login = ({ onLogin, isLoggedIn, onLogout }) => {
  const [hotelId, setHotelId] = useState('');
  const [password, setPassword] = useState(''); // 기본적으로 빈 문자열로 초기화
  const [error, setError] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showHotelSettings, setShowHotelSettings] = useState(false);
  const [isFormDisabled, setIsFormDisabled] = useState(false);
  const [showPassword, setShowPassword] = useState(false); // 기본값을 false로 설정 (숨김 상태)
  const [isLoading, setIsLoading] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [staySignedIn, setStaySignedIn] = useState(false);

  useEffect(() => {
    // 로컬 스토리지에서 로그인 상태 복원
    const savedHotelId = localStorage.getItem('hotelId');
    const savedPassword = localStorage.getItem('password');
    const savedStaySignedIn = localStorage.getItem('staySignedIn') === 'true';

    if (savedHotelId) {
      setHotelId(savedHotelId);
      if (savedStaySignedIn && savedPassword) {
        setPassword(savedPassword);
        setStaySignedIn(true);
      } else {
        setPassword(''); // 비밀번호 초기화
        setStaySignedIn(false);
      }
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const normalizedHotelId = hotelId.trim().toLowerCase();

      const { accessToken, isRegistered } = await loginUser({
        hotelId: normalizedHotelId,
        password,
      });

      console.log('로그인 성공:', accessToken, isRegistered);
      onLogin(accessToken, normalizedHotelId);

      if (staySignedIn) {
        localStorage.setItem('hotelId', normalizedHotelId);
        localStorage.setItem('password', password);
        localStorage.setItem('staySignedIn', 'true');
      } else {
        localStorage.removeItem('password');
        localStorage.setItem('hotelId', normalizedHotelId);
        localStorage.setItem('staySignedIn', 'false');
      }

      setError('');

      try {
        await fetchHotelSettings(normalizedHotelId);
      } catch (fetchError) {
        if (fetchError.status === 404) {
          setShowHotelSettings(true);
        } else {
          setError('호텔 설정을 불러오는 중 오류가 발생했습니다.');
        }
      }
    } catch (error) {
      if (error.status === 401) {
        setIsFormDisabled(true);
        setShowForgotPassword(true);
        setError('로그인 실패: 유효하지 않은 호텔 ID 또는 비밀번호입니다.');
      } else if (error.status === 403) {
        setError('CSRF 토큰 오류: 페이지 새로고침 후 다시 시도해주세요.');
      } else {
        setError(error.message || '로그인 중 오류가 발생했습니다.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Eslint 경고 무시: handleLogout는 부모 컴포넌트에서 사용될 수 있음
  // eslint-disable-next-line no-unused-vars
  const handleLogout = () => {
    onLogout(); // 부모 컴포넌트에서 logoutUser 호출
    setPassword(''); // 비밀번호 초기화
    if (staySignedIn) {
      // 로그인 상태 유지 체크 시 아이디 유지, 비밀번호 숨김 유지, 버튼으로 바로 로그인 가능
      setHotelId(localStorage.getItem('hotelId') || '');
      setPassword(''); // 비밀번호는 숨김 상태로 유지
      setShowPassword(false); // 비밀번호 숨김 상태로 설정
    } else {
      setHotelId(''); // 로그인 상태 유지 해제 시 아이디도 초기화
      localStorage.clear();
    }
    setIsFormDisabled(false);
    setError('');
  };

  const toggleShowPassword = () => {
    setShowPassword((prev) => !prev);
  };

  const openQRModal = () => {
    setShowQRModal(true);
  };

  const closeQRModal = () => {
    setShowQRModal(false);
  };

  const handleStaySignedInChange = (e) => {
    const checked = e.target.checked;
    setStaySignedIn(checked);
    if (checked) {
      localStorage.setItem('staySignedIn', 'true');
      if (hotelId && password) {
        localStorage.setItem('hotelId', hotelId);
        localStorage.setItem('password', password);
      }
    } else {
      localStorage.removeItem('staySignedIn');
      if (!isLoggedIn) {
        localStorage.removeItem('password');
      }
    }
  };

  const handleHotelIdClick = () => {
    const savedHotelId = localStorage.getItem('hotelId');
    const savedPassword = localStorage.getItem('password');
    const savedStaySignedIn = localStorage.getItem('staySignedIn') === 'true';

    if (savedHotelId) {
      setHotelId(savedHotelId);
      if (savedStaySignedIn && savedPassword) {
        setPassword(savedPassword);
        setStaySignedIn(true);
        handleSubmit({ preventDefault: () => {} }); // 자동 로그인 시도
      }
    }
  };

  return (
    <div className="login-container">
      <form onSubmit={handleSubmit} className="login-form" autoComplete="on">
        <h2 className="login-title">HOTEL CHECKIN</h2>
        {error && <p className="login-error-message">{error}</p>}

        <div className="login-login-block">
          <div className="login-input-group">
            <label className="login-input-label" htmlFor="hotelId">ID/전화번호</label>
            <div className="login-input-wrapper">
              <input
                type="text"
                id="hotelId"
                name="username"
                autoComplete="username"
                placeholder="740630"
                value={hotelId}
                onChange={(e) => setHotelId(e.target.value)}
                onClick={handleHotelIdClick} // 아이디 클릭 시 로컬 저장값 자동 입력 및 로그인
                required
                aria-label="호텔 ID"
                disabled={isFormDisabled}
                className="login-input-field"
              />
            </div>
          </div>

          <div className="login-input-group login-no-margin-bottom">
            <label className="login-input-label" htmlFor="password">비밀번호</label>
            <div className="login-input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="current-password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                aria-label="비밀번호"
                disabled={isFormDisabled}
                className="login-input-field"
                style={{ height: '48px', lineHeight: '24px', padding: '12px 16px' }} // 고정 스타일
              />
              <span
                className="login-password-toggle-icon"
                onClick={toggleShowPassword}
                aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 표시'}
                role="button"
                tabIndex={0}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    toggleShowPassword();
                  }
                }}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </span>
            </div>
          </div>
        </div>

        <div className="login-options">
          <label className="login-checkbox-label">
            <input
              type="checkbox"
              name="staySignedIn"
              checked={staySignedIn}
              onChange={handleStaySignedInChange}
              disabled={isFormDisabled}
            />
            <span className="login-checkbox-text">로그인 상태 유지</span>
          </label>
          <span className="login-ip-security">IP 보안 ON</span>
        </div>

        <button type="submit" disabled={isFormDisabled || isLoading} className="login-login-button">
          {isLoading ? '로그인 중...' : '로그인'}
        </button>

        <div className="login-auth-options-bottom">
          <button className="login-passkey-button" aria-label="Passkey Login">Passkey로 로그인</button>
          <button className="login-qr-button" onClick={openQRModal} aria-label="QR Login">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#1a237e">
              <path d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zm-8 8h8v8H3v-8zm2 2v4h4v-4H5zm8-2h8v8h-8v-8zm2 2v4h4v-4h-4z"/>
            </svg>
          </button>
        </div>

        <p className="login-forgot-or-signup">
          <span onClick={() => setShowForgotPassword(true)} className="login-forgot-link" aria-label="Forgot Password">
            비밀번호를 잊으셨나요?
          </span>{' '}
          |{' '}
          <Link to="/register" className="login-signup-link" aria-label="Sign Up">
            회원가입
          </Link>
        </p>
      </form>

      {/* QR 코드 모달 (디자인만) */}
      <Modal
        isOpen={showQRModal}
        onRequestClose={closeQRModal}
        style={{
          content: {
            width: '300px',
            height: '400px',
            margin: 'auto',
            borderRadius: '10px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          },
          overlay: {
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
          },
        }}
      >
        <div className="login-qr-modal">
          <h3 className="login-qr-modal-title">QR 코드로 로그인</h3>
          <div className="login-qr-code-image">
            <img src="/logo32.png" alt="QR Code" style={{ width: '200px', height: '200px' }} />
          </div>
          <p className="login-qr-valid-time">유효 시간: 02:55</p>
          <p className="login-qr-instruction">
            공공 네트워크라면 안전하게 QR 코드를 사용하세요.<br />
            QR 코드를 모바일 기기로 스캔한 후, 화면의 번호를 입력하면 PC에 로그인됩니다.
          </p>
          <button onClick={closeQRModal} className="login-close-modal" aria-label="Close Modal">닫기</button>
        </div>
      </Modal>

      {showForgotPassword && (
        <ForgotPassword onClose={() => setShowForgotPassword(false)} />
      )}

      {showHotelSettings && (
        <HotelSettings
          onClose={() => setShowHotelSettings(false)}
          onSave={() => {
            setShowHotelSettings(false);
            alert('회원가입이 완료되었습니다. 이제 로그인하세요.');
          }}
        />
      )}
    </div>
  );
};

export default Login;