import { useState, useEffect } from 'react';
import './css/App.css';
import ContactList from './components/ContactList';
import MessageList from './components/MessageList';
import ToolBar from './components/toolBar';

function App() {
  const [selectFeatures, setSelectFeatures] = useState('message');
  const [selectedContact, setSelectedContact] = useState(null);
  const [messages, setMessages] = useState({});
  const [drafts, setDrafts] = useState({});
  const [messagePages, setMessagePages] = useState({});

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
    setMessagePages(prev => ({ ...prev, [contact.id]: 1 }));
    const history = await window.electronAPI.getChatHistory(contact.id, 1, 20);
    setMessages(prevMessages => ({
      ...prevMessages,
      [contact.id]: history
    }));
  };

  const loadMoreMessages = async (contactId) => {
    const currentPage = messagePages[contactId] || 1;
    const nextPage = currentPage + 1;
    const olderMessages = await window.electronAPI.getChatHistory(contactId, nextPage, 20);

    if (olderMessages.length > 0) {
      setMessages(prev => ({
        ...prev,
        [contactId]: [...olderMessages, ...prev[contactId]]
      }));
      setMessagePages(prev => ({ ...prev, [contactId]: nextPage }));
    }
  };

  const handleSendMessage = (message) => {
    if (selectedContact) {
      const newMessage = {
        text: message,
        sender: 'user',
        timestamp: new Date().toISOString() // 使用 ISO 格式时间戳
      };
      // 只将消息发送到主进程，由 onReply 监听器负责更新UI
      window.electronAPI.sendMessage(selectedContact.id, newMessage);
      // 清除当前联系人的草稿
      setDrafts(prevDrafts => ({
        ...prevDrafts,
        [selectedContact.id]: ''
      }));
    }
  };

  const handleDraftChange = (contactId, text) => {
    setDrafts(prevDrafts => ({
      ...prevDrafts,
      [contactId]: text
    }));
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
      return (
        <MessageList
          contact={selectedContact}
          messages={messages[selectedContact.id]}
          draft={drafts[selectedContact.id] || ''}
          onDraftChange={handleDraftChange}
          onSendMessage={handleSendMessage}
          onLoadMore={() => loadMoreMessages(selectedContact.id)}
        />
      );
    }
    return <div>请选择一个联系人以开始聊天</div>;
  };

  return (
    <div className="app">
      <div className='app-features-bar'>
        <ToolBar selectFeatures={selectFeatures} setSelectFeatures={setSelectFeatures} />
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
