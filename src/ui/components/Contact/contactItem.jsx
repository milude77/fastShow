import React from 'react'
import { useEffect, useState } from 'react'
import './css/contactItem.css'


export default function ContactItem({ contact, selectedContact, handleSelectContact, serverUrl }) {

    const [lastMessage, setLastMessage] = useState({});


    function getLastMessage(contactId) {
        const isGroup = contact.type === 'group';
        window.electronAPI.getLastMessage(contactId, isGroup).then((message) => {
            setLastMessage(message);
        })
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
            if(contactId === contact.id) {
                getLastMessage(contact.id);
            }
        };
        window.electronAPI.ipcRenderer.on('disconnect-messages-sent-success', handleNewMessage);
        return () => {
            window.electronAPI.ipcRenderer.removeListener('disconnect-messages-sent-success', handleNewMessage);
    };
    }, []);

    return (
        <div key={contact.id} className={`contact-item ${contact.id === selectedContact?.id ? 'selected' : ''}`} onClick={() => handleSelectContact(contact)} >
            <img className='contact-avatar' src={`${serverUrl}/api/avatar/${contact.id}/${contact.type == 'friend' ? 'user' : 'group'}?t=${new Date().getTime()}`} alt='avatar' />
            <div className="contact-info-grid">
                <span className="contact-username">{contact.username}</span>
                <span className="contact-message">{lastMessage.username ? `${lastMessage?.username}: ${lastMessage?.text}` : ''}</span>
                <span className="contact-timestamp">{formatTime(lastMessage?.timestamp)}</span>
            </div>
        </div>
    )
}