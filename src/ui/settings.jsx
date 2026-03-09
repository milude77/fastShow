
import React from 'react';
import ReactDOM from 'react-dom/client';
import SettingsAPP from './SettingsAPP';
import './css/index.css';
import { SocketProvider } from './context/SocketContext';
import i18n from '../i18n/index.js';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SocketProvider>
      <SettingsAPP />
    </SocketProvider>
  </React.StrictMode>
);

