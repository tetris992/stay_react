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
    if (!token) {
      setError('유효하지 않은 재설정 링크입니다.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      setMessage('');
      return;
    }

    // 비밀번호 유효성 검사 (최소 8자, 대소문자, 숫자, 특수 문자 포함)
    const passwordRegex =
      /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      setError(
        '비밀번호는 최소 8자 이상이며, 대소문자, 숫자, 특수 문자를 포함해야 합니다.'
      );
      setMessage('');
      return;
    }

    setIsSubmitting(true);
    try {
      await resetPassword(token, newPassword);
      setMessage(
        '비밀번호가 성공적으로 재설정되었습니다. 3초 후 로그인 페이지로 이동합니다.'
      );
      setError('');
      setNewPassword('');
      setConfirmPassword('');

      // 3초 후 로그인 페이지로 리디렉션
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 3000);
    } catch (err) {
      const errorMessage =
        err.response?.data?.message || '비밀번호 재설정에 실패했습니다.';
      setError(errorMessage);
      setMessage('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="reset-password-container">
      <form
        onSubmit={handleReset}
        className="reset-password-form"
        aria-label="비밀번호 재설정 폼"
      >
        <h2>비밀번호 재설정</h2>
        {message && <p className="success-message">{message}</p>}
        {error && <p className="error-message">{error}</p>}
        <input
          type="password"
          placeholder="새 비밀번호"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          aria-label="새 비밀번호 입력"
          disabled={isSubmitting}
          autoComplete="new-password"
        />
        <input
          type="password"
          placeholder="비밀번호 확인"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          aria-label="비밀번호 확인 입력"
          disabled={isSubmitting}
          autoComplete="new-password"
        />
        <button
          type="submit"
          disabled={isSubmitting}
          aria-label={isSubmitting ? '재설정 중...' : '비밀번호 재설정'}
        >
          {isSubmitting ? '재설정 중...' : '비밀번호 재설정'}
        </button>
      </form>
    </div>
  );
};

export default ResetPassword;
