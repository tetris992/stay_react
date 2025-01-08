// src/components/SystemStatus.js
import React, { useEffect, useState } from 'react';
import './SystemStatus.css';

const SystemStatus = () => {
  const [tabs, setTabs] = useState([]);
  const [otaStatuses, setOtaStatuses] = useState({});

  // 시스템 상태 API 호출
  const fetchSystemStatus = async () => {
    try {
      const response = await fetch('http://localhost:3003/status/system-status');
      const { tabs, otaStatuses } = await response.json();
      setTabs(tabs);
      setOtaStatuses(otaStatuses);
    } catch (error) {
      console.error('Failed to fetch system status:', error.message);
      setTabs([]);
      setOtaStatuses({});
    }
  };

  useEffect(() => {
    fetchSystemStatus();
    const interval = setInterval(fetchSystemStatus, 30000); // 30초마다 갱신
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="system-status">
      <h4>시스템 상태</h4>
      <div className="debugger-status">
        <h5>디버깅 크롬 상태</h5>
        {tabs.length > 0 ? (
          <ul>
            {tabs.map((tab, index) => (
              <li key={index}>{tab}</li>
            ))}
          </ul>
        ) : (
          <p>디버깅 크롬이 비활성화되었습니다.</p>
        )}
      </div>
      <div className="ota-status">
        <h5>OTA 로그인 상태</h5>
        {Object.keys(otaStatuses).map((ota) => (
          <div key={ota} className="ota-status-item">
            <span>{ota}</span>
            <span
              className={`status-lamp ${
                otaStatuses[ota] === 'active'
                  ? 'green'
                  : otaStatuses[ota] === 'inactive'
                  ? 'gray'
                  : 'red'
              }`}
            ></span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SystemStatus;
