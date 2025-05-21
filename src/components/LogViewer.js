// src/components/LogViewer.js
import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import './LogViewer.css';
import { formatDate } from '../utils/dateParser'; // "yyyy-MM-dd HH:mm:ss" KST 포맷

const LogViewer = ({ logs, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('desc');

  // 메시지 클린업
  const cleanLogMessage = (message) => {
    let m = message.replace(/\[(handle\w+)\]\s*/, '');
    m = m.replace(/\s*\[object Object\]$/, '');
    m = m.replace(
      /(현장예약)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,
      '$1'
    );
    m = m.replace(
      /WEB-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,
      '단잠'
    );
    return m;
  };

  // 필터/검색 적용
  const filteredLogs = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return logs.filter((log) => {
      const byFilter =
        filter === 'all' ||
        (filter === 'create' && log.actionType === 'create') ||
        (filter === 'delete' && log.actionType === 'delete') ||
        (filter === 'move' && log.actionType === 'move') ||
        (filter === 'update' && log.actionType === 'update');
      const bySearch = log.message.toLowerCase().includes(term);
      return byFilter && bySearch;
    });
  }, [logs, filter, searchTerm]);

  // timestamp 기준으로 한국시간 날짜 뽑아서 그룹핑
  const groupedLogs = useMemo(() => {
    return filteredLogs.reduce((acc, log) => {
      const dateKey = new Date(log.timestamp).toLocaleDateString('en-CA', {
        timeZone: 'Asia/Seoul',
      }); // "yyyy-MM-dd"
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(log);
      return acc;
    }, {});
  }, [filteredLogs]);

  // 오늘(한국시간)
  const today = new Date().toLocaleDateString('en-CA', {
    timeZone: 'Asia/Seoul',
  });

  // 날짜 정렬
  const sortedDates = useMemo(() => {
    const dates = Object.keys(groupedLogs);
    const others = dates.filter((d) => d !== today);
    others.sort((a, b) =>
      sortOrder === 'desc'
        ? new Date(b) - new Date(a)
        : new Date(a) - new Date(b)
    );
    return dates.includes(today) ? [today, ...others] : others;
  }, [groupedLogs, sortOrder, today]);

  // 그룹 안에서 timestamp 순 정렬
  const sortedGroupedLogs = useMemo(() => {
    return sortedDates.reduce((acc, date) => {
      const arr = groupedLogs[date].sort((a, b) =>
        sortOrder === 'desc'
          ? new Date(b.timestamp) - new Date(a.timestamp)
          : new Date(a.timestamp) - new Date(b.timestamp)
      );
      acc[date] = arr;
      return acc;
    }, {});
  }, [sortedDates, groupedLogs, sortOrder]);

  return (
    <div className="log-viewer-overlay">
      <div className="log-viewer" onClick={(e) => e.stopPropagation()}>
        <div className="log-viewer-header">
          <h2>과거 내역확인</h2>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          >
            <option value="desc">최신순 (내림차순)</option>
            <option value="asc">오래된순 (오름차순)</option>
          </select>
          <button onClick={onClose}>Close</button>
        </div>

        <div className="log-viewer-filters">
          {['all','create','delete','move','update'].map((f) => (
            <button
              key={f}
              className={filter === f ? 'active' : ''}
              onClick={() => setFilter(f)}
            >
              {{
                all: '전체',
                create: '생성',
                delete: '삭제',
                move: '이동',
                update: '수정'
              }[f]}
            </button>
          ))}
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
              <p>로그가 없습니다.</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="log-viewer-empty">
              <p>No logs matching filter/search.</p>
              <p>조건을 바꿔보세요.</p>
            </div>
          ) : (
            sortedDates.map((date) => (
              <div key={date} className="log-viewer-date-group">
                <h3>Date Changed: {date}</h3>
                {sortedGroupedLogs[date].map((log, idx) => (
                  <p
                    key={idx}
                    className="log-viewer-entry"
                    title={cleanLogMessage(log.message)}
                  >
                    <span className="log-viewer-timestamp">
                      [{formatDate(log.timestamp)}]
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
      actionType: PropTypes.string,
      reservationId: PropTypes.string,
    })
  ).isRequired,
  onClose: PropTypes.func.isRequired,
};

export default LogViewer;
