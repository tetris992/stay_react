import React, { useState, useEffect } from 'react';
import { registerUser } from '../api/api';
import './Register.css';
import { Link, useNavigate } from 'react-router-dom';
import PrivacyConsentModal from './PrivacyConsentModal';
import { FaCheck } from 'react-icons/fa';

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
    general: '',
  });

  useEffect(() => {
    // 로컬 스토리지에서 관련 데이터 제거
    localStorage.removeItem('hotelId');
    localStorage.removeItem('hotelName');
    localStorage.removeItem('password');
    localStorage.removeItem('confirmPassword');
    localStorage.removeItem('email');
    localStorage.removeItem('address');
    localStorage.removeItem('phoneNumber');
    localStorage.removeItem('consentChecked');
  }, []);

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
    if (!email || !/.+@.+\..+/.test(email)) {
      newErrors.email = '유효한 이메일을 입력하세요.';
    }
    if (!address) {
      newErrors.address = '호텔 주소는 필수입니다.';
    }
    const phoneRegex =
      /^(\+82|0)\s?([0-9]{2,4})\s?-?\s?([0-9]{3,4})\s?-?\s?([0-9]{4})$/;
    if (!phoneNumber || !phoneRegex.test(phoneNumber)) {
      newErrors.phoneNumber =
        '전화번호는 올바른 형식이어야 합니다 (예: 010-1234-5678).';
    }
    if (!consentChecked) {
      newErrors.consent = '개인정보 동의가 필요합니다.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async (e) => {
    e.preventDefault();
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
      setErrors((prev) => ({ ...prev, general: message }));
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
    <div className="reg-container">
      <div className="reg-card">
        <h1 className="reg-brand">StaySync</h1>
        <form onSubmit={handleRegister} className="reg-form">
          {/* 순서를 변경하여 input 뒤에 label이 오도록 수정 */}
          <div className="reg-form-group">
            <input
              id="hotelName"
              type="text"
              value={hotelName}
              onChange={(e) => setHotelName(e.target.value)}
              required
              aria-label="호텔 이름"
              className="reg-input-field"
              placeholder=" "
            />
            <label htmlFor="hotelName" className="reg-floating-label">
              호텔 이름
            </label>
            {errors.hotelName && (
              <p className="reg-error-message">{errors.hotelName}</p>
            )}
          </div>

          <div className="reg-form-group">
            <input
              id="hotelId"
              type="text"
              value={hotelId}
              onChange={(e) => setHotelId(e.target.value)}
              required
              aria-label="호텔 ID"
              className="reg-input-field"
              placeholder=" "
            />
            <label htmlFor="hotelId" className="reg-floating-label">
              호텔 ID
            </label>
            {errors.hotelId && (
              <p className="reg-error-message">{errors.hotelId}</p>
            )}
          </div>

          <div className="reg-form-group">
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              aria-label="비밀번호"
              className="reg-input-field"
              placeholder=" "
            />
            <label htmlFor="password" className="reg-floating-label">
              비밀번호
            </label>
            {errors.password && (
              <p className="reg-error-message">{errors.password}</p>
            )}
          </div>

          <div className="reg-form-group">
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              aria-label="비밀번호 확인"
              className="reg-input-field"
              placeholder=" "
            />
            <label htmlFor="confirmPassword" className="reg-floating-label">
              비밀번호 확인
            </label>
            {errors.confirmPassword && (
              <p className="reg-error-message">{errors.confirmPassword}</p>
            )}
          </div>

          <div className="reg-form-group">
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              aria-label="이메일"
              className="reg-input-field"
              placeholder=" "
            />
            <label htmlFor="email" className="reg-floating-label">
              이메일
            </label>
            {errors.email && (
              <p className="reg-error-message">{errors.email}</p>
            )}
          </div>

          <div className="reg-form-group">
            <input
              id="address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
              aria-label="호텔 주소"
              className="reg-input-field"
              placeholder=" "
            />
            <label htmlFor="address" className="reg-floating-label">
              호텔 주소
            </label>
            {errors.address && (
              <p className="reg-error-message">{errors.address}</p>
            )}
          </div>

          <div className="reg-form-group">
            <input
              id="phoneNumber"
              type="text"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              required
              aria-label="전화번호"
              className="reg-input-field"
              placeholder=" "
            />
            <label htmlFor="phoneNumber" className="reg-floating-label">
              전화번호
            </label>
            {errors.phoneNumber && (
              <p className="reg-error-message">{errors.phoneNumber}</p>
            )}
          </div>

          <div className="reg-form-group">
            <div className="reg-consent-text">
              {!consentChecked ? (
                <span
                  onClick={() => setShowConsentModal(true)}
                  className="reg-consent-link"
                  role="button"
                  tabIndex={0}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      setShowConsentModal(true);
                    }
                  }}
                >
                  개인정보 사용 및 서비스 약관 동의하기
                </span>
              ) : (
                <p className="reg-consent-confirmed">
                  개인정보 사용 및 서비스 약관에 동의하셨습니다.
                </p>
              )}
              {errors.consent && (
                <p className="reg-error-message">{errors.consent}</p>
              )}
            </div>
          </div>
          <button
            type="submit"
            disabled={isProcessing}
            className="reg-submit-icon"
          >
            {isProcessing ? (
              <span>처리 중...</span>
            ) : (
              <FaCheck className="reg-icon" aria-label="회원가입 완료" />
            )}
          </button>
        </form>
        <div className="reg-footer">
          이미 계정이 있으신가요?{' '}
          <Link to="/login" className="reg-login-button">
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
