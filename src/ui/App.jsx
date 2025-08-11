import { useState, useEffect } from 'react';
import './css/App.css';
import ContactList from './components/ContactList';
import MessageList from './components/MessageList';

function App() {
  const [selectFeatures, setSelectFeatures] = useState('message');
  const [selectedContact, setSelectedContact] = useState(null);
  const [messages, setMessages] = useState({});

  const contacts = [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
    { id: 3, name: 'Charlie' },
  ];

  useEffect(() => {
    const removeListener = window.electronAPI.onReply(({ contactId, msg }) => {
      if (selectedContact && contactId === selectedContact.id) {
        setMessages(prevMessages => ({
          ...prevMessages,
          [contactId]: [...(prevMessages[contactId] || []), msg]
        }));
      }
    });
    return () => removeListener();
  }, [selectedContact]);

  const handleSelectContact = async (contact) => {
    setSelectedContact(contact);
    const history = await window.electronAPI.getChatHistory(contact.id);
    setMessages(prevMessages => ({
      ...prevMessages,
      [contact.id]: history
    }));
  };

  const handleSendMessage = (message) => {
    if (selectedContact) {
      const newMessage = {
        text: message,
        sender: 'user',
        timestamp: new Date().toDateString() // 使用 ISO 格式时间戳
      };
      // 只将消息发送到主进程，由 onReply 监听器负责更新UI
      window.electronAPI.sendMessage(selectedContact.id, newMessage);
    }
  };

  const renderFeature = () => {
    switch (selectFeatures) {
      case 'contact':
      case 'message':
        return <ContactList contacts={contacts} onSelectContact={handleSelectContact} />;
      default:
        return <div>默认列表</div>;
    }
  };

  const renderInformationFunctionBar = () => {
    if (selectFeatures === 'message' && selectedContact) {
      return <MessageList contact={selectedContact} messages={messages[selectedContact.id]} onSendMessage={handleSendMessage} />;
    }
    return <div>请选择一个联系人以开始聊天</div>;
  };

  return (
    <div className="app">
      <div className='app-features-bar'>
        <button onClick={() => setSelectFeatures('message')}>消息</button>
        <button onClick={() => setSelectFeatures('contact')}>联系人</button>
      </div>
      <div className='contact-list'>
        {renderFeature()}
      </div>
      <div className='message-box'>
        {renderInformationFunctionBar()}
      </div>
    </div>
  );
}

export default App;
