import React, { useState, useEffect } from "react";
import './messageList.css';

const MessageList = () => {
    const [sendedMessage, setSendedMessage] = useState('');
    const [messages, setMessages] = useState([]);

    useEffect(() => {
        const loadHistory = async () => {
            const history = await window.electronAPI.getChatHistory();
            setMessages(history);
        };
        loadHistory();

        const handleReply = (reply) => {
            setMessages(prevMessages => [...prevMessages, reply]);
        };

        window.electronAPI.onReply(handleReply);

        return () => {
            window.electronAPI.removeChatListener();
        };
    }, []);

    function sendMessage() {
        if (sendedMessage.trim() !== '') {
            window.electronAPI.sendMessage(sendedMessage);
            setSendedMessage(''); // 清空输入框
        }
    }

    return (
        <>
            <div className='history-message-box'>
                <ul className='message-list'>
                    {messages.map((msg, index) => (
                        <li key={index} className='message-item'>{msg}</li>
                    ))}
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
