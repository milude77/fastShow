// src/ui/context/UserAvatarContext.jsx
import { useState, useEffect, useCallback } from 'react';
import { AvatarContext } from '../hooks/useAvatar.js';

export const UserAvatarProvider = ({ children }) => {
    const [userId, setUserId] = useState(null);
    const [avatarSrc, setAvatarSrc] = useState(null);
    const [loading, setLoading] = useState(true);
    const [hasCheckedLocal, setHasCheckedLocal] = useState(false);
    const [serverUrl, setServerUrl] = useState('');
    const refreshAvatar = async () => {
        try {
            const avatarPath = await window.electronAPI.getUserAvatarPath();
            const normalizedPath = avatarPath.replace(/\\/g, '/');
            setAvatarSrc(`avatar:///${encodeURI(normalizedPath)}`);
        } catch (error) {
            console.error('刷新头像失败:', error);
        }
    };

    useEffect(() => {
        let cancelled = false;

        const loadAvatar = async () => {
            try {
                // 首先获取服务器URL
                const url = await window.electronAPI.getServerUrl();
                setServerUrl(url);

                // 然后尝试获取本地头像
                const avatarPath = await window.electronAPI.getUserAvatarPath();

                if (avatarPath) {
                    const normalizedPath = avatarPath.replace(/\\/g, '/');
                    setAvatarSrc(`avatar:///${encodeURI(normalizedPath)}`);
                } else {
                    setAvatarSrc(`${url}/api/avatar/${userId}/user`);
                }
                setHasCheckedLocal(true);
            } catch (error) {
                console.error('获取本地头像失败:', error);
                setHasCheckedLocal(true);
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        if (userId) {  // 只有在userId存在时才加载
            loadAvatar();
        } else {
            loadAvatar();
            // 如果没有userId，也标记为已检查
            setHasCheckedLocal(true);
            setLoading(false);
        }

        return () => {
            cancelled = true;
        };
    }, [userId]);

    // 计算头像URL的函数
    const getAvatarUrl = useCallback((targetUserId) => {
        if (targetUserId === userId) {
            // 当前用户头像
            if (avatarSrc) {
                // 优先使用本地路径
                return avatarSrc;
            } else if (!loading && hasCheckedLocal && serverUrl) {
                // 如果不在加载中且已经检查过本地路径，使用网络路径
                return `${serverUrl}/api/avatar/${targetUserId}/user`;
            } else {
                // 如果还在加载或尚未检查本地路径，暂时使用网络路径
                return `${serverUrl}/api/avatar/${targetUserId}/user`;
            }
        } else {
            // 其他用户头像
            return `${serverUrl}/api/avatar/${targetUserId}/user`;
        }
    }, [avatarSrc, loading, hasCheckedLocal, serverUrl, userId]);

    return (
        <AvatarContext.Provider value={{ avatarSrc, getAvatarUrl, refreshAvatar, setUserId }}>
            {children}
        </AvatarContext.Provider>
    );
};