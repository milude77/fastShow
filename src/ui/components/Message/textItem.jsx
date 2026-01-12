import React from 'react';
import { LoadingOutlined, ExclamationCircleOutlined } from '@ant-design/icons';

export default function TextItem({msg, handleResendMessage, contact} ) {
    return (
        <div style={{ display: 'flex', alignItems: 'center' }}>
            {msg.sender === 'user' && (() => {
                switch (msg.status) {
                    case 'sending':
                        return (<span className="message-status"><LoadingOutlined /></span>);
                    case 'fail':
                        return (<span className="message-status" style={{ color: 'red' }} onClick={() => handleResendMessage(contact, msg)}><ExclamationCircleOutlined /></span>);
                }
            })()}
            <div className="message-content">
                <span className="message-text">{msg.text}</span>
            </div>
        </div>
    )
}