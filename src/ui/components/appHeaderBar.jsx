import React, { useState, useEffect, forwardRef } from 'react';
import { Button } from 'antd';
import { PushpinOutlined, PushpinFilled, MinusOutlined, BorderOutlined, CloseOutlined } from '@ant-design/icons';
import '../css/appHeaderBar.css';

const AppHeaderBar = forwardRef(({ style }, ref) => {
  const [isPinned, setIsPinned] = useState(false);

  const customSetIsPinned = (newIsPinnedState) => {
    setIsPinned(newIsPinnedState);
  };

  useEffect(() => {

    const handleTopChange = (event, isAlwaysOnTop) => {
      customSetIsPinned(isAlwaysOnTop);
    }
    const fetchInitialState = async () => {
      const initialState = await window.electronAPI.getInitialIsPinned();
      customSetIsPinned(initialState);
    };

    fetchInitialState();

    window.electronAPI.ipcRenderer.on('always-on-top-changed', handleTopChange);
    return () => {
      window.electronAPI.ipcRenderer.removeListener('always-on-top-changed', handleTopChange);
    };
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
    <div className="title-bar" ref={ref} style={style}>
      <Button className='title-bar-button' type="text" icon={isPinned ? <PushpinFilled /> : <PushpinOutlined />} onClick={handlePin} />
      <Button className='title-bar-button' type="text" icon={<MinusOutlined />} onClick={handleMinimize} />
      <Button className='title-bar-button' type="text" icon={<BorderOutlined />} onClick={handleMaximize} />
      <Button className='title-bar-button' type="text" icon={<CloseOutlined />} onClick={handleClose} />
    </div>
  );
});

export default AppHeaderBar;
