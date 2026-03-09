import React from'react';
import { useState } from 'react';
import './css/SettingsAPP.css'
import UserManagement  from './components/userManagement.jsx';
import AppHeaderBar from './components/appHeaderBar.jsx';
import { Popconfirm, Button } from "antd"
import { useTranslation } from 'react-i18next';

function SettingsAPP() {
    const { t } = useTranslation();

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
                        {t('settings.userManagement')}
                    </div>
                    <div className='tool-bar-item' onClick={() => setToolBarState('userManagement')}>
                        {t('settings.general')}
                    </div>
                </div>
                <div className='content-area'>
                    <UserManagement />
                    <Popconfirm
                        title={t('settings.confirmLogout')}
                        okText={t('common.confirm')}
                        cancelText={t('common.cancel')}
                        onConfirm={handleLogout}
                    >
                        <Button className="logout-button">{t('settings.logout')}</Button>
                    </Popconfirm>
                </div>
            </div>
        </div>
    );
}

export default SettingsAPP;
