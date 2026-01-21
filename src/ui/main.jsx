import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './css/index.css';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { SocketProvider } from './context/SocketContext.jsx';
import { ModalProvider } from './context/ModalContext.jsx';

createRoot(document.getElementById('root')).render(
  <AuthProvider>
    <SocketProvider>
      <ModalProvider>
        <App />
      </ModalProvider>
    </SocketProvider>
  </AuthProvider>
);
