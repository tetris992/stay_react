// src/components/HotelIdModal.js

import React, { useState } from 'react';
import './HotelIdModal.css';

const HotelIdModal = ({ onSubmit }) => {
  const [inputHotelId, setInputHotelId] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputHotelId.trim()) {
      setError('호텔 ID를 입력해주세요.');
      return;
    }
    setError(''); // Clear the error on valid input
    onSubmit(inputHotelId.trim().toLowerCase());
  };

  return (
    <div className="hotel-id-modal">
      <div className="hotel-id-modal-content">
        <h2>호텔 ID 입력</h2>
        {error && <p className="error">{error}</p>}
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="호텔 ID"
            value={inputHotelId}
            onChange={(e) => setInputHotelId(e.target.value)}
            required
          />
          <button type="submit">확인</button>
        </form>
      </div>
    </div>
  );
};

export default HotelIdModal;
