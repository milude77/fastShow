import React from 'react';
import ReactDOM from 'react-dom/client';
import VoiceApp from './VoiceApp';
import { SocketProvider } from './context/SocketContext';
import { UserAvatarProvider } from './context/UserAvatarContext';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <UserAvatarProvider>
      <SocketProvider>
        <VoiceApp />
      </SocketProvider>
    </UserAvatarProvider>
  </React.StrictMode>
);