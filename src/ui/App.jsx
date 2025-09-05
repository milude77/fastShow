import { useState, useEffect } from 'react';
import { Alert } from 'antd';
import './css/App.css';
import AppHeaderBar from './components/appHeaderBar';
import ContactList from './components/contactList';
import MessageList from './components/messageList';
import ToolBar from './components/toolBar';
import AuthPage from './AuthPage';
import { useAuth } from './hooks/useAuth';
import { useSocket } from './hooks/useSocket';

function App() {
  const [selectFeatures, setSelectFeatures] = useState('message');
  const [selectedContact, setSelectedContact] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connected');
  const [messages, setMessages] = useState({});
  const [drafts, setDrafts] = useState({});
  const [messagePages, setMessagePages] = useState({});
  const [contacts, setContacts] = useState([]);

  const { currentUser, setCurrentUser } = useAuth();
  const socket = useSocket();


  useEffect(() => {
    if (!socket) return;

    const handleLoginSuccess = (user) => {
      window.electronAPI.saveCurrentUserCredentials({ userId: user.userId, userName: user.username, token: user.token ?? user.newToken });
      window.electronAPI.saveUserListCredentials({ userId: user.userId, userName: user.username, token: user.token ?? user.newToken });
      window.electronAPI.loginSuccess(user.userId)
      setCurrentUser(user);
    };

    const handleFriendsList = (friends) => {
      setContacts(friends);
    };

    const friendsRequestAccepted = () => {
      socket.emit('get-friends');
    };

    const handleConnect = () => {
      setConnectionStatus('connected');
      // Re-authenticate and fetch data on successful reconnection
      if (currentUser) {
        socket.emit('login-with-token', currentUser.token);
        socket.emit('get-friends');
      }
    };
    const handleDisconnect = () => setConnectionStatus('disconnected');
    const handleReconnecting = () => setConnectionStatus('reconnecting');

    socket.on('login-success', handleLoginSuccess);
    socket.on('user-registered', handleLoginSuccess);
    socket.on('new-message', handleNewMessage);
    socket.on('friends-list', handleFriendsList);
    socket.on('friend-request-accepted', friendsRequestAccepted);

    // Add the status listeners using the socket context
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('reconnecting', handleReconnecting);

    return () => {
      socket.off('login-success', handleLoginSuccess);
      socket.off('user-registered', handleLoginSuccess);
      socket.off('friends-list', handleFriendsList);
      socket.off('new-message', handleNewMessage);
      socket.off('friend-request-accepted', friendsRequestAccepted);

      // Clean up the status listeners
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('reconnecting', handleReconnecting);
    };
  }, [socket, currentUser ]); // Add currentUser to dependency array

  useEffect(() => {
    if (currentUser && socket) {
      socket.emit('get-friends');
      socket.emit('send-disconnect-message', currentUser);
    }
  }, [currentUser, socket]);

  const handleNewMessage = (msg) => {
    // Safety check: Do not process messages if the user is not logged in.
    if (!currentUser) {
      return;
    }

    const contactId = msg.senderId;


    // When receiving a message from others, save it to local history.
    if (msg.senderId !== currentUser.userId) {
      const newMessage = {
        id: msg.id,
        text: msg.content,
        sender: 'other',
        timestamp: new Date(msg.timestamp).toISOString(),
        username: msg.username
      }
      if (window.electronAPI) {
        window.electronAPI.chatMessage(contactId, currentUser.userId, newMessage);
      }
    }

    setMessages(prev => {
      const contactMessages = prev[contactId] || [];

      return {
        ...prev,
        [contactId]: [...contactMessages, {
          id: msg.id,
          text: msg.content,
          sender: 'other',
          timestamp: msg.timestamp,
          username: contacts
        }]
      };
    });
  };
  const handleSelectContact = async (contact) => {
    setSelectedContact(contact);
    setMessagePages({ [contact.id]: 1 });
    if (window.electronAPI && currentUser) {
      const localHistory = await window.electronAPI.getChatHistory(contact.id, currentUser.userId, 1, 20);
      setMessages(prev => ({ ...prev, [contact.id]: localHistory }));
    }
  };

  const handleSendMessage = (message) => {
    if (selectedContact && currentUser && socket) {
      // Create a temporary message with a unique temporary ID
      const tempId = `temp_${Date.now()}`;
      const newMessage = {
        id: tempId, // Assign temporary ID
        text: message,
        sender: 'user',
        timestamp: new Date().toISOString(),
        username: currentUser.username // Use current user's name for sent messages
      };

      // Add the temporary message to the UI immediately
      setMessages(prev => ({
        ...prev,
        [selectedContact.id]: [...(prev[selectedContact.id] || []), newMessage]
      }));

      if (window.electronAPI) {
        window.electronAPI.chatMessage(selectedContact.id, currentUser.userId, newMessage);
      }

      // Send the message to the server
      socket.emit('send-private-message', { message, receiverId: selectedContact.id });

      // Clear the draft
      setDrafts(prev => ({ ...prev, [selectedContact.id]: '' }));
    }
  };

  const handleDraftChange = (contactId, text) => {
    setDrafts(prev => ({ ...prev, [contactId]: text }));
  };

  const loadMoreMessages = async (contactId) => {
    const currentPage = messagePages[contactId] || 1;
    const nextPage = currentPage + 1;

    if (window.electronAPI && currentUser) {
      const olderMessages = await window.electronAPI.getChatHistory(contactId, currentUser.userId, nextPage, 20);
      if (olderMessages.length > 0) {
        setMessages(prev => ({
          ...prev,
          [contactId]: [...olderMessages, ...prev[contactId]]
        }));
        setMessagePages(prev => ({ ...prev, [contactId]: nextPage }));
      }
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

  const renderConnectionStatus = () => {
    if (connectionStatus === 'disconnected') {
      return <Alert message="已断开连接" type="error" showIcon />;
    }
    if (connectionStatus === 'reconnecting') {
      return <Alert message="正在重新连接..." type="warning" showIcon />;
    }
    return null;
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

  if (!currentUser) {
    return <AuthPage />;
  }

  return (
    <div className="app-wrapper">
      <AppHeaderBar />
      <div className="app">
        <div className='app-features-bar'>
          <ToolBar setSelectFeatures={setSelectFeatures} />
        </div>
        <div className='contact-list'>
          {renderConnectionStatus()}
          {renderFeature()}
        </div>
        <div className='message-box'>
          {renderInformationFunctionBar()}
        </div>
      </div>
    </div>
  );
}

export default App;
