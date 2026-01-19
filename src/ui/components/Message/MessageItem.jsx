// MessageItem.jsx
import React, { forwardRef, useEffect, useState } from 'react';
import FileItem from './FileItem';
import TextItem from './TextItem';
import Avatar from '../avatar.jsx';
import { formatTime } from '../../utils/timeFormatter';

const MessageItem = forwardRef(({
    msg,
    index,
    showTimestamp,
    userAvatarSrc,
    contact,
    handleResendMessage,
    handleResendFile,
    handleOpenFileLocation,
    handleDownloadFile,
    convertFileSize,
    isGroup
}, ref) => {

    const [userAvatar, setUserAvatar] = useState(userAvatarSrc);
    
    const key = msg.id || `${msg.timestamp}-${index}`;

    const handleAvatarChange = (event, avatarPath) => {
        if (msg.sender === 'user'){ 
            setUserAvatar(avatarPath)
        };
    }

    useEffect(() =>{
        setUserAvatar(userAvatarSrc);
        window.electronAPI.ipcRenderer.on('avatar-saved-successfully', handleAvatarChange)

        return () => {
            window.electronAPI.ipcRenderer.removeListener('avatar-saved-successfully', handleAvatarChange)
        }
    }, [userAvatarSrc]);


    return (
        <React.Fragment key={key}>
            {showTimestamp && <span className="message-timestamp">{formatTime(msg.timestamp)}</span>}
            <li
                className={`message-item ${msg.sender === 'user' ? 'sent' : 'received'}`}
                ref={ref}
            >
                <Avatar
                    size={35}
                    className="user-avatar"
                    src={userAvatar}
                    alt="user-avatar" />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start', maxWidth: '70%' }} >
                    <div style={{ fontSize: '10px', textAlign: msg.sender === 'user' ? 'right' : 'left' }}>{msg?.username}</div>
                    {msg.messageType == 'text' ?
                        <TextItem
                            msg={msg}
                            handleResendMessage={handleResendMessage}
                            contact={contact} />
                        :
                        <FileItem
                            msg={msg}
                            handleResendFile={handleResendFile}
                            handleOpenFileLocation={handleOpenFileLocation}
                            handleDownloadFile={handleDownloadFile}
                            convertFileSize={convertFileSize}
                            isGroup={isGroup}
                        />
                    }
                </div>
            </li>
        </React.Fragment>
    );
});

export default MessageItem;