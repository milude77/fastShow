import React from 'react';
import ReactDOM from 'react-dom/client';
import SearchApp from './SearchApp';
import './css/index.css';
import { SocketProvider } from './context/SocketContext';
import { UserAvatarProvider } from './context/UserAvatarContext';

ReactDOM.createRoot(document.getElementById('root')).render(
    <SocketProvider>
      <UserAvatarProvider>
        <SearchApp />
      </UserAvatarProvider>
    </SocketProvider>
);
