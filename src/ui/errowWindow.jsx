import React from 'react';
import ReactDOM from 'react-dom/client';
import ErrorMessage from './components/errorMessage.jsx';
import './css/index.css';
import { SocketProvider } from './context/SocketContext';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SocketProvider>
      <ErrorMessage />
    </SocketProvider>
  </React.StrictMode>
);
