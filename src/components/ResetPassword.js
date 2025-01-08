// src/components/ResetPassword.js

import React, { useState } from 'react';
import { resetPassword } from '../api/api';
import { useParams, useNavigate } from 'react-router-dom';
import './ResetPassword.css';

const ResetPassword = () => {
  const { token } = useParams(); // URL에서 토큰 가져오기
  const navigate = useNavigate(); // 리디렉션을 위한 훅
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false); // 요청 진행 상태

  const handleReset = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      setMessage('');
      return;
    }

    // 비밀번호 유효성 검사 (예: 최소 8자, 숫자 및 특수 문자 포함)
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      setError('비밀번호는 최소 8자 이상이며, 숫자와 특수 문자를 포함해야 합니다.');
      setMessage('');
      return;
    }

    setIsSubmitting(true);
    try {
      await resetPassword(token, newPassword);
      setMessage('비밀번호가 성공적으로 재설정되었습니다.');
      setError('');

      // 잠시 후 로그인 페이지로 리디렉션
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err) {
      setError(err.message);
      setMessage('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="reset-password-container">
      <form onSubmit={handleReset} className="reset-password-form">
        <h2>비밀번호 재설정</h2>
        {message && <p className="success">{message}</p>}
        {error && <p className="error">{error}</p>}
        <input
          type="password"
          placeholder="새 비밀번호"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          aria-label="새 비밀번호"
          disabled={isSubmitting}
        />
        <input
          type="password"
          placeholder="비밀번호 확인"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          aria-label="비밀번호 확인"
          disabled={isSubmitting}
        />
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? '비밀번호 재설정 중...' : '비밀번호 재설정'}
        </button>
      </form>
    </div>
  );
};

export default ResetPassword;
