import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaGithub } from 'react-icons/fa';

const LoginForm = ({
  username,
  password,
  setUsername,
  setPassword,
  onSubmit
}) => {
  const { t } = useTranslation();

  return (
    <form
      onSubmit={onSubmit}
      style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}
    >
      {/* 用户名 / 邮箱 */}
      <input
        type="text"
        placeholder={t('auth.userIdOrEmail')}
        value={username}
        maxLength={20}
        onChange={(e) => setUsername(e.target.value)}
        className="input-box"
      />

      {/* 密码 */}
      <input
        type="password"
        placeholder={t('auth.password')}
        value={password}
        maxLength={20}
        onChange={(e) => setPassword(e.target.value)}
        className="input-box"
      />

      {/* 登录按钮 */}
      <button className="login-btn" type="submit">
        {t('auth.login')}
      </button>

      {/* GitHub 登录 */}
      <button
        className="login-btn git-btn"
        type="button"
        onClick={() => window.electronAPI.githubOAuth()}
      >
        <span style={{ display: 'flex', alignItems: 'center', panding: '8px'  }}>
          <FaGithub size={20} />
          {t('auth.githubLoginRegister')}
        </span>
      </button>
    </form>
  );
};

export default LoginForm;