import React from 'react';
import '../css/toolBar.css';
import { useAuth } from '../hooks/useAuth';
import { Button } from 'antd';
import { TeamOutlined, MessageOutlined, UsergroupAddOutlined, SettingOutlined } from '@ant-design/icons'

const ToolBar = ({ setSelectFeatures }) => {
    const { currentUser } = useAuth();

    const handleAddContactClick = () => {
        if (currentUser && currentUser.userId) {
            window.electronAPI.openSearchWindow(currentUser.id);
        } else {
            console.error("Cannot open search window without a logged in user.");
            console.log(currentUser);
        }
    };

    return (
        <div className='tool-bar'>
            <div className='base-tool-bar'>
                <Button type="link" title='消息' icon = { <MessageOutlined /> } onClick={() => setSelectFeatures('message')}></Button>
                <Button type="link" title='联系人' icon = { <TeamOutlined /> } onClick={() => setSelectFeatures('contact')}></Button>
            </div>
            <div className='add-function-bar'>
                <Button type="link" title='添加' icon = { <UsergroupAddOutlined /> } onClick={handleAddContactClick}></Button>
            </div>
            <div className='setting-bth'>
                <Button type="link" title='设置' icon = { <SettingOutlined /> } onClick={() => window.electronAPI.openSettingsWindow()}></Button>
            </div>
        </div>
    );
};

export default ToolBar;
