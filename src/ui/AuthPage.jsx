import React, { useState, useEffect } from 'react';
import { useSocket } from './hooks/useSocket';
import { Button, Select, Modal } from 'antd';
import './css/authPage.css'
import Avatar from './components/avatar.jsx';
import { useUserAvatar } from './hooks/useAvatar.js';
import { FaGithub } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';

// 用户登录中
const LoginLoading = ({ credentials }) => {
  const { getAvatarUrl } = useUserAvatar();
  const { t } = useTranslation();

  return (
    <div className="login-loading-container">
      <div className="login-card slide-in-from-right">
        <div className="avatar-container">
          <div className="particle-orbit">
            <div className="blue-particle"></div>
          </div>
          <Avatar size={100} src={getAvatarUrl(credentials.userId)} alt="头像" />
        </div>
        <div className="title">{t('auth.welcome', { userName: credentials.userName })}</div>
      </div>
    </div>
  )
}

//快速登录
const LastLoginUser = ({ credentials, onLogin, message, handleNewUserLogin }) => {

  const { getAvatarUrl } = useUserAvatar();
  const { t } = useTranslation();
  const [curCredentials, setCurCredentials] = useState(credentials)
  const [allUserCredentials, setAllUserCredentials] = useState([])

  useEffect(() => {
    window.electronAPI.getUserListCredentials().then(userListCredentials => {
      setAllUserCredentials(Object.values(userListCredentials))
    })
  }, [])


  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: 'white', padding: '40px', borderRadius: '8px', boxShadow: '0 4px 8px rgba(0,0,0,0.1)', width: '300px' }}>
      <span style={{ transform: 'translateY(-50%)', textAlign: 'center', fontSize: '24px', fontWeight: 'bold', color: '#333', marginBottom: '10px' }}>{t('auth.quickLogin')}</span>
      <Avatar
        size={100}
        src={getAvatarUrl(curCredentials.userId)}
        alt="头像"
      />
      <Select
        style={{ marginTop: '20px', width: '10rem' }}
        value={curCredentials.userId}
        onChange={(userId) => {
          const credentials = allUserCredentials.find(
            item => item.userId === userId
          );
          setCurCredentials(credentials);
        }}>
        {allUserCredentials.map((credentials) => (
          <Select.Option key={credentials.userId} value={credentials.userId} >
            <div className='select-history-user'>
              <Avatar size={24} src={getAvatarUrl(credentials.userId)} />
              <span>{credentials.userName}</span>
            </div>
          </Select.Option>
        ))}
      </Select>
      <Button
        type="primary"
        style={{ marginTop: '20px' }}
        onClick={() => { onLogin(curCredentials); }}
      >
        {t('auth.login')}
      </Button>
      <span style={{ marginTop: '10px', color: '#666' }} onClick={() => handleNewUserLogin()}>{t('auth.newAccountLogin')}</span>
      {message && <span style={{ color: 'red', marginTop: '10px' }}>{message}</span>}
    </div >
  )
}

