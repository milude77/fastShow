import React, { useState, useEffect, useCallback } from'react';
import './css/messageInput.css'
import { useTranslation } from 'react-i18next';

const MessageInput = ({ contactID, contactType, onSendMessage, onSendGroupMessage }) => {
    const { t } = useTranslation();
    const [draft, setDraft] = useState('');

    const deDounce = (func, delay) => {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                func.apply(this, args);
            }, delay);
        }
    }

    const saveDraft = deDounce(async(curDraft) => {
        await window.electronAPI.saveMessageDraft(contactID, contactType == 'group', curDraft);
        console.log('save draft')
    }, 100);

    const clearDraft = deDounce(async() => {
        await window.electronAPI.clearMessageDraft(contactID, contactType == 'group')
        console.log('clear draft')
    }, 200);


    const getSavedDraft = useCallback(async() => {
        const savedDraft = await window.electronAPI.getMessageDraft(contactID, contactType == 'group');
        setDraft(savedDraft);
    }, [contactID, contactType]);

    useEffect(() => {
        getSavedDraft()
    },[contactID, contactType, getSavedDraft])

    const handleDraftChange = (event) => {
        setDraft(event.target.value);
        saveDraft(event.target.value);
    };

    const handleSendMessage = (message) => {
        if (message.trim() !== '') {
            if (contactType === 'group') {
                onSendGroupMessage(message);
            } else {
                onSendMessage(message);
            }
            setDraft('');
            clearDraft()
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
            <button className='message-send-btn' onClick={() => handleSendMessage(draft)}>{t('chat.sendMessage')}</button>
        </>
    );
};

export default MessageInput;