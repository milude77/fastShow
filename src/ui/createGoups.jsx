import React from 'react';
import ReactDOM from 'react-dom/client';
import CreateGoupsApp from './CreateGoupsApp';
import './css/index.css';
import { SocketProvider } from './context/SocketContext';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SocketProvider>
      <CreateGoupsApp />
    </SocketProvider>
  </React.StrictMode>
);
