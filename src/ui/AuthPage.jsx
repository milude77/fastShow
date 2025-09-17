import React, { useState, useEffect } from 'react';
import { useSocket } from './hooks/useSocket';
import { Button } from 'antd';

const LastLoginUser = ({ credentials, onLogin, message }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: '40px', borderRadius: '8px', boxShadow: '0 4px 8px rgba(0,0,0,0.1)', backgroundColor: 'white', width: '300px' }}>
      <span style={{ transform: 'translateY(-50%)', textAlign: 'center', fontSize: '24px', fontWeight: 'bold', color: '#333', marginBottom: '20px' }}>快速登录</span>
      <span>ID ：{credentials.userId}</span>
      <span>{credentials.userName}</span>
      <Button
        type="primary"
        style={{ marginTop: '20px' }}
        onClick={() => { onLogin(credentials.token); }}
      >
        登录
      </Button>
      {message && <span style={{ color: 'red', marginTop: '10px' }}>{message}</span>}
    </div>
  )
}

const AuthPage = () => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [showAttemptAutoLogin, setShowAttemptAutoLogin] = useState(true);
  const [lastLoginUser, setLastLoginUser] = useState(null);

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
          setLastLoginUser(credentials);
        }
        if (!socket) {
          setMessage('错误: 无法连接服务器');
        }
      };
    }
    attemptAutoLogin();
  }, [socket]);

  useEffect(() => {

    const handleRegisterSuccess = (data) => {
      setIsRegistering(false);
      setMessage('');
      setUsername('');
      setPassword('');
      setConfirmPassword('');
      window.electronAPI.showErrowMessage("注册成功，您的账号ID为: " + data.userId);
    };


    const handleErrorMessage = (message) => {
      setShowAttemptAutoLogin(false);
      setMessage(message.message);
      window.electronAPI.showErrowMessage(message.message);
    };

    socket.on('error', handleErrorMessage);
    socket.on('user-registered', handleRegisterSuccess);


    return () => {
      socket.off('error', handleErrorMessage);
      socket.off('user-registered', handleRegisterSuccess);
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

    if (isRegistering && password !== confirmPassword) {
      setMessage('两次输入的密码不一致。');
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
      {(socket && lastLoginUser && showAttemptAutoLogin)
        ?
        <LastLoginUser credentials={lastLoginUser} onLogin={(token) => { socket.emit('login-with-token', token); }} message={message} />
        :
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
            {isRegistering && (<input type="password"
              placeholder="确认密码"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ddd' }}
            />)}
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
                setConfirmPassword('');
              }}
              style={{ color: '#007bff', cursor: 'pointer', marginLeft: '5px' }}
            >
              {isRegistering ? '去登录' : '去注册'}
            </span>
          </p>
          {message && <p style={{ textAlign: 'center', marginTop: '15px', color: 'red' }}>{message}</p>}
        </div>}
    </div>
  );
};

export default AuthPage;
