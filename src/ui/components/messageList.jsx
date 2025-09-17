import React, { useLayoutEffect, useEffect, useRef, useState } from "react";
import '../css/messageList.css';

const MessageList = ({ contact, messages, draft, onDraftChange, onSendMessage, onLoadMore }) => {
    const messagesEndRef = useRef(null);
    const messageContainerRef = useRef(null);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [prevScrollHeight, setPrevScrollHeight] = useState(null);

    const handleScroll = async () => {
        if (messageContainerRef.current.scrollTop < 1 && !isLoadingMore) { // 更改为 < 1 增加健壮性
            let scrollHeight = messageContainerRef.current.scrollHeight;
            setIsLoadingMore(true);
            await onLoadMore();
            setPrevScrollHeight(scrollHeight);
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
            <div className='history-message-box' ref={messageContainerRef} onScroll={handleScroll}>
                {isLoadingMore && <div className="loading-spinner">Loading...</div>}
                <ul className='message-list'>
                    {messages && messages.map((msg, index) => {
                        const showTimestamp = shouldShowTimestamp(msg.timestamp, messages[index - 1]?.timestamp);
                        // Use a stable and unique key, like msg.id or msg.timestamp
                        const key = msg.id || `${msg.timestamp}-${index}`;
                        return (
                            <React.Fragment key={key}>
                                {showTimestamp && <span className="message-timestamp">{new Date(msg.timestamp).toLocaleTimeString()}</span>}
                                <li className={`message-item ${msg.sender === 'user' ? 'sent' : 'received'}`}>
                                    <span style={{ fontSize:'10px' }}>{msg.username}</span>
                                    <div className="message-content">
                                        <span className="message-text">{msg.text}</span>
                                    </div>
                                </li>
                            </React.Fragment>
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