// 登录/注册页面
const AuthPage = () => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [logincredentials, setLogincredentials] = useState(null)
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [showAttemptAutoLogin, setShowAttemptAutoLogin] = useState(false);
  const [lastLoginUser, setLastLoginUser] = useState(null);
  const [modal, modalContextHolder] = Modal.useModal();
  const { t } = useTranslation();

  const socket = useSocket();

  useEffect(() => {

    if (!socket) return;

    const handleConnect = () => {
      setMessage('');
    };

    const handleDisconnect = () => {
      setMessage(t('auth.disconnected'));
    };

    const handleReconnecting = () => {
      setMessage(t('auth.reconnecting'));
    };

    // 立即检查当前连接状态
    const checkInitialStatus = async () => {
      const isConnected = await window.electronAPI.getSocketStatus();
      if (!isConnected) {
        setMessage(t('auth.serverConnectionError'));
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
          setShowAttemptAutoLogin(true);
        }
        if (!socket) {
          setMessage(t('auth.serverConnectionError'));
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
      setEmail('');
      setConfirmPassword('');
      modal.success({
        title: t('auth.registerSuccess'),
        content: `${t('auth.yourAccountIdIs')}: ${data.userId}`,
        okText: t('common.ok')
      });
    };


    socket.on('user-registered', handleRegisterSuccess);


    return () => {
      socket.off('user-registered', handleRegisterSuccess);
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (socket == null) {
      setMessage(t('auth.serverConnectionError'));
    }

    if (isRegistering && email.trim() === '') {
      setMessage(t('auth.invalidEmail'));
    }

    if (username.trim() === '' || password.trim() === '') {
      setMessage(t('auth.usernamePasswordRequired'));
      return;
    }

    if (isRegistering && password !== confirmPassword) {
      setMessage(t('auth.passwordMismatch'));
      return;
    }

    const credentials = { userId: username, password };

    if (isRegistering) {
      socket.emit('register-user', { username, password, email });
    } else {
      setIsLoggingIn(true);
      socket.emit('login-user', credentials);
    }
  };

  const handleNewUserLogin = () => {
    setLastLoginUser(null);
    setShowAttemptAutoLogin(false);
  };




  useEffect(() => {
    const handleStrongLogoutWaring = (event, message) => {
      modal.info({
        title: t('auth.forceLogoutNotice'),
        content: `${message}`,
        okText: t('common.ok')
      });
    }

    const handleOauthSuccess = (event, { token }) => {
      socket.emit('login-with-token', token);
    }

    socket.on('login-success', handleLoginSuccess);
    window.electronAPI.ipcRenderer.on('strong-logout-waring', handleStrongLogoutWaring)
    window.electronAPI.ipcRenderer.on('oauth-success', handleOauthSuccess)

    return () => {
      socket.off('login-success', handleLoginSuccess);
      window.electronAPI.ipcRenderer.removeListener('strong-logout-waring', handleStrongLogoutWaring)
      window.electronAPI.ipcRenderer.removeListener('oauth-success', handleOauthSuccess)
    }
  }, [modal, socket]);

  const handleLoginSuccess = (data) => {
    const { userId, username, token, email } = data;
    const credentials = { userId, userName: username, token, email };
    setLogincredentials(credentials);
    setIsLoggingIn(true);
  }

  const userLoginOption = (credentials) => {
    setLogincredentials(credentials)
    setIsLoggingIn(true)
    socket.emit('login-with-token', credentials.token)
  };

  if (isLoggingIn && logincredentials) {
    return <LoginLoading credentials={logincredentials} />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      {modalContextHolder}
      {(socket && lastLoginUser && showAttemptAutoLogin)
        ?
        <LastLoginUser
          credentials={lastLoginUser}
          onLogin={userLoginOption}
          message={message}
          handleNewUserLogin={handleNewUserLogin}
        />
        :
        <div style={{ padding: '40px', borderRadius: '8px', boxShadow: '0 4px 8px rgba(0,0,0,0.1)', backgroundColor: 'white', width: '300px' }}>
          <h2 style={{ textAlign: 'center', marginBottom: '20px', color: '#333' }}>
            {isRegistering ? t('auth.userRegister') : t('auth.userLogin')}
          </h2>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {isRegistering ? (
              <>
                <input
                  type="text"
                  placeholder={t('auth.email')}
                  value={email}
                  maxLength={30}
                  onChange={(e) => setEmail(e.target.value)}
                  className='input-box'
                />
                <input
                  type="text"
                  maxLength={20}
                  placeholder={t('auth.username')}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ddd' }}
                  className='input-box'
                />
              </>
            ) : (
              <input
                type="text"
                placeholder={t('auth.userIdOrEmail')}
                value={username}
                maxLength={20}
                onChange={(e) => setUsername(e.target.value)}
                className='input-box'
              />
            )}
            <input
              type="password"
              placeholder={t('auth.password')}
              maxLength={20}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className='input-box'
            />
            {isRegistering && (<input type="password"
              placeholder={t('auth.confirmPassword')}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className='input-box'
            />)}
            <button
              className='login-btn'
              type="submit"
            >
              {isRegistering ? t('auth.register') : t('auth.login')}
            </button>
            <button className='login-btn git-btn' type="button" onClick={() => { window.electronAPI.githubOAuth() }}>
              <span>
                <FaGithub size={20} />
                {t('auth.githubLoginRegister')}
              </span>
            </button>
          </form>
          <p style={{ textAlign: 'center', marginTop: '20px', color: '#666' }}>
            {isRegistering ? t('auth.haveAccount') : t('auth.noAccount')}
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
              {isRegistering ? t('auth.goToLogin') : t('auth.goToRegister')}
            </span>
          </p>
          {message && <p style={{ textAlign: 'center', marginTop: '15px', color: 'red' }}>{message}</p>}
        </div>}
    </div>
  );
};

export default AuthPage;
