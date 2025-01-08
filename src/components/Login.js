// src/components/Login.js

import React, { useState } from 'react';
import { loginUser, fetchHotelSettings } from '../api/api';
import ForgotPassword from './ForgotPassword';
import HotelSettings from './HotelSettings';
import { Link } from 'react-router-dom';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import './Login.css';

const Login = ({ onLogin }) => {
  const [hotelId, setHotelId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [showHotelSettings, setShowHotelSettings] = useState(false);
  const [isFormDisabled, setIsFormDisabled] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const MAX_LOGIN_ATTEMPTS = 5;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setPasswordError('');

    try {
      const normalizedHotelId = hotelId.trim().toLowerCase();

      const { accessToken, isRegistered } = await loginUser({
        hotelId: normalizedHotelId,
        password,
      });

      console.log('로그인 성공:', accessToken, isRegistered);
      onLogin(accessToken, normalizedHotelId);
      setLoginAttempts(0);
      setError('');
      setPasswordError('');

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
      // console.error('로그인 실패:', error);
      // console.log('에러 객체 상세:', error);
      // console.log('error.status:', error.status);
      // console.log('error.message:', error.message);

      // error.response 대신 error.status와 error.message를 활용
      if (error.status === 401) {
        setLoginAttempts((prevAttempts) => {
          const newAttempts = prevAttempts + 1;
          if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
            setShowForgotPassword(true);
            setIsFormDisabled(true);
            return 0; // 횟수 초기화
          } else {
            const remainingAttempts = MAX_LOGIN_ATTEMPTS - newAttempts;
            setError(
              error.message ||
                '로그인 실패: 유효하지 않은 자격 증명 또는 호텔 ID.'
            );
            setPasswordError(`남은 시도 횟수: ${remainingAttempts}`);
            return newAttempts;
          }
        });
      } else {
        // 네트워크 에러 또는 서버, 기타 에러
        setError(
          error.message ||
            '로그인 중 오류가 발생했습니다. 나중에 다시 시도해주세요.'
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const toggleShowPassword = () => {
    setShowPassword((prevState) => !prevState);
  };

  return (
    <div className="login-container">
      <form onSubmit={handleSubmit} className="login-form">
        <h2>HOTEL CHECKIN</h2>
        <Link to="/register" className="register-link">
          회원가입
        </Link>
        {error && <p className="error">{error}</p>}
        {passwordError && <p className="password-error">{passwordError}</p>}

        <input
          type="text"
          placeholder="호텔 ID"
          value={hotelId}
          onChange={(e) => setHotelId(e.target.value)}
          required
          aria-label="호텔 ID"
          disabled={isFormDisabled}
        />

        <div className="password-input-container">
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            aria-label="비밀번호"
            disabled={isFormDisabled}
          />
          <span
            className="password-toggle-icon"
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

        <button type="submit" disabled={isFormDisabled || isLoading}>
          {isLoading ? '로그인 중...' : '로그인'}
        </button>

        <button
          type="button"
          onClick={() => setShowForgotPassword(true)}
          className={`forgot-password-button ${
            loginAttempts >= MAX_LOGIN_ATTEMPTS ? 'highlight' : ''
          }`}
          disabled={isFormDisabled}
        >
          비밀번호를 잊으셨나요?
        </button>
      </form>

      {showForgotPassword && (
        <ForgotPassword onClose={() => setShowForgotPassword(false)} />
      )}

      {showHotelSettings && (
        <HotelSettings
          onClose={() => setShowHotelSettings(false)}
          onSave={() => {
            setShowHotelSettings(false);
            alert('호텔 설정이 완료되었습니다. 이제 로그인하세요.');
          }}
        />
      )}
    </div>
  );
};

export default Login;
