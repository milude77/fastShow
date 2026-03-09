import React from 'react';
import ReactDOM from 'react-dom/client';
import VoiceApp from './VoiceApp';
import { SocketProvider } from './context/SocketContext';
import { UserAvatarProvider } from './context/UserAvatarContext';
import i18n from '../i18n/index.js';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <UserAvatarProvider>
      <SocketProvider>
        <VoiceApp />
      </SocketProvider>
    </UserAvatarProvider>
  </React.StrictMode>
);