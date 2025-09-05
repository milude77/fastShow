import React from 'react';
import '../css/appHeaderBar.css';

const AppHeaderBar = () => {
  const handleMinimize = () => {
    window.electronAPI.minimizeWindow();
  };

  const handleMaximize = () => {
    window.electronAPI.maximizeWindow();
  };

  const handleClose = () => {
    window.electronAPI.closeWindow();
  };

  return (
    <div className="title-bar">
      <div className="title-bar-drag-region"></div>
      <div className="title-bar-title">FastShow</div>
      <div className="title-bar-controls">
        <button className="title-bar-button" id="minimize-btn" onClick={handleMinimize}>
          &#xE921;
        </button>
        <button className="title-bar-button" id="maximize-btn" onClick={handleMaximize}>
          &#xE922;
        </button>
        <button className="title-bar-button" id="close-btn" onClick={handleClose}>
          &#xE8BB;
        </button>
      </div>
    </div>
  );
};

export default AppHeaderBar;
