// MessageItem.jsx
import React from 'react';
import { Button } from 'antd';
import { LoadingOutlined, ExclamationCircleOutlined, FolderOpenOutlined, DownloadOutlined } from '@ant-design/icons';

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
                        (
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                {msg.sender === 'user' && (() => {
                                    switch (msg.status) {
                                        case 'sending':
                                            return (<span className="message-status"><LoadingOutlined /></span>);
                                        case 'fail':
                                            return (<span className="message-status" style={{ color: 'red' }} onClick={() => handleResendMessage(contact, msg)}><ExclamationCircleOutlined /></span>);
                                    }
                                })()}
                                <div className="message-content">
                                    <span className="message-text">{msg.text}</span>
                                </div>
                            </div>
                        )
                        :
                        (
                            <div style={{ display: 'flex', alignItems: 'center', maxWidth: '70%' }} >
                                {msg.sender === 'user' && (() => {
                                    switch (msg.status) {
                                        case 'fail':
                                            return (<span className="message-status" style={{ color: 'red' }} onClick={() => handleResendFile(msg)}><ExclamationCircleOutlined /></span>)
                                    };
                                })()}
                                <div className={`file-message-content ${msg.sender === 'user' ? 'sent' : 'received'}`} >
                                    <div style={{ display: "flex", flexDirection: 'column', flex: '1', justifyContent: 'space-between', margin: '5px' }} className="file-information">
                                        <span className="message-text">{msg.fileName}</span>
                                        <span style={{ color: 'gray' }}>{convertFileSize(msg.fileSize)}</span>
                                    </div>
                                    {
                                        msg.fileExt ? (
                                            <Button
                                                style={{ top: '50%', transform: 'translateY(-50%)', backgroundColor: '#52c41a', color: 'white' }}
                                                type="primary"
                                                onClick={() => handleOpenFileLocation(msg.id, isGroup)}
                                                title="打开文件位置"
                                            >
                                                <FolderOpenOutlined />
                                            </Button>
                                        ) : (
                                            <Button
                                                style={{ top: '50%', transform: 'translateY(-50%)', backgroundColor: '#8f8f8fff', color: 'white' }}
                                                type="primary"
                                                onClick={() => handleDownloadFile(msg.id, msg.fileUrl, msg.fileName, isGroup)}
                                                title="下载文件"
                                            >
                                                <DownloadOutlined />
                                            </Button>
                                        )
                                    }
                                </div>
                            </div>
                        )
                    }
                </div>
            </li>
        </React.Fragment>
    );
};

export default MessageItem;