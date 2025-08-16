import React, { useMemo } from 'react';
import { SocketContext } from '../hooks/useSocket';

export const SocketProvider = ({ children }) => {
  const socket = useMemo(() => {
    // 创建一个事件监听器的存储对象
    const eventListeners = new Map();

    return {
      // 模拟 socket.on
      on: (event, callback) => {
        // 使用 preload 暴露的方法来监听主进程转发的事件
        const removeListener = window.electronAPI.socketOn(event, callback);
        eventListeners.set(callback, removeListener);
      },
      // 模拟 socket.off
      off: (event, callback) => {
        if (eventListeners.has(callback)) {
          const removeListener = eventListeners.get(callback);
          removeListener(); // 调用 preload 返回的清理函数
          eventListeners.delete(callback);
        }
      },
      // 模拟 socket.emit
      emit: (event, ...args) => {
        // 使用 preload 暴露的方法将事件发送到主进程
        window.electronAPI.socketEmit(event, ...args);
      },
    };
  }, []);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};

