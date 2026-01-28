import { useState, useRef, useCallback } from "react";
import { useGlobalMessage } from './useGlobalMessage';

export function useMessageList(curSelectedContact) {
    const contactRef = useRef(curSelectedContact);
    contactRef.current = curSelectedContact;
    const [messages, setMessages] = useState([]);
    const pendingTimersRef = useRef(new Map());
    const { messageApi } = useGlobalMessage();

    // 移除内部的 selectedContact 状态

    const handleNewMessage = useCallback((msg) => {
        // Safety check: Do not process messages if the user is not logged in.

        const contactId = msg.type == 'group' ? msg.receiverId : msg.senderId;
        const messageId = msg.message_id;

        const newMessage = {
            id: messageId,
            text: msg.content,
            sender: 'other',
            sender_id: msg.senderId,
            timestamp: new Date(msg.timestamp),
            username: msg.username,
            fileName: msg.fileName,
            messageType: msg.messageType,
            type: msg.type,
            fileUrl: msg.fileUrl,
            fileSize: msg.fileSize,
        }

        if (window.electronAPI) {
            try { window.electronAPI.newChatMessage(contactId, newMessage); }
            catch (e) { console.error("保存消息失败:", e) };
        }

        if (contactRef.current.id == contactId && msg.type == contactRef.current.type) {
            setMessages(prev => {
                const newMessage = {
                    id: messageId,
                    text: msg.content,
                    sender: 'other',
                    timestamp: msg.timestamp,
                    username: msg.username,
                    messageType: msg.messageType,
                    fileName: msg.fileName,
                    fileUrl: msg.fileUrl,
                    fileSize: msg.fileSize,
                    sender_id: contactId
                };

                // 返回新数组，不是包装在对象中的数组
                return [...prev, newMessage];
            })
        }
    }, []); // 使用外部传入的联系人

    const handleSendMessageStatus = useCallback(({ senderInfo, sendMessageId, receiverId, isGroup }) => {
        // 收到服务端成功回执，清除超时计时器
        let timer;

        timer = pendingTimersRef.current.get(sendMessageId);
        clearTimeout(timer);
        pendingTimersRef.current.delete(sendMessageId);
        if (receiverId === contactRef.current.id) {
            setMessages(prev =>
                prev.map(msg =>
                    msg.id === sendMessageId ? { ...msg, status: 'success' } : msg
                )
            );
        }
        window.electronAPI.sendMessageStatusChange(senderInfo, sendMessageId, isGroup);
    }, [])

    const handleChatHistoryDeleted = useCallback((event, { contactId, isGroup }) => {
        if (contactId === contactRef.current.id && isGroup && contactRef.current.type === 'group') {
            setMessages([]);
            messageApi.success('消息已清除');
        }
    }, [messageApi])

    const handleMessageListSelectContact = useCallback(async (contact) => {
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));

        if (window.electronAPI) {
            const localHistory = await window.electronAPI.getChatHistory(
                contact.id,
                currentUser.userId,
                15,
                contact.type === 'group',
                null
            );

            setMessages(localHistory);
        }

        window.electronAPI.clearUnreadMessageCount(
            contact.id,
            contact.type === 'group'
        );
    }, []);


    const handleSendMessage = useCallback(async (text) => {
        if (!contactRef.current) return;

        const messageId = await window.electronAPI.getNewMessageId();
        const currentUser = JSON.parse(localStorage.getItem('currentUser'))

        const newMessage = {
            id: messageId,
            text,
            sender: 'user',
            messageType: 'text',
            timestamp: Date.now(),
            username: currentUser.username,
            sender_id: currentUser.userId,
            status: 'sending',
            type: 'private'
        };

        setMessages(prev => ([...prev, newMessage]));

        const timer = setTimeout(() => {
            setMessages(prev =>
                prev.map(msg =>
                    msg.id === messageId ? { ...msg, status: 'fail' } : msg
                )
            );
            pendingTimersRef.current.delete(messageId);
        }, 10000);

        pendingTimersRef.current.set(messageId, timer);

        await window.electronAPI.sendPrivateMessage({
            receiverId: contactRef.current.id,
            message: {
                text,
                messageType: 'text',
                sender_id: currentUser.userId,
                username: currentUser.username,
                type: 'private'
            },
            messageId
        });

    }, []);

    const handleSendgroupMessage = useCallback(async (text) => {
        if (contactRef.current) {
            const messageId = await window.electronAPI.getNewMessageId();
            const currentUser = JSON.parse(localStorage.getItem('currentUser'))

            const newMessage = {
                id: messageId,
                text,
                sender: 'user',
                messageType: 'text',
                timestamp: Date.now(),
                username: currentUser.username,
                sender_id: currentUser.userId,
                status: 'sending',
                type: 'group'
            };

            setMessages(prev => ([...prev, newMessage]));

            // 启动 10 秒超时计时器，若未收到成功回执则标记为失败
            const timer = setTimeout(() => {
                setMessages(prev =>
                    prev.map(msg =>
                        msg.id === messageId ? { ...msg, status: 'fail' } : msg
                    )
                );
                pendingTimersRef.current.delete(messageId);
            }, 10000);
            pendingTimersRef.current.set(messageId, timer);

            await window.electronAPI.sendGroupMessage({
                groupId: contactRef.current.id,
                message: {
                    text,
                    messageType: 'text',
                    sender_id: currentUser.userId,
                    username: currentUser.username,
                    type: 'group'
                },
                messageId
            });
        }
    }, []);

    const handleResendMessage = useCallback((contactID, msg, contactType) => {
        if (contactID == contactRef.current.id) {
            if (contactType == 'group') {
                setMessages(prev => (prev.filter(message => message.id !== msg.id)));
                handleSendgroupMessage(msg.text);
            } else {
                setMessages(prev => (prev.filter(message => message.id !== msg.id)));
                handleSendMessage(msg.text);
            }
        }
    }, [handleSendMessage, handleSendgroupMessage, messages])

    const loadMoreMessages = useCallback(async () => {
        if (!window.electronAPI) return;

        const currentUser = JSON.parse(localStorage.getItem('currentUser'))

        const contactId = contactRef.current.id;
        const isGroup = contactRef.current.type === 'group';

        const oldestMessage = (messages && messages.length > 0) ? messages[0] : null;
        const beforeTimestamp = oldestMessage?.timestamp ?? null;

        const olderMessages = await window.electronAPI.getChatHistory(
            contactId,
            currentUser.userId,
            15,
            isGroup,
            beforeTimestamp
        );

        if (Array.isArray(olderMessages) && olderMessages.length > 0 && messages) {
            const existingIds = new Set(messages.map(m => m.id));
            const dedupedOlder = olderMessages.filter(
                m => !existingIds.has(m.id)
            );
            setMessages([...dedupedOlder, ...messages]);
            return false;

        }
        return true;
    }, [messages]); // 添加依赖

    const handleUploadFile = useCallback(async ({ filePath }) => {
        if (!contactRef.current) return;

        const currentUser = JSON.parse(localStorage.getItem('currentUser'))

        const fileName = filePath.split(/[\\/]/).pop();
        const tempId = await window.electronAPI.getNewMessageId();
        const isGroup = contactRef.current.type === 'group';

        // 1. 在UI中立即显示一个"正在上传"的临时消息
        const tempMessage = {
            id: tempId,
            text: '',
            sender: 'user',
            sender_id: currentUser.userId,
            timestamp: new Date(),
            username: currentUser.username,
            messageType: 'file',
            fileName: fileName,
            fileUrl: null,
            localPath: filePath,
            fileExt: true,
            status: 'uploading'
        };

        setMessages(prev => ([...prev, tempMessage]));

        try {
            // 2. 调用主进程的上传函数
            const result = await window.electronAPI.initiateFileUpload(
                filePath,
                currentUser.userId,
                contactRef.current.id,
                isGroup,
                tempId
            );

            if (result.success) {
                // 3. 上传成功后，用服务器返回的真实消息替换掉临时消息
                const finalMessage = {
                    ...result.messageData,
                    sender_id: currentUser.userId,
                    sender: 'user', // 确保UI正确显示
                    localPath: filePath,
                    fileExt: true,
                    status: 'success',
                    id: result.messageId,
                };

                setMessages(prev =>
                    prev.map(msg =>
                        msg.id === tempId ? finalMessage : msg
                    )
                )
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('文件上传失败:', error);
            // 5. 上传失败，更新临时消息的状态为 'fail'
            setMessages(prev => prev.map(msg =>
                msg.id === tempId ? { ...msg, status: 'fail', fileSize: '上传失败' } : msg
            ))
        }
    }, []);



    return {
        messages: messages,
        onLoadMore: loadMoreMessages,
        onUploadFile: handleUploadFile,
        onSendMessage: handleSendMessage,
        onSendGroupMessage: handleSendgroupMessage,
        onResendMessage: handleResendMessage,
        handleChatHistoryDeleted,
        MessageListSelectContact: handleMessageListSelectContact,
        handleSendMessageStatus,
        handleNewMessage,
    }
}