import React from 'react';
import { useState } from 'react';
import './css/SettingsAPP.css'
import UserManagement from './components/settingPage/userManagement.jsx';
import GeneralManagement from './components/settingPage/generalManagement.jsx';
import AppHeaderBar from './components/appHeaderBar.jsx';
import { Popconfirm, Button } from "antd"
import { useTranslation } from 'react-i18next';

function UserManagementPage({ handleLogout }) {
    const { t } = useTranslation();

    return (
        <>
            <UserManagement />
            <Popconfirm
                title={t('settings.confirmLogout')}
                okText={t('common.confirm')}
                cancelText={t('common.cancel')}
                onConfirm={handleLogout}
            >
                <Button className="logout-button">{t('settings.logout')}</Button>
            </Popconfirm>
        </>
    )
}

function SettingsAPP() {
    const { t } = useTranslation();

    const [tooBarState, setToolBarState] = useState('userManagement');

    const handleLogout = () => {
        window.electronAPI.logout();
    }

    const handleSwitchToolBarItem = (item) => {
        switch (item) {
            case 'userManagement':
                return <UserManagementPage handleLogout={handleLogout} />
            case 'general':
                return <GeneralManagement />
            default:
                return <UserManagementPage handleLogout={handleLogout} />
        }
    }


    return (
        <div className="settings-app" >
            <AppHeaderBar />
            <div className='settings-area'>
                <div className='tool-bar'>
                    <div className={tooBarState === 'userManagement' ? 'tool-bar-item active' : 'tool-bar-item'} onClick={() => setToolBarState('userManagement')}>
                        {t('settings.userManagement')}
                    </div>
                    <div className={tooBarState === 'general' ? 'tool-bar-item active' : 'tool-bar-item'} onClick={() => setToolBarState('general')}>
                        {t('settings.general')}
                    </div>
                </div>
                <div className='content-area'>
                    {handleSwitchToolBarItem(tooBarState)}
                </div>
            </div>
        </div>
    );
}

export default SettingsAPP;
