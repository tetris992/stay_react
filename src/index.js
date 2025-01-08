// src/index.js
import React from 'react';
import { createRoot } from 'react-dom/client';
import Root from './Root';
import './index.css';
import './i18n';
import Modal from 'react-modal'; // Modal 임포트 추가

Modal.setAppElement('#root'); // 앱 시작 시 딱 1번 호출

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
