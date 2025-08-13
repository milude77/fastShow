import React from 'react';
import '../css/toolBar.css';

const ToolBar = ({ setSelectFeatures }) => {
    const handleAddContactClick = () => {
        window.electronAPI.openSearchWindow();
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
