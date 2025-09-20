import React, { useLayoutEffect, useEffect, useRef, useState } from "react";
import { Modal, Card, Button } from 'antd';
import '../css/messageList.css';
import { DownloadOutlined } from '@ant-design/icons';

const MessageList = ({ contact, messages, draft, onDraftChange, onSendMessage, onLoadMore, onUploadFile }) => {

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

    const handleScroll = async () => {
        if (messageContainerRef.current.scrollTop < 1 && !isLoadingMore) { // 更改为 < 1 增加健壮性
            let scrollHeight = messageContainerRef.current.scrollHeight;
            setIsLoadingMore(true);
            await onLoadMore();
            setPrevScrollHeight(scrollHeight);
            setIsLoadingMore(false);
        }
    };

    useLayoutEffect(() => {
        if (prevScrollHeight) {
            // 正确设置 scrollTop 属性
            messageContainerRef.current.scrollTop = messageContainerRef.current.scrollHeight - prevScrollHeight;
            setPrevScrollHeight(null);
        }
    }, [messages, prevScrollHeight]);


    const lastMessageTimestamp = useRef(messages?.[messages.length - 1]?.timestamp);

    const scrollToBottom = (behavior = "auto") => {
        messagesEndRef.current?.scrollIntoView({ behavior });
    };

    useEffect(() => {
        const newLastMessage = messages?.[messages.length - 1];
        const newLastMessageTimestamp = newLastMessage?.timestamp;

        if (newLastMessageTimestamp && newLastMessageTimestamp !== lastMessageTimestamp.current) {
            scrollToBottom();
        } else if (messages?.length > 0 && !lastMessageTimestamp.current) {
            scrollToBottom();
        }

        lastMessageTimestamp.current = newLastMessageTimestamp;
    }, [messages]);

    // 发送信息
    function sendMessage() {
        if (draft.trim() !== '') {
            onSendMessage(draft);
        }
    }


    //按下回车即可发送信息
    const handleKeyDown = (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    };

    // 判断是否显示时间戳
    const shouldShowTimestamp = (currentTimestamp, previousTimestamp) => {
        if (!previousTimestamp) {
            return true; // Always show for the first message
        }
        const fiveMinutes = 5 * 60 * 1000;
        return new Date(currentTimestamp) - new Date(previousTimestamp) > fiveMinutes;
    };
    // 拖拽上传文件
    const handleDrop = (event) => {
        event.preventDefault();
        // 先检测是否为文件夹（基于 Chromium 的 webkitGetAsEntry）
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
            const file = files[0];
            const fileSize = (file.size / 1024).toFixed(2);
            modal.confirm({
                zIndex: 2000,
                centered: true,
                maskClosable: false,
                title: `发送文件给 ${contact?.username}？`,
                content: `文件名: ${file.name}, 大小: ${fileSize} KB`,
                onOk() {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const fileContent = e.target.result.split(',')[1];
                        onUploadFile({ fileName: file.name, fileContent });
                    };
                    reader.readAsDataURL(file);
                }
            });
        }
    };

    const handleDragOver = (event) => {
        event.preventDefault();
    };


    return (
        <>
            {modalContextHolder}
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
                        // Use a stable and unique key, like msg.id or msg.timestamp
                        const key = msg.id || `${msg.timestamp}-${index}`;
                        return (
                            <React.Fragment key={key}>
                                {showTimestamp && <span className="message-timestamp">{new Date(msg.timestamp).toLocaleTimeString()}</span>}
                                <li className={`message-item ${msg.sender === 'user' ? 'sent' : 'received'}`}>
                                    <span style={{ fontSize: '10px' }}>{msg.username}</span>
                                    {msg.messageType == 'text' ?
                                        (<>
                                            <div className="message-content">
                                                <span className="message-text">{msg.text}</span>
                                            </div>
                                        </>)
                                        :
                                        (
                                            <div className="file-message-content" >
                                                <div style={{ display: "flex", flexDirection: 'column', width: '60%', justifyContent:'space-between', margin: '5px' }} className="file-information">
                                                    <span className="message-text">{msg.fileName}</span>
                                                    <span className="message-text">{convertFileSize(msg.fileSize)}</span>
                                                </div>
                                                <Button style={{ top: '50%', transform: 'translateY(-50%)', backgroundColor: '#8f8f8fff', color: 'white' }} type="primary"><DownloadOutlined /></Button>
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
            <div className='message-send-box'>
                <textarea
                    className='message-input-box'
                    type="text"
                    value={draft}
                    onChange={(e) => onDraftChange(contact.id, e.target.value)}
                    onKeyDown={handleKeyDown}
                />
                <button className='message-send-btn' onClick={sendMessage} >发送</button>
            </div>
        </>
    )
}

export default MessageList;
