import React from 'react'
import { Badge } from 'antd';
import { useEffect, useState, useRef } from 'react'
import './css/contactItem.css'


export default function ContactItem({ contact, selectedContact, handleSelectContact, serverUrl }) {

    const [lastMessage, setLastMessage] = useState({});
    const [newMessageCount, setNewMessageCount] = useState(0);

    //节流函数
    const throttle = (fn, delay) => {
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

    function getLastMessage(contactId) {
        const isGroup = contact.type === 'group';
        window.electronAPI.getLastMessage(contactId, isGroup).then((message) => {
            setLastMessage(message);
        })
    }

    const trollerGetLastMessageRef = useRef(null);

    if (!trollerGetLastMessageRef.current) {
        trollerGetLastMessageRef.current = throttle(getLastMessage, 1000);
    }

    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    useEffect(() => {
        getLastMessage(contact.id);
    }, [])



    useEffect(() => {
        const handleNewMessage = (event, contactId) => {
            if (contactId === contact.id) {
                setNewMessageCount((count) => count + 1);
                trollerGetLastMessageRef.current(contactId);
            }
        };
        window.electronAPI.ipcRenderer.on('receive-new-message', handleNewMessage);
        return () => {
            window.electronAPI.ipcRenderer.removeListener('receive-new-message', handleNewMessage);
        };
    }, [contact]);

    return (
        <div key={contact.id} className={`contact-item ${contact.id === selectedContact?.id ? 'selected' : ''}`} onClick={() => handleSelectContact(contact)} >
            <img className='contact-avatar' src={`${serverUrl}/api/avatar/${contact.id}/${contact.type == 'friend' ? 'user' : 'group'}?t=${new Date().getTime()}`} alt='avatar' />
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