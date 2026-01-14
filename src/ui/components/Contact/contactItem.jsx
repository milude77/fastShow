import React, { useCallback } from 'react'
import { Badge } from 'antd';
import { UserOutlined, TeamOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import Avatar from '../avatar.jsx';
import './css/contactItem.css';


export default function ContactItem({ contact, selectedContact, handleSelectContact, serverUrl }) {

    const [lastMessage, setLastMessage] = useState({});
    const [newMessageCount, setNewMessageCount] = useState(0);

    //节流函数
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
    async function handleSelectCurContact(contact) {
        handleSelectContact(contact);
        setNewMessageCount(0);
        await window.electronAPI.clearUnreadMessageCount(contact.id, contact.type === 'group');
    }

    async function getLastMessage(contactId) {
        const isGroup = contact.type === 'group';
        const message = await window.electronAPI.getLastMessage(contactId, isGroup);
        setLastMessage(message);
        return message;
    }

    const trollerGetLastMessage = throttle(getLastMessage, 300)
    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    useEffect(() => {
        getLastMessage(contact.id);
    }, [])

    const handleNewMessage = useCallback((event, { contactId, isGroup }) => {
        if (contactId === contact.id && isGroup === (contact.type === 'group')) {
            setNewMessageCount((newMessageCount) => newMessageCount + 1);
            trollerGetLastMessage(contactId);
        }
    }, [contact.id, contact.type, trollerGetLastMessage]);



    useEffect(() => {

        window.electronAPI.ipcRenderer.on('revived-new-chat-message', handleNewMessage);
        return () => {
            window.electronAPI.ipcRenderer.removeListener('revived-new-chat-message', handleNewMessage);
        };
    }, [handleNewMessage]);


    return (
        <div key={contact.id} className={`contact-item ${contact.id === selectedContact?.id ? 'selected' : ''}`} onClick={() => handleSelectCurContact(contact)} >
            <Avatar
                className='contact-avatar'
                size={48}
                icon={contact.type === 'group' ? <TeamOutlined /> : <UserOutlined />}
                src={`${serverUrl}/api/avatar/${contact.id}/${contact.type == 'friend' ? 'user' : 'group'}?t=${new Date().getTime()}`}
                alt='avatar'
            />
            <div className="contact-info-grid">
                <span className="contact-username">{contact.username}</span>
                <span className="contact-message">{lastMessage.username ? `${lastMessage?.username}: ${lastMessage?.text}` : ''}</span>
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
    )
}