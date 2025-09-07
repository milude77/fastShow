import React from'react';
import { useState } from 'react';
import './css/SettingsAPP.css'
import UserManagement  from './components/userManagement.jsx';
import AppHeaderBar from './components/appHeaderBar.jsx';


function SettingsAPP() {

    const [tooBarState, setToolBarState] = useState('userManagement');

    const handleSwitchUser = () => {
        window.electronAPI.switchUser();
    }

    const handleLogout = () => {
        window.electronAPI.logout();
    }



    return (
        <div className="settings-app">
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
                    <button onClick={handleSwitchUser}>切换用户</button>
                    <button onClick={handleLogout}>退出登录</button>
                </div>
            </div>
        </div>
    );
}

export default SettingsAPP;
