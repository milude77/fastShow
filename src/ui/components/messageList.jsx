import React, { useLayoutEffect, useEffect, useRef, useState } from "react";
import { Modal, Card, Button, message } from 'antd';
import '../css/messageList.css';
import { DownloadOutlined, FileOutlined, FolderOpenOutlined, LoadingOutlined, ExclamationCircleOutlined, CheckOutlined } from '@ant-design/icons';

const MessageInput = ({ contactID, savedDraft, onDraftChange, onSendMessage }) => {
    const [draft, setDraft] = useState(savedDraft || '');

    const deDounce = (func, delay) => {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                func.apply(this, args);
            }, delay);
        }
    }
    const handleDraftChange = (event) => {
        setDraft(event.target.value);
        deDounce(onDraftChange(contactID, event.target.value), 500);
    };

    const handleSendMessage = (message) => {
        if (message.trim() !== '') {
            onSendMessage(message);
            setDraft('');
        }
    };

    const handleKeyDown = (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleSendMessage(draft);
        }
    };

    return (
        <>
            <textarea
                className='message-input-box'
                type="text"
                value={draft}
                onChange={handleDraftChange}
                onKeyDown={handleKeyDown}
            />
            <button className='message-send-btn' onClick={() => handleSendMessage(draft)}>发送</button>
        </>
    );
};

const InputToolBar = ({ onUploadFile, scrollToBottom }) => {
    const [modal, modalContextHolder] = Modal.useModal();

    const handleFileSelect = async () => {
        const filePath = await window.electronAPI.showOpenDialog();

        if (filePath) {
            const fileName = filePath.split(/[\\/]/).pop();
            const fileContent = await window.electronAPI.readFile(filePath);
            const fileSize = (fileContent.length / 1024).toFixed(2);

            if (fileContent) {
                // 由于我们无法直接获取文件大小，这里可以留空或进行估算
                // const fileSize = (fileContent.length * 0.75 / 1024).toFixed(2); // Base64 估算
                modal.confirm({
                    zIndex: 2000,
                    centered: true,
                    maskClosable: false,
                    title: `发送文件 ${fileName} 给联系人？`,
                    content: `文件名: ${fileName}，大小: ${fileSize} KB`,

                    onOk() {
                        onUploadFile({ fileName, fileContent, localPath: filePath });
                        scrollToBottom();
                    }
                });
            }
        }
    };

    return (
        <div className='input-toolbar' style={{ display: 'flex', width: '100%' }}>
            {modalContextHolder}
            <Button
                icon={<FileOutlined />}
                className="file-upload-btn"
                onClick={handleFileSelect}
            >
            </Button>
        </div>
    )
}

