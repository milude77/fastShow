import React, { useState, useEffect } from 'react';
import { useSocket } from './hooks/useSocket';

const AuthPage = () => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  const socket = useSocket(); 

  useEffect(() => {

    if (!socket) return;
    
    const handleConnect = () => {
      setMessage('');
    };

    const handleDisconnect = () => {
      setMessage('已断开与服务器的连接');
    };

    const handleReconnecting = () => {
      setMessage('正在重新连接到服务器...');
    };

    // 立即检查当前连接状态
    const checkInitialStatus = async () => {
      const isConnected = await window.electronAPI.getSocketStatus();
      if (!isConnected) {
        setMessage('错误: 无法连接服务器');
      } else {
        setMessage(''); // 如果已连接，清除任何旧的错误信息
      }
    };
    checkInitialStatus();

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('reconnecting', handleReconnecting);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('reconnecting', handleReconnecting)
    };
  }, [socket]);

  useEffect(() => {
    const attemptAutoLogin = async () => {
      if (socket && window.electronAPI) {
        const credentials = await window.electronAPI.getCurrentUserCredentials();
        if (credentials) {
          socket.emit('login-with-token', credentials.token);
        }
      }
      if (!socket){
        setMessage('错误: 无法连接服务器');
      }
    };
    attemptAutoLogin();
  }, [socket]);

  useEffect(() => {

    const handleErrorMessage = (message) => {
      setMessage(message.message);
      window.electronAPI.showErrowMessage(message.message);
    };

    socket.on('error', handleErrorMessage);


    return () => {
      socket.off('error', handleErrorMessage);
    }
  }, [socket]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (socket == null) {
      setMessage('错误: 无法连接服务器');
    }
    if (username.trim() === '' || password.trim() === '') {
      setMessage('用户名和密码不能为空。');
      return;
    }

    const credentials = { userId: username, password };

    if (isRegistering) {
      socket.emit('register-user', { username, password });
    } else {
      socket.emit('login-user', credentials);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#f0f2f5' }}>
      <div style={{ padding: '40px', borderRadius: '8px', boxShadow: '0 4px 8px rgba(0,0,0,0.1)', backgroundColor: 'white', width: '300px' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '20px', color: '#333' }}>
          {isRegistering ? '用户注册' : '用户登录'}
        </h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {isRegistering ? (
            <input
              type="text"
              placeholder="用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ddd' }}
            />
          ) : (
            <input
              type="text"
              placeholder="用户ID (例如: 000001)"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ddd' }}
            />
          )}
          <input
            type="password"
            placeholder="密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ddd' }}
          />
          <button
            type="submit"
            style={{ padding: '10px', borderRadius: '4px', border: 'none', backgroundColor: '#007bff', color: 'white', fontSize: '16px', cursor: 'pointer' }}
          >
            {isRegistering ? '注册' : '登录'}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: '20px', color: '#666' }}>
          {isRegistering ? '已有账号？' : '没有账号？'}
          <span
            onClick={() => {
              setIsRegistering(!isRegistering);
              setMessage('');
              setUsername('');
              setPassword('');
            }}
            style={{ color: '#007bff', cursor: 'pointer', marginLeft: '5px' }}
          >
            {isRegistering ? '去登录' : '去注册'}
          </span>
        </p>
        {message && <p style={{ textAlign: 'center', marginTop: '15px', color: 'red' }}>{message}</p>}
      </div>
    </div>
  );
};

export default AuthPage;
