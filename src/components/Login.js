// staysync/frontend/src/Login.js
import React, { useState, useEffect, useCallback } from 'react';
import { loginUser, fetchHotelSettings, refreshToken } from '../api/api';
import ForgotPassword from './ForgotPassword';
import HotelSettings from './HotelSettings';
import { Link } from 'react-router-dom';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import Modal from 'react-modal';
import './Login.css';

Modal.setAppElement('#root');

const Login = ({ onLogin, isLoggedIn, onLogout }) => {
  const [hotelId, setHotelId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showHotelSettings, setShowHotelSettings] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);

  useEffect(() => {
    if (isLoggedIn) return;

    const tryAutoLogin = async () => {
      try {
        const data = await refreshToken();
        if (data.accessToken) {
          const savedHotelId = localStorage.getItem('hotelId');
          if (savedHotelId) {
            onLogin(data.accessToken, savedHotelId);
            console.log('자동 로그인 성공:', data.accessToken, savedHotelId);
          } else {
            console.warn('자동 로그인 실패: hotelId 없음');
          }
        }
      } catch (error) {
        console.log('자동 로그인 실패:', error);
      }
    };

    tryAutoLogin();
  }, [onLogin, isLoggedIn]);

  useEffect(() => {
    const savedHotelId = localStorage.getItem('hotelId');
    const savedAttempts = localStorage.getItem('loginAttempts') || '0';
    console.log(
      'Login.js - Local Storage:',
      { savedHotelId, savedAttempts },
      ' - Once'
    );

    if (savedHotelId) {
      setHotelId(savedHotelId);
    }

    const initializeLoginAttempts = async () => {
      try {
        const response = await loginUser({ hotelId: savedHotelId, password: '' });
        if (response.remainingAttempts !== undefined) {
          setLoginAttempts(5 - response.remainingAttempts);
        }
      } catch (error) {
        console.error('Login attempts initialization failed:', error);
        setLoginAttempts(parseInt(savedAttempts, 10) || 0);
      }
    };

    if (savedHotelId) initializeLoginAttempts();
  }, []);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setIsLoading(true);
      setError('');

      try {
        const normalizedHotelId = hotelId.trim().toLowerCase();
        const result = await loginUser({
          hotelId: normalizedHotelId,
          password,
        });

        if (result.accessToken) {
          const { accessToken, isRegistered } = result;
          console.log('로그인 성공:', accessToken, isRegistered);
          onLogin(accessToken, normalizedHotelId);

          setLoginAttempts(0);
          localStorage.setItem('hotelId', normalizedHotelId);
          localStorage.removeItem('password');
          localStorage.setItem('loginAttempts', '0');
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
        } else {
          throw new Error('로그인에 실패했습니다.');
        }
      } catch (error) {
        if (error.status === 401) {
          if (error.userNotFound) {
            setError(error.message);
          } else if (error.message.includes('승인 대기')) {
            setError(error.message); // '계정이 승인 대기 중입니다. 개발사의 승인을 기다려주세요.'
          } else if (error.message.includes('비활성화')) {
            setError(error.message); // '계정이 비활성화되었습니다. 개발사에 문의하세요.'
          } else {
            const newAttempts = (loginAttempts || 0) + 1;
            setLoginAttempts(newAttempts);
            localStorage.setItem('loginAttempts', newAttempts.toString());
            const remainingAttempts = 5 - newAttempts;
            if (remainingAttempts > 0) {
              setError(
                `로그인 실패: ${newAttempts}번 실패했습니다. 남은 시도 횟수: ${remainingAttempts}번`
              );
            } else {
              setError(
                '로그인 실패: 최대 시도 횟수를 초과했습니다. 비밀번호 재설정을 요청하세요.'
              );
              setShowForgotPassword(true);
              setLoginAttempts(0);
              localStorage.setItem('loginAttempts', '0');
            }
          }
        } else if (error.status === 403) {
          setError('CSRF 토큰 오류: 페이지 새로고침 후 다시 시도해주세요.');
        } else {
          setError(error.message || '로그인 중 오류가 발생했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    },
    [hotelId, password, onLogin, loginAttempts]
  );

  const toggleShowPassword = () => {
    setShowPassword((prev) => !prev);
  };

  const openQRModal = () => {
    setShowQRModal(true);
  };

  const closeQRModal = () => {
    setShowQRModal(false);
  };

  return (
    <div className="login-container">
      <form onSubmit={handleSubmit} className="login-form" autoComplete="on">
        <h2 className="login-title">HOTEL CHECKIN</h2>
        {error && (
          <p className="login-error-message">
            {typeof error === 'string' ? error : error.message}
          </p>
        )}

        <div className="login-login-block">
          <div className="login-input-group">
            <div className="login-input-wrapper">
              <input
                type="text"
                id="hotelId"
                name="username"
                autoComplete="username"
                placeholder=" "
                value={hotelId}
                onChange={(e) => setHotelId(e.target.value)}
                required
                aria-label="호텔 ID"
                className="login-input-field"
              />
              <label className="login-input-label" htmlFor="hotelId">
                ID/전화번호
              </label>
            </div>
          </div>

          <div className="login-input-group login-no-margin-bottom">
            <div className="login-input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="current-password"
                autoComplete="current-password"
                placeholder=" "
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                aria-label="비밀번호"
                className="login-input-field"
                style={{
                  height: '48px',
                  lineHeight: '24px',
                  padding: '12px 16px',
                }}
              />
              <label className="login-input-label" htmlFor="password">
                비밀번호
              </label>
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

        <button
          type="submit"
          disabled={isLoading}
          className="login-login-button"
        >
          {isLoading ? '로그인 중...' : '로그인'}
        </button>

        <div className="login-auth-options-bottom">
          <button className="login-passkey-button" aria-label="Passkey Login">
            Passkey로 로그인
          </button>
          <button
            className="login-qr-button"
            onClick={openQRModal}
            aria-label="QR Login"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#1a237e">
              <path d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zm-8 8h8v8H3v-8zm2 2v4h4v-4H5zm8-2h8v8h-8v-8zm2 2v4h4v-4h-4z" />
            </svg>
          </button>
        </div>

        <p className="login-forgot-or-signup">
          <span
            onClick={() => setShowForgotPassword(true)}
            className="login-forgot-link"
            aria-label="Forgot Password"
          >
            비밀번호를 잊으셨나요?
          </span>{' '}
          |{' '}
          <Link
            to="/register"
            className="login-signup-link"
            aria-label="Sign Up"
          >
            회원가입
          </Link>
        </p>
      </form>

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
            <img
              src="/logo32.png"
              alt="QR Code"
              style={{ width: '200px', height: '200px' }}
            />
          </div>
          <p className="login-qr-valid-time">유효 시간: 02:55</p>
          <p className="login-qr-instruction">
            공공 네트워크라면 안전하게 QR 코드를 사용하세요.
            <br />
            QR 코드를 모바일 기기로 스캔한 후, 화면의 번호를 입력하면 PC에
            로그인됩니다.
          </p>
          <button
            onClick={closeQRModal}
            className="login-close-modal"
            aria-label="Close Modal"
          >
            닫기
          </button>
        </div>
      </Modal>

      {showForgotPassword && (
        <ForgotPassword
          onClose={() => setShowForgotPassword(false)}
          isCritical={loginAttempts >= 5}
        />
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