const MessageList = ({ contact, messages, draft, onDraftChange, onSendMessage, onLoadMore, onUploadFile, onResendMessage }) => {
    const [messageApi, contextHolder] = message.useMessage();
    const convertFileSize = (sizeInKb) => {
        const sizeInBytes = sizeInKb;
        if (sizeInBytes < 1024) return sizeInBytes + ' B';
        const sizeInMb = sizeInBytes / (1024 * 1024);
        if (sizeInMb < 1) return (sizeInBytes / 1024).toFixed(2) + ' KB';
        const sizeInGb = sizeInMb / 1024;
        if (sizeInGb < 1) return sizeInMb.toFixed(2) + ' MB';
        return sizeInGb.toFixed(2) + ' GB';
    };
    const messagesEndRef = useRef(null);
    const messageContainerRef = useRef(null);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [prevScrollHeight, setPrevScrollHeight] = useState(null);
    const [modal, modalContextHolder] = Modal.useModal();

    const [inputHeight, setInputHeight] = useState(210); // 初始高度设置
    const isResizingRef = useRef(false);
    const startYRef = useRef(0);
    const startHeightRef = useRef(80);

    const onResizeMouseMove = (e) => {
        if (!isResizingRef.current) return;
        const delta = startYRef.current - e.clientY; // 向上拖动为正数
        let next = startHeightRef.current + delta;
        const min = 60;
        const max = Math.max(min, Math.floor(window.innerHeight * 0.6));
        next = Math.max(min, Math.min(max, next));
        setInputHeight(next);
    };

    const onResizeMouseUp = () => {
        if (!isResizingRef.current) return;
        isResizingRef.current = false;
        document.removeEventListener('mousemove', onResizeMouseMove);
        document.removeEventListener('mouseup', onResizeMouseUp);
    };

    const onResizeMouseDown = (e) => {
        isResizingRef.current = true;
        startYRef.current = e.clientY;
        startHeightRef.current = inputHeight;
        document.addEventListener('mousemove', onResizeMouseMove);
        document.addEventListener('mouseup', onResizeMouseUp);
        e.preventDefault();
    };

    useEffect(() => {
        return () => {
            document.removeEventListener('mousemove', onResizeMouseMove);
            document.removeEventListener('mouseup', onResizeMouseUp);
        };
    }, []);

    const handleScroll = async () => {
        if (messageContainerRef.current.scrollTop < 1 && !isLoadingMore) {
            let scrollHeight = messageContainerRef.current.scrollHeight;
            setIsLoadingMore(true);
            await onLoadMore();
            setPrevScrollHeight(scrollHeight);
            setIsLoadingMore(false);
        }
    };

    useLayoutEffect(() => {
        if (prevScrollHeight) {
            messageContainerRef.current.scrollTop = messageContainerRef.current.scrollHeight - prevScrollHeight;
            setPrevScrollHeight(null);
        }
    }, [messages, prevScrollHeight]);

    const lastMessageTimestamp = useRef(messages?.[messages.length - 1]?.timestamp)
    const scrollToBottom = (behavior = "auto") => {
        messagesEndRef.current?.scrollIntoView({ behavior });
    };

    useEffect(() => {
        scrollToBottom();
    }, []);

    useEffect(() => {
        const newLastMessageTimestamp = messages?.[messages.length - 1]?.timestamp;
        if (newLastMessageTimestamp && newLastMessageTimestamp !== lastMessageTimestamp.current) {
            scrollToBottom()
        }
        lastMessageTimestamp.current = newLastMessageTimestamp;
    }, [messages]);

    const handleSendMessage = (message) => {
        onSendMessage(message);
        scrollToBottom();
    }

    // 判断是否显示时间戳
    const shouldShowTimestamp = (currentTimestamp, previousTimestamp) => {
        if (!previousTimestamp) {
            return true;
        }
        const fiveMinutes = 5 * 60 * 1000;
        return new Date(currentTimestamp) - new Date(previousTimestamp) > fiveMinutes;
    };
    // 拖拽上传文件
    // 由于js限制，拖拽文件无法在渲染层中获取路径，所以拖拽上传无法保存本地路径
    const handleDrop = (event) => {
        event.preventDefault();
        const items = event.dataTransfer.items;
        if (items && items.length > 0) {
            const entry = items[0].webkitGetAsEntry && items[0].webkitGetAsEntry();
            if (entry && entry.isDirectory) {
                modal.warning({
                    zIndex: 2000,
                    centered: true,
                    title: '暂不支持上传文件夹',
                    content: '请压缩后或选择具体文件上传',
                });
                return;
            }
        }

        const files = event.dataTransfer.files;
        if (files.length > 0) {
            const filePath = window.electronAPI.getDropFilePath(Array.from(files));
            const file = files[0];
            const fileSize = (file.size / 1024).toFixed(2);
            modal.confirm({
                zIndex: 2000,
                centered: true,
                maskClosable: false,
                title: `发送文件给 ${contact?.username}？`,
                content: `文件名: ${file.name}，大小: ${fileSize} KB`,
                onOk() {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const fileContent = e.target.result.split(',')[1];
                        onUploadFile({ fileName: file.name, fileContent, localPath: filePath.join() });
                    };
                    reader.readAsDataURL(file);
                    scrollToBottom()
                }
            });
        }
    };

    const handleDragOver = (event) => {
        event.preventDefault();
    };


    // 处理文件下载
    const handleDownloadFile = async (fileUrl, fileName) => {
        try {
            if (!fileUrl) {
                return;
            }

            const result = await window.electronAPI.downloadFile(fileUrl, fileName);
            if (result.success) {
                return
            } else {
                console.error('文件下载失败:', result.error);
                messageApi.error('文件下载失败: ' + result.error);
            }
        } catch (error) {
            console.error('文件下载出错:', error);
            messageApi.error('文件下载出错: ' + error.message);
        }
    };

    // 处理打开文件位置
    const handleOpenFileLocation = async (messageId) => {
        try {
            // 检查文件是否存在
            const checkResult = await window.electronAPI.checkFileExists(messageId);
            if (checkResult.exists) {
                const result = await window.electronAPI.openFileLocation(messageId);
                if (!result.success) {
                    messageApi.error('无法打开文件位置: ' + result.error);
                }
            } else {
                messageApi.warning('文件不存在或已被移动');
            }
        } catch (error) {
            console.error('打开文件位置出错:', error);
            messageApi.error('打开文件位置出错: ' + error.message);
        }
    };

    //重新发送消息
    const handleResendMessage = async(contact, msg) => {
        const res = await window.electronAPI.resendMessage(msg.id)
        if (res.success) {
            onResendMessage(contact, msg)
            scrollToBottom(); 
        } else {
            messageApi.error('消息重新发送失败: ' + res.error);
        }
    }


    return (
        <>
            {modalContextHolder}
            {contextHolder}
            <div className='history-message-box' ref={messageContainerRef}
                onMouseLeave={() => {
                    messageContainerRef.current.style.scrollbarColor = 'transparent transparent'; // 隐藏滚动条颜色
                }}
                onMouseEnter={() => {
                    messageContainerRef.current.style.scrollbarColor = 'rgb(206, 206, 206) transparent'; // 设置滚动条颜色
                }}
                onScroll={handleScroll}
                onDrop={handleDrop}
                onDragOver={handleDragOver}>
                {isLoadingMore && <div className="loading-spinner">Loading...</div>}
                <ul className='message-list'>
                    {messages && messages.map((msg, index) => {
                        const showTimestamp = shouldShowTimestamp(msg.timestamp, messages[index - 1]?.timestamp);
                        const key = msg.id || `${msg.timestamp}-${index}`;
                        return (
                            <React.Fragment key={key}>
                                {showTimestamp && <span className="message-timestamp">{new Date(msg.timestamp).toLocaleTimeString()}</span>}
                                <li className={`message-item ${msg.sender === 'user' ? 'sent' : 'received'}`}>
                                    <div style={{ fontSize: '10px' }}>{msg?.username}</div>
                                    {msg.messageType == 'text' ?
                                        (
                                            <div style={{ display: 'flex', alignItems: 'center', maxWidth: '70%' }} >
                                                {msg.sender === 'user' && (() => {
                                                    switch (msg.status) {
                                                        case 'sending':
                                                            return (<span className="message-status"><LoadingOutlined /></span>);
                                                        case 'fail':
                                                            return (<span className="message-status" style={{ color: 'red' }} onClick={() => handleResendMessage(contact.id, msg)}><ExclamationCircleOutlined /></span>);
                                                    }
                                                })()}
                                                <div className="message-content">
                                                    <span className="message-text">{msg.text}</span>
                                                </div>
                                            </div>
                                        )
                                        :
                                        (
                                            <div className="file-message-content" >
                                                {(() => {
                                                    switch (msg.status) {
                                                        case 'sending':
                                                            return (<span className="message-status"><LoadingOutlined /></span>);
                                                        case 'fail':
                                                            return (<span className="message-status"><ExclamationCircleOutlined /></span>);
                                                    }
                                                })()}

                                                <div style={{ display: "flex", flexDirection: 'column', width: '60%', justifyContent: 'space-between', margin: '5px' }} className="file-information">
                                                    <span className="message-text">{msg.fileName}</span>
                                                    <span style={{ color: 'gray' }}>{convertFileSize(msg.fileSize)}</span>
                                                </div>
                                                {
                                                    msg.fileExt ? (
                                                        <Button
                                                            style={{ top: '50%', transform: 'translateY(-50%)', backgroundColor: '#52c41a', color: 'white' }}
                                                            type="primary"
                                                            onClick={() => handleOpenFileLocation(msg.id)}
                                                            title="打开文件位置"
                                                        >
                                                            <FolderOpenOutlined />
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            style={{ top: '50%', transform: 'translateY(-50%)', backgroundColor: '#8f8f8fff', color: 'white' }}
                                                            type="primary"
                                                            onClick={() => handleDownloadFile(msg.fileUrl, msg.fileName)}
                                                            title="下载文件"
                                                        >
                                                            <DownloadOutlined />
                                                        </Button>
                                                    )
                                                }
                                            </div>
                                        )
                                    }
                                </li>
                            </React.Fragment>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </ul>
            </div>
            <div className='message-send-box' style={{ height: inputHeight }} >
                <div className="resize-handle" onMouseDown={onResizeMouseDown} />
                <InputToolBar onUploadFile={onUploadFile} scrollToBottom={scrollToBottom} />
                <MessageInput contactID={contact?.id} savedDraft={draft} onDraftChange={onDraftChange} onSendMessage={handleSendMessage} inputHeight={inputHeight} onResizeMouseDown={onResizeMouseDown} />
            </div>
        </>
    )
}

export default MessageList;
