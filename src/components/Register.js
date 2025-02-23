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
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [consentChecked, setConsentChecked] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errors, setErrors] = useState({
    hotelId: '',
    hotelName: '',
    password: '',
    confirmPassword: '',
    email: '',
    address: '',
    phoneNumber: '',
    consent: '',
  });

  const validateForm = () => {
    const newErrors = {};
    if (!hotelId || hotelId.length < 5 || hotelId.length > 20) {
      newErrors.hotelId = '호텔 ID는 5자 이상 20자 이하여야 합니다.';
    }
    if (!hotelName) {
      newErrors.hotelName = '호텔 이름은 필수입니다.';
    }
    if (!password || password.length < 8) {
      newErrors.password = '비밀번호는 최소 8자 이상이어야 합니다.';
    }
    if (password !== confirmPassword) {
      newErrors.confirmPassword = '비밀번호가 일치하지 않습니다.';
    }
    if (!email || !/.+@.+\..+/.test(email)) { // 백슬래시 제거
      newErrors.email = '유효한 이메일을 입력하세요.';
    }
    if (!address) {
      newErrors.address = '호텔 주소는 필수입니다.';
    }
    const phoneRegex = /^(\+82|0)\s?([0-9]{2,4})\s?-?\s?([0-9]{3,4})\s?-?\s?([0-9]{4})$/;
    if (!phoneNumber || !phoneRegex.test(phoneNumber)) {
      newErrors.phoneNumber = '전화번호는 올바른 형식이어야 합니다 (예: 010-1234-5678).';
    }
    if (!consentChecked) {
      newErrors.consent = '개인정보 동의가 필요합니다.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setIsProcessing(true);

    if (!validateForm()) {
      setIsProcessing(false);
      return;
    }

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
        if (error.message && error.message.includes('phoneNumber')) {
          setErrors((prev) => ({
            ...prev,
            phoneNumber: '이미 등록된 전화번호입니다.',
          }));
          message = '이미 등록된 전화번호입니다.';
        } else if (error.message && error.message.includes('email')) {
          setErrors((prev) => ({
            ...prev,
            email: '이미 등록된 이메일입니다.',
          }));
          message = '이미 등록된 이메일입니다.';
        } else if (error.message && error.message.includes('hotelId')) {
          setErrors((prev) => ({
            ...prev,
            hotelId: '이미 존재하는 호텔 ID입니다.',
          }));
          message = '이미 존재하는 호텔 ID입니다.';
        } else {
          message = '이미 존재하는 호텔 ID, 이메일 또는 전화번호입니다.';
        }
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
    setErrors((prev) => ({ ...prev, consent: '' }));
  };

  return (
    <div className="register-container">
      <form onSubmit={handleRegister} className="register-form">
        <h2>회원가입</h2>
        {error && <p className="error">{error}</p>}
        <label>
          호텔 ID:
          <input
            type="text"
            placeholder="호텔 ID (5~20자)"
            value={hotelId}
            onChange={(e) => setHotelId(e.target.value)}
            required
            aria-label="호텔 ID"
          />
          {errors.hotelId && <p className="error">{errors.hotelId}</p>}
        </label>
        <label>
          호텔 이름:
          <input
            type="text"
            placeholder="호텔 이름"
            value={hotelName}
            onChange={(e) => setHotelName(e.target.value)}
            required
            aria-label="호텔 이름"
          />
          {errors.hotelName && <p className="error">{errors.hotelName}</p>}
        </label>
        <label>
          비밀번호:
          <input
            type="password"
            placeholder="비밀번호 (8자 이상)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            aria-label="비밀번호"
          />
          {errors.password && <p className="error">{errors.password}</p>}
        </label>
        <label>
          비밀번호 확인:
          <input
            type="password"
            placeholder="비밀번호 확인"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            aria-label="비밀번호 확인"
          />
          {errors.confirmPassword && <p className="error">{errors.confirmPassword}</p>}
        </label>
        <label>
          이메일:
          <input
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            aria-label="이메일"
          />
          {errors.email && <p className="error">{errors.email}</p>}
        </label>
        <label>
          호텔 주소:
          <input
            type="text"
            placeholder="호텔 주소"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
            aria-label="호텔 주소"
          />
          {errors.address && <p className="error">{errors.address}</p>}
        </label>
        <label>
          전화번호:
          <input
            type="text"
            placeholder="전화번호 (예: 010-1234-5678)"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            required
            aria-label="전화번호"
          />
          {errors.phoneNumber && <p className="error">{errors.phoneNumber}</p>}
        </label>
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
            <p>개인정보 사용 및 서비스 약관에 동의하셨습니다。</p>
          )}
          {errors.consent && <p className="error">{errors.consent}</p>}
        </div>
        <button type="submit" disabled={isProcessing}>
          {isProcessing ? '처리 중...' : '회원가입'}
        </button>
      </form>
      <div className="register-footer">
        이미 계정이 있으신가요?{' '}
        <Link to="/login" className="login-link">
          로그인
        </Link>
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