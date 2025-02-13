/* eslint-disable react/jsx-no-undef */
// src/index.js
import React from 'react';
import { createRoot } from 'react-dom/client';
import Root from './Root';
import './index.css';
import './i18n';
import Modal from 'react-modal';

Modal.setAppElement('#root');

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
