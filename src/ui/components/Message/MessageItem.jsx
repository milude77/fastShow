// MessageItem.jsx
import React from 'react';
import { Button } from 'antd';
import { LoadingOutlined, ExclamationCircleOutlined, FolderOpenOutlined, DownloadOutlined } from '@ant-design/icons';
import FileItem from './FileItem';
import TextItem from './TextItem';

const MessageItem = ({
    msg,
    index,
    messages,
    shouldShowTimestamp,
    serverUrl,
    currentUser,
    contact,
    handleResendMessage,
    handleResendFile,
    handleOpenFileLocation,
    handleDownloadFile,
    convertFileSize,
    isGroup
}) => {
    const showTimestamp = shouldShowTimestamp(msg.timestamp, messages[index - 1]?.timestamp);
    const key = msg.id || `${msg.timestamp}-${index}`;

    return (
        <React.Fragment key={key}>
            {showTimestamp && <span className="message-timestamp">{new Date(msg.timestamp).toLocaleTimeString()}</span>}
            <li className={`message-item ${msg.sender === 'user' ? 'sent' : 'received'}`}>
                <img
                    className="user-avatar"
                    src={`${serverUrl}/api/avatar/${msg.sender_id}/user?t=${msg.sender_id === currentUser.userId ? currentUser.avatarVersion : ''}`}
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
};

export default MessageItem;