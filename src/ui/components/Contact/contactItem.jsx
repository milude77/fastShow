// ContactItem.jsx
import React, { useCallback, useRef } from 'react'
import { Badge } from 'antd';
import { UserOutlined, TeamOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import Avatar from '../avatar.jsx';
import './css/contactItem.css';

const ContactItem = React.memo(({ contact, selectedContact, handleSelectContact, serverUrl }) => {
    const [lastMessage, setLastMessage] = useState({});
    const [newMessageCount, setNewMessageCount] = useState(0);
    const newMessageCountRef = useRef(newMessageCount);

    // 节流函数
    const throttle = (fn, delay) => {
        let timer = null;
        let inProgress = false;

        return async function (...args) {
            if (timer || inProgress) return;

            inProgress = true;
            try {
                await fn.apply(this, args);
            } finally {
                inProgress = false;
            }

            timer = setTimeout(() => {
                timer = null;
            }, delay);
        }
    }

    const handleSelectCurContact = useCallback(async (contact) => {
        handleSelectContact(contact);
        setNewMessageCount(0);
        await window.electronAPI.clearUnreadMessageCount(contact.id, contact.type === 'group');
    }, [handleSelectContact]);

    const getLastMessage = useCallback(async (contactId) => {
        const isGroup = contact.type === 'group';
        const message = await window.electronAPI.getLastMessage(contactId, isGroup);
        setLastMessage(message);
        return message;
    }, [contact.type]);

    const throttledGetLastMessage = useCallback(throttle(getLastMessage, 300), [getLastMessage]);

    const formatTime = useCallback((timestamp) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }, []);

    useEffect(() => {
        newMessageCountRef.current = newMessageCount;
    }, [newMessageCount]);

    useEffect(() => {
        getLastMessage(contact.id);
    }, [contact.id, getLastMessage]);

    const handleNewMessage = useCallback((event, { contactId, isGroup }) => {
        if (contactId === contact.id && isGroup === (contact.type === 'group')) {
            setNewMessageCount(newMessageCountRef.current + 1);
            throttledGetLastMessage(contactId);
        }
    }, [contact.id, contact.type, throttledGetLastMessage]);

    const handleSendNewMessage = useCallback((event, { contactId, isGroup }) => {
        if (contactId === contact.id && isGroup === (contact.type === 'group')) {
            throttledGetLastMessage(contactId);
        }
    }, [contact.id, contact.type, throttledGetLastMessage]);

    useEffect(() => {
        window.electronAPI.ipcRenderer.on('revived-new-chat-message', handleNewMessage);
        window.electronAPI.ipcRenderer.on('send-new-meaage', handleSendNewMessage);
        
        return () => {
            window.electronAPI.ipcRenderer.removeListener('revived-new-chat-message', handleNewMessage);
            window.electronAPI.ipcRenderer.removeListener('send-new-meaage', handleSendNewMessage);
        };
    }, [handleNewMessage, handleSendNewMessage]);

    const changeSelectedContact = useCallback((contact) => {
        if (contact.id === selectedContact?.id) {
            return;
        } else {
            handleSelectCurContact(contact);
        }
    }, [selectedContact?.id, handleSelectCurContact]);

    return (
        <div 
            className={`contact-item ${contact.id === selectedContact?.id ? 'selected' : ''}`} 
            onClick={() => changeSelectedContact(contact)}
        >
            <Avatar
                className='contact-avatar'
                size={48}
                icon={contact.type === 'group' ? <TeamOutlined /> : <UserOutlined />}
                src={`${serverUrl}/api/avatar/${contact.id}/${contact.type == 'friend' ? 'user' : 'group'}?t=${new Date().getTime()}`}
                alt='avatar'
            />
            <div className="contact-info-grid">
                <span className="contact-username">{contact.username}</span>
                <span className="contact-message">
                    {lastMessage.username ? `${lastMessage?.username}: ${lastMessage?.text}` : ''}
                </span>
                <span className="contact-timestamp">{formatTime(lastMessage?.timestamp)}</span>
                {newMessageCount > 0 && (
                    <Badge
                        size="small"
                        className="message-badge"
                        count={newMessageCount}
                        style={{
                            position: 'absolute',
                            bottom: '5px',
                            right: '5px',
                            backgroundColor: '#ff4d4f',
                            color: 'white'
                        }}
                    />
                )}
            </div>
        </div>
    );
}, (prevProps, nextProps) => {
    // 只有在 contact 相关数据或 selectedContact 的影响发生改变时才重新渲染
    const isContactEqual = prevProps.contact.id === nextProps.contact.id &&
                           prevProps.contact.username === nextProps.contact.username &&
                           prevProps.contact.type === nextProps.contact.type &&
                           prevProps.contact.lastMessageTime === nextProps.contact.lastMessageTime;
    
    const isSelectedChanged = (prevProps.selectedContact?.id === prevProps.contact.id) !== 
                             (nextProps.selectedContact?.id === nextProps.contact.id);
    
    const isOtherPropsEqual = prevProps.serverUrl === nextProps.serverUrl;
    
    // 只有当联系人数据、选中状态或服务器 URL 改变时才重新渲染
    return !isSelectedChanged && isContactEqual && isOtherPropsEqual;
});

export default ContactItem;