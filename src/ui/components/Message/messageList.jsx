import React, { useEffect, useRef, useState } from "react";
import { Modal, Card, Button, message } from 'antd';
import './css/messageList.css';
import { DownloadOutlined, FileOutlined, FolderOpenOutlined, LoadingOutlined, ExclamationCircleOutlined, CheckOutlined, TeamOutlined } from '@ant-design/icons';
import { WhatsAppOutlined, EllipsisOutlined } from '@ant-design/icons';
import ContactOption from "./contactOption";
import GroupMember from "./groupMember";
import MessageInput from "./messageInput";
import MessageItem from "./messageItem";


const InputToolBar = ({ contact, onUploadFile, scrollToBottom }) => {
    const [modal, modalContextHolder] = Modal.useModal();

    const handleFileSelect = async () => {
        const filePath = await window.electronAPI.selectFile();
        if (filePath) {
            const fileName = filePath.split(/[\\/]/).pop();
            modal.confirm({
                zIndex: 2000,
                centered: true,
                maskClosable: false,
                title: `发送文件 ${fileName} 给 ${contact?.username}？`,
                onOk() {
                    onUploadFile({ filePath });
                    scrollToBottom();
                }
            });
        }
    };

    return (
        <div className='input-toolbar' >
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

const MessageListTool = ({ openContactOptions }) => {
    return (
        <div className="message-list-tool">
            <WhatsAppOutlined className="icon" />
            <EllipsisOutlined id="contact-options-btn" className="icon" onClick={() => openContactOptions()} />
        </div>
    )
}

const MessageListHead = ({ contact, openContactOptions }) => {
    return (
        <div className='contact-info'>
            <strong>
                {contact.username + (contact.type === 'friend' ? '' : `(${contact.members.length})`)}
            </strong>
            <MessageListTool openContactOptions={openContactOptions} />
        </div>
    )
}



const MessageList = ({ contact, currentUser, messages, draft, onDraftChange, onSendMessage, onSendGroupMessage, onLoadMore, onUploadFile, onResendMessage, deleteContact, inviteFriendsJoinGroup }) => {
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

    const [inputHeight, setInputHeight] = useState(210);                                        //输入框高度
    const [messageHeight, setMessageHeight] = useState(window.innerHeight - inputHeight - 100); //消息列表高度
    const isResizingRef = useRef(false);
    const startYRef = useRef(0);
    const startHeightRef = useRef(80);
    const [groupMemberListOpen, setGroupMemberListOpen] = useState(true)
    const [groupMemberListBtnDisplay, setGroupMemberListBtnDisplay] = useState(false)

    //服务器地址
    const [serverUrl, setServerUrl] = useState('');

    const [openContactOptions, setOpenContactOptions] = useState(false)

    const handleServerUrlChange = async () => {
        const url = await window.electronAPI.getServerUrl();
        setServerUrl(url);
    }

    const onResizeMouseMove = (e) => {
        if (!isResizingRef.current) return;
        const delta = startYRef.current - e.clientY;
        let next = startHeightRef.current + delta;
        const min = 100;
        const max = Math.max(min, Math.floor(window.innerHeight * 0.6));
        next = Math.max(min, Math.min(max, next));

        const newHistoryBoxHeight = window.innerHeight - next - 40; // 将40px调整成显示
        setMessageHeight(newHistoryBoxHeight);

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


    const lastMessageTimestamp = useRef(messages?.[-1]?.timestamp)
    const scrollToBottom = (behavior = "auto") => {
        messagesEndRef.current?.scrollIntoView({ behavior });
    };

    useEffect(() => {
        handleServerUrlChange();
        scrollToBottom();
    }, []);

    useEffect(() => {
        const newLastMessageTimestamp = messages?.[messages.length - 1]?.timestamp;
        if (newLastMessageTimestamp && newLastMessageTimestamp !== lastMessageTimestamp.current) {
            scrollToBottom()
        }
        lastMessageTimestamp.current = newLastMessageTimestamp;
    }, [messages]);

    useEffect(() => {
        setOpenContactOptions(false)
    }, [contact]);

    const handleSendMessage = (message) => {
        onSendMessage(message);
        scrollToBottom();
    }

    const handleSendGroupMessage = (message) => {
        onSendGroupMessage(message);
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
            const filePaths = window.electronAPI.getDropFilePath(Array.from(files));
            if (filePaths && filePaths.length > 0) {
                const filePath = filePaths[0];
                const fileName = filePath.split(/[\\/]/).pop();
                modal.confirm({
                    zIndex: 2000,
                    centered: true,
                    maskClosable: false,
                    title: `发送文件 ${fileName} 给 ${contact?.username}？`,
                    onOk() {
                        onUploadFile({ filePath });
                        scrollToBottom();
                    }
                });
            }
        }
    };

    const handleDragOver = (event) => {
        event.preventDefault();
    };


    // 处理文件下载
    const handleDownloadFile = async (messageId, fileUrl, fileName, isGroup) => {
        try {
            if (!fileUrl) {
                return;
            }
            const result = await window.electronAPI.downloadFile(messageId, fileUrl, fileName, isGroup);
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
    const handleOpenFileLocation = async (messageId, isGroup) => {
        try {
            // 检查文件是否存在
            const checkResult = await window.electronAPI.checkFileExists(messageId, isGroup);
            if (checkResult.exists) {
                const result = await window.electronAPI.openFileLocation(messageId, isGroup);
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
    const handleResendMessage = async (contact, msg) => {
        const isGroup = contact.type === 'group'
        const res = await window.electronAPI.resendMessage(msg.id, isGroup)
        if (res.success) {
            onResendMessage(contact.id, msg, contact.type)
            scrollToBottom();
        } else {
            messageApi.error('消息重新发送失败: ' + res.error);
        }
    }


    //重发文件
    const handleResendFile = async (msg) => {
        try {
            // 检查是否有本地文件路径
            if (!msg.localFilePath) {
                messageApi.error('无法重传文件：本地文件路径不存在');
                return;
            }

            // 读取文件内容
            const fileContent = await window.electronAPI.readFile(msg.localFilePath);
            if (!fileContent) {
                messageApi.error('无法重传文件：文件读取失败');
                return;
            }

            // 重新上传文件
            await onUploadFile({
                fileName: msg.fileName,
                fileContent: fileContent,
                localPath: msg.localFilePath,
                isResend: true,
                originalMessageId: msg.id
            });

            // 删除原消息记录
            const isGroup = contact.type === 'group';
            const res = await window.electronAPI.resendMessage(msg.id, isGroup);
            if (!res.success) {
                messageApi.error('删除原消息记录失败: ' + res.error);
            }

            messageApi.success('文件重新发送成功');
        } catch (error) {
            console.error('文件重传失败:', error);
            messageApi.error('文件重传失败: ' + error.message);
        }
    }

    //打开联系人操作选项
    const handleOpenContactOptions = () => {
        if (openContactOptions) {
            setOpenContactOptions(false)
        }
        else {
            setOpenContactOptions(true)
        }
    }

    const handleCloseContactOptions = () => {
        setOpenContactOptions(false);
    };

    const handleDeleteContactMessageHistory = async (contact) => {
        const res = await window.electronAPI.deleteContactMessageHistory(contact);
        if (res.success) {
            messageApi.success('历史消息记录已清空');
        } else {
            messageApi.error('清空历史消息记录失败: ' + res.error);
        }
    }

    //节流函数
    const troller = (fn, delay) => {
        let timer = null
        return function (...args) {
            if (!timer) {
                fn.apply(this, args)
                timer = setTimeout(() => {
                    timer = null;
                }, delay);
            }
        }
    }


    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {modalContextHolder}
            {contextHolder}
            <MessageListHead contact={contact} openContactOptions={handleOpenContactOptions} />
            <div style={{ display: 'flex', flex: '1' }}>
                <div style={{ display: 'flex', flex: '1', flexDirection: 'column', position: 'relative' }}>
                    <div className='history-message-box' style={{ height: messageHeight }} ref={messageContainerRef}
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
                            {messages && messages.map((msg, index) => (
                                <MessageItem
                                    key={msg.id || `${msg.timestamp}-${index}`}
                                    msg={msg}
                                    index={index}
                                    messages={messages}
                                    shouldShowTimestamp={shouldShowTimestamp}
                                    serverUrl={serverUrl}
                                    currentUser={currentUser}
                                    contact={contact}
                                    handleResendMessage={handleResendMessage}
                                    handleResendFile={handleResendFile}
                                    handleOpenFileLocation={handleOpenFileLocation}
                                    handleDownloadFile={handleDownloadFile}
                                    convertFileSize={convertFileSize}
                                    isGroup={contact.type === 'group'}
                                />
                            ))}
                        </ul >
                        <div className="group-member-toggle-btn"

                            onMouseEnter={() => setGroupMemberListBtnDisplay(true)}
                            onMouseLeave={() => setGroupMemberListBtnDisplay(false)}
                        >
                            {contact.type === 'group' && groupMemberListBtnDisplay && (
                                <Button
                                    icon={<TeamOutlined />}
                                    onClick={() => {
                                        if (groupMemberListOpen) {
                                            const windowWidth = window.innerWidth;
                                            const windowHeight = window.innerHeight;
                                            window.electronAPI.resizeWindow(windowWidth - 200, windowHeight);
                                            setGroupMemberListOpen(false)
                                        } else {
                                            setGroupMemberListOpen(true)
                                            const windowWidth = window.innerWidth;
                                            const windowHeight = window.innerHeight;
                                            window.electronAPI.resizeWindow(windowWidth + 200, windowHeight);
                                            setGroupMemberListOpen(true)
                                        }
                                    }}
                                />
                            )}
                        </div>
                        <div ref={messagesEndRef} />
                    </div >
                    <div className='message-send-box' style={{ height: inputHeight }} >
                        <div className="resize-handle" onMouseDown={onResizeMouseDown} />
                        <InputToolBar contact={contact} onUploadFile={onUploadFile} scrollToBottom={scrollToBottom} />
                        <MessageInput contactID={contact?.id} contactType={contact?.type} savedDraft={draft} onDraftChange={onDraftChange} onSendMessage={handleSendMessage} onSendGroupMessage={handleSendGroupMessage} />
                    </div>
                </div>
                {contact.type === 'group' && groupMemberListOpen && (
                    <GroupMember members={contact.members} serverUrl={serverUrl} currentUser={currentUser} />
                )}
                <ContactOption contact={contact} currentUser={currentUser} openContactOptions={openContactOptions} deleteContactMessageHistory={handleDeleteContactMessageHistory} deleteContact={deleteContact} onClose={handleCloseContactOptions} inviteFriendsJoinGroup={inviteFriendsJoinGroup} />
            </div>
        </div>
    )
}

export default MessageList;
