import React from 'react';
import ReactDOM from 'react-dom/client';
import SearchApp from './SearchApp';
import './css/index.css';
import { SocketProvider } from './context/SocketContext';
import { UserAvatarProvider } from './context/UserAvatarContext';
import i18n from '../i18n/index.js';

ReactDOM.createRoot(document.getElementById('root')).render(
    <SocketProvider>
      <UserAvatarProvider>
        <SearchApp />
      </UserAvatarProvider>
    </SocketProvider>
);
