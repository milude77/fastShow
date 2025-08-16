import { createContext, useContext } from 'react';

// 将 Context 的创建和 Hook 放在一起
export const SocketContext = createContext(null);

export const useSocket = () => {
  const socket = useContext(SocketContext);
  if (!socket) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return socket;
};
