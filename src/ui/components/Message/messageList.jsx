import React, { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Button } from 'antd';
import './css/messageList.css';
import { FileOutlined, TeamOutlined } from '@ant-design/icons';
import { WhatsAppOutlined, EllipsisOutlined } from '@ant-design/icons';
import ContactOption from "./contactOption";
import GroupMember from "./groupMember";
import MessageInput from "./messageInput";
import MessageItem from "./messageItem.jsx";
import apiClient from '../../utils/api.js';
import { useUserAvatar } from '../../hooks/useAvatar.js';
import { useGlobalMessage } from '../../hooks/useGlobalMessage.js';
import { formatTime } from '../../utils/timeFormatter.js';



const InputToolBar = ({ contact, onUploadFile, scrollToBottom }) => {
    const [modal, modalContextHolder] = Modal.useModal();

    const MAX_FILE_SIZE = 200 * 1024 * 1024;

    const handleFileSelect = async () => {
        const filePath = await window.electronAPI.selectFile();
        if (filePath) {
            const fileName = filePath.split(/[\\/]/).pop();
            const fileInfo = await window.electronAPI.getFileInfo(filePath);
            if (fileInfo.size > MAX_FILE_SIZE) {
                modal.error({
                    zIndex: 2000,
                    centered: true,
                    title: '文件过大',
                    content: `暂不支持上传超过 200MB 的文件`,
                });
                return;
            }
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

const MessageListHead = ({ contact, openContactOptions, memberLength }) => {
    return (
        <div className='contact-info'>
            <strong>
                {contact.username + (contact.type === 'friend' ? '' : `(${memberLength})`)}
            </strong>
            <MessageListTool openContactOptions={openContactOptions} />
        </div>
    )
}



const MessageList = ({ contact, messageListHook }) => {

    const { messageApi } = useGlobalMessage();


    const convertFileSize = (sizeInKb) => {
        const sizeInBytes = sizeInKb;
        if (sizeInBytes < 1024) return sizeInBytes + ' B';
        const sizeInMb = sizeInBytes / (1024 * 1024);
        if (sizeInMb < 1) return (sizeInBytes / 1024).toFixed(2) + ' KB';
        const sizeInGb = sizeInMb / 1024;
        if (sizeInGb < 1) return sizeInMb.toFixed(2) + ' MB';
        return sizeInGb.toFixed(2) + ' GB';
    };

    const currentUser = JSON.parse(localStorage.getItem('currentUser'))

    const messageContainerRef = useRef(null);
    const lastMessageRef = useRef(null);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [isFirstLoad, setIsFirstLoad] = useState(true);
    const [modal, modalContextHolder] = Modal.useModal();
    const { getAvatarUrl, refreshAvatar } = useUserAvatar(currentUser?.userId);
    const [isMessageListTop, setIsMessageListTop] = useState(false)

    const [groupMemberList, setGroupMemberList] = useState([]);
    const [groupMemberListOpen, setGroupMemberListOpen] = useState(true)
    const [groupMemberListBtnDisplay, setGroupMemberListBtnDisplay] = useState(false)

    //服务器地址
    const [serverUrl, setServerUrl] = useState('');

    const [openContactOptions, setOpenContactOptions] = useState(false)
    const {
        messages,
        onLoadMore,
        onUploadFile,
        onSendMessage,
        onSendGroupMessage,
        onResendMessage,
    } = messageListHook;

    const currentDistanceFromBottom = useRef(0);

    const handleScroll = async () => {
        if (messageContainerRef.current.scrollTop < 50 && !isLoadingMore && !isMessageListTop) {
            currentDistanceFromBottom.current = messageContainerRef.current.scrollHeight - messageContainerRef.current.scrollTop - 50

            setIsLoadingMore(true);
            const isTop =  await onLoadMore();
            setIsMessageListTop(isTop);
        }
    };

    useEffect(() => {
        if (isLoadingMore) {

            messageContainerRef.current.scrollTop = messageContainerRef.current.scrollHeight - currentDistanceFromBottom.current

            setIsLoadingMore(false);
        }
    }, [messages]);

    const firstScrollToBottom = useCallback((behavior = "auto") => {
        if (lastMessageRef.current && isFirstLoad) {
            lastMessageRef.current.scrollIntoView({
                behavior: behavior,
                block: 'end'  // 确保元素滚动到容器底部
            });
            setIsFirstLoad(false);
        }
    }, [isFirstLoad]);

    const scrollToBottom = useCallback((behavior = "auto") => {
        if (lastMessageRef.current && isFirstLoad) {
            lastMessageRef.current.scrollIntoView({
                behavior: behavior,
                block: 'end'  // 确保元素滚动到容器底部
            });
            setIsFirstLoad(false);
        }
    }, [isFirstLoad]);

    const getGroupMemberList = useCallback(async () => {
        const url = await window.electronAPI.getServerUrl();
        setServerUrl(url);
        if (contact.type === 'group') {
            const response = await apiClient.get(`${url}/api/getGroupMember/${contact.id}`);
            setGroupMemberList(response.data);
        }
    }, [contact]);

    useEffect(() => {
        const handleAvatarUpdate = () => {
            // 重新渲染消息列表以获取最新的头像URL
            refreshAvatar();
        };

        window.electronAPI.ipcRenderer.on('avatar-saved-successfully', handleAvatarUpdate);

        return () => {
            window.electronAPI.ipcRenderer.removeListener('avatar-saved-successfully', handleAvatarUpdate);
        };
    }, [refreshAvatar]);

    useEffect(() => {
        getGroupMemberList();
        setIsFirstLoad(true);
        setIsMessageListTop(false)
        setOpenContactOptions(false)
    }, [contact, getGroupMemberList]);


    useEffect(() => {
        firstScrollToBottom();
    }, [messages, contact, firstScrollToBottom]);

    const handleSendMessage = (message) => {
        onSendMessage(message);
    }

    const handleSendGroupMessage = (message) => {
        onSendGroupMessage(message);
    }

    const handleSendNewMessage = (event, { contactId, isGroup }) => {
        if (contactId === contact.id && isGroup === (contact.type === 'group')) {
            scrollToBottom("smooth");
        }
    }

    useEffect(() => {
        window.electronAPI.ipcRenderer.on('send-new-meaage', handleSendNewMessage);

        return () => {
            window.electronAPI.ipcRenderer.removeListener('send-new-meaage', handleSendNewMessage);
        }
    })



    // 判断是否显示时间戳
    const LastMessageTimestamp = useRef(null);

    useEffect(() => {
        LastMessageTimestamp.current = null;
    }, [messages, contact, isMessageListTop]);
    const shouldShowTimestamp = (currentTimestamp) => {
        if (!LastMessageTimestamp.current) {
            LastMessageTimestamp.current = currentTimestamp;
            return true;
        }
        else if (currentTimestamp - LastMessageTimestamp.current > 60 * 5000) {
            LastMessageTimestamp.current = currentTimestamp;
            return true;
        }
        return false;
    }

    // 拖拽上传文件
    // 由于js限制，拖拽文件无法在渲染层中获取路径，所以拖拽上传无法保存本地路径
    const handleDrop = (event) => {
        event.preventDefault();
        const MAX_FILE_SIZE = 200 * 1024 * 1024;
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
            if (file.size > MAX_FILE_SIZE) {
                modal.error({
                    zIndex: 2000,
                    centered: true,
                    title: '文件过大',
                    content: `暂不支持上传超过 200MB 的文件`,
                });
                return;
            }
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
                console.error('文件下载失败:', result);
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
    const handleResendMessage = useCallback(async (contact, msg) => {
        const isGroup = contact.type === 'group'
        const res = await window.electronAPI.resendMessage(msg.id, isGroup)
        if (res.success) {
            onResendMessage(contact.id, msg, contact.type)
            scrollToBottom("smooth");
        } else {
            messageApi.error('消息重新发送失败: ' + res.error);
        }
    }, [onResendMessage, messageApi, scrollToBottom]);


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

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {modalContextHolder}
            <MessageListHead contact={contact} openContactOptions={handleOpenContactOptions} memberLength={groupMemberList?.length || 0} />
            <div style={{ display: 'flex', flex: '1' }}>
                <div style={{ display: 'flex', flex: '1', flexDirection: 'column', position: 'relative' }}>
                    <div className='history-message-box' style={{ height: window.innerHeight - 310 }} ref={messageContainerRef}
                        onMouseLeave={() => {
                            messageContainerRef.current.style.scrollbarColor = 'transparent transparent'; // 隐藏滚动条颜色
                        }}
                        onMouseEnter={() => {
                            messageContainerRef.current.style.scrollbarColor = 'rgb(206, 206, 206) transparent'; // 设置滚动条颜色
                        }}
                        onScroll={handleScroll}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}>
                        <ul className='message-list'>
                            {messages && messages.map((msg, index) => {
                                const isShowTimestamp = shouldShowTimestamp(msg.timestamp);
                                const AvatarSrc = getAvatarUrl(msg.sender_id);
                                return (
                                    <>
                                        {isShowTimestamp && <span className="message-timestamp">{formatTime(msg.timestamp)}</span>}
                                        <MessageItem
                                            key={msg.id}
                                            msg={msg}
                                            index={index}
                                            userAvatarSrc={AvatarSrc}
                                            contact={contact}
                                            handleResendMessage={handleResendMessage}
                                            handleResendFile={handleResendFile}
                                            handleOpenFileLocation={handleOpenFileLocation}
                                            handleDownloadFile={handleDownloadFile}
                                            convertFileSize={convertFileSize}
                                            isGroup={contact.type === 'group'}
                                            ref={index === messages.length - 1 ? lastMessageRef : null}
                                        />
                                    </>
                                )
                            })}
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
                    </div >
                    <div className='message-send-box' style={{ height: 210 }} >
                        {/* 移除了 <div className="resize-handle" onMouseDown={onResizeMouseDown} /> */}
                        <InputToolBar contact={contact} onUploadFile={onUploadFile} scrollToBottom={scrollToBottom} />
                        <MessageInput
                            contactID={contact?.id}
                            contactType={contact?.type}
                            onSendMessage={handleSendMessage}
                            onSendGroupMessage={handleSendGroupMessage} />
                    </div>
                </div>
                {contact.type === 'group' && groupMemberListOpen && (
                    <GroupMember members={groupMemberList} serverUrl={serverUrl} currentUser={currentUser} />
                )}
                <ContactOption contact={contact} currentUser={currentUser} openContactOptions={openContactOptions} onClose={handleCloseContactOptions} groupMemberList={groupMemberList} messageApi={messageApi} />
            </div>
        </div>
    )
}

export default MessageList;
