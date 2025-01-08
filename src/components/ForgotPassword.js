// src/components/ForgotPassword.js

import React, { useState, useEffect, useRef } from 'react';
import { resetPasswordRequest } from '../api/api'; // 수정된 임포트
import './ForgotPassword.css';

const ForgotPassword = ({ onClose }) => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false); // 요청 진행 상태
  const emailInputRef = useRef(null); // 포커스 관리

  useEffect(() => {
    // 모달이 열리면 이메일 입력 필드에 포커스
    if (emailInputRef.current) {
      emailInputRef.current.focus();
    }
  }, []);

  const handleRequest = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      // 이메일 형식 검증
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        setError('유효한 이메일 형식을 입력하세요.');
        setMessage('');
        setIsSubmitting(false);
        return;
      }

      await resetPasswordRequest(email); // 수정된 함수 호출
      setMessage('비밀번호 재설정 이메일이 전송되었습니다.');
      setError('');
    } catch (err) {
      console.error('비밀번호 재설정 요청 실패:', err);
      setError(
        err.response?.data?.message || '비밀번호 재설정 요청에 실패했습니다.'
      );
      setMessage('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="forgot-password-overlay">
      <div className="forgot-password-modal" role="dialog" aria-modal="true" aria-labelledby="forgot-password-title">
        <button className="close-button" onClick={onClose} aria-label="닫기">
          &times;
        </button>
        <h2 id="forgot-password-title">비밀번호 재설정</h2>
        {message && <p className="success">{message}</p>}
        {error && <p className="error">{error}</p>}
        <form onSubmit={handleRequest}>
          <input
            type="email"
            placeholder="등록된 이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            aria-label="등록된 이메일"
            ref={emailInputRef} // 포커스 관리
            disabled={isSubmitting} // 요청 진행 시 비활성화
          />
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? '요청 중...' : '비밀번호 재설정 요청'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ForgotPassword;
