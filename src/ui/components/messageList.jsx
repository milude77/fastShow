import React, { useState } from "react";
import '../css/messageList.css';

const MessageList = ({ contact, messages, onSendMessage }) => {
    const [sendedMessage, setSendedMessage] = useState('');

    function sendMessage() {
        if (sendedMessage.trim() !== '') {
            onSendMessage(sendedMessage);
            setSendedMessage(''); // 清空输入框
        }
    }

    const shouldShowTimestamp = (currentTimestamp, previousTimestamp) => {
        if (!previousTimestamp) {
            return true; // Always show for the first message
        }
        const fiveMinutes = 5 * 60 * 1000;
        return new Date(currentTimestamp) - new Date(previousTimestamp) > fiveMinutes;
    };

    return (
        <>
            <div className="message-header">
                <h3>{contact.name}</h3>
            </div>
            <div className='history-message-box'>
                <ul className='message-list'>
                    {messages && messages.map((msg, index) => {
                        const showTimestamp = shouldShowTimestamp(msg.timestamp, messages[index - 1]?.timestamp);
                        return (
                            <>
                                {showTimestamp && <span className="message-timestamp">{new Date(msg.timestamp).toLocaleTimeString()}</span>}
                                <li key={index} className={`message-item ${msg.sender === 'user' ? 'sent' : 'received'}`}>
                                    <div className="message-content">
                                        <span className="message-text">{msg.text}</span>
                                    </div>
                                </li>
                            </>
                        );
                    })}
                </ul>
            </div>
            <div className='message-send-box'>
                <textarea className='message-input-box' type="text" value={sendedMessage} onChange={(e) => setSendedMessage(e.target.value)} />
                <button className='message-send-btn' onClick={sendMessage} >发送</button>
            </div>
        </>
    )
}

export default MessageList;
