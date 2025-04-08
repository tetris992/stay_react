import React, { useState, useEffect, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import './LogViewer.css';

const LogViewer = ({ logs, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  const [filteredLogsState, setFilteredLogsState] = useState(logs);
  const [sortOrder, setSortOrder] = useState('desc');

  // 디버깅: logs 배열 확인
  useEffect(() => {
    console.log('[LogViewer] Received logs:', logs);
  }, [logs]);

  // 로그 메시지 정제 함수
  const cleanLogMessage = (message) => {
    // 1. 함수 이름 제거 (예: [handleRoomChangeAndSync], [handleFormSave] 등)
    let cleanedMessage = message.replace(/\[(handle\w+)\]\s*/, '');

    // 2. [object Object] 제거
    cleanedMessage = cleanedMessage.replace(/\s*\[object Object\]$/, '');

    // 3. 현장예약- 뒤의 UUID 제거
    cleanedMessage = cleanedMessage.replace(
      /(현장예약)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,
      '$1'
    );

    return cleanedMessage;
  };

  // 검색 및 필터링 실행 핸들러
  const handleSearchAndFilter = useCallback(() => {
    const trimmedSearchTerm = searchTerm.trim().toLowerCase();
    const filtered = logs.filter((log) => {
      const matchesFilter =
        filter === 'all' ||
        (filter === 'create' && log.actionType === 'create') ||
        (filter === 'delete' && log.actionType === 'delete') ||
        (filter === 'move' && log.actionType === 'move') ||
        (filter === 'update' && log.actionType === 'update');
      const matchesSearch = log.message.toLowerCase().includes(trimmedSearchTerm);
      return matchesFilter && matchesSearch;
    });
    setFilteredLogsState(filtered);
    console.log('[LogViewer] Filtered logs:', filtered);
  }, [logs, filter, searchTerm]);

  // Enter 키 입력 감지
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSearchAndFilter();
    }
  };

  // 로그 데이터 또는 필터 변경 시 필터링 상태 갱신
  useEffect(() => {
    handleSearchAndFilter();
  }, [handleSearchAndFilter]);

  // 날짜별로 로그 그룹화
  const groupedLogs = useMemo(() => {
    return filteredLogsState.reduce((acc, log) => {
      const date = log.selectedDate;
      if (!acc[date]) acc[date] = [];
      acc[date].push(log);
      return acc;
    }, {});
  }, [filteredLogsState]);

  // 정렬된 날짜 목록
  const sortedDates = useMemo(() => {
    return Object.keys(groupedLogs).sort((a, b) =>
      sortOrder === 'desc' ? new Date(b) - new Date(a) : new Date(a) - new Date(b)
    );
  }, [groupedLogs, sortOrder]);

  // 로그 정렬 (각 날짜 내에서 시간순 정렬)
  const sortedGroupedLogs = useMemo(() => {
    return sortedDates.reduce((acc, date) => {
      const logsForDate = groupedLogs[date].sort((a, b) =>
        sortOrder === 'desc'
          ? new Date(b.timestamp) - new Date(a.timestamp)
          : new Date(a.timestamp) - new Date(b.timestamp)
      );
      acc[date] = logsForDate;
      return acc;
    }, {});
  }, [sortedDates, groupedLogs, sortOrder]);

  // 소트 변경 핸들러
  const handleSortChange = (e) => {
    setSortOrder(e.target.value);
  };

  return (
    <div className="log-viewer-overlay" onClick={onClose}>
      <div
        className="log-viewer"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="log-viewer-header"
        >
          <div className="log-viewer-title">
            <h2>과거 내역확인</h2>
            <select
              value={sortOrder}
              onChange={handleSortChange}
            >
              <option value="desc">최신순 (내림차순)</option>
              <option value="asc">오래된순 (오름차순)</option>
            </select>
          </div>
          <button onClick={onClose}>
            Close
          </button>
        </div>

        <div className="log-viewer-filters">
          <button
            className={filter === 'all' ? 'active' : ''}
            onClick={() => setFilter('all')}
          >
            전체
          </button>
          <button
            className={filter === 'create' ? 'active' : ''}
            onClick={() => setFilter('create')}
          >
            생성
          </button>
          <button
            className={filter === 'delete' ? 'active' : ''}
            onClick={() => setFilter('delete')}
          >
            삭제
          </button>
          <button
            className={filter === 'move' ? 'active' : ''}
            onClick={() => setFilter('move')}
          >
            이동
          </button>
          <button
            className={filter === 'update' ? 'active' : ''}
            onClick={() => setFilter('update')}
          >
            수정
          </button>
          <input
            type="text"
            placeholder="Search logs... (Press Enter to search)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        <div className="log-viewer-content">
          {logs.length === 0 ? (
            <div className="log-viewer-empty">
              <p>No logs found in the system.</p>
              <p>로그가 수집되지 않았습니다. 예약 생성, 삭제, 이동, 수정 작업을 수행해 보세요.</p>
            </div>
          ) : filteredLogsState.length === 0 ? (
            <div className="log-viewer-empty">
              <p>No logs found with the current filter/search.</p>
              <p>필터 또는 검색 조건을 변경해 보세요.</p>
            </div>
          ) : (
            sortedDates.map((date) => (
              <div key={date} className="log-viewer-date-group">
                <h3>Date Changed: {date}</h3>
                {sortedGroupedLogs[date].map((log, index) => (
                  <p
                    key={index}
                    className="log-viewer-entry"
                    title={cleanLogMessage(log.message)}
                  >
                    <span className="log-viewer-timestamp">
                      [{new Date(log.timestamp).toLocaleString()}]
                    </span>{' '}
                    {cleanLogMessage(log.message)}
                  </p>
                ))}
              </div>
            ))
          )}
        </div>
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
      actionType: PropTypes.string,
      reservationId: PropTypes.string,
    })
  ).isRequired,
  onClose: PropTypes.func.isRequired,
};

export default LogViewer;