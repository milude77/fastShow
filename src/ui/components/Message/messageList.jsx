import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { Modal, Button, Menu, Dropdown } from 'antd';
import './css/messageList.css';
import { FileOutlined, TeamOutlined } from '@ant-design/icons';
import { WhatsAppOutlined, EllipsisOutlined, PhoneOutlined, VideoCameraOutlined } from '@ant-design/icons';
import ContactOption from "./contactOption";
import GroupMember from "./groupMember";
import MessageInput from "./messageInput";
import MessageItem from "./messageItem.jsx";
import apiClient from '../../utils/api.js';
import { useUserAvatar } from '../../hooks/useAvatar.js';
import { useGlobalMessage } from '../../hooks/useGlobalMessage.js';
import { formatTime } from '../../utils/timeFormatter.js';
import { useTranslation } from 'react-i18next';

const InputToolBar = ({ contact, onUploadFile, scrollToBottom }) => {
    const { t } = useTranslation();
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
                    title: t('file.tooLarge'),
                    content: t('file.sizeLimit'),
                });
                return;
            }
            modal.confirm({
                zIndex: 2000,
                centered: true,
                maskClosable: false,
                title: `${t('file.sendConfirm')} ${fileName} ${t('user.giveTo')} ${contact?.username}？`,
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

const MessageListTool = ({ openContactOptions, voiceCallToContact, videoCallToContact }) => {
    const { t } = useTranslation();

    const MenuItem = (
        <Menu>
            <Menu.Item key="1" >
                <Button type="link" icon={<PhoneOutlined />} onClick={() => voiceCallToContact()} >{t('call.voice')}</Button>
            </Menu.Item>
            <Menu.Item key="2">
                <Button type="link" icon={<VideoCameraOutlined />} onClick={() => videoCallToContact()} >{t('call.video')}</Button>
            </Menu.Item>
        </Menu>
    )

    return (
        <div className="message-list-tool" >
            <Dropdown
                overlay={MenuItem}
                trigger={['click']}
            >
                <WhatsAppOutlined id="" className="icon" />
            </Dropdown>

            <EllipsisOutlined id="contact-options-btn" className="icon" onClick={() => openContactOptions()} />
        </div>
    )
}

const MessageListHead = ({ contact, openContactOptions, memberLength, voiceCallToContact, videoCallToContact }) => {
    return (
        <div className='contact-info'>
            <strong>
                {contact.username + (contact.type === 'friend' ? '' : `(${memberLength})`)}
            </strong>
            <MessageListTool openContactOptions={openContactOptions} voiceCallToContact={voiceCallToContact} videoCallToContact={videoCallToContact} />
        </div>
    )
}



const MessageList = ({ contact, messageListHook }) => {
    const { t } = useTranslation();
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
    const LastMessageTimestamp = useRef(null);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const firstLoadRef = useRef(true);
    const [modal, modalContextHolder] = Modal.useModal();
    const { getAvatarUrl } = useUserAvatar();
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
        //滚动到顶部加载更多消息
        if (messageContainerRef.current.scrollTop < 50 && !isLoadingMore && !isMessageListTop) {
            currentDistanceFromBottom.current = messageContainerRef.current.scrollHeight - messageContainerRef.current.scrollTop - 50
            setIsLoadingMore(true);
            const isTop = await onLoadMore();
            setIsMessageListTop(isTop);
        }
    };

    useEffect(() => {
        if (isLoadingMore) {

            messageContainerRef.current.scrollTop = messageContainerRef.current.scrollHeight - currentDistanceFromBottom.current

            setIsLoadingMore(false);
        }
    }, [messages]);

    const scrollToBottom = useCallback((behavior = "auto") => {
        if (lastMessageRef.current) {
            lastMessageRef.current.scrollIntoView({
                behavior: behavior,
                block: 'end'  // 确保元素滚动到容器底部
            });
        }
    }, []);

    const getGroupMemberList = useCallback(async () => {
        const url = await window.electronAPI.getServerUrl();
        setServerUrl(url);
        if (contact.type === 'group') {
            const response = await apiClient.get(`${url}/api/getGroupMember/${contact.id}`);
            setGroupMemberList(response.data);
        }
    }, [contact]);

    useEffect(() => {
        getGroupMemberList();
        firstLoadRef.current = true;
        setIsMessageListTop(false)
        setOpenContactOptions(false)
    }, [contact, getGroupMemberList]);


    useEffect(() => {
        if (firstLoadRef.current && messages.length > 0) {
            firstLoadRef.current = false;
            scrollToBottom();
        }
    }, [messages, scrollToBottom]);

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
        window.electronAPI.ipcRenderer.on('sent-new-message', handleSendNewMessage);

        return () => {
            window.electronAPI.ipcRenderer.removeListener('sent-new-message', handleSendNewMessage);
        }
    })

    const processedMessages = useMemo(() => {
        let lastShownTimestamp = null;

        return messages.map((msg) => {
            let showTime = false;

            if (!lastShownTimestamp) {
                showTime = true;
                lastShownTimestamp = msg.timestamp;
            } else if (msg.timestamp - lastShownTimestamp > 5 * 60 * 1000) {
                showTime = true;
                lastShownTimestamp = msg.timestamp;
            }

            return {
                ...msg,
                showTime
            };
        });

    }, [messages]);

    // 拖拽上传文件
    // 由于 js 限制，拖拽文件无法在渲染层中获取路径，所以拖拽上传无法保存本地路径
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
                    title: t('file.folderNotSupported'),
                    content: t('file.compressHint'),
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
                    title: t('file.tooLarge'),
                    content: t('file.sizeLimit'),
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
                    title: `${t('file.sendConfirm')} ${fileName} ${t('user.giveTo')} ${contact?.username}？`,
                    onOk() {
                        onUploadFile({ filePath });
                        scrollToBottom("smooth");
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
                messageApi.error(`${t('file.downloadFailed')} ${result.error}`);
            }
        } catch (error) {
            console.error('文件下载出错:', error);
            messageApi.error(`${t('file.downloadFailed')} ${error.message}`);
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
                    messageApi.error(`${t('file.openLocationFailed')} ${result.error}`);
                }
            } else {
                messageApi.warning(t('file.notExists'));
            }
        } catch (error) {
            console.error('打开文件位置出错:', error);
            messageApi.error(`${t('file.openLocationFailed')} ${error.message}`);
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
            messageApi.error(`${t('file.resendFailed')} ${res.error}`);
        }
    }, [onResendMessage, messageApi, scrollToBottom, t]);


    //重发文件
    const handleResendFile = async (msg) => {
        try {
            // 检查是否有本地文件路径
            if (!msg.localFilePath) {
                messageApi.error(t('file.localPathNotFound'));
                return;
            }

            // 读取文件内容
            const fileContent = await window.electronAPI.readFile(msg.localFilePath);
            if (!fileContent) {
                messageApi.error(t('file.readFailed'));
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
                messageApi.error(`${t('file.deleteFailed')} ${res.error}`);
            }

            messageApi.success(t('file.resendFileSuccess'));
        } catch (error) {
            console.error('文件重传失败:', error);
            messageApi.error(`${t('file.resendFileFailed')} ${error.message}`);
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

    const handleVoiceCallToContact = () => {
        window.electronAPI.voiceCallToContact(contact.id);
    };

    const handleVideoCallToContact = () => {
        window.electronAPI.videoCallToContact(contact.id);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {modalContextHolder}
            <MessageListHead contact={contact} openContactOptions={handleOpenContactOptions} memberLength={groupMemberList?.length || 0} voiceCallToContact={handleVoiceCallToContact} videoCallToContact={handleVideoCallToContact} />
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
                        <div className='message-list'>
                            {messages && processedMessages.map((msg, index) => {
                                const AvatarSrc = getAvatarUrl(msg.sender_id);
                                return (
                                    <React.Fragment key={msg.id} >
                                        {msg.showTime && <span className="message-timestamp">{formatTime(msg.timestamp)}</span>}
                                        <MessageItem
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
                                        />
                                        <div className="message-list-botton" ref={lastMessageRef}></div>
                                    </React.Fragment>
                                )
                            })}
                        </div >
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
