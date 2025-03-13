import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import './LogViewer.css';

const LogViewer = ({ logs, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredLogsState, setFilteredLogsState] = useState(logs); // 필터링된 로그 상태
  const [sortOrder, setSortOrder] = useState('desc'); // 기본 정렬: 내림차순 (최신순)

  // 검색 실행 핸들러 (Enter 키로만 실행)
  const handleSearch = () => {
    const trimmedSearchTerm = searchTerm.trim();
    const filtered = logs.filter((log) =>
      log.message.toLowerCase().includes(trimmedSearchTerm.toLowerCase())
    );
    setFilteredLogsState(filtered);
  };

  // Enter 키 입력 감지
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // 로그 데이터가 변경될 때 초기 필터링 상태 갱신
  useEffect(() => {
    setFilteredLogsState(logs);
  }, [logs]);

  // 날짜별로 로그 그룹화
  const groupedLogs = filteredLogsState.reduce((acc, log) => {
    const date = log.selectedDate;
    if (!acc[date]) acc[date] = [];
    acc[date].push(log);
    return acc;
  }, {});

  // 정렬된 날짜 목록 (최신 날짜가 위로 오도록 기본 내림차순)
  const sortedDates = Object.keys(groupedLogs).sort((a, b) => {
    return sortOrder === 'desc'
      ? new Date(b) - new Date(a)
      : new Date(a) - new Date(b);
  });

  // 로그 정렬 (각 날짜 내에서 시간순 정렬)
  const sortedGroupedLogs = sortedDates.reduce((acc, date) => {
    const logsForDate = groupedLogs[date].sort((a, b) => {
      return sortOrder === 'desc'
        ? new Date(b.timestamp) - new Date(a.timestamp)
        : new Date(a.timestamp) - new Date(b.timestamp);
    });
    acc[date] = logsForDate;
    return acc;
  }, {});

  // 소트 변경 핸들러
  const handleSortChange = (e) => {
    setSortOrder(e.target.value);
  };

  return (
    <div className="log-viewer-overlay" onClick={onClose}>
      <div
        className="log-viewer"
        style={{
          width: '1200px', // 화면에서 볼 때는 더 넓게 설정
          maxWidth: '90vw', // 최대 너비는 화면의 90%로 제한
          minHeight: '400px',
          maxHeight: '90vh',
          backgroundColor: 'white',
          padding: '30px', // 더 넓은 패딩으로 가독성 향상
          boxShadow: '0 0 10px rgba(0, 0, 0, 0.5)',
          overflowY: 'auto', // 세로 스크롤 바
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 1000,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <h2 style={{ fontSize: '2em', margin: 0 }}>과거 내역확인</h2>
            <select
              value={sortOrder}
              onChange={handleSortChange}
              style={{
                padding: '5px 10px',
                fontSize: '1em',
                borderRadius: '4px',
                border: '1px solid #ccc',
              }}
            >
              <option value="desc">최신순 (내림차순)</option>
              <option value="asc">오래된순 (오름차순)</option>
            </select>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '8px 15px',
              fontSize: '1.1em',
              backgroundColor: '#f0f0f0',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
        <input
          type="text"
          placeholder="Search logs... (Press Enter to search)"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{
            width: '100%',
            padding: '10px',
            marginBottom: '20px',
            fontSize: '1.2em',
            border: '1px solid #ccc',
            borderRadius: '4px',
          }}
        />
        {sortedDates.map((date) => (
          <div key={date}>
            <h3
              style={{
                borderTop: '2px solid #000',
                paddingTop: '15px',
                fontSize: '1.6em',
                marginBottom: '10px',
              }}
            >
              Date Changed: {date}
            </h3>
            {sortedGroupedLogs[date].map((log, index) => (
              <p
                key={index}
                style={{
                  margin: '10px 0',
                  fontSize: '1.2em',
                  lineHeight: '1.6',
                  padding: '5px 10px',
                  backgroundColor: '#f9f9f9',
                  borderRadius: '4px',
                }}
              >
                [{log.timestamp}] {log.message}
              </p>
            ))}
          </div>
        ))}
        {filteredLogsState.length === 0 && (
          <p style={{ fontSize: '1.2em', color: '#666' }}>No logs found.</p>
        )}
      </div>
    </div>
  );
};

LogViewer.propTypes = {
  logs: PropTypes.arrayOf(
    PropTypes.shape({
      timestamp: PropTypes.string.isRequired,
      message: PropTypes.string.isRequired,
      selectedDate: PropTypes.string.isRequired,
    })
  ).isRequired,
  onClose: PropTypes.func.isRequired,
};

export default LogViewer;
