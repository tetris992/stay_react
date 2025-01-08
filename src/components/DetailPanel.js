// src/components/DetailPanel.js

import React, { useState } from 'react';
import './DetailPanel.css';

function DetailPanel({ reservation, onClose, onEdit, onSave }) {
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({ ...reservation });

  const handleEditToggle = () => setEditMode(!editMode);
  const handleChange = (e) =>
    setEditData({ ...editData, [e.target.name]: e.target.value });

  const handleSave = () => {
    onSave(editData);
    setEditMode(false);
  };

  return (
    <div className="detail-panel">
      <div className="detail-header">
        <h2>예약 상세</h2>
        <button onClick={onClose}>닫기</button>
      </div>
      {editMode ? (
        <div className="edit-form">
          <label>
            예약자:
            <input
              name="customerName"
              value={editData.customerName}
              onChange={handleChange}
            />
          </label>
          {/* 다른 필드들도 동일한 방식으로 추가/수정 */}
          <button onClick={handleSave}>저장</button>
          <button onClick={handleEditToggle}>취소</button>
        </div>
      ) : (
        <div className="detail-content">
          <p>예약자: {reservation.customerName}</p>
          <p>체크인: {reservation.checkIn}</p>
          <p>체크아웃: {reservation.checkOut}</p>
          {/* 필요한 정보 표시 */}
          <button onClick={handleEditToggle}>수정</button>
        </div>
      )}
    </div>
  );
}

export default DetailPanel;
