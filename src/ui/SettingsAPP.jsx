import React from'react';
import { useState } from 'react';
import './css/SettingsAPP.css'
import UserManagement  from './components/userManagement.jsx';
import AppHeaderBar from './components/appHeaderBar.jsx';
import { Popconfirm, Button } from "antd"


function SettingsAPP() {

    const [tooBarState, setToolBarState] = useState('userManagement');

    const handleLogout = () => {
        window.electronAPI.logout();
    }



    return (
        <div className="settings-app" style={{ position: 'relative', height: '100vh' }}>
            <AppHeaderBar />
            <div className='settings-area'>
                <div className='tool-bar'>
                    <div className={tooBarState === 'userManagement' ? 'tool-bar-item active' : 'tool-bar-item'} onClick={() => setToolBarState('userManagement')}>
                        用户管理
                    </div>
                    <div className='tool-bar-item' onClick={() => setToolBarState('userManagement')}>
                        通用
                    </div>
                </div>
                <div className='content-area'>
                    <UserManagement />
                    <Popconfirm
                        title="确定要退出登录吗？"
                        okText="确定"
                        cancelText="取消"
                        onConfirm={handleLogout}
                    >
                        <Button className="logout-button">退出登录</Button>
                    </Popconfirm>
                </div>
            </div>
        </div>
    );
}

export default SettingsAPP;
