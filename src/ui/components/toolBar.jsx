import React, { useState, useEffect } from 'react';
import '../css/toolBar.css';
import { Button } from 'antd';
import { TeamOutlined, MessageOutlined, SettingOutlined, SunOutlined, MoonOutlined } from '@ant-design/icons';
import axios from 'axios';
import AvatarUploader from './AvatarUploader';
import apiClient from '../utils/api';

const ToolBar = React.memo(({ currentUser, onAvatarUpdate, selectFeatures, setSelectFeatures, isDarkMode, toggleDarkMode }) => {
    const [avatarSrc, setAvatarSrc] = useState('');
    const [isUploaderOpen, setIsUploaderOpen] = useState(false);

    const updateAvatarSrc = async () => {
        if (currentUser && currentUser.userId) {
            try {
                const serverUrl = await window.electronAPI.getServerUrl();
                setAvatarSrc(`${serverUrl}/api/avatar/${currentUser.userId}/user?t=${new Date().getTime()}`);
            } catch (error) {
                console.error('Failed to get server URL:', error);
            }
        } else {
            setAvatarSrc(''); 
        }
    };

    useEffect(() => {
        updateAvatarSrc();
    }, [currentUser]);

    const handleAvatarUpload = async (blob) => {
        try {
            const serverUrl = await window.electronAPI.getServerUrl();
            console.log(localStorage.getItem('token'));
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

            await updateAvatarSrc();
            if(onAvatarUpdate) {
                onAvatarUpdate();
            }

        } catch (error) {
            console.error('Error uploading avatar:', error);
        } finally {
            setIsUploaderOpen(false);
        }
    };

    return (
        <div className='tool-bar'>
            <img className='user-avatar' onClick={() => setIsUploaderOpen(true)} src={avatarSrc} alt="User Avatar" />
            {isUploaderOpen && (
                <AvatarUploader
                    onAvatarUpload={handleAvatarUpload}
                    onClose={() => setIsUploaderOpen(false)}
                />
            )}
            <div className='base-tool-bar'>
                <Button className={`tool-bar-button ${selectFeatures === 'message' ? 'active' : 'inactive'}`} style={{ color: 'var(--text-color)' }} type="link" title='消息' icon={<MessageOutlined />} onClick={() => setSelectFeatures('message')}></Button>
                <Button className={`tool-bar-button ${selectFeatures === 'contact' ? 'active' : 'inactive'}`} style={{ color: 'var(--text-color)' }} type="link" title='联系人' icon={<TeamOutlined />} onClick={() => setSelectFeatures('contact')}></Button>
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
