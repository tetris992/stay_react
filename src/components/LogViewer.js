import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { format } from 'date-fns';
import './LogViewer.css';

const LogViewer = ({ logs, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('desc');

  // 로그 메시지 정제 함수
  const cleanLogMessage = (message) => {
    let cleanedMessage = message.replace(/\[(handle\w+)\]\s*/, '');
    cleanedMessage = cleanedMessage.replace(/\s*\[object Object\]$/, '');
    cleanedMessage = cleanedMessage.replace(
      /(현장예약)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,
      '$1'
    );
    cleanedMessage = cleanedMessage.replace(
      /WEB-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,
      '단잠'
    );
    return cleanedMessage;
  };

  // 필터링된 로그: logs, filter, searchTerm에 따라 자동 계산
  const filteredLogs = useMemo(() => {
    const trimmedSearchTerm = searchTerm.trim().toLowerCase();
    return logs.filter((log) => {
      const matchesFilter =
        filter === 'all' ||
        (filter === 'create' && log.actionType === 'create') ||
        (filter === 'delete' && log.actionType === 'delete') ||
        (filter === 'move' && log.actionType === 'move') ||
        (filter === 'update' && log.actionType === 'update');
      const matchesSearch = log.message
        .toLowerCase()
        .includes(trimmedSearchTerm);
      return matchesFilter && matchesSearch;
    });
  }, [logs, filter, searchTerm]);

  // 날짜별로 로그 그룹화
  const groupedLogs = useMemo(() => {
    return filteredLogs.reduce((acc, log) => {
      const date = log.selectedDate || 'Unknown';
      if (!acc[date]) acc[date] = [];
      acc[date].push(log);
      return acc;
    }, {});
  }, [filteredLogs]);

  const today = format(new Date(), 'yyyy-MM-dd');

  // 정렬된 날짜 목록
  const sortedDates = useMemo(() => {
    const dates = Object.keys(groupedLogs);
    let sorted = [...dates];
    const todayIndex = sorted.indexOf(today);

    if (todayIndex !== -1) {
      sorted.splice(todayIndex, 1);
      sorted.sort((a, b) =>
        sortOrder === 'desc'
          ? new Date(b) - new Date(a)
          : new Date(a) - new Date(b)
      );
      sorted.unshift(today);
    } else {
      sorted.sort((a, b) =>
        sortOrder === 'desc'
          ? new Date(b) - new Date(a)
          : new Date(a) - new Date(b)
      );
    }
    return sorted;
  }, [groupedLogs, sortOrder, today]);

  // 그룹 내 각 날짜별 로그 정렬
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

  return (
    <div className="log-viewer-overlay">
      <div className="log-viewer" onClick={(e) => e.stopPropagation()}>
        <div className="log-viewer-header">
          <div className="log-viewer-title">
            <h2>과거 내역확인</h2>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            >
              <option value="desc">최신순 (내림차순)</option>
              <option value="asc">오래된순 (오름차순)</option>
            </select>
          </div>
          <button onClick={onClose}>Close</button>
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
            placeholder="Search logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="log-viewer-content">
          {logs.length === 0 ? (
            <div className="log-viewer-empty">
              <p>No logs found in the system.</p>
              <p>
                로그가 수집되지 않았습니다. 예약 생성, 삭제, 이동, 수정 작업을
                수행해 보세요.
              </p>
            </div>
          ) : filteredLogs.length === 0 ? (
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
                    key={`${date}-${index}`}
                    className="log-viewer-entry"
                    title={cleanLogMessage(log.message)}
                  >
                    <span className="log-viewer-timestamp">
                      [
                      {new Date(log.timestamp).toLocaleString('ko-KR', {
                        timeZone: 'Asia/Seoul',
                      })}
                      ]
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
