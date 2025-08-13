import React, { useLayoutEffect, useEffect, useRef, useState } from "react";
import '../css/messageList.css';

const MessageList = ({ contact, messages, draft, onDraftChange, onSendMessage, onLoadMore }) => {
    const messagesEndRef = useRef(null);
    const messageContainerRef = useRef(null);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [prevScrollHeight, setPrevScrollHeight] = useState(null);

    const handleScroll = async () => {
        if (messageContainerRef.current.scrollTop === 0 && !isLoadingMore) {
            setIsLoadingMore(true);
            console.log(messageContainerRef.current.scrollHeight)
            await onLoadMore();
            console.log(messageContainerRef.current.scrollHeight)
            setPrevScrollHeight(messageContainerRef.current.scrollHeight);
            setIsLoadingMore(false);
        }
    };

    useLayoutEffect(() => {
        if (prevScrollHeight) {
            // 正确设置 scrollTop 属性
            messageContainerRef.current.scrollTop = messageContainerRef.current.scrollHeight - prevScrollHeight;
            setPrevScrollHeight(null);
        }
    }, [messages, prevScrollHeight]);


    const lastMessageTimestamp = useRef(messages?.[messages.length - 1]?.timestamp);

    const scrollToBottom = (behavior = "auto") => {
        messagesEndRef.current?.scrollIntoView({ behavior });
    };

    useEffect(() => {
        const newLastMessage = messages?.[messages.length - 1];
        const newLastMessageTimestamp = newLastMessage?.timestamp;

        // Scroll to bottom only if the last message is new, or on initial load.
        if (newLastMessageTimestamp && newLastMessageTimestamp !== lastMessageTimestamp.current) {
            scrollToBottom();
        } else if (messages?.length > 0 && !lastMessageTimestamp.current) {
            scrollToBottom();
        }

        lastMessageTimestamp.current = newLastMessageTimestamp;
    }, [messages]);

    function sendMessage() {
        if (draft.trim() !== '') {
            onSendMessage(draft);
        }
    }

    const handleKeyDown = (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault(); // 阻止默认的回车换行行为
            sendMessage();
        }
    };

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
            <div className='history-message-box' ref={messageContainerRef} onScroll={handleScroll}>
                {isLoadingMore && <div className="loading-spinner">Loading...</div>}
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
                    <div ref={messagesEndRef} />
                </ul>
            </div>
            <div className='message-send-box'>
                <textarea
                    className='message-input-box'
                    type="text"
                    value={draft}
                    onChange={(e) => onDraftChange(contact.id, e.target.value)}
                    onKeyDown={handleKeyDown}
                />
                <button className='message-send-btn' onClick={sendMessage} >发送</button>
            </div>
        </>
    )
}

export default MessageList;
