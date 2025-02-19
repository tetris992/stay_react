// src/components/Register.js
import React, { useState } from 'react';
import { registerUser } from '../api/api';
import './Register.css';
import { Link } from 'react-router-dom';
import PropTypes from 'prop-types';
import PrivacyConsentModal from './PrivacyConsentModal';

const Register = ({ onRegisterSuccess, onSwitchToLogin }) => {
  const [hotelId, setHotelId] = useState('');
  const [hotelName, setHotelName] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  // 서버에서는 'consentChecked' 필드로 동의 여부를 관리합니다.
  const [consentChecked, setConsentChecked] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // 회원가입 버튼 클릭 시 입력 정보와 동의 여부를 포함해 API 호출
  const handleRegister = async (e) => {
    e.preventDefault();
    if (!consentChecked) {
      const errMsg = '회원가입을 위해 개인정보 동의가 필요합니다.';
      setError(errMsg);
      alert(errMsg);
      return;
    }
    setIsProcessing(true);
    setError('');
    try {
      const normalizedHotelId = hotelId.trim().toLowerCase();
      const userData = {
        hotelId: normalizedHotelId,
        hotelName: hotelName.trim(),
        password,
        email: email.trim(),
        address: address.trim(),
        phoneNumber: phoneNumber.trim(),
        consentChecked: true,
      };
      await registerUser(userData);
      alert('회원가입이 완료되었습니다.');
      onRegisterSuccess(); // 로그인 화면으로 전환
    } catch (error) {
      const message = error?.response?.data?.message|| '회원가입 중 오류가 발생했습니다.';  //확인이 필요함. 
      setError(message);
      alert(message);
    } finally {
      setIsProcessing(false);
    }
  };

  // 모달에서 동의 확인 시 호출되는 콜백: 단순히 동의 상태만 업데이트
  const handleConsentComplete = () => {
    setConsentChecked(true);
    setShowConsentModal(false);
  };

  return (
    <div className="register-container">
      <form onSubmit={handleRegister} className="register-form">
        <h2>회원가입</h2>
        {error && <p className="error">{error}</p>}
        <input
          type="text"
          placeholder="호텔 이름"
          value={hotelName}
          onChange={(e) => setHotelName(e.target.value)}
          required
          aria-label="호텔 이름"
        />
        <input
          type="text"
          placeholder="호텔 ID"
          value={hotelId}
          onChange={(e) => setHotelId(e.target.value)}
          required
          aria-label="호텔 ID"
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

        {/* 개인정보 동의 영역 */}
        <div className="consent-container">
          {!consentChecked ? (
            <button
              type="button"
              onClick={() => setShowConsentModal(true)}
              disabled={isProcessing}
            >
              개인정보 사용 및 서비스 약관 동의하기
            </button>
          ) : (
            <p>개인정보 사용 및 서비스 약관에 동의하셨습니다.</p>
          )}
        </div>

        <button type="submit" disabled={isProcessing}>
          {isProcessing ? '처리 중...' : '회원가입'}
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

      {showConsentModal && (
        <PrivacyConsentModal
          hotelId={hotelId}
          onClose={() => setShowConsentModal(false)}
          onConsentComplete={handleConsentComplete}
        />
      )}
    </div>
  );
};

Register.propTypes = {
  onRegisterSuccess: PropTypes.func.isRequired,
  onSwitchToLogin: PropTypes.func,
};

export default Register;
