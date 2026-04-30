import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaGithub } from 'react-icons/fa';
import { apiClient } from '../../utils/api';
import { useGlobalMessage } from '../../hooks/useGlobalMessage';

const RegisterForm = ({
    socket,
    email,
    username,
    password,
    confirmPassword,
    setEmail,
    setUsername,
    setPassword,
    setConfirmPassword,
    onSubmit
}) => {
    const { t } = useTranslation();
    const { messageApi } = useGlobalMessage();
    const [codeSended, setCodeSent] = useState(false);
    const [code, setCode] = useState('');

    const handleGetCodeSubmit = (e) => {
        e.preventDefault();
        apiClient.post('api/get-verification-code', {
            email: email,
        }).then(result => {
            if (result.status === 200) {
                messageApi.success('验证码已发送，请注意邮箱');
            }
        }).catch(error => {
            messageApi.error(error.response?.data?.message);
        });
    };

    const handleVerifyVerificationCodeSubmit = (e) => {
        e.preventDefault();
        apiClient.post('api/verify-verification-code', {
            email: email,
            code: code,
        }).then(result => {
            if (result.status === 200) {
                messageApi.success('验证码验证成功');
                setCodeSent(true);
            }
        }).catch(error => {
            messageApi.error(error.response?.data?.message);
        });
    };

    const registerUser = () => {
        socket.emit('register-user', { username, password, email });
    }

    if (codeSended) {
        return (
            <form
                onSubmit={registerUser}
                style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}
            >
                {/* 邮箱 */}
                <input
                    type="text"
                    className='input-box'
                    placeholder={t('auth.email')}
                    value={email}
                    maxLength={30}
                    readOnly
                />
                {/* 用户名 */}
                <input
                    type="text"
                    placeholder={t('auth.username')}
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

                {/* 确认密码 */}
                <input
                    type="password"
                    placeholder={t('auth.confirmPassword')}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="input-box"
                />

                <button className="login-btn" type="submit">
                    {t('auth.register')}
                </button>
            </form>

        )
    }

    return (
        <form
            onSubmit={handleVerifyVerificationCodeSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}
        >
            {/* 邮箱 */}
            <input
                type="text"
                placeholder={t('auth.email')}
                value={email}
                maxLength={30}
                onChange={(e) => setEmail(e.target.value)}
                className="input-box"
            />

            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                    type="text"
                    placeholder={'验证码'}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="input-box"
                    style={{ paddingRight: '45px' }}
                />
                <button
                    type="button"
                    onClick={handleGetCodeSubmit}
                    style={{
                        position: 'absolute',
                        right: '8px',
                        height: '32px', // 根据 input 高度调整
                        padding: '0 12px',
                        background: '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px'
                    }}
                >
                    发送验证码
                </button>
            </div>
            {/* 注册按钮 */}
            <button className="login-btn" type="submit">
                {t('auth.register')}
            </button>

            {/* GitHub */}
            <button
                className="login-btn git-btn"
                type="button"
                onClick={() => window.electronAPI.githubOAuth()}
            >
                <span style={{ display: 'flex', alignItems: 'center', panding: '8px' }}>
                    <FaGithub size={20} />
                    {t('auth.githubLoginRegister')}
                </span>
            </button>
        </form>
    );
};

export default RegisterForm;