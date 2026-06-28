// MessageItem.jsx
import React, { forwardRef, useCallback, useEffect, useState } from 'react';
import FileItem from './FileItem.jsx';
import TextItem from './TextItem.jsx';
import Avatar from '../avatar.jsx';
import { useAuth } from '../../hooks/useAuth';


const MessageItem = forwardRef(({
    msg,
    index,
    userAvatarSrc,
    contact,
    handleResendMessage,
    handleResendFile,
    handleOpenFileLocation,
    handleDownloadFile,
    convertFileSize,
    isGroup
}, ref) => {
    const { currentUser } = useAuth()
    const [userAvatar, setUserAvatar] = useState(userAvatarSrc);
    const isCurUserSender = msg.sender_id === currentUser.userId

    const key = msg.id || `${msg.timestamp}-${index}`;

    const handleAvatarChange = useCallback((event, avatarPath) => {
        if (isCurUserSender) {
            setUserAvatar(avatarPath)
        };
    }, [isCurUserSender])

    useEffect(() => {
        setUserAvatar(userAvatarSrc);
        window.electronAPI.ipcRenderer.on('avatar-saved-successfully', handleAvatarChange)

        return () => {
            window.electronAPI.ipcRenderer.removeListener('avatar-saved-successfully', handleAvatarChange)
        }
    }, [userAvatarSrc, handleAvatarChange]);


    return (
        <React.Fragment key={key}>
            <li
                className={`message-item ${isCurUserSender ? 'sent' : 'received'}`}
                ref={ref}
            >
                <Avatar
                    size={35}
                    className="user-avatar"
                    src={userAvatar}
                    alt="user-avatar" />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: isCurUserSender ? 'flex-end' : 'flex-start', maxWidth: '70%' }} >
                    <div style={{ fontSize: '10px', textAlign: isCurUserSender ? 'right' : 'left' }}>{msg?.username}</div>
                    {msg.messageType == 'text' ?
                        <TextItem
                            msg={msg}
                            handleResendMessage={handleResendMessage}
                            contact={contact}
                            isCurUserSender={isCurUserSender}
                        />
                        :
                        <FileItem
                            msg={msg}
                            handleResendFile={handleResendFile}
                            handleOpenFileLocation={handleOpenFileLocation}
                            handleDownloadFile={handleDownloadFile}
                            convertFileSize={convertFileSize}
                            isGroup={isGroup}
                            isCurUserSender={isCurUserSender}
                        />
                    }
                </div>
            </li>
        </React.Fragment>
    );
});

export default MessageItem;