import React, { useState, useEffect } from 'react';
import { useSocket } from './hooks/useSocket';
import { Button, Select, Modal, Dropdown } from 'antd';
import './css/authPage.css'
import Avatar from './components/avatar.jsx';
import { useUserAvatar } from './hooks/useAvatar.js';
import { FaGithub } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { GlobalOutlined } from '@ant-design/icons'

import LoginForm from './components/authPage/LoginForm';
import RegisterForm from './components/authPage/RegisterForm';

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
  const { t, i18n } = useTranslation();
  const [languageDropdownVisible, setLanguageDropdownVisible] = useState(false);

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

    const handleloginFailed = () => {
      setIsLoggingIn(false);
    }

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('reconnecting', handleReconnecting);
    socket.on('login-failed', handleloginFailed)


    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('reconnecting', handleReconnecting)
      socket.off('login-failed', handleloginFailed)
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
  }, [socket]);

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

    if (!isRegistering) {
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
  }, [socket]);

  const handleLoginSuccess = (data) => {
    const { userId, username, token, email } = data;
    const credentials = { userId, userName: username, token, email };
    setLogincredentials(credentials);
    setIsLoggingIn(true);
  }

  const userLoginOption = (credentials) => {
    setLogincredentials(credentials)
    socket.emit('login-with-token', credentials.token)
  };

  // 语言选项配置
  const languageOptions = [
    { value: 'en', label: 'English' },
    { value: 'zh', label: '简体中文' },
    { value: 'ru', label: 'Русский' }
  ];


  const handleLanguageChange = async (value) => {
    i18n.changeLanguage(value);
    window.electronAPI.updateLanguage(value);
    setLanguageDropdownVisible(false);
  }


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
          {isRegistering ? (
            <RegisterForm
              socket={socket}
              email={email}
              username={username}
              password={password}
              confirmPassword={confirmPassword}
              setEmail={setEmail}
              setUsername={setUsername}
              setPassword={setPassword}
              setConfirmPassword={setConfirmPassword}
              onSubmit={handleSubmit}
            />
          ) : (
            <LoginForm
              username={username}
              password={password}
              setUsername={setUsername}
              setPassword={setPassword}
              onSubmit={handleSubmit}
            />
          )}
          <p style={{ textAlign: 'center', marginTop: '20px', color: '#666' }}>
            <Dropdown
              menu={{
                items: languageOptions.map(option => ({
                  key: option.value,
                  label: option.label,
                  onClick: () => handleLanguageChange(option.value)
                }))
              }}
              trigger={['click']}
              open={languageDropdownVisible}
              onOpenChange={setLanguageDropdownVisible}
            >
              <GlobalOutlined style={{ color: '#00DFFF', position: 'absolute', left: '10px', bottom: '10px' }} />
            </Dropdown>
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
