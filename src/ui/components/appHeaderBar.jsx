import React, { useState, useEffect } from 'react';
import { Button } from 'antd';
import { PushpinOutlined, PushpinFilled, MinusOutlined, BorderOutlined, CloseOutlined } from '@ant-design/icons';
import '../css/appHeaderBar.css';

const AppHeaderBar = ({ style }) => {
  const [isPinned, setIsPinned] = useState(false);

  const customSetIsPinned = (newIsPinnedState) => {
    setIsPinned(newIsPinnedState);
  };

  useEffect(() => {
    const fetchInitialState = async () => {
      const initialState = await window.electronAPI.getInitialIsPinned();
      customSetIsPinned(initialState);
    };

    fetchInitialState();

    const cleanup = window.electronAPI.onAlwaysOnTopChanged(customSetIsPinned);
    return cleanup;
  }, []);

  const handleMinimize = () => {
    window.electronAPI.minimizeWindow();
  };

  const handleMaximize = () => {
    window.electronAPI.maximizeWindow();
  };

  const handleClose = () => {
    window.electronAPI.closeWindow();
  };

  const handlePin = () => {
    window.electronAPI.toggleAlwaysOnTop();
  };

  return (
    <div className="title-bar" style={style}>
      <div className="title-bar-controls">
        <Button className='title-bar-button' type="text" icon={isPinned ? <PushpinFilled /> : <PushpinOutlined />} onClick={handlePin} />
        <Button className='title-bar-button' type="text" icon={<MinusOutlined />} onClick={handleMinimize} />
        <Button className='title-bar-button' type="text" icon={<BorderOutlined />} onClick={handleMaximize} />
        <Button className='title-bar-button' type="text" icon={<CloseOutlined />} onClick={handleClose} />
      </div>
    </div>
  );
};

export default AppHeaderBar;
