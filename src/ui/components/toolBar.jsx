import React from 'react';
import '../css/toolBar.css';
import { Button } from 'antd';
import { TeamOutlined, MessageOutlined, UsergroupAddOutlined, SettingOutlined, SunOutlined, MoonOutlined } from '@ant-design/icons'

const ToolBar = ({ selectFeatures, setSelectFeatures, isDarkMode, toggleDarkMode }) => {

    return (
        <div className='tool-bar'>
            <div className='base-tool-bar'>
                <Button className={`tool-bar-button ${selectFeatures === 'message'? 'active' : 'inactive'}`}  style={{color: 'var(--text-color)'}} type="link" title='消息' icon = { <MessageOutlined /> } onClick={() => setSelectFeatures('message')}></Button>
                <Button className={`tool-bar-button ${selectFeatures === 'contact'? 'active' : 'inactive'}`}  style={{color: 'var(--text-color)'}} type="link" title='联系人' icon = { <TeamOutlined /> } onClick={() => setSelectFeatures('contact')}></Button>
            </div>
            <div className='change-theme-bar'>
                <Button style={{color: 'var(--text-color)'}} type='link' icon={ isDarkMode ? <SunOutlined /> : <MoonOutlined /> } onClick={() => toggleDarkMode()}></Button>
            </div>
            <div className='setting-bth'>
                <Button style={{color: 'var(--text-color)'}} type="link" title='设置' icon = { <SettingOutlined /> } onClick={() => window.electronAPI.openSettingsWindow()}></Button>
            </div>
        </div>
    );
};

export default ToolBar;
