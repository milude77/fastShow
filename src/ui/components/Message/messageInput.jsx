import React, { useState, useEffect } from'react';
import './css/messageInput.css'


const MessageInput = ({ contactID, contactType, savedDraft, onDraftChange, onSendMessage, onSendGroupMessage }) => {
    const [draft, setDraft] = useState(savedDraft || '');

    useEffect(() => {
        setDraft(savedDraft || '');
    }, [savedDraft])

    const deDounce = (func, delay) => {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                func.apply(this, args);
            }, delay);
        }
    }

    const handleDraftChange = (event) => {
        setDraft(event.target.value);
        deDounce(onDraftChange(contactID, contactType, event.target.value), 1000);
    };

    const handleSendMessage = (message) => {
        if (message.trim() !== '') {
            if (contactType === 'group') {
                onSendGroupMessage(message);
            } else {
                onSendMessage(message);
            }
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

export default MessageInput;