import React, { useState, useEffect } from 'react';
import './css/toolBar.css';
import { Button, Badge, Space } from 'antd';
import Avatar from '../avatar.jsx';
import { useUserAvatar } from '../../hooks/useAvatar.js';
import { TeamOutlined, MessageOutlined, SettingOutlined, SunOutlined, MoonOutlined } from '@ant-design/icons';
import axios from 'axios';
import AvatarUploader from './AvatarUploader.jsx';
import apiClient from '../../utils/api.js';


const ToolBar = React.memo(({ currentUser, selectFeatures, setSelectFeatures, isDarkMode, toggleDarkMode }) => {
    const { avatarSrc, refreshAvatar } = useUserAvatar(currentUser?.userId);
    const [isUploaderOpen, setIsUploaderOpen] = useState(false);
    const [hasNewInvite, setHasNewInvite] = useState(false);
    const [newMessageCount, setNewMessageCount] = useState(0);

    const handleNewInvite = () => {
        setHasNewInvite(true);
    };

    const handleNewMessage = () => {
        setNewMessageCount((newMessageCount) => newMessageCount + 1);
    };

    const handleClearUnreadMessageCount = async () => {
        const allCount = await window.electronAPI.getAllUnreadMessageCount();
        setNewMessageCount(allCount);
    };

    useEffect(() => {

        window.electronAPI.ipcRenderer.on('receive-new-invite', handleNewInvite);
        window.electronAPI.ipcRenderer.on('revived-new-chat-message', handleNewMessage);
        window.electronAPI.ipcRenderer.on('unread-message-count-cleared', handleClearUnreadMessageCount);
        return () => {
            window.electronAPI.ipcRenderer.removeListener('receive-new-invite', handleNewInvite);
            window.electronAPI.ipcRenderer.removeListener('revived-new-chat-message', handleNewMessage);
            window.electronAPI.ipcRenderer.removeListener('unread-message-count-cleared', handleClearUnreadMessageCount);
        };
    }, []);

    const handleAvatarUpload = async (blob) => {
        try {
            const arrayBuffer = await blob.arrayBuffer();

            // 先保存到本地
            await window.electronAPI.saveAvatarLocally(arrayBuffer);
            await refreshAvatar()

            const serverUrl = await window.electronAPI.getServerUrl();
            const initiateResponse = await apiClient.post(`${serverUrl}/api/avatar/initiate`);
            const { presignedUrl, objectName } = initiateResponse.data;

            await axios.put(presignedUrl, blob, {
                headers: {
                    'Content-Type': 'image/jpg',
                },
            });

            await apiClient.post(`${serverUrl}/api/avatar/complete`, {
                objectName,
            });

        } catch (error) {
            console.error('Error uploading avatar:', error);
        } finally {
            setIsUploaderOpen(false);
        }
    };

    return (
        <div className='tool-bar'>
            <Avatar
                size={35}
                className='user-avatar'
                onClick={() => setIsUploaderOpen(true)}
                src={avatarSrc}
                alt="User Avatar" />
            {isUploaderOpen && (
                <AvatarUploader
                    currentUser={currentUser}
                    onAvatarUpload={handleAvatarUpload}
                    onClose={() => setIsUploaderOpen(false)}
                />
            )}
            <div className='base-tool-bar'>
                <Badge size="small" count={newMessageCount}>
                    <Button className={`tool-bar-button ${selectFeatures === 'message' ? 'active' : 'inactive'}`} type="link" title='消息' icon={<MessageOutlined />} onClick={() => setSelectFeatures('message')}></Button>
                </Badge>
                <Badge size="small" dot={hasNewInvite} >
                    <Button className={`tool-bar-button ${selectFeatures === 'contact' ? 'active' : 'inactive'}`} type="link" title='联系人' icon={<TeamOutlined />} onClick={() => { setHasNewInvite(false); setSelectFeatures('contact') }}></Button>
                </Badge>
            </div>
            <div className='change-theme-bar'>
                <Button style={{ color: 'var(--text-color)' }} type='link' icon={isDarkMode ? <SunOutlined /> : <MoonOutlined />} onClick={() => toggleDarkMode()}></Button>
            </div>
            <div className='setting-bth'>
                <Button style={{ color: 'var(--text-color)' }} type="link" title='设置' icon={<SettingOutlined />} onClick={() => window.electronAPI.openSettingsWindow()}></Button>
            </div>
        </div>
    );
});

export default ToolBar;
