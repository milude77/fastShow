import React from 'react';
import '../css/toolBar.css';
import { useAuth } from '../hooks/useAuth';

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
                <button onClick={() => setSelectFeatures('message')}>消息</button>
                <button onClick={() => setSelectFeatures('contact')}>联系人</button>
            </div>
            <div className='add-function-bar'>
                <button onClick={handleAddContactClick}>添加联系人</button>
            </div>
        </div>
    );
};

export default ToolBar;
