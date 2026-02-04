import { createRoot } from 'react-dom/client';
import './css/index.css';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { SocketProvider } from './context/SocketContext.jsx';
import { ModalProvider } from './context/ModalContext.jsx';
import { AntdMessageProvider } from './context/AntdMeaageContext.jsx';
import { UserAvatarProvider } from './context/UserAvatarContext.jsx';

createRoot(document.getElementById('root')).render(
  <AuthProvider>
    <SocketProvider>
      <ModalProvider>
        <AntdMessageProvider>
          <UserAvatarProvider>
            <App />
          </UserAvatarProvider>
        </AntdMessageProvider>
      </ModalProvider>
    </SocketProvider>
  </AuthProvider>
);
