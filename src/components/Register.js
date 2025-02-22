import React, { useState } from 'react';
import { registerUser } from '../api/api';
import './Register.css';
import { Link, useNavigate } from 'react-router-dom';
import PrivacyConsentModal from './PrivacyConsentModal';

const Register = () => {
  const navigate = useNavigate();
  const [hotelId, setHotelId] = useState('');
  const [hotelName, setHotelName] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [consentChecked, setConsentChecked] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [hotelIdError, setHotelIdError] = useState('');
  const [phoneNumberError, setPhoneNumberError] = useState('');

  const handleRegister = async (e) => {
    e.preventDefault();

    if (password.length < 8) {
      setPasswordError('비밀번호는 최소 8자 이상이어야 합니다.');
      return;
    } else {
      setPasswordError('');
    }

    if (hotelId.length < 5 || hotelId.length > 20) {
      setHotelIdError('호텔 ID는 최소 5자 이상, 최대 20자 이하이어야 합니다.');
      return;
    } else {
      setHotelIdError('');
    }

    const phoneRegex = /^(\+82|0)\s?([0-9]{2,4})\s?-?\s?([0-9]{3,4})\s?-?\s?([0-9]{4})$/;
    if (!phoneRegex.test(phoneNumber)) {
      setPhoneNumberError('전화번호는 올바른 형식이어야 합니다 (예: 010-2224-4444).');
      return;
    } else {
      setPhoneNumberError('');
    }

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
      navigate('/login');
    } catch (error) {
      let message = '회원가입 중 오류가 발생했습니다.';
      if (error.status === 403) {
        message = 'CSRF 토큰 오류: 페이지 새로고침 후 다시 시도해주세요.';
      } else if (error.status === 409) {
        message = error.message || '이미 존재하는 호텔 ID, 이메일 또는 전화번호입니다.';
      } else if (error.message) {
        message = error.message;
      }
      setError(message);
      alert(message);
    } finally {
      setIsProcessing(false);
    }
  };

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
        {hotelIdError && <p className="error">{hotelIdError}</p>}
        <input
          type="password"
          placeholder="비밀번호(8자이상)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          aria-label="비밀번호"
        />
        {passwordError && <p className="error">{passwordError}</p>}
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
        {phoneNumberError && <p className="error">{phoneNumberError}</p>}

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

export default Register;