// src/components/Register.js

import React, { useState } from 'react';
import { registerUser } from '../api/api';
import './Register.css';
import { Link } from 'react-router-dom'; // Link 컴포넌트 추가
// import ApiError from '../utils/ApiError.js';
import PropTypes from 'prop-types';

const Register = ({ onRegisterSuccess, onSwitchToLogin }) => {
  const [hotelId, setHotelId] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setIsProcessing(true); // 처리 시작
    setError(''); // 오류 초기화

    try {
      const normalizedHotelId = hotelId.trim().toLowerCase();
      const userData = {
        hotelId: normalizedHotelId,
        password,
        email: email.trim(),
        address: address.trim(),
        phoneNumber: phoneNumber.trim(),
      };
      await registerUser(userData);
      alert('회원가입이 완료되었습니다. 이제 로그인하세요.');
      onRegisterSuccess();
    } catch (error) {
      console.error('회원가입 실패:', error);

      // 오류 메시지 추출
      const message = error?.message || '회원가입 중 오류가 발생했습니다.';
      setError(message);
    } finally {
      setIsProcessing(false); // 처리 종료
    }
  };

  return (
    <div className="register-container">
      <form onSubmit={handleRegister} className="register-form">
        <h2>회원가입</h2>
        {error && <p className="error">{error}</p>}

        <input
          type="text"
          placeholder="호텔 ID"
          value={hotelId}
          onChange={(e) => setHotelId(e.target.value)}
          required
          aria-label="호텔 ID"
          // autoComplete="off"
        />
        <input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          aria-label="비밀번호"
        />
        <input
          type="email"
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          aria-label="이메일"
        />
        <input
          type="text"
          placeholder="호텔 주소"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          required
          aria-label="호텔 주소"
        />
        <input
          type="text"
          placeholder="전화번호 (예: 0507-1388-6901)"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          required
          aria-label="전화번호"
        />
        <button type="submit" disabled={isProcessing}>
          {isProcessing ? '회원가입 중...' : '회원가입'}
        </button>
      </form>
      <div className="register-footer">
        이미 계정이 있으신가요?{' '}
        <div>
          <Link to="/login" className="login-link">
            로그인
          </Link>
        </div>
      </div>
    </div>
  );
};

Register.propTypes = {
  //배포에서는 삭제하는게 좋음.(개발단계에서 정확한 타입을 정의하기 위해 사용)
  onRegisterSuccess: PropTypes.func.isRequired,
  onSwitchToLogin: PropTypes.func,
};

export default Register;
