import React, { useState } from 'react';
import './DetailPanel.css';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toZonedTime } from 'date-fns-tz';

function DetailPanel({ reservation, onClose, onEdit, onSave }) {
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({ ...reservation });

  // 디버깅 로그: 초기 데이터 확인
  console.log('[DetailPanel] Initial reservation data:', reservation);

  const handleEditToggle = () => {
    setEditMode(!editMode);
    console.log('[DetailPanel] Edit mode toggled to:', !editMode); // 디버깅 로그
  };

  const handleChange = (e) => {
    try {
      const { name, value } = e.target;
      setEditData((prev) => {
        const updatedData = { ...prev, [name]: value };
        console.log(`[DetailPanel] Changed ${name} to:`, value); // 디버깅 로그
        return updatedData;
      });
    } catch (error) {
      console.error('[DetailPanel] Error in handleChange:', error);
      alert('입력 처리 중 오류가 발생했습니다.');
    }
  };

  const handleSave = () => {
    try {
      // 기본 유효성 검사 (예: 필수 필드 확인)
      if (!editData.customerName || !editData.roomNumber) {
        alert('예약자 이름과 객실 번호는 필수입니다.');
        return;
      }
      onSave(editData);
      setEditMode(false);
      console.log('[DetailPanel] Saved data:', editData); // 디버깅 로그
    } catch (error) {
      console.error('[DetailPanel] Error in handleSave:', error);
      alert('저장 중 오류가 발생했습니다.');
    }
  };

  // 날짜를 KST로 변환하고 포맷팅
  const formatDateKST = (dateStr) => {
    if (!dateStr) return '';
    const parsedDate = parseISO(dateStr);
    const kstDate = toZonedTime(parsedDate, 'Asia/Seoul');
    return format(kstDate, 'yyyy-MM-dd HH:mm', { locale: ko });
  };

  return (
    <div className="detail-panel" role="dialog" aria-labelledby="detail-header">
      <div className="detail-header" id="detail-header">
        <h2>예약 상세</h2>
        <button onClick={onClose} aria-label="패널 닫기">
          닫기
        </button>
      </div>
      {editMode ? (
        <div className="edit-form">
          <label>
            예약자:
            <input
              name="customerName"
              value={editData.customerName || ''}
              onChange={handleChange}
              aria-label="예약자 이름 입력"
              required
            />
          </label>
          <label>
            객실 번호:
            <input
              name="roomNumber"
              value={editData.roomNumber || ''}
              onChange={handleChange}
              aria-label="객실 번호 입력"
              required
            />
          </label>
          <label>
            체크인:
            <input
              name="checkIn"
              value={editData.checkIn || ''}
              onChange={handleChange}
              aria-label="체크인 날짜 입력"
            />
          </label>
          <label>
            체크아웃:
            <input
              name="checkOut"
              value={editData.checkOut || ''}
              onChange={handleChange}
              aria-label="체크아웃 날짜 입력"
            />
          </label>
          {/* 동적 필드 추가 가능성을 위한 예비 공간 */}
          {Object.keys(reservation)
            .filter(
              (key) =>
                !['customerName', 'roomNumber', 'checkIn', 'checkOut'].includes(
                  key
                )
            )
            .map((key) => (
              <label key={key}>
                {key}:
                <input
                  name={key}
                  value={editData[key] || ''}
                  onChange={handleChange}
                  aria-label={`${key} 입력`}
                />
              </label>
            ))}
          <div className="edit-buttons">
            <button onClick={handleSave} aria-label="변경 사항 저장">
              저장
            </button>
            <button onClick={handleEditToggle} aria-label="편집 취소">
              취소
            </button>
          </div>
        </div>
      ) : (
        <div className="detail-content">
          <p>예약자: {reservation.customerName || 'N/A'}</p>
          <p>체크인: {formatDateKST(reservation.checkIn) || 'N/A'}</p>
          <p>체크아웃: {formatDateKST(reservation.checkOut) || 'N/A'}</p>
          <p>객실 번호: {reservation.roomNumber || 'N/A'}</p>
          {/* 동적 필드 표시 */}
          {Object.keys(reservation)
            .filter(
              (key) =>
                !['customerName', 'roomNumber', 'checkIn', 'checkOut'].includes(
                  key
                )
            )
            .map((key) => (
              <p key={key}>
                {key}: {reservation[key] || 'N/A'}
              </p>
            ))}
          <button onClick={handleEditToggle} aria-label="예약 수정">
            수정
          </button>
        </div>
      )}
    </div>
  );
}

export default DetailPanel;